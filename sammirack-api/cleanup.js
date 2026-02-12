const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🧹 DB 클린업 및 중복 제거 시작...\n');

async function cleanupDocuments() {
    console.log('🔍 문서 데이터 검사 중...');
    const rows = await db.all('SELECT * FROM documents');
    console.log(`총 문서 수: ${rows.length}개`);

    let duplicateCount = 0;
    let ghostCount = 0;
    let deletedCount = 0;

    // 1. 중복 제거 (X.0 과 X가 같이 있으면 X.0 삭제)
    // ID 기반 맵핑
    const idMap = {};
    rows.forEach(row => {
        idMap[row.doc_id] = row;
    });

    for (const row of rows) {
        const docId = row.doc_id;

        // A. ".0" 패턴 중복 검사
        if (docId.endsWith('.0')) {
            const cleanId = docId.replace('.0', '');
            if (idMap[cleanId]) {
                // 클린 ID가 이미 존재함 -> 이 .0 문서는 중복임 -> Soft Delete!
                console.log(`🗑️ 중복 문서 발견 (Soft Delete 처리): ${docId} (원본: ${cleanId} 존재함)`);
                // DB에서 완전히 지우면 프론트가 부활시키므로, deleted=1로 마킹하여 프론트에 "삭제됨"을 알림
                await db.run('UPDATE documents SET deleted = 1, updated_at = ?, deleted_at = ? WHERE doc_id = ?', [new Date().toISOString(), new Date().toISOString(), docId]);
                duplicateCount++;
                continue;
            }
        }

        // B. 유령 문서 검사 (문서 번호나 날짜가 없는 경우)
        if (!row.document_number && !row.created_at) {
            console.log(`� 유령 문서 발견 (Soft Delete 처리): ${docId}`);
            console.log(` 유령 문서 발견 (Soft Delete 처리): ${docId}`);
            await db.run('UPDATE documents SET deleted = 1, updated_at = ?, deleted_at = ? WHERE doc_id = ?', [new Date().toISOString(), new Date().toISOString(), docId]);
            ghostCount++;
            continue;
        }
    }

    // 2. 문서 번호(document_number) + 타입(type) 중복 검사
    // 번호가 같더라도 타입(견적서/청구서)이 다르면 다른 문서로 취급해야 함
    const activeRows = await db.all('SELECT * FROM documents WHERE deleted != 1 OR deleted IS NULL');
    const numberMap = {};

    for (const row of activeRows) {
        if (!row.document_number) continue;

        // 타입 추론 (컬럼이 없거나 비어있으면 ID 접두사 사용)
        let type = row.type;
        if (!type && row.doc_id.includes('_')) {
            type = row.doc_id.split('_')[0]; // estimate, purchase, delivery, etc.
        }
        if (!type) type = 'unknown';

        const docNum = row.document_number.trim();
        const uniqueKey = `${type}:${docNum}`; // ✅ 타입별로 구분하여 그룹핑

        if (!numberMap[uniqueKey]) {
            numberMap[uniqueKey] = [];
        }
        numberMap[uniqueKey].push(row);
    }

    let bizDuplicateCount = 0;
    for (const [key, docs] of Object.entries(numberMap)) {
        if (docs.length > 1) {
            // 최신순 정렬
            docs.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

            // [0]번(최신)만 살리고 나머지 삭제
            const toKeep = docs[0];
            const toDelete = docs.slice(1);

            console.log(`�️ 번호 중복 발견: "${docNum}" (${docs.length}개) -> 최신 ID ${toKeep.doc_id} 유지, 나머지 ${toDelete.length}개 삭제`);

            for (const deadDoc of toDelete) {
                await db.run('UPDATE documents SET deleted = 1, updated_at = ?, deleted_at = ? WHERE doc_id = ?', [new Date().toISOString(), new Date().toISOString(), deadDoc.doc_id]);
                bizDuplicateCount++;
            }
        }
    }

    // C. 삭제 플래그가 있는 문서 완전히 제거할지 여부
    // 여기서는 동기화를 위해 Hard Delete 하지 않음
    const deletedRows = await db.all('SELECT * FROM documents WHERE deleted = 1');
    console.log(`🗑️ (참고) Soft Deleted 상태인 문서: ${deletedRows.length}개`);

    console.log('===========================================');
    console.log(`✅ 클린업 완료 결과:`);
    console.log(`   - ID 중복(Soft Delete): ${duplicateCount}건`);
    console.log(`   - 유령 문서(Soft Delete): ${ghostCount}건`);
    console.log(`   - 번호 중복(Soft Delete): ${bizDuplicateCount}건`);
    console.log('===========================================');
}

cleanupDocuments().catch(err => {
    console.error('❌ 클린업 실패:', err);
});
