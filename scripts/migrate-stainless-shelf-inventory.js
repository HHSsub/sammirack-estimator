// 스텐랙 선반 재고 데이터 마이그레이션 스크립트
// 기존 사이즈별 재고를 W(너비)만으로 통합
// 예: 스텐랙-선반-사이즈43x90, 스텐랙-선반-사이즈43x120 등 → 스텐랙-선반-43

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 또는 명령줄 인자로부터 설정 가져오기
const GIST_ID = process.env.VITE_GITHUB_GIST_ID || process.argv[3];
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.argv[4];
const GIST_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : null;
const GIST_RAW_URL = 'https://gist.githubusercontent.com/HHSsub/5f9bbee69fda5cad68fa0ced4b657f3c/raw/inventory.json';

// 실행 모드: 'local' (로컬 파일) 또는 'gist' (Gist API 직접 사용)
const mode = process.argv[2] || 'local';
const inventoryPath = mode === 'local' 
  ? (process.argv[3] || path.join(__dirname, '..', 'inventory.json'))
  : null;

console.log('📦 스텐랙 선반 재고 데이터 마이그레이션 시작...\n');
console.log(`📋 실행 모드: ${mode === 'gist' ? 'Gist API 직접 사용' : '로컬 파일'}\n`);

let inventory = {};
let inventoryBackupPath = null;

// ========================================
// 모드 1: 로컬 파일 사용
// ========================================
if (mode === 'local') {
  if (!fs.existsSync(inventoryPath)) {
    console.error(`❌ 재고 파일을 찾을 수 없습니다: ${inventoryPath}`);
    console.error(`\n💡 사용법:`);
    console.error(`   node scripts/migrate-stainless-shelf-inventory.js local [파일경로]`);
    console.error(`   예: node scripts/migrate-stainless-shelf-inventory.js local inventory.json\n`);
    process.exit(1);
  }

  inventoryBackupPath = inventoryPath + '.backup.' + Date.now();
  
  console.log('1. 백업 생성 중...');
  fs.copyFileSync(inventoryPath, inventoryBackupPath);
  console.log(`   ✅ 백업 생성 완료: ${inventoryBackupPath}\n`);

  console.log('2. 재고 데이터 로드 중...');
  inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  console.log(`   ✅ 재고 데이터 로드 완료: ${Object.keys(inventory).length}개 항목\n`);
}
// ========================================
// 모드 2: Gist API 직접 사용
// ========================================
else if (mode === 'gist') {
  if (!GIST_ID || !GITHUB_TOKEN) {
    console.error('❌ Gist ID 또는 GitHub Token이 설정되지 않았습니다.');
    console.error(`\n💡 사용법:`);
    console.error(`   node scripts/migrate-stainless-shelf-inventory.js gist [GIST_ID] [GITHUB_TOKEN]`);
    console.error(`   또는 .env 파일에 VITE_GITHUB_GIST_ID와 VITE_GITHUB_TOKEN 설정\n`);
    process.exit(1);
  }

  console.log('1. Gist에서 재고 데이터 다운로드 중...');
  try {
    const response = await fetch(GIST_RAW_URL);
    if (!response.ok) {
      throw new Error(`Gist fetch failed: ${response.status}`);
    }
    inventory = await response.json();
    console.log(`   ✅ 재고 데이터 다운로드 완료: ${Object.keys(inventory).length}개 항목\n`);
    
    // 로컬 백업 생성
    inventoryBackupPath = path.join(__dirname, '..', `inventory.backup.${Date.now()}.json`);
    fs.writeFileSync(inventoryBackupPath, JSON.stringify(inventory, null, 2), 'utf8');
    console.log(`   ✅ 로컬 백업 생성: ${inventoryBackupPath}\n`);
  } catch (error) {
    console.error('❌ Gist에서 재고 데이터 다운로드 실패:', error.message);
    process.exit(1);
  }
} else {
  console.error(`❌ 잘못된 모드: ${mode}`);
  console.error(`\n💡 사용법:`);
  console.error(`   로컬 파일: node scripts/migrate-stainless-shelf-inventory.js local [파일경로]`);
  console.error(`   Gist API:  node scripts/migrate-stainless-shelf-inventory.js gist [GIST_ID] [GITHUB_TOKEN]\n`);
  process.exit(1);
}

// 3. 스텐랙 선반 재고 통합
console.log('3. 스텐랙 선반 재고 통합 중...');

const mergedInventory = { ...inventory };
const shelf43Keys = [];
const shelf50Keys = [];

// 기존 사이즈별 키 찾기
Object.keys(mergedInventory).forEach(key => {
  if (key.startsWith('스텐랙-선반-사이즈43x')) {
    shelf43Keys.push(key);
  } else if (key.startsWith('스텐랙-선반-사이즈50x')) {
    shelf50Keys.push(key);
  }
});

