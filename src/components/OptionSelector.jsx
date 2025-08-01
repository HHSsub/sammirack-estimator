import React, { useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { validateRate } from '../utils/priceUtils';

const OptionSelector = () => {
  const { loading, selections, setSelections, availableOptions, isCustomPriceMode } = useProducts();

  // version '기본형 V1' 강제 고정 (스텐랙)
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
      if (name === 'type') {
        newSelections = { ...newSelections, color: '', size: '', height: '', level: '', customPrice: null };
      }
      if (['color', 'size', 'height'].includes(name)) {
        newSelections = { ...newSelections, level: '', customPrice: null };
      }
      if (name === 'level') {
        newSelections = { ...newSelections, customPrice: null };
      }
      if (name === 'quantity') {
        newSelections.quantity = parseInt(value, 10) || 1;
      }
      if (name === 'applyRate') {
        newSelections.applyRate = validateRate(value);
      }
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
        <label>제품 유형:</label>
        <select name="type" value={selections.type} onChange={handleChange}>
          <option value="">선택하세요</option>
          <option value="스텐랙">스텐랙</option>
          <option value="하이랙">하이랙</option>
        </select>
      </div>
      {/* 하이랙 색상 선택 */}
      {selections.type === '하이랙' && (
        <div className="form-group">
          <label>색상/타입:</label>
          <select name="color" value={selections.color} onChange={handleChange}>
            <option value="">선택하세요</option>
            {availableOptions.colors.map(color => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
        </div>
      )}
      {/* 규격 */}
      <div className="form-group">
        <label>규격:</label>
        <select name="size" value={selections.size} onChange={handleChange} disabled={!selections.type}>
          <option value="">선택하세요</option>
          {availableOptions.sizes.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
      {/* 높이 */}
      <div className="form-group">
        <label>높이:</label>
        <select name="height" value={selections.height} onChange={handleChange} disabled={!selections.size}>
          <option value="">선택하세요</option>
          {availableOptions.heights.map(height => (
            <option key={height} value={height}>{height}</option>
          ))}
        </select>
      </div>
      {/* 단수 */}
      <div className="form-group">
        <label>단수:</label>
        <select name="level" value={selections.level} onChange={handleChange} disabled={!selections.height}>
          <option value="">선택하세요</option>
          {availableOptions.levels.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>
      {/* 수량 */}
      <div className="form-group">
        <label>수량:</label>
        <input type="number" min="1" name="quantity" value={selections.quantity || 1} onChange={handleChange}/>
      </div>
      {/* 적용률 */}
      <div className="form-group">
        <label>적용률 (%):</label>
        <input type="number" min="0" max="100" step="0.1" name="applyRate"
          value={selections.applyRate ?? 100} onChange={handleChange} placeholder="100" />
      </div>
      {/* 직접가격입력란 */}
      {isCustomPriceMode && (
        <div className="form-group">
          <label>직접 입력 가격 (원):</label>
          <input
            type="number"
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
