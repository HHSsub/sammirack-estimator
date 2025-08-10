import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';

const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

const OptionSelector = () => {
  const {
    allOptions,
    availableOptions,
    colorLabelMap,
    selectedType,
    selectedOptions,
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
    addToCart,
    loading,
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);

  useEffect(() => { setApplyRateInput(applyRate); }, [applyRate]);
  useEffect(() => {
    if (selectedType === '스텐랙' && selectedOptions.version !== 'V1') {
      handleOptionChange('version', 'V1');
    }
  }, [selectedType, selectedOptions, handleOptionChange]);

  const onApplyRateChange = (e) => {
    const v = e.target.value;
    if (v === '' || /^[0-9]{1,3}$/.test(v)) {
      setApplyRateInput(v);
      const num = Number(v);
      if (!isNaN(num) && num >= 0 && num <= 200) { setApplyRate(num); }
    }
  };

  const renderOptionSelect = (optionName, label, enabled = true, displayMap = null) => {
    const opts = availableOptions[optionName] || [];
    if (!Array.isArray(opts) || opts.length === 0) return null;
    return (
      <div className="option-group" style={{ minWidth: 150 }}>
        <label style={{ fontSize: '13px', fontWeight: 500 }}>{label}</label>
        <select
          style={{
            minWidth: 150,
            height: 38,
            fontSize: 14,
            lineHeight: 'normal',
            padding: '6px 8px',
            boxSizing: 'border-box',
          }}
          value={selectedOptions[optionName] || ''}
          onChange={e => handleOptionChange(optionName, e.target.value)}
          disabled={!enabled || loading}
        >
          <option value="">{label} 선택</option>
          {opts.map(o => (
            <option key={o} value={o}>
              {displayMap && displayMap[o] ? displayMap[o] : o}
            </option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) return <div>데이터 로드 중...</div>;

  // 종속성 순서대로, 상위 선택 안하면 하위 옵션 select 안뜸
  return (
    <div className="option-selector" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="options-row" style={{
        display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22
      }}>
        {renderOptionSelect('type', '제품 유형', true)}
        {selectedType === '스텐랙' && (
          <>
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이', !!selectedOptions.size)}
            {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
          </>
        )}
        {selectedType === '하이랙' && (
          <>
            {renderOptionSelect('color', '색상', true, colorLabelMap)}
            {renderOptionSelect('size', '규격', !!selectedOptions.color)}
            {renderOptionSelect('height', '높이', !!selectedOptions.color && !!selectedOptions.size)}
            {renderOptionSelect('level', '단수', !!selectedOptions.color && !!selectedOptions.size && !!selectedOptions.height)}
          </>
        )}
        {formTypeRacks.includes(selectedType) && (
          <>
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이', !!selectedOptions.size)}
            {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
            {renderOptionSelect('formType', '형식', !!selectedOptions.size && !!selectedOptions.height && !!selectedOptions.level)}
          </>
        )}
        {/* 기타 입력 필드 */}
        <div className="option-group" style={{ minWidth: 90 }}>
          <label>수량</label>
          <input type="number" min="0" value={quantity}
            onChange={e => setQuantity(Math.max(0, Number(e.target.value)))}
            style={{ width: 60 }}
          />
        </div>
        <div className="option-group" style={{ minWidth: 80 }}>
          <label>적용률(%)</label>
          <input type="text" value={applyRateInput}
            onChange={onApplyRateChange} maxLength={3} style={{ width: 50 }} />
        </div>
        <div className="option-group" style={{ minWidth: 110 }}>
          <label>가격 직접입력</label>
          <input type="number" min="0" value={customPrice}
            onChange={e => {
              setCustomPrice(Number(e.target.value) || 0);
              setIsCustomPrice(!!e.target.value);
            }}
            style={{ width: 80 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 18 }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '18px' }}>
            계산 가격: {currentPrice.toLocaleString()}원
          </h3>
          {isCustomPrice && (
            <p style={{ color: '#406dc1', fontWeight: 500, margin: 0 }}>
              * 수동 입력 가격 적용
            </p>
          )}
        </div>
        <button
          onClick={addToCart}
          disabled={!selectedType}
          style={{
            padding: '8px 22px',
            background: '#2556a0',
            color: '#fff',
            borderRadius: 6,
          }}
        >
          목록 추가
        </button>
      </div>
    </div>
  );
};

export default OptionSelector;
