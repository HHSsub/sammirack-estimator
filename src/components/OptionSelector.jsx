import React from 'react';
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

      {/* 경량/중량/조립식앵글 */}
      {['경량랙', '중량랙', '조립식앵글'].includes(selectedType) && (
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

      {/* 가격 수동 입력 (Excel 기반 제품이거나 invalid 조합일 때) */}
      {((['경량랙', '중량랙', '조립식앵글'].includes(selectedType) && 
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
