import React, { useState, useEffect } from 'react';
import { useProductState } from '../contexts/ProductContext.jsx';
import BOMDisplay from './BOMDisplay';
import '../styles/PurchaseOrderForm.css';

/**
 * PurchaseOrderForm component with BOM display
 * Can be created from an existing estimate or from scratch
 */
const PurchaseOrderForm = ({ onSave, onPrint, existingOrder = null, fromEstimate = null }) => {
  const { productType, selectedOptions, price } = useProductState();
  
  // Form state
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState(price);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimateNumber, setEstimateNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('계약금 50%, 잔금 50% (출고 전)');
  const [notes, setNotes] = useState('');
  
  // Load data if editing existing order or creating from estimate
  useEffect(() => {
    if (existingOrder) {
      // Load existing order data
      setOrderNumber(existingOrder.orderNumber);
      setCustomerName(existingOrder.customerName);
      setContactInfo(existingOrder.contactInfo);
      setQuantity(existingOrder.quantity);
      setDate(existingOrder.date);
      setEstimateNumber(existingOrder.estimateNumber || '');
      setDeliveryDate(existingOrder.deliveryDate || '');
      setDeliveryAddress(existingOrder.deliveryAddress || '');
      setPaymentTerms(existingOrder.paymentTerms || '계약금 50%, 잔금 50% (출고 전)');
      setNotes(existingOrder.notes || '');
      
    } else if (fromEstimate) {
      // Create order from estimate
      setCustomerName(fromEstimate.customerName);
      setContactInfo(fromEstimate.contactInfo);
      setQuantity(fromEstimate.quantity);
      setEstimateNumber(fromEstimate.estimateNumber);
      setTotalPrice(fromEstimate.totalPrice);
      
      // Generate default order number based on estimate number
      if (fromEstimate.estimateNumber) {
        setOrderNumber(fromEstimate.estimateNumber.replace('EST', 'PO'));
      } else {
        generateDefaultOrderNumber();
      }
      
    } else {
      // New order
      generateDefaultOrderNumber();
    }
  }, [existingOrder, fromEstimate]);
  
  // Update total price when quantity or price changes
  useEffect(() => {
    setTotalPrice(price * quantity);
  }, [price, quantity]);
  
  const generateDefaultOrderNumber = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setOrderNumber(`PO-${year}${month}${day}-${randomNum}`);
  };
  
  const handleSave = () => {
    if (!customerName || !productType) {
      alert('고객명과 제품 유형은 필수 입력사항입니다.');
      return;
    }
    
    // Create order object
    const order = {
      id: existingOrder?.id || crypto.randomUUID(),
      type: 'order',
      orderNumber,
      date,
      estimateNumber,
      customerName,
      contactInfo,
      productType,
      selectedOptions,
      quantity,
      unitPrice: price,
      totalPrice,
      deliveryDate,
      deliveryAddress,
      paymentTerms,
      notes,
      createdAt: existingOrder?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: existingOrder?.status || '처리 중' // default status
    };
    
    if (onSave) {
      onSave(order);
    }
  };
  
  const handlePrint = () => {
    if (!customerName || !productType) {
      alert('고객명과 제품 유형은 필수 입력사항입니다.');
      return;
    }
    
    // Create temporary order object for printing
    const order = {
      orderNumber,
      date,
      estimateNumber,
      customerName,
      contactInfo,
      productType,
      selectedOptions,
      quantity,
      unitPrice: price,
      totalPrice,
      deliveryDate,
      deliveryAddress,
      paymentTerms,
      notes
    };
    
    if (onPrint) {
      onPrint(order);
    }
  };
  
  return (
    <div className="purchase-order-form">
      <h2>주문서 작성</h2>
      
      <div className="form-section">
        <div className="form-group">
          <label>주문서 번호:</label>
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="주문서 번호"
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
          <label>견적서 번호:</label>
          <input
            type="text"
            value={estimateNumber}
            onChange={(e) => setEstimateNumber(e.target.value)}
            placeholder="견적서 번호 (선택사항)"
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
      
      <div className="form-section delivery-section">
        <h3>배송 및 결제 정보</h3>
        
        <div className="form-group">
          <label>배송 예정일:</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label>배송지:</label>
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="배송지 주소"
          />
        </div>
        
        <div className="form-group">
          <label>결제 조건:</label>
          <input
            type="text"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="결제 조건"
          />
        </div>
        
        <div className="form-group">
          <label>비고:</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="기타 사항"
          />
        </div>
      </div>
      
      <div className="form-actions">
        <button onClick={handleSave} disabled={!productType}>주문서 저장</button>
        <button onClick={handlePrint} disabled={!productType}>인쇄</button>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;