import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';

const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

export default function OptionSelector() {
  const {
    allOptions, availableOptions, colorLabelMap,
    selectedType, selectedOptions, handleOptionChange,
    extraOptions, handleExtraOptionChange,
    extraProducts, customMaterialName, setCustomMaterialName,
    customMaterialPrice, setCustomMaterialPrice,
    quantity, setQuantity, applyRate, setApplyRate,
    customPrice, setCustomPrice, currentPrice,
    addToCart, loading
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);
  const [extraOpen, setExtraOpen] = useState(false);

  useEffect(() => setApplyRateInput(applyRate), [applyRate]);

  const onApplyRateChange = e => {
    const v = e.target.value;
    if (v === '' || /^[0-9]{1,3}$/.test(v)) {
      setApplyRateInput(v);
      const num = Number(v);
      if (!isNaN(num) && num >= 0 && num <= 200) setApplyRate(num);
    }
  };

  const renderOptionSelect = (name, label, enabled = true, map = null) => {
    const opts = availableOptions[name] || [];
    if (!opts.length) return null;
    return (
      <div style={{ minWidth: 160 }}>
        <label>{label}</label>
        <select
          disabled={!enabled || loading}
          value={selectedOptions[name] || ''}
          onChange={e => handleOptionChange(name, e.target.value)}
        >
          <option value="">{label} 선택</option>
          {opts.map(o => <option key={o} value={o}>{map && map[o] ? map[o] : o}</option>)}
        </select>
      </div>
    );
  };

  let extraCatList = [];
  if (extraProducts[selectedType]) extraCatList = Object.entries(extraProducts[selectedType]);
  const toggleExtra = id => {
    if (extraOptions.includes(id)) handleExtraOptionChange(extraOptions.filter(e => e !== id));
    else handleExtraOptionChange([...extraOptions, id]);
  };

  if (loading) return <div>데이터 로드 중...</div>;
  const canAddItem = customPrice > 0 || currentPrice > 0;

  return (
    <div style={{ padding: 20, background: '#f8fcff', borderRadius: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <label>제품 유형</label>
          <select value={selectedType} onChange={e => handleOptionChange('type', e.target.value)}>
            <option value="">제품 유형 선택</option>
            {allOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {formTypeRacks.includes(selectedType) && <>
          {renderOptionSelect('size', '규격')}
          {renderOptionSelect('height', '높이', !!selectedOptions.size)}
          {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
          {renderOptionSelect('formType', '형식', !!selectedOptions.size && !!selectedOptions.height && !!selectedOptions.level)}
        </>}
        {selectedType === '하이랙' && <>
          {renderOptionSelect('color', '색상', true, colorLabelMap)}
          {renderOptionSelect('size', '규격', !!selectedOptions.color)}
          {renderOptionSelect('height', '높이', !!selectedOptions.color && !!selectedOptions.size)}
          {renderOptionSelect('level', '단수', !!selectedOptions.color && !!selectedOptions.size && !!selectedOptions.height)}
        </>}
        {selectedType === '스텐랙' && <>
          {renderOptionSelect('size', '규격')}
          {renderOptionSelect('height', '높이', !!selectedOptions.size)}
          {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
        </>}
        <div><label>수량</label><input type="number" min={0} value={quantity} onChange={e => setQuantity(Math.max(0, Number(e.target.value)))} /></div>
        <div><label>적용률(%)</label><input value={applyRateInput} onChange={onApplyRateChange} maxLength={3} /></div>
        <div><label>가격 직접입력</label><input type="number" value={customPrice} onChange={e => setCustomPrice(Number(e.target.value) || 0)} /></div>
      </div>
      {extraCatList.length > 0 && (
        <>
          <button onClick={() => setExtraOpen(o => !o)}>{extraOpen ? '기타 추가 옵션 닫기' : '기타 추가 옵션 열기'}</button>
          {extraOpen && extraCatList.map(([cat, arr]) => (
            <div key={cat}>
              <div style={{fontWeight:600}}>{cat}</div>
              {arr.map(opt => {
                const checked = extraOptions.includes(opt.id);
                return (
                  <div key={opt.id}>
                    <label>
                      <input type="checkbox" checked={checked} onChange={() => toggleExtra(opt.id)} />
                      {opt.name} {opt.price ? `+${opt.price}원` : ''}
                    </label>
                    {selectedType === '경량랙' && opt.id === 'l1-custom' && checked && (
                      <div>
                        <input placeholder="부품명" value={customMaterialName} onChange={e => setCustomMaterialName(e.target.value)} />
                        <input type="number" placeholder="금액" value={customMaterialPrice} onChange={e => setCustomMaterialPrice(Number(e.target.value) || 0)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <span>계산 가격: {customPrice > 0 ? customPrice.toLocaleString() : currentPrice.toLocaleString()}원</span>
        <button onClick={addToCart} disabled={!canAddItem}>목록 추가</button>
      </div>
    </div>
  );
}
