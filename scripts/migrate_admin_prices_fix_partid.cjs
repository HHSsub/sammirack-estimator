/**
 * 🔧 admin_prices partId 형식 수정 마이그레이션
 * 
 * 문제: cartBOMView에서 partId를 inventoryPartId(색상 포함)로 덮어쓰는 버그로 인해
 *       admin_prices 테이블에 잘못된 형식의 key가 저장되어 있음
 * 
 * 잘못된 형식 (색상/볼트식 포함 = inventoryPartId 형식):
 *   하이랙-선반아이보리(볼트식)270kg-사이즈60x150270kg → 4400
 *   하이랙-선반블루(기둥)+오렌지(가로대)(볼트식)270kg-사이즈60x150270kg → 4300
 *   하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이250270kg → 20000
 * 
 * 올바른 형식 (색상 없음 = generatePartId 형식):
 *   하이랙-선반-사이즈60x150270kg → 4300  (기존 존재)
 *   하이랙-기둥-사이즈60x높이250270kg → 20000  (기존 존재)
 *   하이랙-로드빔-150270kg → 4300  (기존 존재)
 * 
 * 마이그레이션 로직:
 *   1. 잘못된 형식의 row를 찾는다 (색상/볼트식 포함)
 *   2. 올바른 형식의 key로 변환한다
 *   3. 올바른 형식의 기존 row가 있으면: 더 최신 timestamp의 price로 UPDATE
 *   4. 올바른 형식의 기존 row가 없으면: INSERT
 *   5. 잘못된 형식의 row 삭제
 * 
 * 사용법 (서버에서):
 *   node scripts/migrate_admin_prices_fix_partid.cjs [DB경로]
 *   예: node scripts/migrate_admin_prices_fix_partid.cjs /home/rocky/db/sammi.db
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// DB 경로 (인자 또는 기본값)
const DB_PATH = process.argv[2] || path.join(process.env.HOME || '/home/rocky', 'db', 'sammi.db');

console.log(`\n🔧 admin_prices partId 형식 수정 마이그레이션`);
console.log(`📂 DB 경로: ${DB_PATH}\n`);

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ DB 열기 실패:', err.message);
        process.exit(1);
    }
});

// Promise wrapper
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * 잘못된 형식의 partId에서 올바른 형식으로 변환
 * 
 * 잘못된 형식 패턴:
 *   하이랙-{부품명}{색상}({볼트식}){중량}kg-{규격}
 *   예: 하이랙-선반아이보리(볼트식)270kg-사이즈60x150270kg
 *   예: 하이랙-기둥메트그레이(볼트식)270kg-사이즈60x높이250270kg
 *   예: 하이랙-로드빔아이보리(볼트식)270kg-150270kg
 *   예: 하이랙-선반블루(기둥)+오렌지(가로대)(볼트식)270kg-사이즈60x150270kg
 *   예: 하이랙-선반블루(기둥.선반)+오렌지(빔)550kg-사이즈80x108550kg
 * 
 * 올바른 형식:
 *   하이랙-{부품명}-{규격}
 *   예: 하이랙-선반-사이즈60x150270kg
 *   예: 하이랙-기둥-사이즈60x높이250270kg
 *   예: 하이랙-로드빔-150270kg
 */
function convertToCorrectPartId(wrongId) {
    // 하이랙이 아니면 변환 불필요
    if (!wrongId.startsWith('하이랙-')) return null;

    const parts = wrongId.split('-');
    if (parts.length < 3) return null;

    // parts[0] = "하이랙"
    // parts[1] = "선반아이보리(볼트식)270kg" 또는 "기둥메트그레이(볼트식)270kg" 등
    // parts[2] = "사이즈60x150270kg" 또는 "150270kg" 등

    const middlePart = parts[1];
    const spec = parts.slice(2).join('-'); // 나머지는 규격

    // 부품 기본명 추출: 기둥, 선반, 로드빔
    let baseName = '';
    if (middlePart.includes('기둥')) baseName = '기둥';
    else if (middlePart.includes('선반')) baseName = '선반';
    else if (middlePart.includes('로드빔') || middlePart.includes('빔')) baseName = '로드빔';
    else return null; // 알 수 없는 부품명

    // 색상/볼트식 정보가 포함되어 있는지 확인
    const colorPatterns = [
        '아이보리', '메트그레이', '매트그레이', '블루', '오렌지', '화이트', '그레이', '블랙',
        '메트블랙', '매트블루', '실버',
        '(볼트식)', '(기둥)', '(가로대)', '(기둥.선반)', '(빔)'
    ];

    const hasColorInfo = colorPatterns.some(p => middlePart.includes(p));
    if (!hasColorInfo) return null; // 색상 정보 없으면 이미 올바른 형식

    // 올바른 형식: 하이랙-{baseName}-{spec}
    return `하이랙-${baseName}-${spec}`;
}

