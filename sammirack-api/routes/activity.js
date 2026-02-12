const express = require('express');
const router = express.Router();
const db = require('../db');

// 최근 활동 로그 조회
router.get('/recent', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  
  try {
    const rows = await db.all(
      'SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    
    const logs = rows.map(row => ({
      timestamp: row.timestamp,
      action: row.action,
      userIP: row.user_ip,
      dataTypes: JSON.parse(row.data_types),
      documentCount: row.document_count,
      details: JSON.parse(row.details)
    }));
    
    res.json(logs);
  } catch (error) {
    console.error('활동 로그 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// 활동 로그 추가
router.post('/log', async (req, res) => {
  const { action, details } = req.body;
  const userIP = req.ip || req.connection.remoteAddress;
  const now = new Date().toISOString();
  
  try {
    await db.run(`
      INSERT INTO activity_log 
      (timestamp, action, user_ip, data_types, document_count, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      now,
      action,
      userIP,
      JSON.stringify(details?.dataTypes || []),
      details?.documentCount || null,
      JSON.stringify(details)
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('활동 로그 추가 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
