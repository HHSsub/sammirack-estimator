import React, { useState, useEffect } from 'react';
import { generateInventoryPartId } from '../utils/unifiedPriceManager';
import { inventoryService } from '../services/InventoryService';
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
 * - onConfirm: "무시하고 전송/인쇄" 콜백 함수
 * - onCancel: "취소" 콜백 함수
 */
function ShortageInventoryPanel({ 
  shortageItems = [], 
  onClose, 
  onSave,
  onConfirm,
  onCancel
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

  // ✅ "무시하고 전송/인쇄" 핸들러
  const handleProceed = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  // ✅ "취소" 핸들러
  const handleCancelAction = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  if (!shortageItems || shortageItems.length === 0) {
    return null;
  }

  return (
    <div className="shortage-inventory-panel">
      {/* 헤더 */}
      <div className="shortage-panel-header">
        <div className="shortage-panel-title">
          <span>⚠️ 재고 부족 알림</span>
          <button 
            className="shortage-panel-close" 
            onClick={handleCancelAction}
            disabled={isSaving}
          >
            ✕
          </button>
        </div>
        <div className="shortage-panel-subtitle">
          다음 품목의 재고가 부족합니다
        </div>
      </div>

      {/* 부족 품목 목록 */}
      <div className="shortage-panel-content">
        {shortageItems.map((item, index) => {
          const partId = generateInventoryPartId(
            item.rackType || '',
            item.name || '',
            item.specification || '',
            item.colorWeight || ''
          );
          const currentStock = inventory[partId] || item.serverInventory || 0;

          return (
            <div 
              key={index} 
              className={`shortage-item ${item.isShortage ? 'has-shortage' : 'no-shortage'}`}
            >
              <div className="shortage-item-name">{item.name || '-'}</div>
              <div className="shortage-item-specs">
                규격: {item.specification || '-'} | 거치대: {item.rackType || '-'}
              </div>

              <div className="shortage-item-grid">
                <div className="shortage-required">
                  필요 수량:
                  <span className="shortage-required-value">{item.quantity || 0}</span>
                </div>
                <div className="shortage-shortage">
                  부족 수량:
                  <span className="shortage-shortage-value">{item.shortage || 0}</span>
                </div>
              </div>

              <div className="shortage-current-stock">
                <div className="shortage-current-stock-row">
                  <span className="shortage-current-stock-label">현재 재고:</span>
                  {isAdmin ? (
                    <input
                      type="number"
                      value={currentStock}
                      onChange={(e) => handleQuantityChange(partId, e.target.value)}
                      disabled={isSaving}
                      className="shortage-quantity-input"
                    />
                  ) : (
                    <span className={`shortage-quantity-display ${currentStock === 0 ? 'zero' : 'normal'}`}>
                      {currentStock}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 버튼 영역 */}
      <div className="shortage-panel-actions">
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="shortage-save-button"
          >
            {isSaving ? '저장 중...' : '재고 저장'}
          </button>
        )}
        
        {onConfirm && (
          <button
            onClick={handleProceed}
            disabled={isSaving}
            className="shortage-proceed-button"
          >
            무시하고 진행
          </button>
        )}
        
        <button
          onClick={handleCancelAction}
          disabled={isSaving}
          className="shortage-close-button"
        >
          {onCancel ? '취소 (중단)' : '닫기'}
        </button>

        {/* 관리자만 재고를 직접 수정할 수 있습니다 안내 */}
        <div className={`shortage-permission-info ${isAdmin ? 'admin' : 'guest'}`}>
          {isAdmin 
            ? '💡 관리자 권한으로 재고를 수정할 수 있습니다.' 
            : '💡 관리자만 재고를 직접 수정할 수 있습니다.'}
        </div>
      </div>
    </div>
  );
}

export default ShortageInventoryPanel;
