import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BOMDisplay from './BOMDisplay';
import { formatEstimateData, navigateToPrintPage } from '../utils/printUtils';

const EstimateForm = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [cart] = useState(Array.isArray(location.state?.cart) ? location.state.cart : []);
  const [cartTotal] = useState(location.state?.cartTotal || 0);
  const [totalBom] = useState(location.state?.totalBom || []);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    estimateNumber: '',
    customerName: '',
    contactInfo: '',
    companyName: '',
    contactPerson: '',
    notes: ''
  });

  useEffect(() => {
    if (!location.state || cart.length === 0) {
      alert("견적할 항목을 먼저 선택해주세요.");
      navigate('/');
    }
  }, [location, navigate, cart.length]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => {
    const printData = formatEstimateData(formData, cart, cartTotal);

    // ==== 히스토리에 저장 ====
    const id = Date.now().toString();
    const historyItem = {
      id,
      type: 'estimate',
      estimateNumber: printData.estimateNumber,
      date: printData.date,
      customerName: printData.customerName,
      contactInfo: printData.contactInfo,
      productType: cart[0]?.type || '',
      selectedOptions: cart[0]?.options || {},
      quantity: cart[0]?.quantity || 0,
      unitPrice: cart[0] ? Math.floor(cart[0].price / (cart[0].quantity || 1)) : 0,
      totalPrice: cartTotal,
      status: '진행 중',
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(`estimate_${id}`, JSON.stringify(historyItem));
    // ========================

    navigateToPrintPage('gyeonjuk', printData, navigate);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">견적서 작성</h2>

      {/* 고객 정보 입력 */}
      <div className="mb-6 p-4 border rounded">
        <h3 className="text-xl font-semibold mb-3">견적서 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* 날짜, 번호, 회사명, 담당자, 고객명, 연락처 필드들 */}
          <div>
            <label>견적일자</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label>견적번호</label>
            <input type="text" name="estimateNumber" value={formData.estimateNumber} onChange={handleInputChange} placeholder="자동 생성됩니다" className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label>상호명 (공급받는 쪽)</label>
            <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="예: (주)테스트" className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label>담당자</label>
            <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} placeholder="예: 홍길동" className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label>고객명</label>
            <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label>연락처</label>
            <input type="text" name="contactInfo" value={formData.contactInfo} onChange={handleInputChange} className="w-full p-2 border rounded"/>
          </div>
        </div>
        <div className="mt-4">
          <label>비고사항</label>
          <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="3" className="w-full p-2 border rounded"/>
        </div>
      </div>

      {/* 항목 리스트 */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold">견적 항목</h3>
        <table className="w-full text-left border-collapse">
          <thead><tr><th>항목</th><th className="text-right">금액</th></tr></thead>
          <tbody>
            {cart.map((item, idx) => (
              <tr key={idx}>
                <td>{item.displayName || `${item.type} ${item.options?.formType || ''} ${item.options?.size || ''} ${item.options?.height || ''} ${item.options?.level || ''} x ${item.quantity}개`}</td>
                <td className="text-right">{item.price?.toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-semibold">총 견적 금액: {cartTotal.toLocaleString()} 원</h3>

      <BOMDisplay bom={totalBom} title="총 부품 목록 (BOM)" />

      {/* 버튼 */}
      <div className="mt-6 flex gap-4">
        <button onClick={handlePrint} className="p-3 bg-green-500 text-white rounded">견적서 인쇄</button>
        <button onClick={() => navigate('/')} className="p-3 bg-gray-500 text-white rounded">돌아가기</button>
      </div>
    </div>
  );
};

export default EstimateForm;
