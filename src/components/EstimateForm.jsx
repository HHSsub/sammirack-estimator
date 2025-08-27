import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import '../styles/EstimateForm.css'; // 새로운 경로로 import

const EstimateForm = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate(); // useNavigate 훅 추가
  const isEditMode = !!id;
  const [memo, setMemo] = useState('아래와 같이 견적합니다 (부가세, 운임비 별도)');
  
  // 장바구니에서 전달받은 데이터
  const cartData = location.state || {};
  const { cart = [], cartTotal = 0, totalBom = [] } = cartData;
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    companyName: '',
    documentNumber: '',
    items: [
      { name: '', specification: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    notes: ''
  });

  // 편집 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (isEditMode) {
      const storageKey = `estimate_${id}`;
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const estimateData = JSON.parse(savedData);
        setFormData(estimateData);
      }
    }
  }, [id, isEditMode]);

  // 장바구니 데이터를 items로 변환하는 useEffect 추가
  useEffect(() => {
    if (!isEditMode && cart.length > 0) {
      const cartItems = cart.map((item, index) => ({
        name: item.displayName || item.name || '',
        specification: item.specification || '',
        unit: '개',
        quantity: item.quantity || 1,
        unitPrice: Math.round((item.price || 0) / (item.quantity || 1)),
        totalPrice: item.price || 0,
        note: ''
      }));

      setFormData(prev => ({
        ...prev,
        items: cartItems.length > 0 ? cartItems : prev.items
      }));
    }
  }, [cart, isEditMode]);

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

  // 전체 금액 계산
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
    const tax = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + tax;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      tax,
      totalAmount
    }));
  }, [formData.items]);

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
    const storageKey = `estimate_${itemId}`;
    
    const newEstimate = {
      ...formData,
      id: itemId,
      type: 'estimate',
      status: formData.status || '진행 중',
      estimateNumber: formData.documentNumber,
      customerName: formData.companyName,
      // HistoryPage에서 필요한 추가 필드들
      productType: formData.items.length > 0 ? formData.items[0].name : '',
      quantity: formData.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0),
      unitPrice: formData.items.length > 0 ? parseInt(formData.items[0].unitPrice) || 0 : 0,
      totalPrice: formData.totalAmount,
      contactInfo: '', // 필요시 추가 필드
      selectedOptions: {}, // 필요시 추가 필드
      updatedAt: new Date().toISOString()
    };

    // createdAt은 새 문서일 때만 설정
    if (!isEditMode) {
      newEstimate.createdAt = new Date().toISOString();
    }

    localStorage.setItem(storageKey, JSON.stringify(newEstimate));
    alert(isEditMode ? '견적서가 수정되었습니다.' : '견적서가 저장되었습니다.');
  };

  // 인쇄하기
  const handlePrint = () => {
    // 현재 페이지에서 직접 인쇄하는 방식으로 변경
    const printWindow = window.open('', '_blank');
    const printData = formData;
    
    // 인쇄용 HTML 생성
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>견적서</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .print-header { text-align: center; margin-bottom: 30px; }
            .print-header h1 { font-size: 24px; margin: 0; }
            .info-table, .quote-table, .total-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .info-table td, .quote-table th, .quote-table td, .total-table td { border: 1px solid #000; padding: 8px; }
            .quote-table th { background-color: #f0f0f0; text-align: center; }
            .right { text-align: right; }
            .label { background-color: #f8f9fa; font-weight: bold; }
            .notes-section { margin-top: 20px; }
            .form-company { text-align: center; margin-top: 30px; font-weight: bold; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
          <div>문서번호: ${printData.documentNumber}</div>
        </div>
        
        <table class="info-table">
          <tbody>
            <tr>
              <td class="label">견적일자</td>
              <td>${printData.date}</td>
              <td class="label">사업자등록번호</td>
              <td>232-81-01750</td>
            </tr>
            <tr>
              <td class="label">상호명</td>
              <td>${printData.companyName}</td>
              <td class="label">상호</td>
              <td>삼미앵글랙산업</td>
            </tr>
            <tr>
              <td colSpan={2} rowSpan={3} style={{
                textAlign: "center",
                fontWeight: "bold",
                verticalAlign: "middle",
                padding: "16px 0",
                background: "#f8f9fa"
              }}>
                <textarea
                  className="estimate-memo"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="아래와 같이 견적합니다 (부가세, 운임비 별도)"
                  style={{
                    width: "96%",
                    border: "none",
                    background: "#f8f9fa",
                    color: memo ? "#333" : "#999",
                    fontWeight: "bold",
                    fontSize: "16px",
                    textAlign: "center",
                    resize: "none",
                    outline: "none",
                    fontStyle: memo ? "normal" : "italic",
                    opacity: memo ? 1 : 0.7,
                    minHeight: "3em",
                    lineHeight: "1.5"
                  }}
                />
              </td>
              <td class="label">대표자</td>
              <td>박이삭</td>
            </tr>
            <tr>
              <td class="label">소재지</td>
              <td>경기도 광명시 원노온사로 39, 제1동</td>
            </tr>
            <tr>
              <td class="label">TEL</td>
              <td>(02)2611-4597</td>
            </tr>
            <tr>
              <td class="label">FAX</td>
              <td>(02)2611-4595</td>
            </tr>
            <tr>
              <td class="label">홈페이지</td>
              <td>http://www.ssmake.com</td>
            </tr>
          </tbody>
        </table>
        
        <table class="quote-table">
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
            </tr>
          </thead>
          <tbody>
            ${printData.items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.name}</td>
                <td>${item.specification}</td>
                <td>${item.unit}</td>
                <td>${item.quantity}</td>
                <td>${parseInt(item.unitPrice || 0).toLocaleString()}</td>
                <td class="right">${parseInt(item.totalPrice || 0).toLocaleString()}</td>
                <td>${item.note}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <table class="total-table">
          <tbody>
            <tr>
              <td class="label">소계</td>
              <td class="right">${printData.subtotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="label">부가세</td>
              <td class="right">${printData.tax.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="label"><strong>합계</strong></td>
              <td class="right"><strong>${printData.totalAmount.toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>
        
        ${printData.notes ? `
          <div class="notes-section">
            <strong>비고:</strong><br>
            ${printData.notes.replace(/\n/g, '<br>')}
          </div>
        ` : ''}
        
        <div class="form-company">(주)삼미앵글랙산업</div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // 인쇄 실행
    printWindow.onload = function() {
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <div className="estimate-form-container">
      <div className="form-header">
        <h1>견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
        <div className="document-number-field">
          <label>문서번호:</label>
          <input
            type="text"
            value={formData.documentNumber}
            onChange={(e) => updateFormData('documentNumber', e.target.value)}
            placeholder="휴대폰번호 입력"
          />
        </div>
      </div>

      {/* 상단 정보 테이블 - GyeonjukPrint와 동일한 구조 */}
      <table className="form-table info-table">
        <tbody>
          <tr>
            <td className="label">견적일자</td>
            <td>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateFormData('date', e.target.value)}
              />
            </td>
            <td className="label">사업자등록번호</td>
            <td>232-81-01750</td>
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
            <td colSpan={2} rowSpan={3} style={{
              textAlign: "center",
              fontWeight: "bold",
              verticalAlign: "middle",
              padding: "16px 0",
              background: "#f8f9fa"
            }}>
              <textarea
                className="estimate-memo"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="아래와 같이 견적합니다 (부가세, 운임비 별도)"
                style={{
                  width: "96%",
                  border: "none",
                  background: "#f8f9fa",
                  color: memo ? "#333" : "#999",
                  fontWeight: "bold",
                  fontSize: "16px",
                  textAlign: "center",
                  resize: "none",
                  outline: "none",
                  fontStyle: memo ? "normal" : "italic",
                  opacity: memo ? 1 : 0.7,
                  minHeight: "3em",
                  lineHeight: "1.5"
                }}
              />
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

      {/* 견적 명세 테이블 */}
      <table className="form-table quote-table">
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
          + 품목 추가
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

export default EstimateForm;
