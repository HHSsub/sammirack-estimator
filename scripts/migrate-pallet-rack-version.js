// 파렛트랙 version 마이그레이션 스크립트
// 구형 파렛트랙의 관리자 단가와 재고 정보를 신형으로 복사

const fs = require('fs');
const path = require('path');

console.log('📦 파렛트랙 version 마이그레이션 시작...');

// 1. 관리자 단가 정보 복사 (localStorage)
console.log('\n1. 관리자 단가 정보 마이그레이션');
console.log('   ⚠️  이 스크립트는 브라우저에서 실행되어야 합니다.');
console.log('   브라우저 콘솔에서 다음 코드를 실행하세요:');
console.log(`
// 관리자 단가 마이그레이션
const stored = localStorage.getItem('admin_edit_prices') || '{}';
const priceData = JSON.parse(stored);
const newPriceData = { ...priceData };

// 구형 partId를 신형 partId로 변환하여 복사
Object.keys(priceData).forEach(oldPartId => {
  if (oldPartId.startsWith('파렛트랙-')) {
    const newPartId = oldPartId.replace('파렛트랙-', '파렛트랙신형-');
    if (!newPriceData[newPartId]) {
      newPriceData[newPartId] = { ...priceData[oldPartId] };
      console.log(\`✅ 복사: \${oldPartId} → \${newPartId}\`);
    }
  }
});

localStorage.setItem('admin_edit_prices', JSON.stringify(newPriceData));
console.log('✅ 관리자 단가 마이그레이션 완료');
`);

// 2. 재고 정보 복사 (Gist)
console.log('\n2. 재고 정보 마이그레이션');
console.log('   ⚠️  재고 정보는 Gist API를 통해 업데이트해야 합니다.');
console.log('   InventoryService.js의 updateInventory 함수를 사용하거나');
console.log('   Gist에서 직접 inventory.json을 수정하세요.');
console.log(`
// 재고 정보 마이그레이션 (Gist API 사용)
// 구형 partId를 신형 partId로 변환하여 복사
// 예: "파렛트랙-기둥-h4500" → "파렛트랙신형-기둥-h4500"
`);

console.log('\n✅ 마이그레이션 가이드 완료');
console.log('   실제 마이그레이션은 브라우저 콘솔과 Gist API를 통해 수행하세요.');

