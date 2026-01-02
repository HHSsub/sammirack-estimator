// 파렛트랙 version 마이그레이션 스크립트
// 구형 파렛트랙 데이터를 신형으로 복사

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bomDataPath = path.join(__dirname, '..', 'public', 'bom_data_weight_added.json');
const backupPath = path.join(__dirname, '..', 'public', 'bom_data_weight_added.json.backup');

console.log('📦 파렛트랙 신형 데이터 채우기 시작...');

// 백업 생성
console.log('1. 백업 생성 중...');
if (fs.existsSync(bomDataPath)) {
  fs.copyFileSync(bomDataPath, backupPath);
  console.log(`✅ 백업 완료: ${backupPath}`);
} else {
  console.log('⚠️ 원본 파일을 찾을 수 없습니다.');
  process.exit(1);
}

// 데이터 로드
console.log('2. 데이터 로드 중...');
const bomData = JSON.parse(fs.readFileSync(bomDataPath, 'utf8'));

if (!bomData['파렛트랙']) {
  console.log('⚠️ 파렛트랙 데이터를 찾을 수 없습니다.');
  process.exit(1);
}

const palletRackData = bomData['파렛트랙'];

if (!palletRackData['구형']) {
  console.log('⚠️ 구형 데이터를 찾을 수 없습니다.');
  process.exit(1);
}

// 구형 데이터를 깊은 복사하여 신형 데이터로 설정
console.log('3. 구형 데이터를 신형으로 복사 중...');

// 깊은 복사 함수
function deepCopy(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepCopy(item));
  }
  
  const copy = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepCopy(obj[key]);
    }
  }
  return copy;
}

// 구형 데이터를 신형으로 복사
palletRackData['신형'] = deepCopy(palletRackData['구형']);

console.log('✅ 신형 데이터 복사 완료');
console.log(`   - 구형: ${Object.keys(palletRackData['구형']).length}개 weight 레벨`);
console.log(`   - 신형: ${Object.keys(palletRackData['신형']).length}개 weight 레벨`);

// 변경된 데이터 저장
console.log('4. 변경된 데이터 저장 중...');
fs.writeFileSync(bomDataPath, JSON.stringify(bomData, null, 2), 'utf8');

console.log('\n✅ 파렛트랙 신형 데이터 채우기 완료!');
console.log(`   파일: ${bomDataPath}`);
console.log(`   백업: ${backupPath}`);
