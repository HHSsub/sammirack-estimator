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

  const onApplyRateChange = e => {
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
      <div style={{ minWidth: 150, marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>{label}</label>
        <select
          style={{
            minWidth: 150,
            height: 38,
            fontSize: 14,
            marginTop: 4,
            padding: '6px 8px',
            boxSizing: 'border-box'
          }}
          value={selectedOptions[optionName] || ''}
          onChange={e => handleOptionChange(optionName, e.target.value)}
          disabled={!enabled || loading}
        >
          <option value="">{label} 선택</option>
          {opts.map(o => (
            <option key={o} value={o}>
              {map && map[o] ? map[o] : o}
            </option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>데이터 로드 중...</div>;

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '20px 24px 12px 24px',
        background: '#f8fcff',
        borderRadius: 16,
        boxShadow: '0 1px 4px #dee1e540'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '22px',
          alignItems: 'flex-end',
          marginBottom: '18px'
        }}
      >
        {/* 제품 유형: 항상 표시 */}
        <div style={{ minWidth: 150, marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>제품 유형</label>
          <select value={selectedType} onChange={e => handleOptionChange('type', e.target.value)}
            style={{
              minWidth: 150,
              height: 38,
              fontSize: 14,
              marginTop: 4,
              padding: '6px 8px',
              boxSizing: 'border-box'
            }}>
            <option value="">제품 유형 선택</option>
            {allOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* 각 유형별 옵션 */}
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
        {/* 기타 입력 */}
        <div style={{ minWidth: 90 }}>
          <label>수량</label>
          <input type="number" min={0} value={quantity}
            onChange={e => setQuantity(Math.max(0, Number(e.target.value)))}
            style={{ width: 70, marginTop: 4 }}
          />
        </div>
        <div style={{ minWidth: 80 }}>
          <label>적용률(%)</label>
          <input type="text" value={applyRateInput}
            onChange={onApplyRateChange} maxLength={3}
            style={{ width: 50, marginTop: 4 }}
          />
        </div>
        <div style={{ minWidth: 110 }}>
          <label>가격 직접입력</label>
          <input type="number" min={0} value={customPrice}
            onChange={e => { setCustomPrice(Number(e.target.value) || 0); setIsCustomPrice(!!e.target.value); }}
            style={{ width: 80, marginTop: 4 }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        marginBottom: 18
      }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '18px' }}>
            계산 가격: {currentPrice ? currentPrice.toLocaleString() + '원' : '가격정보 없음'}
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
            padding: '9px 30px',
            background: '#2556a0',
            color: '#fff',
            borderRadius: 6,
            fontWeight: 600
          }}
        >
          목록 추가
        </button>
      </div>
    </div>
  );
};

export default OptionSelector;
