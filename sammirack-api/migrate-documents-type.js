/**
 * One-time migration: add `type` column to documents table.
 * Safe: nullable, no existing data modified.
 * Run once: node migrate-documents-type.js
 */
const db = require('./db');

async function migrate() {
  try {
    const row = await db.get(
      "SELECT name FROM pragma_table_info('documents') WHERE name = 'type'"
    );
    if (row) {
      console.log('✅ documents.type column already exists. Skipping.');
      process.exit(0);
      return;
    }
    await db.run('ALTER TABLE documents ADD COLUMN type TEXT');
    console.log('✅ documents.type column added.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
