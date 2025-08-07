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
    isValidCombination,
    currentPrice,
    safePrice,
    loading
  } = useProducts();

  // ✅ 스탠랙 선택 시 자동으로 version = 'V1' 지정
  useEffect(() => {
    if (selectedType === '스탠랙' && selectedOptions.version !== 'V1') {
      handleOptionChange('version', 'V1');
    }
  }, [selectedType]);

  if (loading) return <p>데이터 불러오는 중...</p>;

  const renderOptionSelect = (optionName, label, options) => {
    if (!options) return null;

    // ✅ 스탠랙일 때 version 드롭다운 숨김
    if (selectedType === '스탠랙' && optionName === 'version') return null;

    let isDisabled = !selectedType;

    if (['경량랙', '중량랙', '파렛트랙'].includes(selectedType)) {
      if (optionName === 'height') isDisabled = !selectedOptions.size;
      if (optionName === 'level') isDisabled = !selectedOptions.height;
    } else if (selectedType === '하이랙') {
      if (optionName === 'size') isDisabled = !selectedOptions.color;
      if (optionName === 'height') isDisabled = !selectedOptions.size;
      if (optionName === 'level') isDisabled = !selectedOptions.height;
    } else if (selectedType === '스탠랙') {
      if (optionName === 'height') isDisabled = !selectedOptions.size;
      if (optionName === 'level') isDisabled = !selectedOptions.height;
    }

    return (
      <div className="option-group">
        <label htmlFor={optionName}>{label}</label>
        <select
          id={optionName}
          value={selectedOptions[optionName] || ''}
          onChange={(e) => handleOptionChange(optionName, e.target.value)}
          disabled={isDisabled}
        >
          <option value="">선택</option>
          {options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="option-selector">
      {/* 제품 유형 */}
      <div className="option-group">
        <label htmlFor="type">제품 유형</label>
        <select
          id="type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">선택</option>
          {allOptions.types?.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* 스탠랙 */}
      {selectedType === '스탠랙' && (
        <>
          {/* version 드롭다운은 자동 설정되고 숨김 */}
          {renderOptionSelect('size', '사이즈', filteredOptions.sizes)}
          {renderOptionSelect('height', '높이', filteredOptions.heights)}
          {renderOptionSelect('level', '단수', filteredOptions.levels)}
        </>
      )}

      {/* 하이랙 */}
      {selectedType === '하이랙' && (
        <>
          {renderOptionSelect('color', '색상', availableOptions.colors)}
          {renderOptionSelect('size', '사이즈', filteredOptions.sizes)}
          {renderOptionSelect('height', '높이', filteredOptions.heights)}
          {renderOptionSelect('level', '단수', filteredOptions.levels)}
        </>
      )}

      {/* 경량/중량/파렛트랙 */}
      {['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && (
        <>
          {renderOptionSelect('size', '사이즈', availableOptions.sizes)}
          {renderOptionSelect('height', '높이', filteredOptions.heights)}
          {renderOptionSelect('level', '단수', filteredOptions.levels)}
        </>
      )}

      {/* 수량 */}
      <div className="option-group">
        <label htmlFor="quantity">수량</label>
        <input
          type="number"
          id="quantity"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
        />
      </div>

      {/* 적용률 */}
      <div className="option-group">
        <label htmlFor="applyRate">적용률 (%)</label>
        <input
          type="number"
          id="applyRate"
          min="0"
          max="200"
          value={applyRate}
          onChange={(e) => setApplyRate(parseInt(e.target.value) || 100)}
        />
      </div>

      {/* 수동 가격 입력 */}
      {((['경량랙', '중량랙', '파렛트랙'].includes(selectedType) &&
         selectedOptions.size && selectedOptions.height && selectedOptions.level) ||
        (!isValidCombination && selectedType && Object.values(selectedOptions).some(val => val))) && (
        <div className="option-group">
          <label htmlFor="customPrice">가격 직접입력 (선택사항)</label>
          <input
            type="number"
            id="customPrice"
            min="0"
            value={customPrice}
            placeholder="자동 계산됩니다"
            onChange={(e) => {
              setCustomPrice(parseInt(e.target.value) || 0);
              setIsCustomPrice(!!e.target.value);
            }}
          />
        </div>
      )}

      {/* 가격 표시 */}
      <div className="price-display">
        <h3>계산된 가격: {safePrice(currentPrice)}원</h3>
        {isCustomPrice && (
          <p className="text-sm text-gray-600">* 수동 입력된 가격</p>
        )}
      </div>
    </div>
  );
};

export default OptionSelector;
