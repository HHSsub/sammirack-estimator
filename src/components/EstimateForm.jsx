import React, { useState, useEffect } from 'react';
import { useProductState } from '../contexts/ProductContext.jsx';
import BOMDisplay from './BOMDisplay';
import '../styles/EstimateForm.css';

/**
 * Enhanced EstimateForm component with BOM display and purchase order generation
 */
const EstimateForm = ({ onSave, onCreatePurchaseOrder, onPrint, existingEstimate = null }) => {
  const { productType, selectedOptions, price } = useProductState();
  
  // Form state
  const [estimateNumber, setEstimateNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState(price);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Load estimate data if editing existing estimate
  useEffect(() => {
    if (existingEstimate) {
      setEstimateNumber(existingEstimate.estimateNumber);
      setCustomerName(existingEstimate.customerName);
      setContactInfo(existingEstimate.contactInfo);
      setQuantity(existingEstimate.quantity);
      setDate(existingEstimate.date);
    } else {
      // Generate default estimate number
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      setEstimateNumber(`EST-${year}${month}${day}-${randomNum}`);
    }
  }, [existingEstimate]);
  
  // Update total price when quantity or price changes
  useEffect(() => {
    setTotalPrice(price * quantity);
  }, [price, quantity]);
  
  const handleSave = () => {
    if (!customerName || !productType) {
      alert('고객명과 제품 유형은 필수 입력사항입니다.');
      return;
    }
    
    // Create estimate object
    const estimate = {
      id: existingEstimate?.id || crypto.randomUUID(),
      type: 'estimate',
      estimateNumber,
      date,
      customerName,
      contactInfo,
      productType,
      selectedOptions,
      quantity,
      unitPrice: price,
      totalPrice,
      createdAt: existingEstimate?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (onSave) {
      onSave(estimate);
    }
  };
  
  const handleCreatePurchaseOrder = () => {
    if (!customerName || !productType) {
      alert('고객명과 제품 유형은 필수 입력사항입니다.');
      return;
    }
    
    // Create estimate object first
    const estimate = {
      id: existingEstimate?.id || crypto.randomUUID(),
      type: 'estimate',
      estimateNumber,
      date,
      customerName,
      contactInfo,
      productType,
      selectedOptions,
      quantity,
      unitPrice: price,
      totalPrice,
      createdAt: existingEstimate?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (onCreatePurchaseOrder) {
      onCreatePurchaseOrder(estimate);
    }
  };
  
  const handlePrint = () => {
    if (!customerName || !productType) {
      alert('고객명과 제품 유형은 필수 입력사항입니다.');
      return;
    }
    
    // Create temporary estimate object for printing
    const estimate = {
      estimateNumber,
      date,
      customerName,
      contactInfo,
      productType,
      selectedOptions,
      quantity,
      unitPrice: price,
      totalPrice
    };
    
    if (onPrint) {
      onPrint(estimate);
    }
  };
  
  return (
    <div className="estimate-form">
      <h2>견적서 작성</h2>
      
      <div className="form-section">
        <div className="form-group">
          <label>견적서 번호:</label>
          <input
            type="text"
            value={estimateNumber}
            onChange={(e) => setEstimateNumber(e.target.value)}
            placeholder="견적서 번호"
          />
        </div>
        
        <div className="form-group">
          <label>날짜:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      
      <div className="form-section">
        <div className="form-group">
          <label>고객명:</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="고객명"
          />
        </div>
        
        <div className="form-group">
          <label>연락처:</label>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="연락처"
          />
        </div>
      </div>
      
      <div className="product-summary">
        <h3>제품 정보</h3>
        
        {productType ? (
          <>
            <p><strong>제품 유형:</strong> {productType}</p>
            
            {selectedOptions && Object.entries(selectedOptions).map(([key, value]) => (
              <p key={key}><strong>{key === 'size' ? '규격' : 
                              key === 'height' ? '높이' : 
                              key === 'level' ? '단수' : 
                              key === 'color' ? '색상' : key}:</strong> {value}</p>
            ))}
            
            <div className="quantity-section">
              <label>수량:</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            
            <p><strong>단가:</strong> {price.toLocaleString()}원</p>
            <p><strong>총액:</strong> {totalPrice.toLocaleString()}원</p>
          </>
        ) : (
          <p>제품을 선택해주세요.</p>
        )}
      </div>
      
      {/* BOM Display */}
      {productType && (
        <BOMDisplay
          productType={productType}
          selectedOptions={selectedOptions}
          quantity={quantity}
        />
      )}
      
      <div className="form-actions">
        <button onClick={handleSave} disabled={!productType}>견적서 저장</button>
        <button onClick={handleCreatePurchaseOrder} disabled={!productType}>주문서 생성</button>
        <button onClick={handlePrint} disabled={!productType}>인쇄</button>
      </div>
    </div>
  );
};

export default EstimateForm;