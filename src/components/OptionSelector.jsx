import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import BOMDisplay from './BOMDisplay';

const OptionSelector = () => {
  const {
    allOptions, availableOptions, colorLabelMap,
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

  // BOM 토글 (둘 다 true: 항상 보이기)
  const [showCurrent, setShowCurrent] = useState(true);
  const [showTotal, setShowTotal] = useState(true);

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
          {opts.map(o => (
            <option key={o} value={o}>
              {optionName === 'color' ? (colorLabelMap[o] || o) : o}
            </option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) return <div>데이터 로드 중...</div>;

  return (
    <div>
      {renderOptionSelect('type', '제품 유형')}
      {selectedType && (
        <>
          {selectedType === '스텐랙' && <>
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이')}
            {renderOptionSelect('level', '단수')}
          </>}
          {selectedType === '하이랙' && <>
            {renderOptionSelect('color', '색상')}
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이')}
            {renderOptionSelect('level', '단수')}
          </>}
          {['경량랙','중량랙','파렛트랙'].includes(selectedType) && <>
            {renderOptionSelect('formType', '구성형태')}
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이')}
            {renderOptionSelect('level', '단수')}
          </>}
        </>
      )}

      <div>
        <label>수량</label>
        <input type="number" min="0" value={quantity} onChange={e => setQuantity(Math.max(0, Number(e.target.value)))} />
      </div>
      <div>
        <label>적용률(%)</label>
        <input type="text" value={applyRateInput} onChange={onApplyRateChange} maxLength={3} />
      </div>
      <div>
        <label>가격 직접입력</label>
        <input type="number" min="0" value={customPrice} onChange={e => { setCustomPrice(Number(e.target.value) || 0); setIsCustomPrice(!!e.target.value); }} />
      </div>

      <div>
        <h3>계산 가격: {currentPrice.toLocaleString()}원</h3>
        {isCustomPrice && <p>* 수동 입력 가격 적용</p>}
      </div>

      <button onClick={addToCart} disabled={!selectedType}>목록 추가</button>

      {/* 현재 BOM */}
      {showCurrent && (
        <BOMDisplay bom={currentBOM} title="현재 BOM" onQuantityChange={updateCurrentBOMQuantity} />
      )}
      <button onClick={() => setShowCurrent(!showCurrent)}>{showCurrent ? '숨기기' : '현재 BOM 보기'}</button>

      {/* 전체 BOM */}
      {showTotal && (
        <BOMDisplay bom={cartBOM} title="전체 BOM (모든 장바구니 누적)" onQuantityChange={updateCartBOMQuantity} />
      )}
      <button onClick={() => setShowTotal(!showTotal)}>{showTotal ? '숨기기' : '전체 BOM 보기'}</button>
    </div>
  );
};
export default OptionSelector;
