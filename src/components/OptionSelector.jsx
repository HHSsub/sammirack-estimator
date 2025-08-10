import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import BOMDisplay from './BOMDisplay';

const OptionSelector = () => {
  const {
    allOptions, availableOptions,
    selectedType, selectedOptions,
    handleOptionChange, quantity, setQuantity,
    applyRate, setApplyRate,
    customPrice, setCustomPrice,
    isCustomPrice, setIsCustomPrice,
    currentPrice, currentBOM, cartBOM,
    updateCurrentBOMQuantity, updateCartBOMQuantity,
    addToCart, loading
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);

  useEffect(() => { setApplyRateInput(applyRate); }, [applyRate]);
  useEffect(() => {
    if (selectedType === '스텐랙' && selectedOptions.version !== 'V1') {
      handleOptionChange('version', 'V1');
    }
  }, [selectedType, selectedOptions, handleOptionChange]);

  const onApplyRateChange = e => {
    const v = e.target.value;
    if (v === '' || /^[0-9]{1,3}$/.test(v)) {
      setApplyRateInput(v);
      const num = Number(v);
      if (!isNaN(num) && num >= 0 && num <= 200) setApplyRate(num);
    }
  };

  // 옵션 그리기
  const renderOptionSelect = (optionName, label) => {
    const opts = {
      'type': allOptions.types || [],
      'color': availableOptions.color || [],
      'size': availableOptions.size || [],
      'height': availableOptions.height || [],
      'level': availableOptions.level || [],
      'version': availableOptions.version || [],
      'formType': availableOptions.formType || [],
    }[optionName] || [];
    if (selectedType === '스텐랙' && optionName === 'version') return null;
    if (!Array.isArray(opts) || opts.length === 0) return null;
    return (
      <div className="option-group">
        <label>{label}</label>
        <select
          value={optionName === 'type' ? selectedType : (selectedOptions[optionName] || '')}
          onChange={e => handleOptionChange(optionName, e.target.value)}
          disabled={loading}
        >
          <option value="">{label} 선택</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  };

  if (loading) return <div>데이터 로드 중...</div>;

  return (
    <div className="option-selector" style={{ maxWidth: 620, margin: '0 auto' }}>
      {/* 옵션 선택부 */}
      <div className="options-select" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        {renderOptionSelect('type', '제품 유형')}
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
        {['경량랙','중량랙','파렛트랙'].includes(selectedType) && (
          <>
            {renderOptionSelect('formType', '구성형태')}
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이')}
            {renderOptionSelect('level', '단수')}
          </>
        )}
        <div className="option-group">
          <label>수량</label>
          <input type="number" min="0" value={quantity} onChange={e => setQuantity(Math.max(0, Number(e.target.value)))} style={{ width: 70 }} />
        </div>
        <div className="option-group">
          <label>적용률(%)</label>
          <input type="text" value={applyRateInput} onChange={onApplyRateChange} maxLength={3} style={{ width: 50 }} />
        </div>
        <div className="option-group">
          <label>가격 직접입력</label>
          <input type="number" min="0" value={customPrice}
            onChange={e => { setCustomPrice(Number(e.target.value) || 0); setIsCustomPrice(!!e.target.value); }}
            style={{ width: 80 }}
          />
        </div>
      </div>

      {/* 가격표시 및 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 22 }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600 }}>
            계산 가격: {currentPrice.toLocaleString()}원
          </h3>
          {isCustomPrice && <p style={{ color: '#406dc1', fontWeight: 500 }}>* 수동 입력 가격 적용</p>}
        </div>
        <button onClick={addToCart} disabled={!selectedType} style={{
          padding: '8px 22px', background: '#2556a0', color: '#fff', borderRadius: 6
        }}>
          목록 추가
        </button>
      </div>

      {/* ------------- BOM 2개 항상 바로 출력 ------------- */}
      {currentBOM.length > 0 &&
        <BOMDisplay
          bom={currentBOM}
          title="현재 BOM"
          onQuantityChange={updateCurrentBOMQuantity}
        />
      }
      {cartBOM.length > 0 &&
        <BOMDisplay
          bom={cartBOM}
          title="전체 BOM (모든 장바구니 누적)"
          onQuantityChange={updateCartBOMQuantity}
        />
      }
    </div>
  );
};
export default OptionSelector;
