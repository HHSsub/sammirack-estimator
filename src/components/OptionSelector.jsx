import React from 'react';
import { useProducts } from '../contexts/ProductContext';

function OptionSelector() {
  const { loading, productsData, selections, setSelections, availableOptions } = useProducts();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelections(prev => {
      const newSelections = { ...prev, [name]: value };
      if (name === 'type') {
        return { ...newSelections, version: '', color: '', size: '', height: '', level: '' };
      }
      if (name === 'color') {
        return { ...newSelections, size: '', height: '', level: '' };
      }
      if (name === 'size') {
        return { ...newSelections, height: '', level: '' };
      }
      if (name === 'height') {
        return { ...newSelections, level: '' };
      }
      if (name === 'quantity') {
        newSelections.quantity = parseInt(value, 10) || 1;
      }
      return newSelections;
    });
  };

  if (loading) return <p>데이터를 불러오는 중...</p>;

  return (
    <div className="product-selection grid grid-cols-2 gap-4">
      {/* 1행 */}
      <div className="form-group">
        <label>제품 유형:</label>
        <select name="type" value={selections.type} onChange={handleChange}>
          <option value="">선택하세요</option>
          {productsData && Object.keys(productsData).map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      
      {selections.type === '스텐랙' && (
        <div className="form-group">
          <label>버전:</label>
          <select name="version" value={selections.version} onChange={handleChange} disabled={!selections.type}>
            <option value="">선택하세요</option>
            {availableOptions.versions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}
      {selections.type === '하이랙' && (
        <div className="form-group">
          <label>색상/타입:</label>
          <select name="color" value={selections.color} onChange={handleChange} disabled={!selections.type}>
            <option value="">선택하세요</option>
            {availableOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* 2행 */}
      <div className="form-group">
        <label>규격:</label>
        <select name="size" value={selections.size} onChange={handleChange} disabled={availableOptions.sizes.length === 0}>
          <option value="">선택하세요</option>
          {availableOptions.sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>높이:</label>
        <select name="height" value={selections.height} onChange={handleChange} disabled={availableOptions.heights.length === 0}>
          <option value="">선택하세요</option>
          {availableOptions.heights.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      {/* 3행 */}
      <div className="form-group">
        <label>단수:</label>
        <select name="level" value={selections.level} onChange={handleChange} disabled={availableOptions.levels.length === 0}>
          <option value="">선택하세요</option>
          {availableOptions.levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>수량:</label>
        <input type="number" name="quantity" min="1" value={selections.quantity} onChange={handleChange} />
      </div>
    </div>
  );
}

export default OptionSelector;
