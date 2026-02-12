const express = require('express');
const router = express.Router();
const db = require('../db');

// 전체 가격 조회
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM admin_prices');
    const prices = {};
    rows.forEach(row => {
      prices[row.part_id] = {
        price: row.price,
        timestamp: row.timestamp,
        account: row.account,
        partInfo: {
          rackType: row.rack_type,
          name: row.name,
          specification: row.specification,
          originalPrice: row.original_price,
          displayName: row.display_name
        }
      };
    });
    res.json(prices);
  } catch (error) {
    console.error('가격 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 공통 업데이트 핸들러
async function updateHandler(req, res) {
  const { partId, price, timestamp, account, partInfo } = req.body;

  try {
    await db.run(`
      INSERT INTO admin_prices
      (part_id, price, timestamp, account, rack_type, name, specification, original_price, display_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(part_id) DO UPDATE SET
        price = excluded.price,
        timestamp = excluded.timestamp,
        account = excluded.account,
        rack_type = excluded.rack_type,
        name = excluded.name,
        specification = excluded.specification,
        original_price = excluded.original_price,
        display_name = excluded.display_name
    `, [
      partId,
      price,
      timestamp || new Date().toISOString(),
      account || 'api',
      partInfo?.rackType || null,
      partInfo?.name || null,
      partInfo?.specification || null,
      partInfo?.originalPrice || null,
      partInfo?.displayName || null
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('가격 업데이트 실패:', error);
    res.status(500).json({ error: error.message });
  }
}

// ✅ 모든 HTTP 메서드 지원
router.post('/update', updateHandler);
router.put('/update', updateHandler);
router.patch('/update', updateHandler);
router.post('/:partId', updateHandler);  // POST /api/prices/{partId}
router.put('/:partId', updateHandler);   // PUT /api/prices/{partId}
router.patch('/:partId', updateHandler); // PATCH /api/prices/{partId}



module.exports = router;
