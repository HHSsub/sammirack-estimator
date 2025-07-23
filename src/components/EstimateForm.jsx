import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BOMDisplay from './BOMDisplay'; // 경로 수정
import { getKoreanName } from '../utils/nameMap';

const EstimateForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // App.jsx에서 전달받은 데이터로 상태 초기화
  const [estimate, setEstimate] = useState(location.state || {
    selections: {},
    price: 0,
    bom: [],
  });

  useEffect(() => {
    // 데이터가 없으면 홈으로 리디렉션
    if (!location.state) {
      alert("견적할 항목을 먼저 선택해주세요.");
      navigate('/');
    }
  }, [location, navigate]);

  const { selections, price, bom } = estimate;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">견적서</h2>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">견적 항목</h3>
        <p>제품 유형: {selections.type}</p>
        {selections.version && <p>버전: {selections.version}</p>}
        {selections.color && <p>색상/타입: {selections.color}</p>}
        <p>규격: {selections.size}</p>
        <p>높이: {selections.height}</p>
        <p>단수: {selections.level}</p>
        <p>수량: {selections.quantity}</p>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">총 견적 금액</h3>
        <p className="text-2xl text-blue-600">{price.toLocaleString()} 원</p>
      </div>
      <BOMDisplay bom={bom} />
      <button onClick={() => window.print()} className="mt-4 p-2 bg-green-500 text-white rounded">
        인쇄
      </button>
    </div>
  );
};

export default EstimateForm;
