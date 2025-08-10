import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

const OptionSelector = () => {
  const {
    allOptions, availableOptions, colorLabelMap,
    selectedType, selectedOptions, handleOptionChange,
    quantity, setQuantity, applyRate, setApplyRate,
    customPrice, setCustomPrice, isCustomPrice, setIsCustomPrice,
    currentPrice, addToCart, loading
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);
  useEffect(() => { setApplyRateInput(applyRate); }, [applyRate]);

  const onApplyRateChange = (e) => {
    const v = e.target.value;
    if (v === '' || /^[0-9]{1,3}$/.test(v)) {
      setApplyRateInput(v);
      const num = Number(v);
      if (!isNaN(num) && num >= 0 && num <= 200) setApplyRate(num);
    }
  };

  const renderOptionSelect = (optionName, label, enabled = true, map = null) => {
    const opts = availableOptions[optionName] || [];
    if (!Array.isArray(opts) || opts.length === 0) return null;
    return (
      <div style={{ minWidth: 150 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
        <select style={{ minWidth: 150, height: 38, fontSize: 14, padding: '6px 8px' }}
          value={selectedOptions[optionName] || ''}
          onChange={e => handleOptionChange(optionName, e.target.value)}
          disabled={!enabled || loading}>
          <option value="">{label} 선택</option>
          {opts.map(o => (
            <option key={o} value={o}>{map && map[o] ? map[o] : o}</option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) return <div>데이터 로드 중...</div>;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
        {renderOptionSelect('type', '제품 유형', true)}
        {formTypeRacks.includes(selectedType) && (
          <>
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이', !!selectedOptions.size)}
            {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
            {renderOptionSelect('formType', '형식', !!selectedOptions.size && !!selectedOptions.height && !!selectedOptions.level)}
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
        {selectedType === '스텐랙' && (
          <>
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이', !!selectedOptions.size)}
            {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
          </>
        )}
        <div>
          <label>수량</label>
          <input type="number" value={quantity} min="0" style={{ width: 60 }}
            onChange={e => setQuantity(Math.max(0, Number(e.target.value)))} />
        </div>
        <div>
          <label>적용률(%)</label>
          <input type="text" value={applyRateInput} maxLength={3} style={{ width: 50 }}
            onChange={onApplyRateChange} />
        </div>
        <div>
          <label>가격 직접입력</label>
          <input type="number" value={customPrice} min="0" style={{ width: 80 }}
            onChange={e => { setCustomPrice(Number(e.target.value) || 0); setIsCustomPrice(!!e.target.value); }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>계산 가격: {currentPrice.toLocaleString()}원</h3>
          {isCustomPrice && <p style={{ color: '#406dc1' }}>* 수동 입력 가격 적용</p>}
        </div>
        <button onClick={addToCart} disabled={!selectedType}
          style={{ padding: '8px 22px', background: '#2556a0', color: '#fff', borderRadius: 6 }}>목록 추가</button>
      </div>
    </div>
  );
};

export default OptionSelector;
