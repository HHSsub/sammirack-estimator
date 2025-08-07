import React from 'react';
import { useProduct } from '../contexts/ProductContext';

// 왜 안되냐

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
    price,
    loading
  } = useProduct();

  if (loading) return <p>데이터 불러오는 중...</p>;

  // 드롭다운 렌더링 공통 함수
  const renderOptionSelect = (optionName, label, options) => {
    if (!options || options.length === 0) return null;

    return (
      <div className="option-group">
        <label htmlFor={optionName}>{label}</label>
        <select
          id={optionName}
          value={selectedOptions[optionName] || ''}
          onChange={(e) => handleOptionChange(optionName, e.target.value)}
          disabled={!selectedType}
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
      {renderOptionSelect('type', '제품 유형', allOptions.types)}

      {/* 스텐랙 */}
      {selectedType === '스텐랙' && (
        <>
          {renderOptionSelect('version', '버전', availableOptions.versions)}
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

      {/* 가격 수동 입력 (EXTRA or invalid 조합일 때) */}
      {(!isValidCombination &&
        selectedType &&
        Object.values(selectedOptions).some(val => val)) && (
        <div className="option-group">
          <label htmlFor="customPrice">가격 직접입력</label>
          <input
            type="number"
            id="customPrice"
            min="0"
            value={customPrice}
            onChange={(e) => {
              setCustomPrice(parseInt(e.target.value) || 0);
              setIsCustomPrice(true);
            }}
          />
        </div>
      )}

      {/* 가격 표시 */}
      <div className="price-display">
        <h3>계산된 가격: {(price ?? 0).toLocaleString()}원</h3>
      </div>
    </div>
  );
};

export default OptionSelector;
