import React from 'react';
import { useProducts } from '../contexts/ProductContext';

function OptionSelector() {
  const { loading, productsData, selections, setSelections, availableOptions } = useProducts();

  const handleChange = (e) => {
    const { name, value } = e.target;

    const resetFields = (startField) => {
      const fields = ['version', 'color', 'size', 'height', 'level'];
      const startIndex = fields.indexOf(startField);
      const fieldsToReset = {};
      if (startIndex !== -1) {
        for (let i = startIndex + 1; i < fields.length; i++) {
          fieldsToReset[fields[i]] = '';
        }
      }
      return fieldsToReset;
    };

    let fieldsToReset = {};
    if (name === 'type') fieldsToReset = resetFields('type');
    if (name === 'color') fieldsToReset = resetFields('color');
    if (name === 'size') fieldsToReset = resetFields('size');
    if (name === 'height') fieldsToReset = resetFields('height');

    setSelections(prev => ({
      ...prev,
      ...fieldsToReset,
      [name]: name === 'quantity' ? parseInt(value, 10) || 1 : value,
    }));
  };

  if (loading) return <p>데이터를 불러오는 중...</p>;

  return (
    <div className="product-selection grid grid-cols-2 gap-4">
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
          <select name="version" value={selections.version} onChange={handleChange} disabled={availableOptions.versions.length === 0}>
            <option value="">선택하세요</option>
            {availableOptions.versions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      {selections.type === '하이랙' && (
        <div className="form-group">
          <label>색상/타입:</label>
          <select name="color" value={selections.color} onChange={handleChange} disabled={availableOptions.colors.length === 0}>
            <option value="">선택하세요</option>
            {availableOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

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
