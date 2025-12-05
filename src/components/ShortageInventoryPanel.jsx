import React, { useState, useEffect } from 'react';
import { generateInventoryPartId } from '../utils/unifiedPriceManager';
import inventoryService from '../services/inventoryService';
import './ShortageInventoryPanel.css';

/**
 * ShortageInventoryPanel 컴포넌트
 * 
 * 재고 부족 품목을 표시하고 관리자가 재고를 수정할 수 있는 패널입니다.
 * 
 * Props:
 * - shortageItems: 부족한 품목 목록 (배열)
 * - onClose: 패널 닫기 콜백 함수
 * - onSave: 저장 완료 후 콜백 함수
 */
function ShortageInventoryPanel({ 
  shortageItems = [], 
  onClose, 
  onSave 
}) {
  const [inventory, setInventory] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(adminStatus);
    
    // 로컬스토리지에서 inventory_data 불러오기
    const savedInventory = localStorage.getItem('inventory_data');
    if (savedInventory) {
      try {
        setInventory(JSON.parse(savedInventory));
      } catch (e) {
        console.error('재고 데이터 파싱 실패:', e);
      }
    }
  }, []);

  /**
   * 재고 수량 변경 핸들러
   * 관리자만 재고를 직접 수정할 수 있습니다.
   */
  const handleQuantityChange = (partId, value) => {
    const numValue = parseInt(value) || 0;
    setInventory(prev => ({
      ...prev,
      [partId]: numValue
    }));
  };

  /**
   * 재고 저장 핸들러
   * 로컬스토리지와 서버 재고를 동시에 업데이트합니다.
   */
  const handleSave = async () => {
    if (!isAdmin) {
      alert('관리자만 재고를 수정할 수 있습니다.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. 로컬스토리지 저장
      localStorage.setItem('inventory_data', JSON.stringify(inventory));
      
      // 2. 서버 재고 동기화
      await inventoryService.updateInventory(inventory);
      
      // 3. inventoryUpdated 이벤트 발생
      window.dispatchEvent(new CustomEvent('inventoryUpdated', {
        detail: { inventory }
      }));

      alert('재고가 성공적으로 업데이트되었습니다.');
      
      if (onSave) {
        onSave(inventory);
      }
      
      onClose();
    } catch (error) {
      console.error('재고 저장 실패:', error);
      alert('재고 저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!shortageItems || shortageItems.length === 0) {
    return null;
  }

  return (
    <div className="shortage-panel-overlay">
      <div className="shortage-panel-content">
        <h2 className="shortage-panel-title">
          ⚠️ 재고 부족 알림
        </h2>
        
        <div className="shortage-panel-warning">
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            다음 품목의 재고가 부족합니다:
          </p>
        </div>

        <div className="shortage-panel-table-wrapper">
          <table className="shortage-panel-table">
            <thead>
              <tr>
                <th>규격</th>
                <th>품명</th>
                <th>거치대</th>
                <th>필요 수량</th>
                <th>부족 수량</th>
                <th>현재 재고</th>
              </tr>
            </thead>
            <tbody>
              {shortageItems.map((item, index) => {
                const partId = generateInventoryPartId(
                  item.rackType || '',
                  item.name || '',
                  item.specification || '',
                  item.colorWeight || ''
                );
                const currentStock = inventory[partId] || item.serverInventory || 0;

                return (
                  <tr key={index} className={item.isShortage ? 'shortage-row' : ''}>
                    <td>{item.specification || '-'}</td>
                    <td>{item.name || '-'}</td>
                    <td className="text-center">{item.rackType || '-'}</td>
                    <td className="text-right">{item.quantity || 0}</td>
                    <td className="text-right shortage-amount">
                      {item.shortage || 0}
                    </td>
                    <td className="text-right">
                      {isAdmin ? (
                        <input
                          type="number"
                          value={currentStock}
                          onChange={(e) => handleQuantityChange(partId, e.target.value)}
                          disabled={isSaving}
                          className="shortage-input"
                        />
                      ) : (
                        <span>{currentStock}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 관리자만 재고를 직접 수정할 수 있습니다 안내 */}
        {!isAdmin && (
          <div className="shortage-panel-info">
            <p>💡 관리자만 재고를 직접 수정할 수 있습니다.</p>
          </div>
        )}

        <div className="shortage-panel-buttons">
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="shortage-btn shortage-btn-save"
            >
              {isSaving ? '저장 중...' : '재고 저장'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="shortage-btn shortage-btn-close"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShortageInventoryPanel;