// 43 사이즈 통합
if (shelf43Keys.length > 0) {
  const total43 = shelf43Keys.reduce((sum, key) => sum + (mergedInventory[key] || 0), 0);
  mergedInventory['스텐랙-선반-43'] = total43;
  console.log(`   ✅ 선반(43) 통합: ${shelf43Keys.length}개 항목 → 총 ${total43}개`);
  shelf43Keys.forEach(key => {
    console.log(`      - ${key}: ${mergedInventory[key]}개`);
    delete mergedInventory[key];
  });
}

// 50 사이즈 통합
if (shelf50Keys.length > 0) {
  const total50 = shelf50Keys.reduce((sum, key) => sum + (mergedInventory[key] || 0), 0);
  mergedInventory['스텐랙-선반-50'] = total50;
  console.log(`   ✅ 선반(50) 통합: ${shelf50Keys.length}개 항목 → 총 ${total50}개`);
  shelf50Keys.forEach(key => {
    console.log(`      - ${key}: ${mergedInventory[key]}개`);
    delete mergedInventory[key];
  });
}

console.log('');

// 4. 기타추가옵션용 재고도 통합 (있다면)
const extraShelf43Keys = [];
const extraShelf50Keys = [];

Object.keys(mergedInventory).forEach(key => {
  if (key.startsWith('스텐랙-43x') && key.includes('선반-')) {
    extraShelf43Keys.push(key);
  } else if (key.startsWith('스텐랙-50x') && key.includes('선반-')) {
    extraShelf50Keys.push(key);
  }
});

if (extraShelf43Keys.length > 0) {
  const total43 = extraShelf43Keys.reduce((sum, key) => sum + (mergedInventory[key] || 0), 0);
  const existing43 = mergedInventory['스텐랙-선반-43'] || 0;
  mergedInventory['스텐랙-선반-43'] = existing43 + total43;
  console.log(`   ✅ 기타추가옵션 선반(43) 통합: ${extraShelf43Keys.length}개 항목 → 추가 ${total43}개`);
  extraShelf43Keys.forEach(key => {
    console.log(`      - ${key}: ${mergedInventory[key]}개`);
    delete mergedInventory[key];
  });
}

if (extraShelf50Keys.length > 0) {
  const total50 = extraShelf50Keys.reduce((sum, key) => sum + (mergedInventory[key] || 0), 0);
  const existing50 = mergedInventory['스텐랙-선반-50'] || 0;
  mergedInventory['스텐랙-선반-50'] = existing50 + total50;
  console.log(`   ✅ 기타추가옵션 선반(50) 통합: ${extraShelf50Keys.length}개 항목 → 추가 ${total50}개`);
  extraShelf50Keys.forEach(key => {
    console.log(`      - ${key}: ${mergedInventory[key]}개`);
    delete mergedInventory[key];
  });
}

console.log('');

// 5. 통합된 재고 저장
console.log('4. 통합된 재고 데이터 저장 중...');

if (mode === 'local') {
  fs.writeFileSync(inventoryPath, JSON.stringify(mergedInventory, null, 2), 'utf8');
  console.log(`   ✅ 로컬 파일 저장 완료: ${Object.keys(mergedInventory).length}개 항목\n`);
} else if (mode === 'gist') {
  try {
    const payload = {
      files: {
        'inventory.json': {
          content: JSON.stringify(mergedInventory, null, 2),
        },
      },
    };

    const response = await fetch(GIST_URL, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gist 업로드 실패: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    console.log(`   ✅ Gist 서버 업로드 완료: ${Object.keys(mergedInventory).length}개 항목\n`);
  } catch (error) {
    console.error('❌ Gist 업로드 실패:', error.message);
    console.error('\n⚠️  로컬 백업 파일을 확인하고 수동으로 업로드하세요.');
    console.error(`   백업 파일: ${inventoryBackupPath}\n`);
    
    // 실패해도 로컬에 저장
    const localSavePath = path.join(__dirname, '..', `inventory.migrated.${Date.now()}.json`);
    fs.writeFileSync(localSavePath, JSON.stringify(mergedInventory, null, 2), 'utf8');
    console.log(`   💾 로컬에 저장됨: ${localSavePath}\n`);
    process.exit(1);
  }
}

console.log('✅ 마이그레이션 완료!\n');
console.log('📋 변경 사항:');
console.log(`   - 선반(43): ${mergedInventory['스텐랙-선반-43'] || 0}개`);
console.log(`   - 선반(50): ${mergedInventory['스텐랙-선반-50'] || 0}개`);
if (inventoryBackupPath) {
  console.log(`\n⚠️  백업 파일: ${inventoryBackupPath}`);
}
console.log('');

