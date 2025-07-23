import React, { useState } from 'react';
import BOMDisplay from './BOMDisplay';

/**
 * Test component for BOMDisplay
 */
const BOMDisplayTest = () => {
  const [productType, setProductType] = useState('스텐랙');
  const [size, setSize] = useState('50x75');
  const [height, setHeight] = useState('180');
  const [level, setLevel] = useState('3단');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [compact, setCompact] = useState(false);
  
  const handleProductTypeChange = (e) => {
    const newType = e.target.value;
    setProductType(newType);
    
    if (newType === '하이랙') {
      setColor('700kg 블루');
    } else {
      setColor('');
    }
  };
  
  const selectedOptions = {
    size,
    height,
    level,
    ...(productType === '하이랙' ? { color } : {})
  };
  
  return (
    <div className="test-container">
      <h2>BOM 표시 테스트</h2>
      
      <div className="controls">
        <label>
          <input 
            type="checkbox" 
            checked={compact} 
            onChange={(e) => setCompact(e.target.checked)} 
          />
          컴팩트 모드
        </label>
      </div>
      
      <div className="selection-form">
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
      
      <div className="bom-section">
        <BOMDisplay
          productType={productType}
          selectedOptions={selectedOptions}
          quantity={quantity}
          compact={compact}
        />
      </div>
      
      <div className="bom-section">
        <h3>하이랙 예제 (두번째 인스턴스)</h3>
        <BOMDisplay
          productType="하이랙"
          selectedOptions={{
            size: "75x100",
            height: "210",
            level: "4단",
            color: "700kg 블루"
          }}
          quantity={2}
          compact={compact}
        />
      </div>
    </div>
  );
};

export default BOMDisplayTest;