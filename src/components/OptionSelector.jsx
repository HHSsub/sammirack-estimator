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

  // ==== 📌 디버깅 로그 ====
  console.log('[DEBUG] allOptions.types:', allOptions.types);
  console.log('[DEBUG] selectedType:', selectedType);
  console.log('[DEBUG] selectedOptions:', selectedOptions);
  console.log('[DEBUG] availableOptions:', availableOptions);
  console.log('[DEBUG] filteredOptions:', filteredOptions);
  console.log('[DEBUG] currentPrice:', currentPrice);
  console.log('[DEBUG] currentBOM:', currentBOM);

  // 스탠랙 버전 자동 설정 (V1 고정)
  useEffect(() => {
    if (selectedType === '스텐랙' && selectedOptions.version !== 'V1') {
      console.log('[DEBUG] 스텐랙 감지 - version V1 강제 설정');
      handleOptionChange('version', 'V1');
    }
  }, [selectedType, selectedOptions, handleOptionChange]);

  // 드롭다운 렌더 함수 + 디버깅
  const renderOptionSelect = (optionName, label) => {
    const options = {
      'type': allOptions.types || [],
      'color': availableOptions.color || [],
      'size': availableOptions.size || [],
      'height': availableOptions.height || [],
      'level': availableOptions.level || [],
      'version': availableOptions.version || [],
      'formType': availableOptions.formType || []
    }[optionName] || [];

    console.log(`[DEBUG] renderOptionSelect(${optionName}) → options:`, options);

    // 스텐랙 버전 숨김
    if (selectedType === '스텐랙' && optionName === 'version') return null;

    // 옵션 배열이 없거나 길이가 0이면 표시 안 함
    if (!Array.isArray(options) || options.length === 0) return null;

    return (
      <div className="option-group" key={optionName}>
        <label>{label}</label>
        <select
          value={selectedOptions[optionName] || ''}
          onChange={(e) => {
            console.log(`[DEBUG] ${optionName} 선택됨:`, e.target.value);
            handleOptionChange(optionName, e.target.value);
          }}
          disabled={loading}
        >
          <option value="">{label} 선택</option>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) {
    console.log('[DEBUG] 로딩중...');
    return <div className="loading">데이터 로드 중...</div>;
  }

  return (
    <div className="option-selector">
      {/* 제품 유형 */}
      {renderOptionSelect('type', '제품 유형')}

      {/* 랙별 옵션 */}
      {selectedType && (
        <>
          {selectedType === '스텐랙' && renderOptionSelect('size', '규격')}
          {selectedType === '스텐랙' && renderOptionSelect('height', '높이')}
          {selectedType === '스텐랙' && renderOptionSelect('level', '단수')}

          {selectedType === '하이랙' && renderOptionSelect('color', '색상')}
          {selectedType === '하이랙' && renderOptionSelect('size', '규격')}
          {selectedType === '하이랙' && renderOptionSelect('height', '높이')}
          {selectedType === '하이랙' && renderOptionSelect('level', '단수')}

          {['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && renderOptionSelect('formType', '구성형태')}
          {['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && renderOptionSelect('size', '규격')}
          {['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && renderOptionSelect('height', '높이')}
          {['경량랙', '중량랙', '파렛트랙'].includes(selectedType) && renderOptionSelect('level', '단수')}
        </>
      )}

      {/* 수량 & 적용률 */}
      <div className="option-group">
        <label>수량</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        />
      </div>
      <div className="option-group">
        <label>적용률 (%)</label>
        <input
          type="number"
          min="0"
          max="200"
          value={applyRate}
          onChange={(e) => setApplyRate(Math.max(0, Math.min(200, Number(e.target.value) || 100)))}
        />
      </div>

      {/* 가격 직접 입력 */}
      <div className="option-group">
        <label>가격 직접입력 (선택사항)</label>
        <input
          type="number"
          min="0"
          value={customPrice}
          onChange={(e) => {
            setCustomPrice(Number(e.target.value) || 0);
            setIsCustomPrice(!!e.target.value);
          }}
        />
      </div>

      {/* 가격 표시 */}
      <div className="price-display">
        <h3>계산 가격: {safePrice(currentPrice)}원</h3>
        {isCustomPrice && <p className="custom-price-notice">* 수동 입력 가격 적용</p>}
      </div>

      {/* 장바구니 버튼 */}
      <button onClick={addToCart} disabled={!selectedType}>
        목록 추가
      </button>

      {/* BOM 미리보기 */}
      {currentBOM && currentBOM.length > 0 && (
        <div className="current-bom-preview">
          <h4>구성품 상세</h4>
          <ul>
            {currentBOM.map((item, index) => (
              <li key={index}>
                {item.name} × {item.quantity} {item.unit} 
                {item.unitPrice && ` (단가: ${item.unitPrice.toLocaleString()}원)`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OptionSelector;
