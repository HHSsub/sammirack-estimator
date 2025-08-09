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
    currentPrice,
    currentBOM,
    loading,
    safePrice,
    addToCart
  } = useProducts();

  // 스탠랙 버전 자동 설정 (V1 고정)
  useEffect(() => {
    if (selectedType === '스탠랙' && selectedOptions.version !== 'V1') {
      handleOptionChange('version', 'V1');
    }
  }, [selectedType, selectedOptions, handleOptionChange]);

  // 옵션 선택기가 비활성화되어야 하는지 확인
  const getDisabledState = (optionName) => {
    if (loading) return true;
    if (!selectedType) return true;

    // 옵션 종속성 체크
    switch (selectedType) {
      case '스탠랙':
        if (optionName === 'height') return !selectedOptions.size;
        if (optionName === 'level') return !selectedOptions.height;
        break;
      case '하이랙':
        if (optionName === 'size') return !selectedOptions.color;
        if (optionName === 'height') return !selectedOptions.size;
        if (optionName === 'level') return !selectedOptions.height;
        break;
      case '경량랙':
      case '중량랙':
      case '파렛트랙':
        if (optionName === 'height') return !selectedOptions.size;
        if (optionName === 'level') return !selectedOptions.height;
        if (optionName === 'formType') return !selectedOptions.level;
        break;
      default:
        return false;
    }

    return false;
  };

  // 옵션 선택기 렌더링
  const renderOptionSelect = (optionName, label) => {
    const options = {
      'type': allOptions.types,
      'color': availableOptions.colors,
      'size': availableOptions.sizes,
      'height': filteredOptions.heights,
      'level': filteredOptions.levels,
      'version': availableOptions.versions,
      'formType': ['독립형', '연결형']
    }[optionName];

    if (!options || options.length === 0) return null;

    // 스탠랙 버전 숨김 처리
    if (selectedType === '스탠랙' && optionName === 'version') return null;

    return (
      <div className="option-group" key={optionName}>
        <label htmlFor={`option-${optionName}`}>{label}</label>
        <select
          id={`option-${optionName}`}
          value={selectedOptions[optionName] || ''}
          onChange={(e) => handleOptionChange(optionName, e.target.value)}
          disabled={getDisabledState(optionName)}
        >
          <option value="">{label} 선택</option>
          {options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // 유효한 옵션 조합인지 확인
  const isValidCombination = useMemo(() => {
    if (!selectedType) return false;

    const requiredOptions = {
      '스탠랙': ['size', 'height', 'level'],
      '하이랙': ['color', 'size', 'height', 'level'],
      '경량랙': ['size', 'height', 'level', 'formType'],
      '중량랙': ['size', 'height', 'level', 'formType'],
      '파렛트랙': ['size', 'height', 'level', 'formType']
    }[selectedType];

    return requiredOptions.every(opt => selectedOptions[opt]);
  }, [selectedType, selectedOptions]);

  if (loading) {
    return <div className="loading">데이터 로드 중...</div>;
  }

  return (
    <div className="option-selector">
      {/* 제품 유형 선택 */}
      {renderOptionSelect('type', '제품 유형')}

      {/* 스탠랙 옵션 */}
      {selectedType === '스탠랙' && (
        <>
          {renderOptionSelect('size', '크기')}
          {renderOptionSelect('height', '높이')}
          {renderOptionSelect('level', '단수')}
        </>
      )}

      {/* 하이랙 옵션 */}
      {selectedType === '하이랙' && (
        <>
          {renderOptionSelect('color', '색상')}
          {renderOptionSelect('size', '크기')}
          {renderOptionSelect('height', '높이')}
          {renderOptionSelect('level', '단수')}
        </>
      )}

      {/* 경량랙/중량랙/파렛트랙 옵션 */}
      {(selectedType === '경량랙' || selectedType === '중량랙' || selectedType === '파렛트랙') && (
        <>
          {renderOptionSelect('size', '크기')}
          {renderOptionSelect('height', '높이')}
          {renderOptionSelect('level', '단수')}
          {renderOptionSelect('formType', '구성형태')}
        </>
      )}

      {/* 수량 입력 */}
      <div className="option-group">
        <label htmlFor="quantity">수량</label>
        <input
          type="number"
          id="quantity"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
        />
      </div>

      {/* 적용률 입력 */}
      <div className="option-group">
        <label htmlFor="applyRate">적용률 (%)</label>
        <input
          type="number"
          id="applyRate"
          min="0"
          max="200"
          value={applyRate}
          onChange={(e) => setApplyRate(Math.max(0, Math.min(200, parseInt(e.target.value) || 100))}
        />
      </div>

      {/* 수동 가격 입력 (조건부 표시) */}
      {(isValidCombination || (selectedType && Object.keys(selectedOptions).length > 0)) && (
        <div className="option-group">
          <label htmlFor="customPrice">가격 직접입력 (선택사항)</label>
          <input
            type="number"
            id="customPrice"
            min="0"
            value={customPrice}
            onChange={(e) => {
              setCustomPrice(parseInt(e.target.value) || 0);
              setIsCustomPrice(!!e.target.value);
            }}
          />
        </div>
      )}

      {/* 가격 표시 */}
      {currentPrice > 0 && (
        <div className="price-display">
          <h3>계산 가격: {safePrice(currentPrice)}원</h3>
          {isCustomPrice && <p className="custom-price-notice">* 수동 입력 가격 적용</p>}
        </div>
      )}

      {/* 장바구니 추가 버튼 */}
      {isValidCombination && (
        <button 
          className="add-to-cart"
          onClick={addToCart}
          disabled={!isValidCombination}
        >
          목록 추가
        </button>
      )}

      {/* 현재 BOM 미리보기 */}
      {currentBOM && currentBOM.length > 0 && (
        <div className="current-bom-preview">
          <h4>현재 구성품 미리보기</h4>
          <ul>
            {currentBOM.slice(0, 3).map((item, index) => (
              <li key={index}>
                {item.name} × {item.quantity}
              </li>
            ))}
            {currentBOM.length > 3 && <li>...외 {currentBOM.length - 3}개</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OptionSelector;
