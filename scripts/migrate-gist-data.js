// Gist 데이터 마이그레이션 스크립트
// 구형 파렛트랙의 재고 및 관리자 단가 정보를 신형으로 복사

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inventoryPath = path.join(__dirname, '..', 'inventory.json');
const adminPricesPath = path.join(__dirname, '..', 'admin_prices.json');
const inventoryBackupPath = path.join(__dirname, '..', 'inventory.json.backup');
const adminPricesBackupPath = path.join(__dirname, '..', 'admin_prices.json.backup');

console.log('📦 Gist 데이터 마이그레이션 시작...\n');

// 1. 백업 생성
console.log('1. 백업 생성 중...');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const adminPrices = JSON.parse(fs.readFileSync(adminPricesPath, 'utf8'));

fs.writeFileSync(inventoryBackupPath, JSON.stringify(inventory, null, 2), 'utf8');
fs.writeFileSync(adminPricesBackupPath, JSON.stringify(adminPrices, null, 2), 'utf8');
console.log(`✅ 백업 완료: ${inventoryBackupPath}`);
console.log(`✅ 백업 완료: ${adminPricesBackupPath}\n`);

// 2. inventory.json 마이그레이션
console.log('2. inventory.json 마이그레이션 중...');
let inventoryCount = 0;
const newInventory = { ...inventory };

Object.keys(inventory).forEach(oldPartId => {
  if (oldPartId.startsWith('파렛트랙-') && !oldPartId.startsWith('파렛트랙신형-') && !oldPartId.startsWith('파렛트랙 철판형-')) {
    const newPartId = oldPartId.replace('파렛트랙-', '파렛트랙신형-');
    if (!newInventory[newPartId]) {
      newInventory[newPartId] = inventory[oldPartId];
      inventoryCount++;
      console.log(`   ✅ 복사: ${oldPartId} (${inventory[oldPartId]}) → ${newPartId}`);
    } else {
      console.log(`   ⚠️  이미 존재: ${newPartId} (건너뜀)`);
    }
  }
});

console.log(`✅ inventory.json 마이그레이션 완료: ${inventoryCount}개 항목 복사\n`);

// 3. admin_prices.json 마이그레이션
console.log('3. admin_prices.json 마이그레이션 중...');
let adminPricesCount = 0;
const newAdminPrices = { ...adminPrices };

Object.keys(adminPrices).forEach(oldPartId => {
  if (oldPartId.startsWith('파렛트랙-') && !oldPartId.startsWith('파렛트랙신형-') && !oldPartId.startsWith('파렛트랙 철판형-')) {
    const newPartId = oldPartId.replace('파렛트랙-', '파렛트랙신형-');
    if (!newAdminPrices[newPartId]) {
      const oldEntry = adminPrices[oldPartId];
      // partInfo의 rackType도 업데이트
      const newEntry = {
        ...oldEntry,
        partInfo: oldEntry.partInfo ? {
          ...oldEntry.partInfo,
          rackType: '파렛트랙' // partId 생성 시 자동으로 파렛트랙신형으로 변환되므로 그대로 유지
        } : oldEntry.partInfo
      };
      newAdminPrices[newPartId] = newEntry;
      adminPricesCount++;
      console.log(`   ✅ 복사: ${oldPartId} (${oldEntry.price}원) → ${newPartId}`);
    } else {
      console.log(`   ⚠️  이미 존재: ${newPartId} (건너뜀)`);
    }
  }
});

console.log(`✅ admin_prices.json 마이그레이션 완료: ${adminPricesCount}개 항목 복사\n`);

// 4. 변경된 데이터 저장
console.log('4. 변경된 데이터 저장 중...');
fs.writeFileSync(inventoryPath, JSON.stringify(newInventory, null, 2), 'utf8');
fs.writeFileSync(adminPricesPath, JSON.stringify(newAdminPrices, null, 2), 'utf8');
console.log(`✅ 저장 완료: ${inventoryPath}`);
console.log(`✅ 저장 완료: ${adminPricesPath}\n`);

// 5. 요약
console.log('📊 마이그레이션 요약:');
console.log(`   - inventory.json: ${inventoryCount}개 항목 복사`);
console.log(`   - admin_prices.json: ${adminPricesCount}개 항목 복사`);
console.log(`   - 총 ${inventoryCount + adminPricesCount}개 항목 마이그레이션 완료\n`);

console.log('✅ 모든 작업 완료!');
console.log('⚠️  이제 이 파일들을 Gist 서버에 업로드하세요.');

