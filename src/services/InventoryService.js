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
      
      return response.data.inventory;
    } catch (error) {
      console.error('❌ 재고 데이터 서버 업데이트 실패:', error);
      throw new Error('재고 데이터 서버 업데이트 실패');
    }
  }
}

export const inventoryService = new InventoryService();
