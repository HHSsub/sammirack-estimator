import { inventoryAPI } from './apiClient';

class InventoryService {
  async getInventory() {
    try {
      console.log('📦 Gabia API에서 재고 데이터 가져오기...');
      const response = await inventoryAPI.getAll();
      console.log('✅ 재고 데이터 로드 완료:', Object.keys(response.data).length, '개');
      return response.data;
    } catch (error) {
      console.error('❌ Gabia API에서 재고 데이터 로드 실패:', error);
      const localInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');
      console.log('⚠️ 로컬 캐시 사용:', Object.keys(localInventory).length, '개');
      return localInventory;
    }
  }

  async updateInventory(updates) {
    try {
      console.log('💾 Gabia API로 재고 업데이트 요청...', Object.keys(updates).length, '개');
      const response = await inventoryAPI.update(updates);
      console.log('✅ 재고 업데이트 성공');

      localStorage.setItem('inventory_data', JSON.stringify(response.data.inventory));

      // ✅ 이벤트 발생 추가!
      window.dispatchEvent(new CustomEvent('inventoryUpdated', {
        detail: { inventory: response.data.inventory }
      }));

      return response.data.inventory;
    } catch (error) {
      console.error('❌ 재고 데이터 서버 업데이트 실패:', error);
      throw new Error('재고 데이터 서버 업데이트 실패');
    }
  }

  // ✅ 원자적 재고 차감 (Race Condition 방지)
  async deductInventory(deductions, documentId = '', userIp = null) {
    try {
      console.log('🔻 Gabia API로 원자적 재고 차감 요청...', Object.keys(deductions).length, '개');
      console.log('   문서 ID:', documentId);
      console.log('   감소량:', deductions);

      const response = await inventoryAPI.deduct(deductions, documentId, userIp);

      if (!response.data.success) {
        throw new Error(response.data.error || '재고 차감 서버 응답 오류');
      }

      console.log('✅ 원자적 재고 차감 성공');
      console.log('   결과:', response.data.results);

      if (response.data.warnings && response.data.warnings.length > 0) {
        console.warn('⚠️ 재고 부족 경고:', response.data.warnings);
      }

      return response.data;
    } catch (error) {
      console.error('❌ 원자적 재고 차감 실패:', error);
      throw new Error(error.response?.data?.error || error.message || '재고 차감 실패');
    }
  }

  // ✅ 재고 복구 (취소/롤백용)
  async restoreInventory(restorations, documentId = '', userIp = null) {
    try {
      console.log('🔺 Gabia API로 재고 복구 요청...', Object.keys(restorations).length, '개');
      console.log('   문서 ID:', documentId);
      console.log('   복구량:', restorations);

      const response = await inventoryAPI.restore(restorations, documentId, userIp);

      if (!response.data.success) {
        throw new Error(response.data.error || '재고 복구 서버 응답 오류');
      }

      console.log('✅ 재고 복구 성공');
      console.log('   결과:', response.data.results);

      return response.data;
    } catch (error) {
      console.error('❌ 재고 복구 실패:', error);
      throw new Error(error.response?.data?.error || error.message || '재고 복구 실패');
    }
  }
}

export const inventoryService = new InventoryService();
