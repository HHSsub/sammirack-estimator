import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './PurchaseOrderForm.css';

const PurchaseOrderForm = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    orderNumber: '',
    companyName: '',
    items: [
      { name: '', specification: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
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

  // 아이템 추가
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', specification: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }]
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
    localStorage.setItem('printData', JSON.stringify(formData));
    window.open('/print?type=purchase-order', '_blank');
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
            onChange={(e) => updateFormData('orderNumber', e.target.value)}
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
            <td>
              <input
                type="text"
                value={formData.orderNumber}
                onChange={(e) => updateFormData('orderNumber', e.target.value)}
                placeholder="거래번호"
              />
            </td>
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
            <td colSpan={2} rowSpan={4} style={{
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: 15,
              verticalAlign: 'middle',
              padding: '18px 0',
              background: '#f8f9fa',
              border: '1px solid #ddd'
            }}>
              아래와 같이 발주합니다 (부가세, 운임비 별도)
            </td>
            <td className="label">대표자</td>
            <td>박이삭</td>
          </tr>
          <tr>
            <td className="label">소재지</td>
            <td>경기도 광명시 원노온사로 39, 제1동</td>
          </tr>
          <tr>
            <td className="label">TEL</td>
            <td>(02)2611-4597</td>
          </tr>
          <tr>
            <td className="label">FAX</td>
            <td>(02)2611-4595</td>
          </tr>
          <tr>
            <td className="label">홈페이지</td>
            <td>http://www.ssmake.com</td>
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
            <th>규격</th>
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
                  value={item.specification}
                  onChange={(e) => updateItem(index, 'specification', e.target.value)}
                  placeholder="규격"
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
                  className="remove-btn"
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
      <div className="item-controls">
        <button type="button" onClick={addItem} className="add-item-btn">
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
            <th>규격/설명</th>
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
                  type="text"
                  value={material.specification}
                  onChange={(e) => updateMaterial(index, 'specification', e.target.value)}
                  placeholder="규격/설명"
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
                  className="remove-btn"
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
      <div className="item-controls">
        <button type="button" onClick={addMaterial} className="add-material-btn">
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
      <div className="form-actions">
        <button type="button" onClick={handleSave} className="save-btn">
          저장하기
        </button>
        <button type="button" onClick={handlePrint} className="print-btn">
          인쇄하기
        </button>
      </div>

      {/* 하단 회사명 */}
      <div className="form-company">(주)삼미앵글랙산업</div>
    </div>
  );
};

export default PurchaseOrderForm;
