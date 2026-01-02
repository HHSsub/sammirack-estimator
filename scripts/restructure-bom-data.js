// bom_data_weight_added.json 구조 변경 스크립트
// 파렛트랙을 { "파렛트랙": { "구형": { "2t": {...} } } } 형식으로 변경

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bomDataPath = path.join(__dirname, '..', 'public', 'bom_data_weight_added.json');
const backupPath = path.join(__dirname, '..', 'public', 'bom_data_weight_added.json.backup');

console.log('📦 BOM 데이터 구조 변경 시작...');

// 백업 생성
console.log('1. 백업 생성 중...');
const bomData = JSON.parse(fs.readFileSync(bomDataPath, 'utf8'));
fs.writeFileSync(backupPath, JSON.stringify(bomData, null, 2), 'utf8');
console.log(`✅ 백업 완료: ${backupPath}`);

// 파렛트랙 구조 변경
if (bomData['파렛트랙']) {
  console.log('2. 파렛트랙 구조 변경 중...');
  const palletRackData = bomData['파렛트랙'];
  
  // 기존 데이터를 "구형"으로 래핑
  bomData['파렛트랙'] = {
    '구형': palletRackData,
    '신형': {} // 신형은 나중에 추가될 예정
  };
  
  console.log('✅ 파렛트랙 구조 변경 완료');
  console.log(`   - 구형: ${Object.keys(palletRackData).length}개 weight 레벨`);
  console.log(`   - 신형: 0개 weight 레벨 (추가 예정)`);
} else {
  console.log('⚠️ 파렛트랙 데이터를 찾을 수 없습니다.');
}

// 변경된 데이터 저장
console.log('3. 변경된 데이터 저장 중...');
fs.writeFileSync(bomDataPath, JSON.stringify(bomData, null, 2), 'utf8');
console.log(`✅ 저장 완료: ${bomDataPath}`);

console.log('✅ 모든 작업 완료!');

