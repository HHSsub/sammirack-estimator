const fs = require('fs');
const path = require('path');

// 1. Try to load sqlite3
let sqlite3;
try {
    sqlite3 = require('sqlite3').verbose();
} catch (e) {
    console.error("❌ Error: 'sqlite3' module not found.");
    console.error("👉 Please run: npm install sqlite3");
    process.exit(1);
}

// 2. Determine Database Path (Server Production Environment)
// User script is likely in /home/rocky/scripts/ or /home/rocky/sammirack-estimator/scripts/
// Live DB is usually in /home/rocky/sammirack-api/data/sammi.db OR /home/rocky/sammirack-estimator/sammi.db?
// Based on previous chats, the backend is 'sammirack-api'.
// Let's try to resolve relative to a common structure or argument.

const possiblePaths = [
    path.join(process.cwd(), 'sammi.db'), // If run from root where db is
    path.join(__dirname, '../sammi.db'), // If run from scripts/
    path.join(__dirname, '../sammirack-api/data/sammi.db'), // If standard backend structure
    path.join(__dirname, '../../sammirack-api/data/sammi.db'), // If deeper
    '/home/rocky/sammirack-api/data/sammi.db', // Absolute guess based on username
    path.join(__dirname, '../sammi_db_backup2/sammi.db') // Local backup (fallback)
];

let dbPath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        dbPath = p;
        break;
    }
}

if (!dbPath) {
    console.error("❌ Could not find 'sammi.db' in likely locations.");
    console.error("👉 Please specify DB path as argument: node fix_high_rack_server.js <path_to_db>");
    console.error("Checked candidates:", possiblePaths);
    process.exit(1);
}

// Check for explicit argument override
if (process.argv[2]) {
    dbPath = process.argv[2];
}

console.log(`🚀 High Rack Restoration (Server Mode) - Targeting DB: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Delete Invalid IDs (WxD Removal)
    console.log("🗑️ Deleting invalid IDs (Cleaning High Rack Pillars)...");

    // Safety: Delete all High Rack Pillars to prevent duplicates/ghosts
    db.run("DELETE FROM inventory WHERE part_id LIKE '하이랙-기둥%'");
    db.run("DELETE FROM inventory WHERE part_id LIKE '하이랙-메트그레이기둥-%'");

    // 2. Define Variants (Wx Only strict mode)
    const variants = [
        // Met Gray 270kg: 45, 60
        { color: '메트그레이', weight: '270kg', widths: ['45', '60'] },
        // Met Gray 450kg: 60 Only
        { color: '메트그레이', weight: '450kg', widths: ['60'] },

        // Blue+Orange 270kg: 45, 60
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

    let processedCount = 0;

    variants.forEach(variant => {
        variant.widths.forEach(width => { // e.g. "60"
            heights.forEach(height => {
                let partId = '';

                // DB ID Format: 하이랙-기둥[Color](볼트식)[Weight]-사이즈[Width]x높이[Height][Weight]
                // Correct Wx format: sizes "60x" (no depth)
                const sizePart = `사이즈${width}x`;

                if (variant.color === '메트그레이') {
                    partId = `하이랙-기둥메트그레이(볼트식)${variant.weight}-${sizePart}높이${height}${variant.weight}`;
                } else if (variant.color.includes('블루')) {
                    partId = `하이랙-기둥블루(기둥)+오렌지(가로대)(볼트식)${variant.weight}-${sizePart}높이${height}${variant.weight}`;
                } else if (variant.color === '아이보리') {
                    partId = `하이랙-기둥아이보리(볼트식)${variant.weight}-${sizePart}높이${height}${variant.weight}`;
                }

                stmt.run(partId);
                processedCount++;
            });
        });
    });

    stmt.finalize();
    console.log(`✅ DB Update Complete. Restored ${processedCount} Unified High Rack Pillars.`);
});

db.close();
