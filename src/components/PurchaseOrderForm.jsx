import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import '../styles/PurchaseOrderForm.css';

const PurchaseOrderForm = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate(); // navigate 변수 추가
  const isEditMode = !!id;
  const orderNumberInputRef = useRef(null);
  const [memo, setMemo] = useState('');
  
  // 장바구니에서 전달받은 데이터
  const cartData = location.state || {};
  const { cart = [], cartTotal = 0, totalBom = [] } = cartData;
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    orderNumber: '',
    companyName: '',
    items: [
      { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    materials: [
      { name: '', specification: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    notes: ''
  });

  // 편집 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (isEditMode) {
      const storageKey = `order_${id}`;
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const orderData = JSON.parse(savedData);
        setFormData(orderData);
      }
    }
  }, [id, isEditMode]);

  // 장바구니 데이터를 items와 materials로 변환하는 useEffect 추가
  useEffect(() => {
    if (!isEditMode && (cart.length > 0 || totalBom.length > 0)) {
      // cart 데이터를 items로 변환
      const cartItems = cart.map((item, index) => ({
        name: item.displayName || item.name || '',
        unit: '개',
        quantity: item.quantity || 1,
        unitPrice: Math.round((item.price || 0) / (item.quantity || 1)),
        totalPrice: item.price || 0,
        note: ''
      }));

      // totalBom 데이터를 materials로 변환
      const bomMaterials = totalBom.map((bom, index) => ({
        name: bom.name || '',
        specification: bom.specification || '',
        quantity: bom.quantity || 0,
        unitPrice: bom.unitPrice || 0,
        totalPrice: bom.totalPrice || (bom.quantity * bom.unitPrice) || 0,
        note: bom.note || ''
      }));

      setFormData(prev => ({
        ...prev,
        items: cartItems.length > 0 ? cartItems : prev.items,
        materials: bomMaterials.length > 0 ? bomMaterials : prev.materials
      }));
    }
  }, [cart, totalBom, isEditMode]);

  // 아이템 추가
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }]
    }));
  };

  // 아이템 삭제
  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // 원자재 추가
  const addMaterial = () => {
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, { name: '', specification: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }]
    }));
  };

  // 원자재 삭제
  const removeMaterial = (index) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }));
  };

  // 아이템 업데이트
  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // 수량과 단가가 입력되면 공급가 자동 계산
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = parseFloat(newItems[index].quantity) || 0;
      const unitPrice = parseFloat(newItems[index].unitPrice) || 0;
      newItems[index].totalPrice = quantity * unitPrice;
    }
    
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  // 원자재 업데이트
  const updateMaterial = (index, field, value) => {
    const newMaterials = [...formData.materials];
    newMaterials[index][field] = value;
    
    // 수량과 단가가 입력되면 금액 자동 계산
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = parseFloat(newMaterials[index].quantity) || 0;
      const unitPrice = parseFloat(newMaterials[index].unitPrice) || 0;
      newMaterials[index].totalPrice = quantity * unitPrice;
    }
    
    setFormData(prev => ({ ...prev, materials: newMaterials }));
  };

  // 전체 금액 계산
  useEffect(() => {
    const itemSubtotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
    const materialSubtotal = formData.materials.reduce((sum, material) => sum + (parseFloat(material.totalPrice) || 0), 0);
    const subtotal = itemSubtotal + materialSubtotal;
    const tax = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + tax;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      tax,
      totalAmount
    }));
  }, [formData.items, formData.materials]);

  // 폼 데이터 업데이트
  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 저장 함수 (편집 모드 지원)
  const handleSave = () => {
    const itemId = isEditMode ? id : Date.now();
    const storageKey = `order_${itemId}`;
    
    const newPurchaseOrder = {
      ...formData,
      id: itemId,
      type: 'order',
      status: formData.status || '진행 중',
      orderNumber: formData.orderNumber,
      customerName: formData.companyName,
      // HistoryPage에서 필요한 추가 필드들
      productType: formData.items.length > 0 ? formData.items[0].name : '',
      quantity: formData.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0),
      unitPrice: formData.items.length > 0 ? parseInt(formData.items[0].unitPrice) || 0 : 0,
      totalPrice: formData.totalAmount,
      contactInfo: '', // 필요시 추가 필드
      selectedOptions: {}, // 필요시 추가 필드
      // 발주서 전용 필드들
      deliveryDate: formData.deliveryDate || '',
      deliveryAddress: formData.deliveryAddress || '',
      paymentTerms: formData.paymentTerms || '계약금 50%, 잔금 50% (출고 전)',
      updatedAt: new Date().toISOString()
    };

    // createdAt은 새 문서일 때만 설정
    if (!isEditMode) {
      newPurchaseOrder.createdAt = new Date().toISOString();
    }

    localStorage.setItem(storageKey, JSON.stringify(newPurchaseOrder));
    alert(isEditMode ? '발주서가 수정되었습니다.' : '발주서가 저장되었습니다.');
  };

  // 인쇄하기
  const handlePrint = () => {
    if (!formData.orderNumber || String(formData.orderNumber).trim() === '') {
      if (orderNumberInputRef.current) {
        orderNumberInputRef.current.classList.add('invalid');
        orderNumberInputRef.current.focus();
        orderNumberInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      alert('거래번호를 입력해주세요.');
      return;
    }
    window.print();
  };

  return (
    <div className="purchase-order-form-container">
      <div className="form-header">
        <h1>발&nbsp;&nbsp;&nbsp;&nbsp;주&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
        <div className="order-number-field">
          <label>거레번호:</label>
          <input
            type="text"
            value={formData.orderNumber}
            ref={orderNumberInputRef}
            onChange={(e) => {
              if (orderNumberInputRef.current) {
                orderNumberInputRef.current.classList.remove('invalid');
              }
              updateFormData('orderNumber', e.target.value);
            }}
            placeholder="거래번호 입력"
          />
        </div>
      </div>

      {/* 상단 정보 테이블 - BaljuPrint와 동일한 구조 */}
      <table className="form-table info-table">
        <tbody>
          <tr>
            <td className="label">거래일자</td>
            <td>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateFormData('date', e.target.value)}
              />
            </td>
            <td className="label">거래번호</td>
            <td>{formData.orderNumber}</td>
          </tr>
          <tr>
            <td className="label">상호명</td>
            <td>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => updateFormData('companyName', e.target.value)}
                placeholder="고객 회사명 입력"
              />
            </td>
            <td className="label">상호</td>
            <td>삼미앵글랙산업</td>
          </tr>
          <tr>
            <td colSpan={2} style={{
              textAlign: "center",
              fontWeight: "bold",
              verticalAlign: "middle",
              padding: "4px 0",
              background: "#f8f9fa",
              lineHeight: "1.1"
            }}>
              <textarea
                className="estimate-memo"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="아래와 같이 발주합니다 (부가세, 운임비 별도)"
                style={{
                  width: "96%",
                  border: "none",
                  background: "#f8f9fa",
                  color: memo ? "#333" : "#999",
                  fontWeight: "bold",
                  fontSize: "12px",
                  textAlign: "center",
                  resize: "none",
                  outline: "none",
                  fontStyle: memo ? "normal" : "italic",
                  opacity: memo ? 1 : 0.7,
                  minHeight: "2em",
                  lineHeight: "1.2"
                }}
              />
            </td>
            <td className="label">대표자</td>
            <td>
              <span>박이삭</span>
              <img
                src={`${import.meta.env.BASE_URL}images/도장.png`}
                alt="도장"
                style={{
                  marginLeft: "6px",
                  verticalAlign: "middle",
                  opacity: 0.85
                }}
              />
            </td>
          </tr>
          <tr>
            <td className="label">소재지</td>
            <td>경기도 광명시 원노온사로 39, 철제 스틸하우스 1</td>
            <td className="label">홈페이지</td>
            <td>http://www.ssmake.com</td>
          </tr>
          <tr>
            <td class="label">TEL</td>
            <td>(02)2611-4597</td>
            <td class="label">FAX</td>
            <td>(02)2611-4595</td>
          </tr>
        </tbody>
      </table>

      {/* 발주 명세 테이블 */}
      <h3 className="section-title">발주 명세</h3>
      <table className="form-table order-table">
        <thead>
          <tr>
            <th>NO</th>
            <th>품명</th>
            <th>단위</th>
            <th>수량</th>
            <th>단가</th>
            <th>공급가</th>
            <th>비고</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {formData.items.map((item, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(index, 'name', e.target.value)}
                  placeholder="품명 입력"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                  placeholder="단위"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  placeholder="수량"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                  placeholder="단가"
                />
              </td>
              <td className="right">
                {item.totalPrice ? parseInt(item.totalPrice).toLocaleString() : '0'}
              </td>
              <td>
                <input
                  type="text"
                  value={item.note}
                  onChange={(e) => updateItem(index, 'note', e.target.value)}
                  placeholder="비고"
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="remove-btn no-print"
                  disabled={formData.items.length === 1}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 아이템 추가 버튼 */}
      <div className="item-controls no-print">
        <button type="button" onClick={addItem} className="add-item-btn no-print">
          + 발주 품목 추가
        </button>
      </div>

      {/* 원자재 명세서 테이블 */}
      <h3 className="section-title">원자재 명세서</h3>
      <table className="form-table material-table">
        <thead>
          <tr>
            <th>NO</th>
            <th>부품명</th>
            <th>수량</th>
            <th>단가</th>
            <th>금액</th>
            <th>비고</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {formData.materials.map((material, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                <input
                  type="text"
                  value={material.name}
                  onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                  placeholder="부품명 입력"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={material.quantity}
                  onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                  placeholder="수량"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={material.unitPrice}
                  onChange={(e) => updateMaterial(index, 'unitPrice', e.target.value)}
                  placeholder="단가"
                />
              </td>
              <td className="right">
                {material.totalPrice ? parseInt(material.totalPrice).toLocaleString() : '0'}
              </td>
              <td>
                <input
                  type="text"
                  value={material.note}
                  onChange={(e) => updateMaterial(index, 'note', e.target.value)}
                  placeholder="비고"
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeMaterial(index)}
                  className="remove-btn no-print"
                  disabled={formData.materials.length === 1}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 원자재 추가 버튼 */}
      <div className="item-controls no-print">
        <button type="button" onClick={addMaterial} className="add-material-btn no-print">
          + 원자재 추가
        </button>
      </div>

      {/* 합계 테이블 */}
      <table className="form-table total-table">
        <tbody>
          <tr>
            <td className="label">소계</td>
            <td className="right">{formData.subtotal.toLocaleString()}</td>
          </tr>
          <tr>
            <td className="label">부가세</td>
            <td className="right">{formData.tax.toLocaleString()}</td>
          </tr>
          <tr>
            <td className="label"><strong>합계</strong></td>
            <td className="right"><strong>{formData.totalAmount.toLocaleString()}</strong></td>
          </tr>
        </tbody>
      </table>

      {/* 비고 */}
      <div className="notes-section">
        <label>비고:</label>
        <textarea
          value={formData.notes}
          onChange={(e) => updateFormData('notes', e.target.value)}
          placeholder="기타 사항을 입력하세요"
          rows={4}
        />
      </div>

      {/* 하단 버튼들 */}
      <div className="form-actions no-print">
        <button type="button" onClick={handleSave} className="save-btn no-print">
          저장하기
        </button>
        <button type="button" onClick={handlePrint} className="print-btn no-print">
          인쇄하기
        </button>
      </div>

      {/* 하단 회사명 */}
      <div className="form-company">(주)삼미앵글랙산업</div>
    </div>
  );
};

export default PurchaseOrderForm;
