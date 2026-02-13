const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../sammi.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking schema for:', dbPath);

db.serialize(() => {
    console.log('\n--- inventory Table ---');
    db.all("PRAGMA table_info(inventory)", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });

    console.log('\n--- admin_prices Table ---');
    db.all("PRAGMA table_info(admin_prices)", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });
});

db.close();
