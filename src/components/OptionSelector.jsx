import React, { useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { validateRate } from '../utils/priceUtils';

const OptionSelector = () => {
  const {
    loading,
    selections,
    setSelections,
    availableOptions,
    isCustomPriceMode
  } = useProducts();

  // 스텐랙 선택 시 version은 항상 '기본형 V1' 고정 (UI 노출 없음)
  useEffect(() => {
    if (selections.type === '스텐랙' && selections.version !== '기본형 V1') {
      setSelections(prev => ({ ...prev, version: '기본형 V1' }));
    }
    if (selections.type !== '스텐랙' && selections.version !== '') {
      setSelections(prev => ({ ...prev, version: '' }));
    }
  }, [selections.type, selections.version, setSelections]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelections(prev => {
      let newSelections = { ...prev, [name]: value };

      // type 변경 시 관련 필드 초기화
      if (name === 'type') {
        newSelections = {
          ...newSelections,
          color: '',
          size: '',
          height: '',
          level: '',
          customPrice: null,
        };
      }

      // color, size, height 변경 시 level 및 customPrice 초기화
      if (['color', 'size', 'height'].includes(name)) {
        newSelections = { ...newSelections, level: '', customPrice: null };
      }

      // level 변경 시 customPrice 초기화
      if (name === 'level') {
        newSelections = { ...newSelections, customPrice: null };
      }

      // 수량 숫자 변환
      if (name === 'quantity') {
        newSelections.quantity = parseInt(value, 10) || 1;
      }

      // 적용률 검증
      if (name === 'applyRate') {
        newSelections.applyRate = validateRate(value);
      }

      // customPrice 숫자 변환, 빈값은 null로 처리
      if (name === 'customPrice') {
        newSelections.customPrice = value === '' ? null : Number(value);
      }

      return newSelections;
    });
  };

  if (loading) return <p>데이터를 불러오는 중...</p>;

  return (
    <div className="product-selection grid grid-cols-2 gap-4">
      {/* 제품 유형 */}
      <div className="form-group">
        <label htmlFor="type">제품 유형:</label>
        <select name="type" id="type" value={selections.type} onChange={handleChange}>
          <option value="">선택하세요</option>
          <option value="스텐랙">스텐랙</option>
          <option value="하이랙">하이랙</option>
        </select>
      </div>

      {/* 스텐랙은 version UI 없음, 내부 고정 */}

      {/* 하이랙 색상 */}
      {selections.type === '하이랙' && (
        <div className="form-group">
          <label htmlFor="color">색상/타입:</label>
          <select name="color" id="color" value={selections.color} onChange={handleChange}>
            <option value="">선택하세요</option>
            {availableOptions.colors.map(color => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
        </div>
      )}

      {/* 규격 (size) */}
      <div className="form-group">
        <label htmlFor="size">규격:</label>
        <select
          name="size"
          id="size"
          value={selections.size}
          onChange={handleChange}
          disabled={!selections.type}
        >
          <option value="">선택하세요</option>
          {availableOptions.sizes.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {/* 높이 */}
      <div className="form-group">
        <label htmlFor="height">높이:</label>
        <select
          name="height"
          id="height"
          value={selections.height}
          onChange={handleChange}
          disabled={!selections.size}
        >
          <option value="">선택하세요</option>
          {availableOptions.heights.map(height => (
            <option key={height} value={height}>{height}</option>
          ))}
        </select>
      </div>

      {/* 단수 */}
      <div className="form-group">
        <label htmlFor="level">단수:</label>
        <select
          name="level"
          id="level"
          value={selections.level}
          onChange={handleChange}
          disabled={!selections.height}
        >
          <option value="">선택하세요</option>
          {availableOptions.levels.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      {/* 수량 */}
      <div className="form-group">
        <label htmlFor="quantity">수량:</label>
        <input
          type="number"
          id="quantity"
          name="quantity"
          min="1"
          value={selections.quantity || 1}
          onChange={handleChange}
        />
      </div>

      {/* 적용률 */}
      <div className="form-group">
        <label htmlFor="applyRate">적용률 (%):</label>
        <input
          type="number"
          id="applyRate"
          name="applyRate"
          min="0"
          max="100"
          step="0.1"
          value={selections.applyRate ?? 100}
          onChange={handleChange}
          placeholder="100"
        />
      </div>

      {/* JSON에 없는 옵션 선택 시 사용자 직접 가격 입력란 노출 */}
      {isCustomPriceMode && (
        <div className="form-group">
          <label htmlFor="customPrice">직접 입력 가격 (원):</label>
          <input
            type="number"
            id="customPrice"
            name="customPrice"
            min="0"
            value={selections.customPrice ?? ''}
            onChange={handleChange}
            placeholder="가격을 입력하세요"
          />
        </div>
      )}
    </div>
  );
};

export default OptionSelector;
