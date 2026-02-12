const API_BASE = 'http://139.150.11.53:3001/api';

async function runMigration() {
    console.log('🚀 하이랙 기둥 마이그레이션을 시작합니다...');

    try {
        // 1. 재고 마이그레이션
        console.log('\n📦 1/2: 재고 수량 합산 중...');
        const invRes = await fetch(`${API_BASE}/inventory/migrate-high-rack`, { method: 'POST' });
        const invData = await invRes.json();
        if (invRes.ok) {
            console.log(`✅ 재고 마이그레이션 성공! (처리된 항목: ${invData.count}개)`);
        } else {
            console.error('❌ 재고 마이그레이션 실패:', invData.error);
        }

        // 2. 가격 마이그레이션
        console.log('\n💰 2/2: 가격 데이터 정리 중...');
        const priceRes = await fetch(`${API_BASE}/prices/migrate-high-rack`, { method: 'POST' });
        const priceData = await priceRes.json();
        if (priceRes.ok) {
            console.log(`✅ 가격 마이그레이션 성공! (처리된 항목: ${priceData.count}개)`);
        } else {
            console.error('❌ 가격 마이그레이션 실패:', priceData.error);
        }

        console.log('\n✨ 모든 마이그레이션 작업이 완료되었습니다!');
    } catch (error) {
        console.error('\n❌ 통신 에러 발생:', error.message);
    }
}

runMigration();
