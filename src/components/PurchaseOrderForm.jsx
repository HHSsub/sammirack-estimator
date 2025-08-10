import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BOMDisplay from './BOMDisplay';
import { formatPurchaseOrderData, navigateToPrintPage } from '../utils/printUtils';

const PurchaseOrderForm = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // context 데이터 그대로 받아서 표출
  const cart = Array.isArray(location.state?.cart) ? location.state.cart : [];
  const cartTotal = location.state?.cartTotal ?? 0;
  const totalBom = Array.isArray(location.state?.totalBom) ? location.state.totalBom : [];

  // 폼 상태
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
    if (!location.state || !cart.length) {
      alert("발주할 항목을 먼저 선택해주세요.");
      navigate('/');
    }
  }, [location, navigate, cart.length]);

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
      {/* 발주서 정보 폼(원형, 생략없음) */}
      <div className="mb-6 p-4 border rounded">
        <h3 className="text-xl font-semibold mb-3">발주서 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* ... input/textarea 폼 종류 */}
          <div><label>발주일자</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange}
             className="w-full p-2 border rounded" />
          </div>
          {/* 나머지 input들 동일 유지 */}
          {/* ... */}
        </div>
        <div className="mt-4">
          <label>비고사항</label>
          <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="3" className="w-full p-2 border rounded" />
        </div>
      </div>
      {/* 위: 발주 항목 테이블 */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold">발주 항목</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr><th className="border-b p-2">항목</th><th className="border-b p-2 text-right">금액</th></tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.id}>
                <td className="border-b p-2">
                  {item.displayName || `${item.type} ${item.options?.size || ''}`} × {item.quantity}개
                </td>
                <td className="border-b p-2 text-right">{item.price ? item.price.toLocaleString() : "0"}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">총 발주 금액</h3>
        <p className="text-2xl text-red-600">{cartTotal.toLocaleString()} 원</p>
      </div>
      {/* 아래: 원자재(BOM) 명세 테이블 */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold mb-2">원자재 명세서</h3>
        <BOMDisplay bom={totalBom} title="총 부품 목록 (BOM)" />
      </div>
      <div className="mt-6 flex gap-4">
        <button onClick={handlePrint} className="p-3 bg-red-500 text-white rounded">발주서 인쇄</button>
        <button onClick={() => navigate('/')} className="p-3 bg-gray-500 text-white rounded">돌아가기</button>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