async function migrate() {
    try {
        // 1. 전체 admin_prices 조회
        const allPrices = await dbAll(`SELECT * FROM admin_prices WHERE rack_type = '하이랙'`);
        console.log(`📊 하이랙 admin_prices 총 ${allPrices.length}개\n`);

        // 2. 잘못된 형식 찾기
        const wrongFormatRows = [];
        const correctFormatRows = new Map(); // key: correctId, value: row

        for (const row of allPrices) {
            const correctId = convertToCorrectPartId(row.part_id);
            if (correctId) {
                // 잘못된 형식
                wrongFormatRows.push({ ...row, correctId });
            } else {
                // 올바른 형식 (또는 변환 불가)
                correctFormatRows.set(row.part_id, row);
            }
        }

        console.log(`✅ 올바른 형식: ${correctFormatRows.size}개`);
        console.log(`❌ 잘못된 형식: ${wrongFormatRows.length}개\n`);

        if (wrongFormatRows.length === 0) {
            console.log('✅ 수정할 항목 없음. 마이그레이션 완료.');
            db.close();
            return;
        }

        // 3. 마이그레이션 실행
        console.log('--- 마이그레이션 상세 ---\n');

        let updatedCount = 0;
        let insertedCount = 0;
        let deletedCount = 0;
        let skippedCount = 0;

        for (const wrong of wrongFormatRows) {
            const existing = correctFormatRows.get(wrong.correctId);

            console.log(`🔄 잘못된 ID: "${wrong.part_id}"`);
            console.log(`   → 올바른 ID: "${wrong.correctId}"`);
            console.log(`   → 가격: ${wrong.price}원 (timestamp: ${wrong.timestamp})`);

            if (existing) {
                // 올바른 형식의 기존 row 존재 → timestamp 비교
                const wrongTime = new Date(wrong.timestamp || 0).getTime();
                const existingTime = new Date(existing.timestamp || 0).getTime();

                if (wrongTime > existingTime) {
                    // 잘못된 형식이 더 최신 → 올바른 형식의 가격을 업데이트
                    console.log(`   🔄 기존(${existing.price}원, ${existing.timestamp}) → 최신(${wrong.price}원, ${wrong.timestamp})`);
                    await dbRun(
                        `UPDATE admin_prices SET price = ?, timestamp = ?, account = ? WHERE part_id = ?`,
                        [wrong.price, wrong.timestamp, wrong.account, wrong.correctId]
                    );
                    updatedCount++;
                } else {
                    // 기존이 더 최신이거나 같음 → 업데이트 불필요
                    console.log(`   ⏭️ 기존이 더 최신 (${existing.price}원, ${existing.timestamp}) → 스킵`);
                    skippedCount++;
                }
            } else {
                // 올바른 형식 없음 → INSERT
                console.log(`   ➕ 새로 INSERT`);
                await dbRun(
                    `INSERT OR REPLACE INTO admin_prices (part_id, price, timestamp, account, rack_type, name, specification, original_price, display_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [wrong.correctId, wrong.price, wrong.timestamp, wrong.account, wrong.rack_type, wrong.name, wrong.specification, wrong.original_price, wrong.display_name]
                );
                insertedCount++;
                // 맵에도 추가 (같은 correctId로 여러 색상이 있을 수 있으므로)
                correctFormatRows.set(wrong.correctId, { ...wrong, part_id: wrong.correctId });
            }

            // 잘못된 형식 row 삭제
            await dbRun(`DELETE FROM admin_prices WHERE part_id = ?`, [wrong.part_id]);
            deletedCount++;
            console.log(`   🗑️ 삭제: "${wrong.part_id}"\n`);
        }

        // 4. 결과 요약
        console.log('\n=== 마이그레이션 결과 ===');
        console.log(`📊 처리된 잘못된 항목: ${wrongFormatRows.length}개`);
        console.log(`   ✅ 기존 row 업데이트: ${updatedCount}개`);
        console.log(`   ➕ 새로 INSERT: ${insertedCount}개`);
        console.log(`   ⏭️ 스킵(기존이 최신): ${skippedCount}개`);
        console.log(`   🗑️ 잘못된 형식 삭제: ${deletedCount}개`);

        // 5. 최종 상태 확인
        const finalPrices = await dbAll(`SELECT * FROM admin_prices WHERE rack_type = '하이랙' ORDER BY part_id`);
        console.log(`\n📊 마이그레이션 후 하이랙 admin_prices: ${finalPrices.length}개`);
        console.log('\n--- 최종 데이터 ---');
        for (const row of finalPrices) {
            console.log(`  ${row.part_id} | ${row.price}원 | ${row.timestamp}`);
        }

        console.log('\n✅ 마이그레이션 완료!');

    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error);
    } finally {
        db.close();
    }
}

migrate();
