const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🔄 데이터 마이그레이션 시작...\n');

// JSON 파일 로드
const dataDir = path.join(__dirname, 'data');

// 0. 스키마 마이그레이션 (컬럼 추가)
async function migrateSchema() {
  console.log('🛠 0/4: DB 스키마 업데이트 (deleted 컬럼 추가)...');
  try {
    // 컬럼 추가 시도 (이미 존재하면 에러나므로 catch로 무시)
    try { await db.run('ALTER TABLE documents ADD COLUMN deleted INTEGER DEFAULT 0'); } catch (e) { }
    try { await db.run('ALTER TABLE documents ADD COLUMN deleted_at TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE documents ADD COLUMN deleted_by TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE documents ADD COLUMN type TEXT'); } catch (e) { }
    console.log('✅ 스키마 업데이트 완료');
  } catch (error) {
    console.error('⚠️ 스키마 업데이트 중 오류 (무시 가능):', error.message);
  }
}

// 1. inventory 마이그레이션
async function migrateInventory() {
  console.log('📦 1/4: inventory 마이그레이션 시작...');
  if (!fs.existsSync(path.join(dataDir, 'inventory.json'))) {
    console.log('⚠️ inventory.json 없음. 건너뜀.');
    return;
  }
  const inventory = JSON.parse(fs.readFileSync(path.join(dataDir, 'inventory.json'), 'utf8'));

  const now = new Date().toISOString();
  let count = 0;

  for (const [partId, quantity] of Object.entries(inventory)) {
    await db.run(`
      INSERT OR REPLACE INTO inventory (part_id, quantity, updated_at, updated_by)
      VALUES (?, ?, ?, ?)
    `, [partId, quantity, now, 'migration']);
    count++;
  }

  console.log(`✅ inventory 마이그레이션 완료: ${count}건\n`);
}

// 2. admin_prices 마이그레이션
async function migrateAdminPrices() {
  console.log('💰 2/4: admin_prices 마이그레이션 시작...');
  if (!fs.existsSync(path.join(dataDir, 'admin_prices.json'))) {
    console.log('⚠️ admin_prices.json 없음. 건너뜀.');
    return;
  }
  const adminPrices = JSON.parse(fs.readFileSync(path.join(dataDir, 'admin_prices.json'), 'utf8'));

  let count = 0;

  for (const [partId, data] of Object.entries(adminPrices)) {
    const pi = data.partInfo || {};
    await db.run(`
      INSERT OR REPLACE INTO admin_prices 
      (part_id, price, timestamp, account, rack_type, name, specification, original_price, display_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      partId,
      data.price,
      data.timestamp,
      data.account,
      pi.rackType || null,
      pi.name || null,
      pi.specification || null,
      pi.originalPrice || null,
      pi.displayName || null
    ]);
    count++;
  }

  console.log(`✅ admin_prices 마이그레이션 완료: ${count}건\n`);
}

// 3. documents 마이그레이션
async function migrateDocuments() {
  console.log('📄 3/4: documents 마이그레이션 시작...');
  if (!fs.existsSync(path.join(dataDir, 'documents.json'))) {
    console.log('⚠️ documents.json 없음. 건너뜀.');
    return;
  }
  const documents = JSON.parse(fs.readFileSync(path.join(dataDir, 'documents.json'), 'utf8'));

  let count = 0;
  const now = new Date().toISOString();

  for (const [docId, doc] of Object.entries(documents)) {
    // ID 정규화 (.0 제거)
    let cleanDocId = docId;
    if (typeof cleanDocId === 'string' && cleanDocId.endsWith('.0')) {
      cleanDocId = cleanDocId.replace('.0', '');
    }

    await db.run(`
      INSERT OR REPLACE INTO documents 
      (doc_id, type, date, document_number, company_name, biz_number, items, materials, 
       subtotal, tax, total_amount, notes, top_memo, created_at, updated_at,
       deleted, deleted_at, deleted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanDocId,
      doc.type || null,
      doc.date,
      doc.documentNumber || null,
      doc.companyName || null,
      doc.bizNumber || null,
      JSON.stringify(doc.items || []),
      JSON.stringify(doc.materials || []),
      doc.subtotal || 0,
      doc.tax || 0,
      doc.totalAmount || 0,
      doc.notes || null,
      doc.topMemo || null,
      now,
      now,
      doc.deleted ? 1 : 0,
      doc.deletedAt || null,
      doc.deletedBy ? JSON.stringify(doc.deletedBy) : null
    ]);
    count++;
  }

  console.log(`✅ documents 마이그레이션 완료: ${count}건\n`);
}

// 4. activity_log 마이그레이션
async function migrateActivityLog() {
  console.log('📊 4/4: activity_log 마이그레이션 시작...');
  if (!fs.existsSync(path.join(dataDir, 'activity_log.json'))) {
    console.log('⚠️ activity_log.json 없음. 건너뜀.');
    return;
  }
  const activityLog = JSON.parse(fs.readFileSync(path.join(dataDir, 'activity_log.json'), 'utf8'));

  let count = 0;

  for (const log of activityLog) {
    await db.run(`
      INSERT INTO activity_log 
      (timestamp, action, user_ip, data_types, document_count, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      log.timestamp,
      log.action,
      log.userIP || null,
      JSON.stringify(log.dataTypes || []),
      log.documentCount || null,
      JSON.stringify(log)
    ]);
    count++;
  }

  console.log(`✅ activity_log 마이그레이션 완료: ${count}건\n`);
}

// 전체 마이그레이션 실행
async function runMigration() {
  try {
    await migrateSchema(); // ✅ 스키마 업데이트 먼저 실행
    await migrateInventory();
    await migrateAdminPrices();
    await migrateDocuments();
    await migrateActivityLog();

    console.log('===========================================');
    console.log('🎉 전체 마이그레이션 완료!');
    console.log('===========================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

runMigration();
