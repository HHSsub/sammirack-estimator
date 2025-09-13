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
import DeliveryNoteForm from './components/DeliveryNoteForm';
import PrintPage from './components/PrintPage';
import Login from './components/Login'; // Login 컴포넌트 임포트
import PasswordChange from './components/PasswordChange'; // 비밀번호 변경 컴포넌트 임포트

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 로그인 상태 관리
  const [currentUser, setCurrentUser] = useState(null); // 현재 로그인한 사용자 정보
  const [showPasswordChange, setShowPasswordChange] = useState(false); // 비밀번호 변경 모달 상태

  const handleLogin = (status, userInfo = null) => {
    setIsLoggedIn(status);
    setCurrentUser(userInfo);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  const handlePasswordChange = () => {
    setShowPasswordChange(true);
  };

  const handlePasswordChangeClose = () => {
    setShowPasswordChange(false);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <nav className="main-nav">
        <div className="nav-logo"><h1>(주)삼미앵글</h1></div>
        <div className="nav-links">
          <Link to="/" className="nav-link">홈</Link>
          <Link to="/estimate/new" className="nav-link">견적서 작성</Link>
          <Link to="/purchase-order/new" className="nav-link">청구서 작성</Link>
          {currentUser?.role === 'admin' && (
            <Link to="/history" className="nav-link">문서 관리</Link>
          )}
          <span className="user-info">
            {currentUser?.username} ({currentUser?.role === 'admin' ? '관리자' : '일반사용자'})
          </span>
          <button onClick={handlePasswordChange} className="nav-link">비밀번호 변경</button>
          <button onClick={handleLogout} className="nav-link">로그아웃</button>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage currentUser={currentUser} />} />
          <Route path="/estimate/new" element={<EstimateForm />} />
          <Route path="/purchase-order/new" element={<PurchaseOrderForm />} />
          <Route path="/delivery-note/new" element={<DeliveryNoteForm />} />
          <Route path="/delivery-note/edit/:id" element={<DeliveryNoteForm />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer"><p>© 2025 (주)삼미앵글. All rights reserved.</p></footer>
      
      {/* 비밀번호 변경 모달 */}
      {showPasswordChange && (
        <PasswordChange 
          currentUser={currentUser}
          onClose={handlePasswordChangeClose} 
        />
      )}
    </div>
  );
}

// ---------- HomePage ----------
const HomePage = ({ currentUser }) => {
  const { currentPrice, currentBOM, addToCart, cart, cartBOM, cartBOMView, selectedType, selectedOptions } = useProducts();
  // 🔹 기본값 true → 항상 보이는 상태
  const [showCurrentBOM, setShowCurrentBOM] = useState(true);
  const [showTotalBOM, setShowTotalBOM] = useState(true);

  const canAddItem = currentPrice > 0;
  const canProceed = cart.length > 0;

  const totalBomForDisplay = cartBOMView || [];

  // 현재 선택된 랙옵션 이름 생성
  const getCurrentRackOptionName = () => {
    if (!selectedType) return '';
    return [
      selectedType,
      selectedOptions.formType,
      selectedOptions.size,
      selectedOptions.height,
      selectedOptions.level,
      selectedOptions.color || ""
    ].filter(Boolean).join(" ");
  };

  return (
    <div className="app-container">
      <h2>랙 제품 견적</h2>
      
      {/* 새로운 레이아웃: 옵션 셀렉터와 가격 정보를 좌우로 배치 */}
      <div className="main-layout">
        <div className="option-section">
          <OptionSelector />
        </div>
        
        <div className="price-section">
          <div className="price-display">
            <h3>현재 항목 예상 가격</h3>
            <p className="price">{currentPrice.toLocaleString()}원</p>
          </div>
        </div>
      </div>

      <div className="action-buttons" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
      </div>

      {/* 🔹 항상 표시 + 숨기기 가능 */}
      <CartDisplay />

      {canProceed && (
        <div className="action-buttons mt-4" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {/* "전체 BOM 숨기기" 버튼을 숨김 처리 */}
          <Link 
            to="/estimate/new"
            state={{ cart, cartTotal: cart.reduce((sum, i) => sum + (i.price ?? 0), 0), totalBom: totalBomForDisplay }}
            className={`create-estimate-button`}
          >
            견적서 작성
          </Link>
          <Link 
            to="/delivery-note/new"
            state={{ cart, cartTotal: cart.reduce((sum, i) => sum + (i.price ?? 0), 0), totalBom: totalBomForDisplay }}
            className={`create-delivery-note-button`}
          >
            거래명세서 작성
          </Link>
          <Link 
            to="/purchase-order/new"
            state={{ cart, cartTotal: cart.reduce((sum, i) => sum + (i.price ?? 0), 0), totalBom: totalBomForDisplay }}
            className={`create-order-button`}
          >
            청구서 작성
          </Link>
        </div>
      )}

      {/* 🔹 항상 표시 + 숨기기 가능 */}
      {showTotalBOM && (
        <BOMDisplay 
          bom={totalBomForDisplay} 
          title="전체 부품 목록 (BOM)" 
          currentUser={currentUser}
          selectedRackOption={getCurrentRackOptionName()}
        />
      )}
    </div>
  );
};

export default App;
