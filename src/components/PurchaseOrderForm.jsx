import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BOMDisplay from './BOMDisplay';
import { formatPurchaseOrderData, navigateToPrintPage } from '../utils/printUtils';

const PurchaseOrderForm = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [cart] = useState(Array.isArray(location.state?.cart) ? location.state.cart : []);
  const [cartTotal] = useState(location.state?.cartTotal || 0);
  const [totalBom] = useState(location.state?.totalBom || []);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    orderNumber: '',
    customerName: '',
    contactInfo: '',
    companyName: '',
    contactPerson: '',
    notes: ''
  });

  useEffect(() => {
    if (!location.state || !Array.isArray(location.state.cart) || location.state.cart.length === 0) {
      alert("발주할 항목을 먼저 선택해주세요.");
      navigate('/');
    }
  }, [location, navigate]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => {
    const printData = formatPurchaseOrderData(formData, cart, totalBom, cartTotal);
    navigateToPrintPage('balju', printData, navigate);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">거래명세서(발주서) 작성</h2>

      {/* 발주서 정보 */}
      <div className="mb-6 p-4 border rounded">
        <h3 className="text-xl font-semibold mb-3">발주서 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* 필드들 */}
          <div>
            <label className="block text-sm font-medium mb-1">발주일자</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">발주번호</label>
            <input type="text" name="orderNumber" value={formData.orderNumber} onChange={handleInputChange} placeholder="자동 생성됩니다" className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">상호명 (공급받는 쪽)</label>
            <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="예: (주)테스트고객" className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">담당자</label>
            <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} placeholder="예: 홍길동" className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">고객명</label>
            <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} className="w-full p-2 border rounded"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">연락처</label>
            <input type="text" name="contactInfo" value={formData.contactInfo} onChange={handleInputChange} className="w-full p-2 border rounded"/>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">비고사항</label>
          <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="3" className="w-full p-2 border rounded" placeholder="추가 정보나 특별 요구사항을 입력하세요"/>
        </div>
      </div>

      {/* 발주 항목 */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold">발주 항목</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="border-b p-2">항목</th>
              <th className="border-b p-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item, idx) => {
              if (!item || !item.type) return null;
              return (
                <tr key={idx}>
                  <td className="border-b p-2">
                    {item.displayName || `${item.type} ${item.options?.size || ''}`} × {item.quantity}개
                  </td>
                  <td className="border-b p-2 text-right">{item.price?.toLocaleString() || '0'}원</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 총액 */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold">총 발주 금액</h3>
        <p className="text-2xl text-red-600">{cartTotal.toLocaleString()} 원</p>
      </div>

      {/* BOM */}
      <BOMDisplay bom={totalBom} title="총 부품 목록 (BOM)" />

      <div className="mt-6 flex gap-4">
        <button onClick={handlePrint} className="p-3 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
          발주서 인쇄
        </button>
        <button onClick={() => navigate('/')} className="p-3 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
