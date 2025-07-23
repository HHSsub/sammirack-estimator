import React, { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import { useProducts } from './contexts/ProductContext';
import OptionSelector from './components/OptionSelector';
import BomDisplay from './components/BomDisplay';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import EstimateForm from './components/EstimateForm';
import HistoryPage from './components/HistoryPage';

function App() {
  return (
    <div className="app">
      <nav className="main-nav">
        <div className="nav-logo">
          <h1>(주)삼미앵글</h1>
        </div>
        <div className="nav-links">
          <Link to="/" className="nav-link">홈</Link>
          <Link to="/estimate/new" className="nav-link">견적서 작성</Link>
          <Link to="/purchase-order/new" className="nav-link">발주서 작성</Link>
          <Link to="/history" className="nav-link">문서 관리</Link>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/estimate/new" element={<EstimateForm />} />
          <Route path="/purchase-order/new" element={<PurchaseOrderForm />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>© 2025 (주)삼미앵글. All rights reserved.</p>
      </footer>
    </div>
  );
}

const HomePage = () => {
  const { price, bom } = useProducts();
  const [showBOM, setShowBOM] = useState(false);

  return (
    <div className="app-container">
      <h2>랙 제품 견적</h2>
      <OptionSelector />
      
      <div className="price-display">
        <h3>예상 가격</h3>
        <p className="price">{price.toLocaleString()}원</p>
      </div>

      <div className="action-buttons">
        <button onClick={() => setShowBOM(!showBOM)} disabled={!price}>
          {showBOM ? 'BOM 숨기기' : 'BOM 보기'}
        </button>
        <Link to="/estimate/new" className="create-estimate-button">견적서 작성</Link>
        <Link to="/purchase-order/new" className="create-order-button">발주서 작성</Link>
      </div>

      {showBOM && <BomDisplay bom={bom} />}
    </div>
  );
};

export default App;
