const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../sammi_db_backup2/sammi.db');
const db = new sqlite3.Database(dbPath);

console.log("Reading from:", dbPath);

db.all("SELECT part_id, quantity FROM inventory WHERE part_id LIKE '하이랙-%기둥%' ORDER BY part_id", [], (err, rows) => {
    if (err) {
        console.error("Error reading DB:", err);
        return;
    }
    console.log(`Found ${rows.length} High Rack Pillars in Backup:`);
    rows.forEach(row => {
        console.log(`${row.part_id}`);
    });
});

db.close();
