const express = require('express');
const router = express.Router();
const db = require('../db');

// type/id safe extraction (column first, else infer from doc_id)
function getTypeAndId(row) {
  const hasUnderscore = row.doc_id && row.doc_id.indexOf('_') >= 0;
  const type = (row.type != null && row.type !== '')
    ? row.type
    : (hasUnderscore ? row.doc_id.split('_')[0] : 'estimate');
  const id = hasUnderscore ? row.doc_id.split('_').slice(1).join('_') : row.doc_id;
  return { type, id };
}

function safeParseItems(itemsRaw) {
  try {
    const parsed = JSON.parse(itemsRaw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function summarizeProductType(items = []) {
  const names = items
    .map(it => String(it?.name || '').trim())
    .filter(Boolean);
  if (names.length === 0) return '';
  return names.join(' | ');
}

// 전체 문서 조회
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM documents ORDER BY date DESC');
    const documents = {};

    rows.forEach(row => {
      const { type, id } = getTypeAndId(row);
      const parsedItems = safeParseItems(row.items);
      let parsedMaterials = [];
      let materialsError = false;
      try {
        parsedMaterials = JSON.parse(row.materials || '[]') || [];
      } catch {
        parsedMaterials = [];
        materialsError = true;
      }

      documents[row.doc_id] = {
        id,
        type,
        date: row.date,
        documentNumber: row.document_number,
        estimateNumber: type === 'estimate' ? row.document_number : null,
        purchaseNumber: type === 'purchase' ? row.document_number : null,
        companyName: row.company_name,
        customerName: row.company_name,
        bizNumber: row.biz_number,
        items: parsedItems,
        materials: parsedMaterials,
        subtotal: row.subtotal,
        tax: row.tax,
        totalAmount: row.total_amount,
        totalPrice: row.total_amount,
        notes: materialsError
          ? '[에러발생한문서 - 문의주세요 010-6317-4543] ' + (row.notes || '')
          : row.notes,
        topMemo: row.top_memo,
        memo: row.top_memo,
        materialsError,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        productType: summarizeProductType(parsedItems),
        // ✅ 삭제 상태 반환 추가 (이게 없어서 프론트가 삭제된걸 몰랐음)
        deleted: !!row.deleted,
        deletedAt: row.deleted_at,
        deletedBy: row.deleted_by ? JSON.parse(row.deleted_by) : null,
        permanentlyDeleted: !!row.permanently_deleted,
        permanentlyDeletedAt: row.permanently_deleted_at,
        // ✅ 재고 감소 상태 반환
        inventoryDeducted: !!row.inventory_deducted,
        inventoryDeductedAt: row.inventory_deducted_at,
        inventoryDeductedBy: row.inventory_deducted_by
      };
    });

    res.json(documents);
  } catch (error) {
    console.error('문서 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// 특정 문서 조회
router.get('/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    console.log('📄 문서 조회 요청:', docId);

    let row = await db.get('SELECT * FROM documents WHERE doc_id = ?', docId);

    // ✅ fallback: underscore 없으면 type_ 접두사 추가해서 재시도
    if (!row && docId.indexOf('_') === -1) {
      console.log('⚠️ underscore 없는 docId 감지, type 접두사 시도:', docId);
      const types = ['estimate', 'purchase', 'delivery'];
      for (const type of types) {
        const prefixedId = `${type}_${docId}`;
        row = await db.get('SELECT * FROM documents WHERE doc_id = ?', prefixedId);
        if (row) {
          console.log('✅ 접두사 추가로 문서 발견:', prefixedId);
          break;
        }
      }
    }

    if (!row) {
      console.log('❌ 문서를 찾을 수 없음:', docId);
      return res.status(404).json({ error: 'Document not found' });
    }

    const { type, id } = getTypeAndId(row);


    // ✅ items, materials 안전 파싱
    let items = [];
    let materials = [];

    try {
      items = JSON.parse(row.items || '[]');
      console.log('✅ items 파싱 성공:', items.length, '개');
    } catch (err) {
      console.error('❌ items 파싱 실패:', err);
      items = [];
    }

    try {
      materials = JSON.parse(row.materials || '[]');
      console.log('✅ materials 파싱 성공:', materials.length, '개');
    } catch (err) {
      console.error('❌ materials 파싱 실패:', err);
      materials = [];
    }

    const document = {
      id,
      type,
      date: row.date,
      documentNumber: row.document_number,
      estimateNumber: type === 'estimate' ? row.document_number : null,
      purchaseNumber: type === 'purchase' ? row.document_number : null,
      companyName: row.company_name,
      customerName: row.customer_name,
      bizNumber: row.biz_number,
      items,
      materials,
      subtotal: row.subtotal,
      tax: row.tax,
      totalAmount: row.total_amount,
      totalPrice: row.total_price,
      notes: row.notes,
      topMemo: row.top_memo,
      memo: row.memo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      productType: summarizeProductType(items),
      // ✅ 재고 감소 상태
      inventoryDeducted: !!row.inventory_deducted,
      inventoryDeductedAt: row.inventory_deducted_at,
      inventoryDeductedBy: row.inventory_deducted_by
    };

    console.log('✅ 문서 조회 성공:', document.id);
    res.json(document);

  } catch (error) {
    console.error('❌ 문서 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});



// ✅ 벌크 저장 핸들러 (변경된 문서들 한 번에 전송)
router.post('/bulk-save', async (req, res) => {
  const { documents } = req.body; // { docId: docData, ... }
  if (!documents || typeof documents !== 'object') {
    return res.status(400).json({ error: 'documents 객체 필요' });
  }

  const entries = Object.entries(documents);
  if (entries.length === 0) {
    return res.json({ success: true, saved: 0 });
  }

  const now = new Date().toISOString();

  try {
    await db.run('BEGIN TRANSACTION');
    for (let [docId, data] of entries) {
      // ID 정규화
      docId = String(docId).replace(/\.0$/, '');
      if (docId.indexOf('_') === -1) {
        docId = `${data.type || 'estimate'}_${docId}`;
      }

      const typeVal = data.type || docId.split('_')[0] || 'estimate';

      await db.run(`
        INSERT INTO documents
        (doc_id, type, date, document_number, company_name, biz_number, items, materials,
        subtotal, tax, total_amount, notes, top_memo, created_at, updated_at,
        deleted, deleted_at, deleted_by,
        permanently_deleted, permanently_deleted_at,
        inventory_deducted, inventory_deducted_at, inventory_deducted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(doc_id) DO UPDATE SET
          type = excluded.type,
          date = excluded.date,
          document_number = excluded.document_number,
          company_name = excluded.company_name,
          biz_number = excluded.biz_number,
          items = excluded.items,
          materials = excluded.materials,
          subtotal = excluded.subtotal,
          tax = excluded.tax,
          total_amount = excluded.total_amount,
          notes = excluded.notes,
          top_memo = excluded.top_memo,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted,
          deleted_at = excluded.deleted_at,
          deleted_by = excluded.deleted_by,
          permanently_deleted = excluded.permanently_deleted,
          permanently_deleted_at = excluded.permanently_deleted_at,
          inventory_deducted = excluded.inventory_deducted,
          inventory_deducted_at = excluded.inventory_deducted_at,
          inventory_deducted_by = excluded.inventory_deducted_by
      `, [
        docId, typeVal, data.date,
        data.documentNumber || null, data.companyName || null, data.bizNumber || null,
        typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
        typeof data.materials === 'string' ? data.materials : JSON.stringify(data.materials || []),
        data.subtotal || 0, data.tax || 0, data.totalAmount || 0,
        data.notes || '', data.topMemo || '',
        data.createdAt || now, data.updatedAt || data.createdAt || now,
        data.deleted ? 1 : 0, data.deletedAt || null,
        data.deletedBy ? JSON.stringify(data.deletedBy) : null,
        data.permanentlyDeleted ? 1 : 0, data.permanentlyDeletedAt || null,
        data.inventoryDeducted ? 1 : 0, data.inventoryDeductedAt || null, data.inventoryDeductedBy || null
      ]);
    }
    await db.run('COMMIT');
    res.json({ success: true, saved: entries.length });
  } catch (error) {
    await db.run('ROLLBACK').catch(() => {});
    console.error('벌크 문서 저장 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 공통 저장 핸들러 (doc_id unchanged; type from body)
async function saveHandler(req, res) {
  let { docId, ...data } = req.body;

  // ✅ [전수조사 결과 반영] ID 정규화 강제 (근본원인 해결)
  // 1. 문자열화 2. .0 접미사 제거 3. 유형 접두사 보정
  if (docId != null) {
    let normalizedId = String(docId).replace(/\.0$/, '');

    // 접두사가 없으면 body의 type이나 기본값(estimate)으로 붙여줌
    if (normalizedId.indexOf('_') === -1) {
      const type = data.type || 'estimate';
      normalizedId = `${type}_${normalizedId}`;
    }

    docId = normalizedId;
  }

  const now = new Date().toISOString();
  const typeVal = data.type || (docId && docId.indexOf('_') >= 0 ? docId.split('_')[0] : 'estimate');

  // 🚨 [긴급 백신] 프론트 로컬 스토리지 좀비 데이터 차단 🚨
  // 프론트엔드 캐시에 남아있는 "3월 6일" 오염된 타임스탬프가 
  // 3월 1일 이전 생성 문서의 수정 시각을 파괴하는 것을 서버단에서 원천 차단
  if (data.createdAt && new Date(data.createdAt) < new Date('2026-03-01')) {
    if (data.updatedAt && data.updatedAt.startsWith('2026-03-06')) {
      data.updatedAt = data.createdAt; // 오염된 수정 시각 무시, 원래 생성 시각으로 강제 복귀
    }
  }

  try {
    // 1. deleted 컬럼이 있는지 확인 (마이그레이션이 안되었을 수도 있으므로)
    // 안전하게 컬럼을 추가하거나, 없는 경우 무시하는 로직이 필요하지만
    // 여기서는 일단 컬럼이 있다고 가정하고 추가합니다.
    // (실제로는 migrate.js가 돌아야 함)

    // 4. 서버 동기화 호출 -> 여기서 saveDocumentSync를 호출함!

    await db.run(`
        INSERT INTO documents
        (doc_id, type, date, document_number, company_name, biz_number, items, materials,
        subtotal, tax, total_amount, notes, top_memo, created_at, updated_at,
        deleted, deleted_at, deleted_by,
        permanently_deleted, permanently_deleted_at,
        inventory_deducted, inventory_deducted_at, inventory_deducted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(doc_id) DO UPDATE SET
          type = excluded.type,
          date = excluded.date,
          document_number = excluded.document_number,
          company_name = excluded.company_name,
          biz_number = excluded.biz_number,
          items = excluded.items,
          materials = excluded.materials,
          subtotal = excluded.subtotal,
          tax = excluded.tax,
          total_amount = excluded.total_amount,
          notes = excluded.notes,
          top_memo = excluded.top_memo,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted,
          deleted_at = excluded.deleted_at,
          deleted_by = excluded.deleted_by,
          permanently_deleted = excluded.permanently_deleted,
          permanently_deleted_at = excluded.permanently_deleted_at,
          inventory_deducted = excluded.inventory_deducted,
          inventory_deducted_at = excluded.inventory_deducted_at,
          inventory_deducted_by = excluded.inventory_deducted_by
      `, [
      docId,
      typeVal,
      data.date,
      data.documentNumber || null,
      data.companyName || null,
      data.bizNumber || null,
      typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
      typeof data.materials === 'string' ? data.materials : JSON.stringify(data.materials || []),
      data.subtotal || 0,
      data.tax || 0,
      data.totalAmount || 0,
      data.notes || '',
      data.topMemo || '',
      data.createdAt || now,
      data.updatedAt || data.createdAt || now,
      data.deleted ? 1 : 0,
      data.deletedAt || null,
      data.deletedBy ? JSON.stringify(data.deletedBy) : null,
      data.permanentlyDeleted ? 1 : 0,
      data.permanentlyDeletedAt || null,
      data.inventoryDeducted ? 1 : 0,
      data.inventoryDeductedAt || null,
      data.inventoryDeductedBy || null
    ]);

    res.json({ success: true, docId });
  } catch (error) {
    // ✅ 컬럼 없음 에러 처리 (자동 마이그레이션 시도)
    if (error.message.includes('no such column')) {
      console.log('⚠️ 컬럼 누락 감지 - 자동 마이그레이션 시도');
      try {
        await db.run('ALTER TABLE documents ADD COLUMN inventory_deducted INTEGER DEFAULT 0');
        await db.run('ALTER TABLE documents ADD COLUMN inventory_deducted_at TEXT');
        await db.run('ALTER TABLE documents ADD COLUMN inventory_deducted_by TEXT');
        console.log('✅ 컬럼 추가 완료 - 재시도');
        return saveHandler(req, res); // 재귀 호출로 재시도
      } catch (alterError) {
        console.error('❌ 마이그레이션 실패:', alterError);
        res.status(500).json({ error: 'Database schema mismatch and migration failed' });
      }
    } else {
      console.error('문서 저장 실패:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

// 초기화 시 컬럼 확인 및 7일 지난 영구삭제 row 물리 정리
(async () => {
  // 컬럼 자동 추가
  const columnsToAdd = [
    ['inventory_deducted', 'INTEGER DEFAULT 0'],
    ['inventory_deducted_at', 'TEXT'],
    ['inventory_deducted_by', 'TEXT'],
    ['permanently_deleted', 'INTEGER DEFAULT 0'],
    ['permanently_deleted_at', 'TEXT'],
  ];
  for (const [col, def] of columnsToAdd) {
    try {
      await db.run(`ALTER TABLE documents ADD COLUMN ${col} ${def}`);
      console.log(`🔧 컬럼 추가: ${col}`);
    } catch (e) { /* 이미 존재하면 무시 */ }
  }

  // 7일 지난 영구삭제 row 물리 DELETE (DB 정리)
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await db.run(
      `DELETE FROM documents WHERE permanently_deleted = 1 AND permanently_deleted_at < ?`,
      [cutoff]
    );
    if (result.changes > 0) {
      console.log(`🧹 영구삭제 정리: ${result.changes}개 row 물리 삭제 (7일 경과)`);
    }
  } catch (e) {
    console.error('영구삭제 정리 실패:', e.message);
  }
})();

// ✅ 모든 HTTP 메서드 지원
router.post('/save', saveHandler);
router.put('/save', saveHandler);
router.patch('/save', saveHandler);

// ⚠️ IMPORTANT: /:docId/inventory-deducted를 :docId보다 반드시 먼저 정의!
router.post('/:docId/inventory-deducted', async (req, res) => {
  try {
    const docId = req.params.docId;
    const { deducted, deductedAt, deductedBy } = req.body;

    const now = new Date().toISOString();
    const deductedAtVal = deductedAt || now;
    const deductedByVal = deductedBy || 'smartstore-listener';

    await db.run(`
      UPDATE documents
      SET inventory_deducted = ?,
          inventory_deducted_at = ?,
          inventory_deducted_by = ?
      WHERE doc_id = ?
    `, [deducted ? 1 : 0, deductedAtVal, JSON.stringify(deductedByVal), docId]);

    res.json({ success: true, message: '재고 감소 상태 업데이트 완료' });
  } catch (error) {
    console.error('재고 감소 상태 업데이트 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 일반 문서 저장/업데이트 (덜 구체적인 라우트는 맨 뒤)
router.post('/:docId', saveHandler);
router.put('/:docId', saveHandler);
router.patch('/:docId', saveHandler);

// 문서 영구 삭제
router.delete('/:docId', async (req, res) => {
  try {
    const docId = req.params.docId;

    // 1차: 그대로 삭제 시도
    let result = await db.run('DELETE FROM documents WHERE doc_id = ?', [docId]);

    // 2차: 0 rows → type prefix 없이 재시도 (예: "estimate_1234" → "1234")
    if (result.changes === 0) {
      const parts = docId.split('_');
      if (parts.length >= 2) {
        const withoutPrefix = parts.slice(1).join('_');
        result = await db.run('DELETE FROM documents WHERE doc_id = ?', [withoutPrefix]);
      }
    }

    // 3차: 아직도 0 rows → doc_id LIKE 패턴으로 삭제 (접두사 변형 대응)
    if (result.changes === 0) {
      const bare = docId.replace(/^(estimate|purchase|delivery)_/, '');
      result = await db.run(
        "DELETE FROM documents WHERE doc_id = ? OR doc_id = ? OR doc_id LIKE ?",
        [bare, `estimate_${bare}`, `purchase_${bare}`]
      );
    }

    if (result.changes === 0) {
      console.warn(`⚠️ 영구 삭제: 일치하는 문서 없음 doc_id=${docId}`);
      return res.status(404).json({ error: '삭제할 문서를 찾을 수 없습니다.' });
    }

    console.log(`🔥 영구 삭제 완료: ${docId} (${result.changes}행)`);
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    console.error('문서 영구 삭제 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
