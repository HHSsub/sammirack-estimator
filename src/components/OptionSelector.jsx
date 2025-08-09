import React, { useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';

const OptionSelector = () => {
  const {
    allOptions,
    availableOptions,
    filteredOptions,
    selectedType,
    selectedOptions,
    setSelectedType,
    handleOptionChange,
    quantity,
    setQuantity,
    applyRate,
    setApplyRate,
    customPrice,
    setCustomPrice,
    isCustomPrice,
    setIsCustomPrice,
    currentPrice,
    currentBOM,
    loading,
    safePrice,
    addToCart
  } = useProducts();

  // 스탠랙 버전 자동 설정 (V1 고정)
  useEffect(() => {
    if (selectedType === '스탠랙' && selectedOptions.version !== 'V1') {
      handleOptionChange('version', 'V1');
    }
  }, [selectedType, selectedOptions, handleOptionChange]);

  // 모든 옵션 즉시 표시 (종속성 제거)
  const renderOptionSelect = (optionName, label) => {
    const options = {
      'type': allOptions.types || [],
      'color': availableOptions.color || [],
      'size': availableOptions.size || [],
      'height': filteredOptions.heights || [],
      'level': filteredOptions.levels || [],
      'version': availableOptions.version || [],
      'formType': ['독립형', '연결형']
    }[optionName];

    // 스탠랙 버전 숨김 처리
    if (selectedType === '스탠랙' && optionName === 'version') return null;

    return (
      <div className="option-group" key={optionName}>
        <label>{label}</label>
        <select
          value={selectedOptions[optionName] || ''}
          onChange={(e) => handleOptionChange(optionName, e.target.value)}
          disabled={loading}
        >
          <option value="">{label} 선택</option>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) return <div className="loading">데이터 로드 중...</div>;

  return (
    <div className="option-selector">
      {/* 제품 유형 선택 */}
      {renderOptionSelect('type', '제품 유형')}

      {/* 모든 옵션 즉시 표시 */}
      {selectedType && (
        <>
          {selectedType !== '스탠랙' && renderOptionSelect('color', '색상')}
          {renderOptionSelect('size', '크기')}
          {renderOptionSelect('height', '높이')}
          {renderOptionSelect('level', '단수')}
          {(selectedType === '경량랙' || selectedType === '중량랙' || selectedType === '파렛트랙') && 
            renderOptionSelect('formType', '구성형태')}
        </>
      )}

      {/* 수량 및 가격 입력 */}
      <div className="option-group">
        <label>수량</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        />
      </div>

      <div className="option-group">
        <label>적용률 (%)</label>
        <input
          type="number"
          min="0"
          max="200"
          value={applyRate}
          onChange={(e) => setApplyRate(Math.max(0, Math.min(200, Number(e.target.value) || 100)))}
        />
      </div>

      {/* 수동 가격 입력 (항상 표시) */}
      <div className="option-group">
        <label>가격 직접입력 (선택사항)</label>
        <input
          type="number"
          min="0"
          value={customPrice}
          onChange={(e) => {
            setCustomPrice(Number(e.target.value) || 0);
            setIsCustomPrice(!!e.target.value);
          }}
        />
      </div>

      {/* 가격 표시 */}
      <div className="price-display">
        <h3>계산 가격: {safePrice(currentPrice)}원</h3>
        {isCustomPrice && <p className="custom-price-notice">* 수동 입력 가격 적용</p>}
      </div>

      {/* 장바구니 추가 버튼 */}
      <button onClick={addToCart} disabled={!selectedType}>
        목록 추가
      </button>

      {/* 전체 BOM 표시 (생략 없음) */}
      {currentBOM && currentBOM.length > 0 && (
        <div className="current-bom-preview">
          <h4>구성품 상세</h4>
          <ul>
            {currentBOM.map((item, index) => (
              <li key={index}>
                {item.name} × {item.quantity} {item.unit} 
                {item.unitPrice && ` (단가: ${item.unitPrice.toLocaleString()}원)`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OptionSelector;
