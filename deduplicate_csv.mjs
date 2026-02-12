import fs from 'fs';
import path from 'path';

const csvPath = 'c:\\Users\\User\\Downloads\\sammi\\sammirack-estimator\\public\\all_materials_list_v2.csv';

function normalizeHighRackColumnSpec(spec) {
    if (!spec) return '';
    return spec.replace(/(\d+)x\d+/, '$1x');
}

function processCsv() {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    const headers = lines[0];
    const newLines = [headers];
    const processedIds = new Set();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');

        // Target High Rack Columns (하이랙-기둥)
        // Check PartId (col 0) starts with '하이랙-' and parts[2] (부품명) includes '기둥'
        if (parts[1] === '하이랙' && parts[2].includes('기둥')) {
            const originalSpec = parts[3];
            const unifiedSpec = normalizeHighRackColumnSpec(originalSpec);

            // Update Spec
            parts[3] = unifiedSpec;

            // Update PartId (col 0) - regenerate based on unified spec
            // Regex to find size like 45x108 in ID
            parts[0] = parts[0].replace(/사이즈(\d+)x\d+/, '사이즈$1x');

            // Also update Display Name (col 5) if it has depth
            parts[5] = parts[5].replace(/사이즈\s*(\d+)x\d+/, '사이즈 $1x');

            const newId = parts[0];
            if (processedIds.has(newId)) {
                console.log(`Skipping duplicate: ${newId}`);
                continue;
            }
            processedIds.add(newId);
            newLines.push(parts.join(','));
        } else {
            newLines.push(line);
        }
    }

    fs.writeFileSync(csvPath, newLines.join('\n') + '\n', 'utf8');
    console.log('CSV processed successfully.');
}

processCsv();
