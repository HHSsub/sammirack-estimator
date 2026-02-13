import fs from 'fs';
import path from 'path';
import { generatePartId } from './src/utils/unifiedPriceManager.js';

const CSV_PATH = './public/all_materials_list_v2.csv';

// Helper to parse CSV (Basic)
const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Handle quoted fields rudimentary (assuming standard quoted CSV)
        const values = [];
        let current = '';
        let inQuote = false;
        for (const char of line) {
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx] || '');
        result.push(row);
    }
    return { headers, rows: result };
};

// Helper to stringify CSV
const stringifyCSV = (headers, rows) => {
    const headerLine = headers.join(',');
    const lines = rows.map(row => {
        return headers.map(h => {
            let val = row[h] || '';
            if (val.includes(',') || val.includes('"')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',');
    });
    return [headerLine, ...lines].join('\n');
};

console.log(`Reading ${CSV_PATH}...`);
if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV file not found!");
    process.exit(1);
}

const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
const { headers, rows } = parseCSV(csvText);

console.log(`Total rows: ${rows.length}`);

// Filter High Rack Columns
let updatedRows = [];
const processedIds = new Set();
let modifiedCount = 0;
let removedCount = 0;

rows.forEach(row => {
    const rackType = row['랙타입'];
    const name = row['부품명'];
    const spec = row['규격'];

    if (rackType === '하이랙' && name.includes('기둥')) {
        // Generate NEW PartId (Depth Ignored)
        const mockItem = {
            rackType: '하이랙',
            name: '기둥', // force base name for generator
            specification: spec
        };
        const newPartId = generatePartId(mockItem);
        // Note: generatePartId calls cleanSpec which removes depth.
        // But wait, generatePartId returns `하이랙-기둥-사이즈60x높이...`.
        // The CSV might contain many variations (60x108, 60x150, 60x200).
        // They will ALL map to `하이랙-기둥-사이즈60x높이...`.

        // Check if we already have this new PartId
        // IF we do, we SKIP this row (Deduplication)
        // IF we don't, we update this row's PartId and Specification (maybe?) and keep it.

        if (processedIds.has(newPartId)) {
            // Already have a representative for "60x H..."
            removedCount++;
            return; // Skip (Remove)
        }

        // First encounter of this unified ID. Update the row.
        row['부품ID'] = newPartId;
        // Also update Spec to be generic? User said "60x108 -> 60x" in ID.
        // Should user see "60x" in spec? Probably yes for consistency.
        // "규격표시할때 60x108 이런거 안쓸거라고"
        row['규격'] = spec.replace(/사이즈\s*(\d+)x\d+/, '사이즈 $1x');

        processedIds.add(newPartId);
        modifiedCount++;
        updatedRows.push(row);
    } else {
        // Keep other rows as is
        // But check if they conflict with any new IDs? Unlikely.
        // Just verify unique ID constraint generally?
        const pid = row['부품ID'];
        if (pid && processedIds.has(pid) && rackType === '하이랙') {
            // If a High Rack item has same ID as one we just unified?
            // Unlikely unless CSV was already unified.
        }
        if (pid) processedIds.add(pid);

        updatedRows.push(row);
    }
});

console.log(`Modified (Unified) High Rack Columns: ${modifiedCount}`);
console.log(`Removed (Duplicate) High Rack Columns: ${removedCount}`);
console.log(`Total Result Rows: ${updatedRows.length}`);

// Write Back
const newCsvText = stringifyCSV(headers, updatedRows);
fs.writeFileSync(CSV_PATH, newCsvText, 'utf-8');
console.log("CSV Updated Successfully.");
