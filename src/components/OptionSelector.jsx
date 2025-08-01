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

  // 스텐랙 선택 시 version을 항상 '기본형 V1'로 강제고정
  useEffect(() => {
    if (selections.type === '스텐랙' && selections.version !== '기본형 V1') {
      setSelections(prev => ({ ...prev, version: '기본형 V1' }));
    }
    // 스텐랙이 아니면 version 빈 문자열로 유지
    if (selections.type !== '스텐랙' && selections.version !== '') {
      setSelections(prev => ({ ...prev, version: '' }));
    }
  }, [selections.type, selections.version, setSelections]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelections(prev => {
      let newSelections = { ...prev, [name]: value };

      // type 변경 시 나머지 선택 초기화 (단, version 강제 고정은 useEffect가 처리)
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

      // color, size, height 변경 시 level / customPrice 초기화
      if (['color', 'size', 'height'].includes(name)) {
        newSelections = { ...newSelections, level: '', customPrice: null };
      }

      // level 변경 시 customPrice 초기화
      if (name === 'level') {
        newSelections = { ...newSelections, customPrice: null };
      }

      // 수량 숫자로 변환
      if (name === 'quantity') {
        newSelections.quantity = parseInt(value, 10) || 1;
      }

      // 적용률 검증
      if (name === 'applyRate') {
        newSelections.applyRate = validateRate(value);
      }

      // customPrice 숫자 변환, 빈값 시 null
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

      {/* version UI는 스텐랙일 때 아예 노출하지 않음 (고정값 적용되므로) */}

      {/* 색상 (하이랙만 노출) */}
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

      {/* 규격 (사이즈) */}
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

      {/* 사용자 직접 가격 입력 (JSON에 없는 옵션일 때만 노출) */}
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
