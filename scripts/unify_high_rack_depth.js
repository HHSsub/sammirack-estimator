// scripts/unify_high_rack_depth.js
// 하이랙 기둥 Depth 통합 마이그레이션 스크립트 (SQLite3 대응)
// 사용법: node scripts/unify_high_rack_depth.js [DB_PATH]
// 기본 DB_PATH: /home/rocky/db/sammi.db

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 환경 변수 또는 인자에서 DB 경로 확인
const DB_PATH = process.argv[2] || process.env.DB_PATH || '/home/rocky/db/sammi.db';

if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ 데이터베이스 파일을 찾을 수 없습니다: ${DB_PATH}`);
    process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);

console.log(`📦 하이랙 기둥 Depth 통합 마이그레이션 시작...`);
console.log(`📂 대상 DB: ${DB_PATH}`);

// Promise 래퍼
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

async function migrate() {
    try {
        await run('BEGIN TRANSACTION');

        // 1. Inventory 테이블 백업
        console.log('1. Inventory 테이블 백업 생성 중...');
        await run(`CREATE TABLE IF NOT EXISTS inventory_backup_depth_unification AS SELECT * FROM inventory`);
        console.log('   ✅ inventory_backup_depth_unification 생성 완료');

        // 2. Inventory 데이터 조회 및 통합 계산
        console.log('2. Inventory 데이터 통합 계산 중...');
        const inventoryRows = await all("SELECT * FROM inventory WHERE part_id LIKE '하이랙-기둥%'");
        const inventoryMap = new Map(); // newId -> totalQuantity
        const inventoryIdsToDelete = [];

        // 정규식: ...사이즈(너비)x(깊이)높이...
        // 예: 하이랙-기둥-사이즈60x108높이2100... -> 하이랙-기둥-사이즈60x높이2100...
        const regex = /(사이즈\d+)x\d+(높이)/;

        for (const row of inventoryRows) {
            const match = row.part_id.match(regex);
            if (match) {
                // 매치되면 Depth 제거한 ID 생성
                const newId = row.part_id.replace(regex, '$1x$2');
                const currentQty = inventoryMap.get(newId) || 0;
                inventoryMap.set(newId, currentQty + row.quantity);
                inventoryIdsToDelete.push(row.part_id);
            }
        }

        console.log(`   ✅ 통합 대상: ${inventoryIdsToDelete.length}개 항목 -> ${inventoryMap.size}개로 통합`);

        // 3. Inventory 데이터 업데이트/삭제
        for (const id of inventoryIdsToDelete) {
            await run("DELETE FROM inventory WHERE part_id = ?", [id]);
        }

        for (const [newId, qty] of inventoryMap) {
            // 기존에 newId가 있을 수 있으므로 Upsert 로직 (quantity 더하기)
            // SQLite는 ON CONFLICT 사용 가능하나 버전 따라 다르므로 조회 후 처리 안전하게
            const existing = await all("SELECT quantity FROM inventory WHERE part_id = ?", [newId]);
            if (existing.length > 0) {
                await run("UPDATE inventory SET quantity = quantity + ? WHERE part_id = ?", [qty, newId]);
            } else {
                await run("INSERT INTO inventory (part_id, quantity) VALUES (?, ?)", [newId, qty]);
            }
        }
        console.log('   ✅ Inventory 테이블 마이그레이션 완료');


        // 4. Admin Prices 테이블 백업
        console.log('3. Admin Prices 테이블 백업 생성 중...');
        await run(`CREATE TABLE IF NOT EXISTS admin_prices_backup_depth_unification AS SELECT * FROM admin_prices`);
        console.log('   ✅ admin_prices_backup_depth_unification 생성 완료');


        // 5. Admin Prices 데이터 조회 및 통합 계산
        console.log('4. Admin Prices 데이터 통합 계산 중...');
        const priceRows = await all("SELECT * FROM admin_prices WHERE part_id LIKE '하이랙-기둥%'");
        const priceMap = new Map(); // newId -> { price, updated_at }
        const priceIdsToDelete = [];

        for (const row of priceRows) {
            const match = row.part_id.match(regex);
            if (match) {
                const newId = row.part_id.replace(regex, '$1x$2');
                // 가격은 임의로 하나 선택 (여기서는 덮어쓰기 -> 마지막에 처리된 것 기준)
                // 혹은 기존에 가격이 있으면 유지? 사용자 요구사항: "기존의 wxd에서의 가격 아무거나 하나 넣어두고"
                if (!priceMap.has(newId)) {
                    priceMap.set(newId, { price: row.price, updated_at: row.updated_at });
                }
                // 이미 있으면 그냥 둠 (첫번째 발견된 가격 사용)
                priceIdsToDelete.push(row.part_id);
            }
        }

        console.log(`   ✅ 통합 대상: ${priceIdsToDelete.length}개 항목 -> ${priceMap.size}개로 통합`);

        // 6. Admin Prices 데이터 업데이트/삭제
        for (const id of priceIdsToDelete) {
            await run("DELETE FROM admin_prices WHERE part_id = ?", [id]);
        }

        for (const [newId, data] of priceMap) {
            // upsert (가격이 이미 존재하면 업데이트? 아니면 유지? "아무거나 하나 넣어두고" -> 덮어쓰자)
            // insert or replace
            await run("INSERT OR REPLACE INTO admin_prices (part_id, price, updated_at) VALUES (?, ?, ?)",
                [newId, data.price, data.updated_at]);
        }
        console.log('   ✅ Admin Prices 테이블 마이그레이션 완료');

        await run('COMMIT');
        console.log('✅ 모든 마이그레이션이 성공적으로 완료되었습니다.');

    } catch (err) {
        console.error('❌ 오류 발생, 롤백합니다:', err);
        await run('ROLLBACK');
        process.exit(1);
    } finally {
        db.close();
    }
}

migrate();
