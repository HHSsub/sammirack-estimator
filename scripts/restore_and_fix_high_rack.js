
const path = require('path');
const fs = require('fs');

/*
 * REPAIR SCRIPT: High Rack Migration Fix
 * 1. Restores `inventory` and `admin_prices` from backups.
 * 2. Correctly migrates IDs by ONLY removing depth dimension (preserving prefixes).
 * 3. Sums up quantities correctly.
 */

// SQLite3 Module Loading
let sqlite3;
try {
    sqlite3 = require('sqlite3').verbose();
} catch (e1) {
    try {
        const apiModulePath = path.resolve(__dirname, '../sammirack-api/node_modules/sqlite3');
        if (fs.existsSync(apiModulePath)) {
            sqlite3 = require(apiModulePath).verbose();
        } else {
            throw new Error('Module not found in sammirack-api');
        }
    } catch (e2) {
        try {
            const parentModulePath = path.resolve(__dirname, '../node_modules/sqlite3');
            if (fs.existsSync(parentModulePath)) {
                sqlite3 = require(parentModulePath).verbose();
            } else {
                throw new Error('Module not found in parent');
            }
        } catch (e3) {
            console.error('❌ sqlite3 module not found.');
            process.exit(1);
        }
    }
}

const DB_PATH = '/home/rocky/db/sammi.db'; // Adjust if needed

