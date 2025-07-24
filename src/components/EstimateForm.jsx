import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BOMDisplay from './BOMDisplay';
import { formatEstimateData, navigateToPrintPage } from '../utils/printUtils';

const EstimateForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [cart, setCart] = useState(location.state?.cart || []);
  const [cartTotal, setCartTotal] = useState(location.state?.cartTotal || 0);
  const [totalBom, setTotalBom] = useState(location.state?.totalBom || []);
  
  // Form data for additional information
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    estimateNumber: '',
    customerName: '',
    contactInfo: '',
    notes: ''
  });

  useEffect(() => {
    if (!location.state || !location.state.cart || location.state.cart.length === 0) {
      alert("견적할 항목을 먼저 선택해주세요.");
      navigate('/');
    }
  }, [location, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePrint = () => {
    const printData = formatEstimateData(formData, cart, cartTotal);
    navigateToPrintPage('gyeonjuk', printData, navigate);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">견적서 작성</h2>
      
      {/* Customer Information Form */}
      <div className="mb-6 p-4 border rounded">
        <h3 className="text-xl font-semibold mb-3">고객 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">견적일자</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">견적번호</label>
            <input
              type="text"
              name="estimateNumber"
              value={formData.estimateNumber}
              onChange={handleInputChange}
              placeholder="자동 생성됩니다"
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">고객명</label>
            <input
              type="text"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">연락처</label>
            <input
              type="text"
              name="contactInfo"
              value={formData.contactInfo}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">비고사항</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows="3"
            className="w-full p-2 border rounded"
            placeholder="추가 정보나 특별 요구사항을 입력하세요"
          />
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="text-xl font-semibold">견적 항목</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="border-b p-2">항목</th>
              <th className="border-b p-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.id}>
                <td className="border-b p-2">
                  {item.selections.type} ({item.selections.version || item.selections.color}) - {item.selections.size} / {item.selections.height} / {item.selections.level} x {item.selections.quantity}개
                </td>
                <td className="border-b p-2 text-right">{item.price.toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <h3 className="text-xl font-semibold">총 견적 금액</h3>
        <p className="text-2xl text-blue-600">{cartTotal.toLocaleString()} 원</p>
      </div>

      <BOMDisplay bom={totalBom} title="총 부품 목록 (BOM)" />

      <div className="mt-6 flex gap-4">
        <button 
          onClick={handlePrint} 
          className="p-3 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          견적서 인쇄
        </button>
        <button 
          onClick={() => navigate('/')} 
          className="p-3 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default EstimateForm;
