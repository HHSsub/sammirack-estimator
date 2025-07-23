import React, { useState } from 'react';
import BOMDisplay from './BOMDisplay';

/**
 * Test component to verify BOM calculation and display
 */
const TestBOM = () => {
  const [productType, setProductType] = useState('스텐랙');
  const [size, setSize] = useState('50x75');
  const [height, setHeight] = useState('180');
  const [level, setLevel] = useState('3단');
  const [color, setColor] = useState(''); // Only used for 하이랙
  const [quantity, setQuantity] = useState(1);

  const handleProductTypeChange = (e) => {
    const newType = e.target.value;
    setProductType(newType);
    
    // Reset color when switching product types
    if (newType === '하이랙') {
      setColor('700kg 블루');
    } else {
      setColor('');
    }
  };

  // Create selectedOptions object from current selections
  const selectedOptions = {
    size,
    height,
    level,
    ...(productType === '하이랙' ? { color } : {})
  };

  return (
    <div className="test-bom">
      <h2>BOM 테스트</h2>
      
      <div className="form-section">
        <div className="form-group">
          <label>제품 유형:</label>
          <select value={productType} onChange={handleProductTypeChange}>
            <option value="스텐랙">스텐랙</option>
            <option value="하이랙">하이랙</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>규격:</label>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="50x75">50x75</option>
            <option value="50x100">50x100</option>
            <option value="75x100">75x100</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>높이:</label>
          <select value={height} onChange={(e) => setHeight(e.target.value)}>
            <option value="120">120cm</option>
            <option value="180">180cm</option>
            <option value="210">210cm</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>단수:</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="3단">3단</option>
            <option value="4단">4단</option>
            <option value="5단">5단</option>
          </select>
        </div>
        
        {productType === '하이랙' && (
          <div className="form-group">
            <label>색상:</label>
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="700kg 블루">700kg 블루</option>
              <option value="300kg 오렌지">300kg 오렌지</option>
              <option value="300kg 메트그레이">300kg 메트그레이</option>
            </select>
          </div>
        )}
        
        <div className="form-group">
          <label>수량:</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>
      </div>
      
      <div className="result-section">
        <h3>선택된 옵션</h3>
        <p><strong>제품 유형:</strong> {productType}</p>
        <p><strong>규격:</strong> {size}</p>
        <p><strong>높이:</strong> {height}cm</p>
        <p><strong>단수:</strong> {level}</p>
        {productType === '하이랙' && <p><strong>색상:</strong> {color}</p>}
        <p><strong>수량:</strong> {quantity}</p>
      </div>
      
      <BOMDisplay
        productType={productType}
        selectedOptions={selectedOptions}
        quantity={quantity}
      />
    </div>
  );
};

export default TestBOM;
