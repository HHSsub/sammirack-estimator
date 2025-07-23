import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import { useProducts } from './contexts/ProductContext';
import OptionSelector from './components/OptionSelector';
import CartDisplay from './components/CartDisplay'; // 새로 만들 컴포넌트
import PurchaseOrderForm from './components/PurchaseOrderForm';
import EstimateForm from './components/EstimateForm';
import HistoryPage from './components/HistoryPage';

function App() {
  return (
    <div className="app">
      <nav className="main-nav">
        {/* ... 네비게이션 ... */}
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
        {/* ... 푸터 ... */}
      </footer>
    </div>
  );
}

const HomePage = () => {
  const { currentPrice, addToCart, cart, cartTotal } = useProducts();
  
  return (
    <div className="app-container">
      <h2>랙 제품 견적</h2>
      <OptionSelector />
      
      <div className="price-display">
        <h3>현재 항목 예상 가격</h3>
        <p className="price">{currentPrice.toLocaleString()}원</p>
      </div>

      <button onClick={addToCart} disabled={currentPrice <= 0} className="p-2 bg-blue-500 text-white rounded">
        목록에 추가
      </button>

      <CartDisplay /> {/* 장바구니 목록 표시 */}

      <div className="action-buttons">
        <Link to="/estimate/new" state={{ cart, cartTotal }} className={`create-estimate-button ${cart.length === 0 && 'disabled'}`}>
          견적서 작성
        </Link>
        <Link to="/purchase-order/new" state={{ cart, cartTotal }} className={`create-order-button ${cart.length === 0 && 'disabled'}`}>
          발주서 작성
        </Link>
      </div>
    </div>
  );
};

export default App;
