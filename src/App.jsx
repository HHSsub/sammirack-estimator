import React, { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import { useProducts } from './contexts/ProductContext';
import OptionSelector from './components/OptionSelector';
import CartDisplay from './components/CartDisplay';
import BOMDisplay from './components/BOMDisplay';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import EstimateForm from './components/EstimateForm';
import HistoryPage from './components/HistoryPage';
import PrintPage from './components/PrintPage';
import { getKoreanName } from './utils/nameMap';

function App() {
  return (
    <div className="app">
      <nav className="main-nav">
        <div className="nav-logo"><h1>(주)삼미앵글</h1></div>
        <div className="nav-links">
          <Link to="/" className="nav-link">홈</Link>
          <Link to="/estimate/new" className="nav-link">견적서 작성</Link>
          <Link to="/purchase-order/new" className="nav-link">거래명세서(발주서) 작성</Link>
          <Link to="/history" className="nav-link">문서 관리</Link>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/estimate/new" element={<EstimateForm />} />
          <Route path="/purchase-order/new" element={<PurchaseOrderForm />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer"><p>© 2025 (주)삼미앵글. All rights reserved.</p></footer>
    </div>
  );
}

const HomePage = () => {
  const { currentPrice, currentBom, addToCart, cart, cartTotal } = useProducts();
  const [showCurrentBOM, setShowCurrentBOM] = useState(false);
  const [showTotalBOM, setShowTotalBOM] = useState(false);

  const canAddItem = currentPrice > 0;
  const canProceed = cart.length > 0;

  // 장바구니 전체의 BOM을 합산하는 로직
  const totalBom = cart.reduce((acc, item) => {
    item.bom.forEach(bomItem => {
      const key = getKoreanName(bomItem);
      if (acc[key]) {
        acc[key] += bomItem.quantity;
      } else {
        acc[key] = bomItem.quantity;
      }
    });
    return acc;
  }, {});

  // 합산된 BOM을 BOMDisplay가 이해하는 형태로 변환
  const totalBomForDisplay = Object.entries(totalBom).map(([name, quantity]) => ({
    name, // getKoreanName이 이미 적용된 이름
    quantity,
  }));

  return (
    <div className="app-container">
      <h2>랙 제품 견적</h2>
      <OptionSelector />
      
      <div className="price-display">
        <h3>현재 항목 예상 가격</h3>
        <p className="price">{currentPrice.toLocaleString()}원</p>
      </div>

      <div className="action-buttons">
        <button onClick={() => setShowCurrentBOM(!showCurrentBOM)} disabled={!canAddItem}>
          {showCurrentBOM ? '현재 BOM 숨기기' : '현재 BOM 보기'}
        </button>
        <button onClick={addToCart} disabled={!canAddItem} className="p-2 bg-blue-500 text-white rounded">
          목록에 추가
        </button>
      </div>

      {showCurrentBOM && <BOMDisplay bom={currentBom} title="현재 항목 부품 목록 (BOM)" />}

      <CartDisplay />

      {canProceed && (
        <div className="action-buttons mt-4">
           <button onClick={() => setShowTotalBOM(!showTotalBOM)}>
            {showTotalBOM ? '전체 BOM 숨기기' : '전체 BOM 보기'}
          </button>
          <Link to="/estimate/new" state={{ cart, cartTotal, totalBom: totalBomForDisplay }} className={`create-estimate-button ${!canProceed && 'disabled'}`}>
            견적서 작성
          </Link>
          <Link to="/purchase-order/new" state={{ cart, cartTotal, totalBom: totalBomForDisplay }} className={`create-order-button ${!canProceed && 'disabled'}`}>
            발주서 작성
          </Link>
        </div>
      )}

      {showTotalBOM && <BOMDisplay bom={totalBomForDisplay} title="전체 부품 목록 (BOM)" />}
    </div>
  );
};

export default App;
