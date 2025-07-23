import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BOMDisplay from './BOMDisplay';

const EstimateForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [cart, setCart] = useState(location.state?.cart || []);
  const [cartTotal, setCartTotal] = useState(location.state?.cartTotal || 0);
  const [totalBom, setTotalBom] = useState(location.state?.totalBom || []);

  useEffect(() => {
    if (!location.state || !location.state.cart || location.state.cart.length === 0) {
      alert("견적할 항목을 먼저 선택해주세요.");
      navigate('/');
    }
  }, [location, navigate]);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">견적서</h2>
      
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

      <button onClick={() => window.print()} className="mt-4 p-2 bg-green-500 text-white rounded">
        인쇄
      </button>
    </div>
  );
};

export default EstimateForm;
