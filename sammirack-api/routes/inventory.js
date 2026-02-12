const express = require('express');
const router = express.Router();
const db = require('../db');

// 전체 재고 조회
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT part_id, quantity FROM inventory');
    const inventory = {};
    rows.forEach(row => {
      inventory[row.part_id] = row.quantity;
    });
    res.json(inventory);
  } catch (error) {
    console.error('재고 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 재고 원자적 차감 (Race Condition 방지)
router.post('/deduct', async (req, res) => {
  const { deductions, documentId, userIp } = req.body;
  const now = new Date().toISOString();
  const results = {};
  const insufficientParts = [];

  if (!deductions || typeof deductions !== 'object') {
    return res.status(400).json({ error: 'Invalid deductions format' });
  }

  try {
    await db.run('BEGIN TRANSACTION');

    for (const [partId, amount] of Object.entries(deductions)) {
      const deductAmount = parseInt(amount);
      if (isNaN(deductAmount) || deductAmount < 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({
          error: 'Invalid deduction amount',
          partId,
          amount
        });
      }

      // 1. 현재 재고 확인
      const current = await db.get(
        'SELECT quantity FROM inventory WHERE part_id = ?',
        [partId]
      );

      if (!current) {
        // 재고 없으면 0으로 생성 후 음수 방지
        await db.run(`
          INSERT INTO inventory (part_id, quantity, updated_at, updated_by)
          VALUES (?, ?, ?, ?)
        `, [partId, 0, now, documentId || userIp || 'api']);

        if (deductAmount > 0) {
          insufficientParts.push({
            partId,
            requested: deductAmount,
            available: 0
          });
        }
        results[partId] = 0;
        continue;
      }

      if (current.quantity < deductAmount) {
        insufficientParts.push({
          partId,
          requested: deductAmount,
          available: current.quantity
        });
      }

      // 2. 원자적 차감 (SQL 레벨에서 계산)
      const newQuantity = Math.max(0, current.quantity - deductAmount);
      await db.run(`
        UPDATE inventory 
        SET quantity = ?,
            updated_at = ?,
            updated_by = ?
        WHERE part_id = ?
      `, [newQuantity, now, documentId || userIp || 'api', partId]);

      results[partId] = newQuantity;
    }

    await db.run('COMMIT');

    // 3. 활동 로그 기록
    try {
      await db.run(`
        INSERT INTO activity_log (timestamp, action, user_ip, data_types, details)
        VALUES (?, ?, ?, ?, ?)
      `, [
        now,
        'inventory_deduct',
        userIp || req.ip || 'unknown',
        JSON.stringify(['inventory']),
        JSON.stringify({
          documentId,
          deductions,
          results,
          insufficientParts: insufficientParts.length > 0 ? insufficientParts : undefined
        })
      ]);
    } catch (logError) {
      console.warn('활동 로그 기록 실패 (무시):', logError.message);
    }

    res.json({
      success: true,
      results,
      warnings: insufficientParts.length > 0 ? insufficientParts : undefined
    });

  } catch (error) {
    await db.run('ROLLBACK');
    console.error('재고 차감 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 재고 복구 (취소/롤백용)
router.post('/restore', async (req, res) => {
  const { restorations, documentId, userIp } = req.body;
  const now = new Date().toISOString();
  const results = {};

  if (!restorations || typeof restorations !== 'object') {
    return res.status(400).json({ error: 'Invalid restorations format' });
  }

  try {
    await db.run('BEGIN TRANSACTION');

    for (const [partId, amount] of Object.entries(restorations)) {
      const restoreAmount = parseInt(amount);
      if (isNaN(restoreAmount) || restoreAmount < 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({
          error: 'Invalid restoration amount',
          partId,
          amount
        });
      }

      // 현재 재고 확인
      const current = await db.get(
        'SELECT quantity FROM inventory WHERE part_id = ?',
        [partId]
      );

      if (!current) {
        // 재고 없으면 생성
        await db.run(`
          INSERT INTO inventory (part_id, quantity, updated_at, updated_by)
          VALUES (?, ?, ?, ?)
        `, [partId, restoreAmount, now, `restore_${documentId}` || userIp || 'api']);
        results[partId] = restoreAmount;
      } else {
        // 원자적 증가
        const newQuantity = current.quantity + restoreAmount;
        await db.run(`
          UPDATE inventory 
          SET quantity = ?,
              updated_at = ?,
              updated_by = ?
          WHERE part_id = ?
        `, [newQuantity, now, `restore_${documentId}` || userIp || 'api', partId]);
        results[partId] = newQuantity;
      }
    }

    await db.run('COMMIT');

    // 활동 로그 기록
    try {
      await db.run(`
        INSERT INTO activity_log (timestamp, action, user_ip, data_types, details)
        VALUES (?, ?, ?, ?, ?)
      `, [
        now,
        'inventory_restore',
        userIp || req.ip || 'unknown',
        JSON.stringify(['inventory']),
        JSON.stringify({ documentId, restorations, results })
      ]);
    } catch (logError) {
      console.warn('활동 로그 기록 실패 (무시):', logError.message);
    }

    res.json({ success: true, results });

  } catch (error) {
    await db.run('ROLLBACK');
    console.error('재고 복구 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// 재고 업데이트 (트랜잭션) - 기존 코드 유지 (하위 호환성)
router.post('/update', async (req, res) => {
  const updates = req.body; // { partId: quantity, ... }
  const now = new Date().toISOString();

  try {
    await db.run('BEGIN TRANSACTION');

    for (const [partId, quantity] of Object.entries(updates)) {
      await db.run(`
        INSERT INTO inventory (part_id, quantity, updated_at, updated_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(part_id) DO UPDATE SET
          quantity = excluded.quantity,
          updated_at = excluded.updated_at
      `, [partId, Math.max(0, quantity), now, 'api']);
    }

    await db.run('COMMIT');

    // 업데이트 후 전체 재고 반환
    const rows = await db.all('SELECT part_id, quantity FROM inventory');
    const inventory = {};
    rows.forEach(row => {
      inventory[row.part_id] = row.quantity;
    });

    res.json({ success: true, inventory });
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('재고 업데이트 실패:', error);
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;

