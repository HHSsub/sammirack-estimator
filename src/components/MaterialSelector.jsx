// src/components/MaterialSelector.jsx
import React, { useState, useEffect } from 'react';
import { loadAllMaterials, getEffectivePrice } from '../utils/unifiedPriceManager';
import './MaterialSelector.css';

const MaterialSelector = ({ isOpen, onClose, onAdd }) => {
  // 데이터 상태
  const [allMaterials, setAllMaterials] = useState([]);
  const [inventory, setInventory] = useState({});
  const [adminPrices, setAdminPrices] = useState({});
  const [loading, setLoading] = useState(false);

  // 필터/검색 상태
  const [selectedRackType, setSelectedRackType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  // 선택 상태
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customMode, setCustomMode] = useState(false);
  const [customData, setCustomData] = useState({
    name: '',
    specification: '',
    quantity: 1,
    unitPrice: 0
  });
  const [quickAction, setQuickAction] = useState(null); // '공임' or '운임'

  // 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔄 MaterialSelector: 데이터 로드 시작');

      // 1. 전체 원자재 로드
      const materials = await loadAllMaterials();
      setAllMaterials(materials);
      console.log(`✅ ${materials.length}개 원자재 로드 완료`);

      // 2. 재고 데이터 로드
      const inv = JSON.parse(localStorage.getItem('inventory_data') || '{}');
      setInventory(inv);
      console.log(`✅ 재고 데이터: ${Object.keys(inv).length}개`);

      // 3. 관리자 단가 로드
      const prices = JSON.parse(localStorage.getItem('admin_edit_prices') || '{}');
      setAdminPrices(prices);
      console.log(`✅ 관리자 단가: ${Object.keys(prices).length}개`);
    } catch (error) {
      console.error('❌ MaterialSelector 데이터 로드 실패:', error);
      alert('자재 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 자재 목록
  const filteredMaterials = allMaterials.filter(material => {
    // 랙 타입 필터
    if (selectedRackType && material.rackType !== selectedRackType) {
      return false;
    }

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = (material.name || '').toLowerCase().includes(term);
      const matchSpec = (material.specification || '').toLowerCase().includes(term);
      const matchPartId = (material.partId || '').toLowerCase().includes(term);
      if (!matchName && !matchSpec && !matchPartId) {
        return false;
      }
    }

    // 재고 있는 것만 보기
    if (showOnlyInStock) {
      const stock = inventory[material.partId] || 0;
      if (stock <= 0) {
        return false;
      }
    }

    return true;
  });

  // 랙 타입 목록 추출
  const rackTypes = [...new Set(allMaterials.map(m => m.rackType))].sort();

  // 자재 선택
  const handleSelectMaterial = (material) => {
    setSelectedMaterial(material);
  };

  // 추가 버튼 핸들러
  const handleAdd = () => {
    if (customMode) {
      // 기타 자재 입력
      if (!customData.name.trim()) {
        alert('부품명을 입력하세요.');
        return;
      }

      onAdd({
        name: customData.name,
        specification: customData.specification,
        quantity: customData.quantity,
        unitPrice: customData.unitPrice,
        totalPrice: customData.quantity * customData.unitPrice,
        note: ''
      });

      // 초기화
      setCustomData({
        name: '',
        specification: '',
        quantity: 1,
        unitPrice: 0
      });
    } else {
      // 시스템 자재 선택
      if (!selectedMaterial) {
        alert('자재를 선택하세요.');
        return;
      }

      // 관리자 단가 적용
      const effectivePrice = getEffectivePrice(selectedMaterial, adminPrices);

      onAdd({
        name: selectedMaterial.name,
        specification: selectedMaterial.specification || '',
        quantity: quantity,
        unitPrice: effectivePrice,
        totalPrice: quantity * effectivePrice,
        note: '',
        // ✅ 재고 매핑을 위한 메타데이터 추가
        rackType: selectedMaterial.rackType || '기타',
        colorWeight: selectedMaterial.colorWeight || '',
        color: selectedMaterial.color || '',
        partId: selectedMaterial.partId || ''
      });

      // 선택은 유지, 수량만 초기화
      setQuantity(1);
    }
  };

  // 닫기 핸들러
  const handleClose = () => {
    setSelectedRackType('');
    setSearchTerm('');
    setShowOnlyInStock(false);
    setSelectedMaterial(null);
    setQuantity(1);
    setCustomMode(false);
    setCustomData({
      name: '',
      specification: '',
      quantity: 1,
      unitPrice: 0
    });
    setQuickAction(null);
    onClose();
  };

  // ESC 키 핸들러
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // ✅ 퀵 버튼 핸들러
  const handleQuickAdd = (type, price) => {
    onAdd({
      name: type,
      unit: '개',
      quantity: 1,
      unitPrice: price,
      totalPrice: price,
      note: '',
      isService: true // 재고 감소 제외용 플래그
    });
    setQuickAction(null);
  };

  const handleQuickManual = (type) => {
    setCustomMode(true);
    setCustomData({
      name: type,
      specification: '',
      quantity: 1,
      unitPrice: 0
    });
    setQuickAction(null);
  };

  if (!isOpen) return null;

  return (
    <div className="material-selector-panel">
      <div className="panel-header">
        <h4>자재 선택</h4>
        <button className="close-btn" onClick={handleClose}>✕</button>
      </div>

      {/* 모드 전환 및 퀵 버튼 */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          className={`custom-btn ${customMode ? 'active' : ''}`}
          onClick={() => {
            setCustomMode(!customMode);
            setQuickAction(null);
          }}
        >
          {customMode ? '시스템 자재' : '기타 입력'}
        </button>

        {!customMode && (
          <div className="quick-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {!quickAction ? (
              <>
                <button className="quick-btn" onClick={() => setQuickAction('공임')}>공임</button>
                <button className="quick-btn" onClick={() => setQuickAction('운임')}>운임</button>
              </>
            ) : (
              <div className="quick-price-selection" style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#e9ecef', padding: '4px 8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{quickAction}:</span>
                <button className="price-opt-btn" onClick={() => handleQuickAdd(quickAction, 1000)}>1,000</button>
                <button className="price-opt-btn" onClick={() => handleQuickAdd(quickAction, 10000)}>10,000</button>
                <button className="price-opt-btn" onClick={() => handleQuickManual(quickAction)}>직접입력</button>
                <button className="price-opt-cancel" onClick={() => setQuickAction(null)}>✕</button>
              </div>
            )}
          </div>
        )}
      </div>

      {!customMode ? (
        <>
          <div className="filter-row">
            <div className="filter-field">
              <label>랙 타입</label>
              <select value={selectedRackType} onChange={e => setSelectedRackType(e.target.value)}>
                <option value="">전체</option>
                {rackTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <input
                type="text"
                placeholder="검색 (부품명, 규격, ID)"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <label>
                <input
                  type="checkbox"
                  checked={showOnlyInStock}
                  onChange={e => setShowOnlyInStock(e.target.checked)}
                />
                재고있는것만
              </label>
            </div>
          </div>

          <div className="material-count">
            {filteredMaterials.length}개 자재
          </div>

          <div className="material-list">
            {filteredMaterials.map(mat => {
              const stock = inventory[mat.partId] || 0;
              const hasStock = stock > 0;
              const isSelected = selectedMaterial?.partId === mat.partId;

              return (
                <div
                  key={mat.partId}
                  className={`material-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectMaterial(mat)}
                >
                  <div className="material-radio">
                    <input
                      type="radio"
                      name="material"
                      checked={isSelected}
                      readOnly
                    />
                  </div>
                  <div className="material-info">
                    <div className="material-name">{mat.name}</div>
                    {mat.specification && (
                      <div className="material-spec">{mat.specification}</div>
                    )}
                    <div className="material-meta">
                      {mat.hasAdminPrice && (
                        <span className="admin-price-badge">관리자가</span>
                      )}
                      <span className={`stock-badge ${hasStock ? 'in-stock' : 'out-of-stock'}`}>
                        재고: {stock}
                      </span>
                      {mat.price > 0 && (
                        <span className="price-badge">
                          {mat.price.toLocaleString()}원
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedMaterial && (
            <div className="selected-info">
              선택: {selectedMaterial.name} ({selectedMaterial.price.toLocaleString()}원)
            </div>
          )}

          <div className="quantity-field">
            <label>수량</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </>
      ) : (
        <div className="custom-input-section">
          <h5>기타 입력</h5>
          <div className="custom-row">
            <input
              type="text"
              placeholder="부품명"
              value={customData.name}
              onChange={e => setCustomData({ ...customData, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="규격"
              value={customData.specification}
              onChange={e => setCustomData({ ...customData, specification: e.target.value })}
            />
            <input
              type="number"
              placeholder="수량"
              min="1"
              value={customData.quantity}
              onChange={e => setCustomData({ ...customData, quantity: Math.max(1, Number(e.target.value) || 1) })}
            />
            <input
              type="number"
              placeholder="단가"
              min="0"
              value={customData.unitPrice}
              onChange={e => setCustomData({ ...customData, unitPrice: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        </div>
      )}

      <div className="action-row">
        <button className="add-btn" onClick={handleAdd}>
          추가
        </button>
        <button className="cancel-btn" onClick={handleClose}>
          닫기
        </button>
      </div>
    </div>
  );
};

export default MaterialSelector;
