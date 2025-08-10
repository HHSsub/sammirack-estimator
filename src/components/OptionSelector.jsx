import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';

const OptionSelector = () => {
  const {
    allOptions, availableOptions,
    selectedType, selectedOptions,
    handleOptionChange,
    quantity, setQuantity,
    applyRate, setApplyRate,
    customPrice, setCustomPrice,
    isCustomPrice, setIsCustomPrice,
    currentPrice, currentBOM,
    cartBOM, loading,
    addToCart
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);

  useEffect(() => {
    setApplyRateInput(applyRate);
  }, [applyRate]);

  useEffect(() => {
    if (selectedType === '스텐랙' && selectedOptions.version !== 'V1') {
      handleOptionChange('version', 'V1');
    }
  }, [selectedType, selectedOptions, handleOptionChange]);

  const onApplyRateChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^[0-9]{1,3}$/.test(value)) {
      setApplyRateInput(value);
      const num = Number(value);
      if (!isNaN(num) && num >= 0 && num <= 200) {
        setApplyRate(num);
      }
    }
  };

  const renderOptionSelect = (optionName, label) => {
    const options = {
      'type': allOptions.types || [],
      'color': availableOptions.color || [],
      'size': availableOptions.size || [],
      'height': availableOptions.height || [],
      'level': availableOptions.level || [],
      'version': availableOptions.version || [],
      'formType': availableOptions.formType || [],
    }[optionName] || [];

    if (selectedType === '스텐랙' && optionName === 'version') return null;
    if (!Array.isArray(options) || options.length === 0) return null;

    return (
      <div className="option-group" key={optionName}>
        <label>{label}</label>
        <select
          value={optionName === 'type' ? selectedType : (selectedOptions[optionName] || '')}
          onChange={e => handleOptionChange(optionName, e.target.value)}
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
      {renderOptionSelect('type', '제품 유형')}
      {selectedType && (
        <>
          {selectedType === '스텐랙' && (
            <>
              {renderOptionSelect('size', '규격')}
              {renderOptionSelect('height', '높이')}
              {renderOptionSelect('level', '단수')}
            </>
          )}
          {selectedType === '하이랙' && (
            <>
              {renderOptionSelect('color', '색상')}
              {renderOptionSelect('size', '규격')}
              {renderOptionSelect('height', '높이')}
              {renderOptionSelect('level', '단수')}
            </>
          )}
          {['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && (
            <>
              {renderOptionSelect('formType', '구성형태')}
              {renderOptionSelect('size', '규격')}
              {renderOptionSelect('height', '높이')}
              {renderOptionSelect('level', '단수')}
            </>
          )}
        </>
      )}
      <div className="option-group">
        <label>수량</label>
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={e => setQuantity(Math.max(0, Number(e.target.value)))}
        />
      </div>
      <div className="option-group">
        <label>적용률 (%)</label>
        <input
          type="text"
          maxLength={3}
          value={applyRateInput}
          onChange={onApplyRateChange}
        />
      </div>
      <div className="option-group">
        <label>가격 직접입력</label>
        <input
          type="number"
          min="0"
          value={customPrice}
          onChange={e => {
            setCustomPrice(Number(e.target.value) || 0);
            setIsCustomPrice(!!e.target.value);
          }}
        />
      </div>

      <div className="price-display">
        <h3>계산 가격: {typeof currentPrice === 'number' ? currentPrice.toLocaleString() : '0'}원</h3>
        {isCustomPrice && <p className="custom-price-notice">* 수동 입력 가격 적용</p>}
      </div>

      <button onClick={addToCart} disabled={!selectedType}>목록 추가</button>

      {currentBOM.length > 0 && (
        <div className="current-bom-preview">
          <h4>현재 BOM</h4>
          <ul>
            {currentBOM.map((item, idx) => (
              <li key={idx}>
                {item.name} × {item.quantity} {item.unit || ''}
                {item.unitPrice && ` (단가: ${item.unitPrice.toLocaleString()}원)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cartBOM.length > 0 && (
        <div className="cart-bom-preview">
          <h4>전체 BOM (모든 장바구니 누적)</h4>
          <ul>
            {cartBOM.map((item, idx) => (
              <li key={idx}>
                {item.name} × {item.quantity} {item.unit || ''}
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
