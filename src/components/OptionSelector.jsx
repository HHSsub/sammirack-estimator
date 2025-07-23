import React from 'react';
import { useProducts } from '../contexts/ProductContext';

function OptionSelector() {
  const { loading, productsData, selections, setSelections, availableOptions } = useProducts();

  const handleChange = (e) => {
    const { name, value } = e.target;

    setSelections(prev => {
      const newSelections = { ...prev, [name]: value };

      // 상위 옵션이 바뀌면 하위 옵션을 리셋
      if (name === 'type') {
        newSelections.version = '';
        newSelections.color = '';
        newSelections.size = '';
        newSelections.height = '';
        newSelections.level = '';
      }
      if (name === 'color' || name === 'version') {
        newSelections.size = '';
        newSelections.height = '';
        newSelections.level = '';
      }
      if (name === 'size') {
        newSelections.height = '';
        newSelections.level = '';
      }
      if (name === 'height') {
        newSelections.level = '';
      }
      if (name === 'quantity') {
        newSelections.quantity = parseInt(value, 10) || 1;
      }

      return newSelections;
    });
  };

  if (loading) return <p>데이터를 불러오는 중...</p>;

  const productTypeSelected = selections.type && productsData?.[selections.type];

  return (
    <div className="product-selection grid grid-cols-2 gap-4">
      {/* 제품 유형 */}
      <div className="form-group">
        <label>제품 유형:</label>
        <select name="type" value={selections.type} onChange={handleChange}>
          <option value="">선택하세요</option>
          {productsData && Object.keys(productsData).map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      {/* 스텐랙 버전 */}
      {selections.type === '스텐랙' && (
        <div className="form-group">
          <label>버전:</label>
          <select name="version" value={selections.version} onChange={handleChange} disabled={!productTypeSelected}>
            <option value="">선택하세요</option>
            {availableOptions.versions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      {/* 하이랙 색상/타입 */}
      {selections.type === '하이랙' && (
        <div className="form-group">
          <label>색상/타입:</label>
          <select name="color" value={selections.color} onChange={handleChange} disabled={!productTypeSelected}>
            <option value="">선택하세요</option>
            {availableOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* 규격 */}
      <div className="form-group">
        <label>규격:</label>
        <select name="size" value={selections.size} onChange={handleChange} disabled={availableOptions.sizes.length === 0}>
          <option value="">선택하세요</option>
          {availableOptions.sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      
      {/* 높이 */}
      <div className="form-group">
        <label>높이:</label>
        <select name="height" value={selections.height} onChange={handleChange} disabled={availableOptions.heights.length === 0}>
          <option value="">선택하세요</option>
          {availableOptions.heights.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      {/* 단수 */}
      <div className="form-group">
        <label>단수:</label>
        <select name="level" value={selections.level} onChange={handleChange} disabled={availableOptions.levels.length === 0}>
          <option value="">선택하세요</option>
          {availableOptions.levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* 수량 */}
      <div className="form-group">
        <label>수량:</label>
        <input type="number" name="quantity" min="1" value={selections.quantity} onChange={handleChange} />
      </div>
    </div>
  );
}

export default OptionSelector;
