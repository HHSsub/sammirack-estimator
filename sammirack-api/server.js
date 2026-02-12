const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정 (GitHub Pages에서 접근 허용)
app.use(cors({
  origin: [
    'https://hhssub.github.io',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'sammirack-api',
    version: '1.0.0'
  });
});

// API 라우트
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/activity', require('./routes/activity'));

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('❌ 서버 에러:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================');
  console.log('🚀 Sammirack API Server 시작');
  console.log(`📍 주소: http://139.150.11.53:${PORT}`);
  console.log(`⏰ 시작 시간: ${new Date().toLocaleString('ko-KR')}`);
  console.log('===========================================');
});