if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database file not found: ${DB_PATH}`);
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function restoreAndMigrate() {
    try {
        await run('BEGIN TRANSACTION');

        console.log('🔄 1. Restoring tables from backup...');

        // Restore Inventory
        const backupCheck = await all("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_backup_depth_unification'");
        if (backupCheck.length === 0) {
            throw new Error('❌ Inventory backup table (inventory_backup_depth_unification) does not exist! Cannot restore.');
        }

        await run("DROP TABLE IF EXISTS inventory");
        await run("CREATE TABLE inventory AS SELECT * FROM inventory_backup_depth_unification");
        console.log('   ✅ Inventory table restored from backup.');


        // Restore Admin Prices
        const priceBackupCheck = await all("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_prices_backup_depth_unification'");
        // If original backup exists, use it. If not, try v2 or warn.
        if (priceBackupCheck.length > 0) {
            await run("DROP TABLE IF EXISTS admin_prices");
            await run("CREATE TABLE admin_prices AS SELECT * FROM admin_prices_backup_depth_unification");
            console.log('   ✅ Admin Prices table restored from backup.');
        } else {
            const v2Check = await all("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_prices_backup_depth_unification_v2'");
            if (v2Check.length > 0) {
                await run("DROP TABLE IF EXISTS admin_prices");
                await run("CREATE TABLE admin_prices AS SELECT * FROM admin_prices_backup_depth_unification_v2");
                console.log('   ✅ Admin Prices table restored from backup V2.');
            } else {
                console.warn('⚠️ Admin Prices backup table not found. Skipping restore for admin_prices.');
            }
        }


        console.log('🔄 2. Starting Correct Migration...');

        // --- Inventory Migration (Complex IDs) ---
        // Inventory must PRESERVE the full ID structure (color, type, etc) and ONLY remove depth.
        console.log('   Processing Inventory...');
        const inventoryRows = await all("SELECT * FROM inventory WHERE part_id LIKE '하이랙-%'");
        const inventoryMap = new Map(); // newId -> quantity
        const idsToDelete = [];

        // Regex: ...[Size W]x[Depth][Height H]... -> ...[Size W]x[Height H]...
        const regex = /(사이즈\d+)x\d+(높이)/;

        for (const row of inventoryRows) {
            const match = row.part_id.match(regex);

            // Only process items that match the "Square" format (High Rack Pillars)
            if (match) {
                // Correctly remove ONLY the depth number, preserving everything else
                const newId = row.part_id.replace(regex, '$1x$2');

                const currentQty = inventoryMap.get(newId) || 0;
                inventoryMap.set(newId, currentQty + row.quantity);
                idsToDelete.push(row.part_id);
            }
        }

        console.log(`   Inventory: Found ${idsToDelete.length} items to migrate.`);

        // Delete old IDs
        for (const id of idsToDelete) {
            await run("DELETE FROM inventory WHERE part_id = ?", [id]);
        }

        // Insert/Update new IDs
        for (const [newId, qty] of inventoryMap) {
            const existing = await all("SELECT quantity FROM inventory WHERE part_id = ?", [newId]);
            if (existing.length > 0) {
                const newTotal = existing[0].quantity + qty;
                await run("UPDATE inventory SET quantity = ?, updated_at = datetime('now', 'localtime') WHERE part_id = ?", [newTotal, newId]);
            } else {
                await run("INSERT INTO inventory (part_id, quantity, updated_at) VALUES (?, ?, datetime('now', 'localtime'))", [newId, qty]);
            }
        }
        console.log('   ✅ Inventory Migration Completed.');


        // --- Admin Prices Migration (Simple IDs for Pillars) ---
        // Admin Prices for pillars should be normalized to '하이랙-기둥-...' to match CSV.
        console.log('   Processing Admin Prices...');
        const priceRows = await all("SELECT * FROM admin_prices WHERE part_id LIKE '하이랙-기둥%' OR part_id LIKE '하이랙-%기둥%'");
        const priceMap = new Map();
        const priceIdsToDelete = [];

        for (const row of priceRows) {
            const match = row.part_id.match(regex);

            // Should match Pillars with Depth
            if (match) {
                // Standardize ID: Remove color/type info from key, keep only '하이랙-기둥-' + Size
                // Extract the "Size..." part from the match. 
                // The replacement '$1x$2' gives e.g. "사이즈60x높이2100".
                // We append the rest of the string? NO.
                // The user's CSV (Simple ID) is: '하이랙-기둥-사이즈Wx높이HWeight'
                // But wait, the weight is usually at the end.
                // Let's rely on the regex match to extract W and H.

                // Let's parse strictly to match CSV format: '하이랙-기둥-사이즈{W}x높이{H}{Weight}'
                // The regex `/(사이즈\d+)x\d+(높이)/` captures W and '높이'.
                // We need to capture the rest (Weight/Suffix) too.

                const fullRegex = /사이즈(\d+)x\d+높이(\d+)(.*)/;
                const fullMatch = row.part_id.match(fullRegex);

                if (fullMatch) {
                    const width = fullMatch[1];
                    const height = fullMatch[2];
                    const suffix = fullMatch[3]; // e.g. "270kg" or " 270kg"

                    // Construct Simple ID
                    const newId = `하이랙-기둥-사이즈${width}x높이${height}${suffix}`;

                    if (!priceMap.has(newId)) {
                        priceMap.set(newId, {
                            ...row,
                            part_id: newId,
                            timestamp: new Date().toISOString()
                        });
                    }
                    priceIdsToDelete.push(row.part_id);
                }
            }
        }

        console.log(`   Admin Prices: Found ${priceIdsToDelete.length} items to migrate.`);

        for (const id of priceIdsToDelete) {
            await run("DELETE FROM admin_prices WHERE part_id = ?", [id]);
        }

        const insertSql = `
            INSERT OR REPLACE INTO admin_prices 
            (part_id, price, timestamp, account, rack_type, name, specification, original_price, display_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const [newId, data] of priceMap) {
            await run(insertSql, [
                newId,
                data.price,
                data.timestamp,
                data.account || 'api',
                data.rack_type,
                data.name,
                data.specification,
                data.original_price,
                data.display_name
            ]);
        }
        console.log('   ✅ Admin Prices Migration Completed.');

        await run('COMMIT');
        console.log('✅ REPAIR AND MIGRATION SUCCESSFUL.');

    } catch (err) {
        console.error('❌ Error during restore/migration:', err);
        await run('ROLLBACK');
        process.exit(1);
    } finally {
        db.close();
    }
}

restoreAndMigrate();
