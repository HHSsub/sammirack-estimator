import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BOMDisplay from './BOMDisplay';
import { formatPurchaseOrderData, navigateToPrintPage } from '../utils/printUtils';

function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

const PurchaseOrderForm = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const cart = Array.isArray(location.state?.cart) ? location.state.cart : [];
  const cartTotal = location.state?.cartTotal ?? 0;
  const totalBom = Array.isArray(location.state?.totalBom) ? location.state.totalBom : [];

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    orderNumber: '',
    companyName: '',
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
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">발주서 작성</h2>
      <div className="mb-6 p-4 border rounded">
        <h3 className="text-xl font-semibold mb-3">발주서 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label>거래일자</label>
            <input type="date" name="date" value={formData.date}
              onChange={handleInputChange} className="w-full p-2 border rounded" />
          </div>
          <div><label>거래번호</label>
            <input type="text" name="orderNumber" value={formData.orderNumber}
              onChange={handleInputChange} placeholder="수동 입력"
              className="w-full p-2 border rounded" />
          </div>
          <div className="col-span-2"><label>상호명 (공급받는 쪽)</label>
            <input type="text" name="companyName" value={formData.companyName}
              onChange={handleInputChange} placeholder="예: ㈜테스트고객"
              className="w-full p-2 border rounded" />
          </div>
        </div>
        <div className="mt-4">
          <label>비고사항</label>
          <textarea name="notes" value={formData.notes}
            onChange={handleInputChange} rows="3"
            className="w-full p-2 border rounded" />
        </div>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">발주 항목</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr><th className="border-b p-2">항목</th>
                <th className="border-b p-2 text-right">금액</th></tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.id}>
                <td className="border-b p-2">
                  {kgLabelFix(item.displayName)} × {item.quantity}개
                </td>
                <td className="border-b p-2 text-right">
                  {item.price?.toLocaleString()}원
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-xl font-semibold">총 발주 금액: {cartTotal.toLocaleString()} 원</h3>
      <div className="mb-4">
        <h3 className="text-xl font-semibold mb-2">원자재 명세서</h3>
        <BOMDisplay bom={totalBom} title="총 부품 목록 (BOM)" />
      </div>
      <div className="mt-6 flex gap-4">
        <button onClick={handlePrint}
          className="p-3 bg-red-500 text-white rounded">발주서 인쇄</button>
        <button onClick={() => navigate('/')}
          className="p-3 bg-gray-500 text-white rounded">돌아가기</button>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
