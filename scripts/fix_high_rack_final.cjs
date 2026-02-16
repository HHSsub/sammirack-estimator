const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// USER INSTRUCTION: Use production DB if running on server, or local backup if testing.
// For this script, we default to the local SAMMI DB path or allow override.
// Given User said "No backup on server", we should target the main DB file if implied logic suggests so.
// However, to be safe and consistent with previous turns, we use the relative path that was working, 
// BUT we acknowledge we are fixing the "Current State".
const dbPath = path.join(__dirname, '../sammi_db_backup2/sammi.db');
// NOTE: If running on server, user should adjust this or we supply a separate command. 
// But User said "Give me a command to upload it". So we fix LOCAL first.

const csvPath = path.join(__dirname, '../public/all_materials_list_v2.csv');
const db = new sqlite3.Database(dbPath);

console.log("🚀 High Rack Final Restoration & Sync Script (Wx Only strict mode)");
console.log("Database:", dbPath);

function readCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8').split('\n');
}

db.serialize(() => {
    // 1. Delete Invalid IDs (Including the WxD ones we just wrongly added)
    console.log("🗑️ Deleting invalid IDs...");

    // Delete WxD format patterns we might have created: e.g. "사이즈60x108높이"
    // Regex for WxD in SQLite is tricky, but we can target specific known patterns or LIKE
    db.run("DELETE FROM inventory WHERE part_id LIKE '%사이즈%x%높이%' AND part_id NOT LIKE '%사이즈%x높이%'");
    // The correct format is "사이즈Wx높이" (e.g. 60x높이). 
    // The wrong format is "사이즈WxD높이" (e.g. 60x108높이).
    // So if it has "x" before "높이" AND another "x" or digit... wait.
    // "60x높이" -> "x" follows digits.
    // "60x108높이" -> "x" follows digits AND "108" follows "x".

    // Simpler: Delete all High Rack Columns and Re-insert correctly.
    // This is safer.
    db.run("DELETE FROM inventory WHERE part_id LIKE '하이랙-기둥%'");
    db.run("DELETE FROM inventory WHERE part_id LIKE '하이랙-메트그레이기둥-%'"); // Old bad pattern

    // 2. Define Variants (Wx Only logic)
    // We only need the WIDTH (profile) for the Column ID.
    // Depth is irrelevant for the Column ID as per user instruction.

    const variants = [
        // Met Gray 270kg: 45, 60
        { color: '메트그레이', weight: '270kg', widths: ['45', '60'] },
        // Met Gray 450kg: 60 Only
        { color: '메트그레이', weight: '450kg', widths: ['60'] },

        // Blue+Orange 270kg: 45, 60
        // ID format: 하이랙-기둥블루(기둥)+오렌지(가로대)(볼트식)270kg-사이즈45x높이150270kg
        { color: '블루(기둥)+오렌지(가로대)', weight: '270kg', widths: ['45', '60'] },
        // Blue+Orange 450kg: 60 Only
        { color: '블루(기둥)+오렌지(가로대)', weight: '450kg', widths: ['60'] },
        // Blue+Orange 600kg: 80 Only
        { color: '블루(기둥)+오렌지(가로대)', weight: '600kg', widths: ['80'] },

        // Ivory 270kg: 60 Only
        { color: '아이보리', weight: '270kg', widths: ['60'] },
        // Ivory 450kg: 60 Only
        { color: '아이보리', weight: '450kg', widths: ['60'] }
    ];

    const heights = ['150', '200', '250'];
    const stmt = db.prepare("INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at) VALUES (?, 0, datetime('now'))");

    let csvRows = [];
    let processedCount = 0;

    variants.forEach(variant => {
        variant.widths.forEach(width => { // e.g. "60"
            heights.forEach(height => {
                let partId = '';
                let csvName = '';
                let csvSpec = '';
                // DB ID Format: 하이랙-기둥[Color](볼트식)[Weight]-사이즈[Width]x높이[Height][Weight]
                // Note: "x" is kept after width, but NO Depth. e.g. "60x높이" matches "Wx" rule. 
                // Check if user wants "60x" or "60". 
                // User said: "Wx만 쓴다했잖아". "Wx" usually implies "60x".
                // Previous valid IDs in DB (from user logs Step 487):
                // `하이랙-기둥메트그레이-사이즈60x높이200270kg` (Wait, user listed this in SQL output).
                // Let's verify that log again.
                // Step 487 SQL: `하이랙-기둥메트그레이-사이즈60x높이200270kg`.
                // YES. This ID has `60x` and `높이`. NO Depth.
                // So my target is `사이즈${width}x높이${height}`.

                const sizePart = `사이즈${width}x`;

                if (variant.color === '메트그레이') {
                    partId = `하이랙-기둥메트그레이(볼트식)${variant.weight}-${sizePart}높이${height}${variant.weight}`;
                    csvName = `기둥(메트그레이)`;
                } else if (variant.color.includes('블루')) {
                    partId = `하이랙-기둥블루(기둥)+오렌지(가로대)(볼트식)${variant.weight}-${sizePart}높이${height}${variant.weight}`;
                    csvName = `기둥(블루)`;
                } else if (variant.color === '아이보리') {
                    partId = `하이랙-기둥아이보리(볼트식)${variant.weight}-${sizePart}높이${height}${variant.weight}`;
                    csvName = `기둥(아이보리)`;
                }

                // CSV Spec: "사이즈 60x 높이 150 270kg"
                csvSpec = `사이즈 ${width}x 높이 ${height} ${variant.weight}`;

                stmt.run(partId);

                // CSV Row
                csvRows.push(`${partId},하이랙,${csvName},${csvSpec},0,하이랙 ${csvName} ${csvSpec},migration,`);
                processedCount++;
            });
        });
    });

    stmt.finalize();
    console.log(`✅ Database actions completed. Processed ${processedCount} unified variants.`);

    // 3. Rewrite CSV
    const lines = readCSV(csvPath);
    if (lines.length > 0) {
        const header = lines[0];
        const otherRows = lines.slice(1).filter(line => {
            if (!line.trim()) return false;
            const cols = line.split(',');
            const id = cols[0];
            const type = cols[1];
            const name = cols[2];

            // Remove ALL High Rack Pillars (to replace with unified ones)
            if (type === '하이랙' && name && name.includes('기둥')) return false;
            if (id && id.includes('하이랙') && id.includes('기둥')) return false;

            return true;
        });

        console.log(`ℹ️ Retained ${otherRows.length} non-pillar rows from existing CSV.`);

        const newContent = [header.trim(), ...otherRows, ...csvRows].join('\n');
        fs.writeFileSync(csvPath, newContent, 'utf8');
        console.log(`✅ CSV Updated: Added ${csvRows.length} Unified High Rack Pillar rows.`);
    } else {
        console.error("❌ Failed to read existing CSV!");
    }
});

db.close();
