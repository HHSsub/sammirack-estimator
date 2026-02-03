import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';  // ✅ useLocation, useNavigate 추가
import './App.css';
import { useProducts } from './contexts/ProductContext';
import OptionSelector from './components/OptionSelector';
import CartDisplay from './components/CartDisplay';
import BOMDisplay from './components/BOMDisplay';
import MaterialPriceManager from './components/MaterialPriceManager';
import InventoryManager from './components/InventoryManager';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import EstimateForm from './components/EstimateForm';
import HistoryPage from './components/HistoryPage';
import DeliveryNoteForm from './components/DeliveryNoteForm';
import PrintPage from './components/PrintPage';
import Login from './components/Login';
import PasswordChange from './components/PasswordChange';
import ShortageInventoryManager from './components/ShortageInventoryManager';
import UpdateHistory from './components/UpdateHistory';  // ✅ 추가

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

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
          {currentUser?.role === 'admin' && (
            <Link to="/history" className="nav-link">문서 관리</Link>
          )}
          <Link to="/estimate/new" className="nav-link">견적서 작성</Link>
          <Link to="/purchase-order/new" className="nav-link">청구서 작성</Link>
          {currentUser?.role === 'admin' && (
            <Link to="/inventory" className="nav-link">재고관리</Link>
          )}
        </div>
        <div className="nav-user-section">
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
          {currentUser?.role === 'admin' && (
            <Route path="/inventory" element={<InventoryPage currentUser={currentUser} />} />
          )}
          <Route path="/estimate/new" element={<EstimateForm />} />
          <Route path="/estimate/edit/:id" element={<EstimateForm />} />
          <Route path="/purchase-order/new" element={<PurchaseOrderForm />} />
          <Route path="/purchase-order/edit/:id" element={<PurchaseOrderForm />} />
          <Route path="/delivery-note/new" element={<DeliveryNoteForm />} />
          <Route path="/delivery-note/edit/:id" element={<DeliveryNoteForm />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer"><p>© 2025 (주)삼미앵글. All rights reserved.</p></footer>

      {showPasswordChange && (
        <PasswordChange
          currentUser={currentUser}
          onClose={handlePasswordChangeClose}
        />
      )}

      <ShortageInventoryManager isAdmin={currentUser?.role === 'admin'} />
    </div>
  );
}

const HomePage = ({ currentUser }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentPrice, currentBOM, addToCart, cart, cartBOM, cartBOMView,
    selectedType, selectedOptions, setCart, handleExtraOptionChange
  } = useProducts();
  const [showCurrentBOM, setShowCurrentBOM] = useState(true);
  const [showTotalBOM, setShowTotalBOM] = useState(true);
  const [adminPricesVersion, setAdminPricesVersion] = useState(0);

  // ✅ 편집 상태 확인
  const editingData = location.state || {};
  const isEditMode = !!editingData.editingDocumentId;

  // ✅ 복원 완료 플래그 (한 번만 실행하기 위해)
  const restoredDocIdRef = React.useRef(null);

  useEffect(() => {
    // ✅ 이미 복원한 문서면 다시 실행 안 함
    if (isEditMode && editingData.editingDocumentId && restoredDocIdRef.current !== editingData.editingDocumentId) {
      restoredDocIdRef.current = editingData.editingDocumentId;  // ✅ 복원 완료 표시

      console.log('🔍🔍🔍 HomePage: 편집 모드 데이터 복원 🔍🔍🔍');
      console.log('📄 editingData:', editingData);
      console.log('🛒 원본 cart:', editingData.cart);
      console.log('📦 원본 materials:', editingData.materials);

      // ✅ Admin 가격 로드 후 Cart 복원
      (async () => {
        try {
          const { loadAdminPrices, generatePartId } = await import('./utils/unifiedPriceManager');
          const adminPrices = await loadAdminPrices();
          console.log('📊 불러온 Admin 가격:', Object.keys(adminPrices).length, '개');

          // ✅ 깊은 복사 + Admin 가격 적용
          const deepCopiedCart = editingData.cart.map((item, index) => {
            // ✅ 먼저 완전한 깊은 복사 수행 (id는 고유하게 재생성)
            const newItem = {
              ...item,
              id: item.id || `${Date.now()}_${index}`,  // ✅ 고유 ID 보장
              extraOptions: item.extraOptions ? [...item.extraOptions] : [],
              customMaterials: item.customMaterials ? item.customMaterials.map(m => ({ ...m })) : [],
              bom: item.bom ? item.bom.map(b => ({ ...b })) : []
            };

            console.log(`\n🔍 [Item ${index + 1}] ${newItem.displayName || newItem.name}`);

            // 1순위: customPrice (사용자 직접 수정) - 서버에서 price로 저장된 경우도 처리
            const savedCustomPrice = newItem.customPrice || item.price;
            if (savedCustomPrice && savedCustomPrice > 0) {
              console.log(`  ✅ customPrice 적용: ${savedCustomPrice}원`);
              newItem.customPrice = savedCustomPrice;
              newItem.unitPrice = savedCustomPrice;
              newItem.totalPrice = savedCustomPrice * (newItem.quantity || 1);
              newItem.price = savedCustomPrice;
              return newItem;
            }
            // 2순위: Admin 가격
            const partId = generatePartId(newItem);
            const adminPrice = adminPrices[partId];

            if (adminPrice && adminPrice.price > 0) {
              console.log(`  ✅ Admin 가격 적용: ${adminPrice.price}원`);
              newItem.unitPrice = adminPrice.price;
              newItem.totalPrice = adminPrice.price * (newItem.quantity || 1);
              newItem.price = adminPrice.price;
              return newItem;
            }

            // 3순위: 기존 가격 유지
            console.log(`  ⚠️ 기존 가격 유지: ${newItem.unitPrice || 0}원`);
            newItem.price = newItem.unitPrice || newItem.price || 0;
            return newItem;
          });


          console.log('🆕 깊은 복사 + 가격 적용 완료:', deepCopiedCart);
          console.log('🔍 배열 참조 확인:', deepCopiedCart === editingData.cart ? '❌ 같은 참조' : '✅ 다른 참조');

          setCart(deepCopiedCart);

          // extraOptions 복원
          const allExtraOptions = [];
          deepCopiedCart.forEach(item => {
            if (item.extraOptions && Array.isArray(item.extraOptions)) {
              allExtraOptions.push(...item.extraOptions);
            }
          });
          if (allExtraOptions.length > 0) {
            const uniqueExtraOptions = Array.from(new Set(allExtraOptions));
            handleExtraOptionChange(uniqueExtraOptions);
          }

          console.log('✅ HomePage: 편집 모드 복원 완료');
          console.log('🛒 최종 cart 개수:', deepCopiedCart.length, '개');
          console.log('📦 최종 materials 개수:', editingData.materials?.length || 0, '개');

        } catch (error) {
          console.error('❌ Admin 가격 적용 실패:', error);

          // 에러 발생 시 기본 깊은 복사만 수행
          const deepCopiedCart = editingData.cart.map(item => ({
            ...item,
            extraOptions: item.extraOptions ? [...item.extraOptions] : [],
            customMaterials: item.customMaterials ? item.customMaterials.map(m => ({ ...m })) : [],
            bom: item.bom ? item.bom.map(b => ({ ...b })) : []
          }));
          setCart(deepCopiedCart);
        }
      })();
    } else if (!isEditMode) {
      // ✅ 편집 모드 종료 시 플래그 초기화
      restoredDocIdRef.current = null;
    }
  }, [isEditMode, editingData.editingDocumentId]);



  const getFinalPrice = () => {
    // ✅ 편집 모드일 때는 cart의 totalPrice 합산 (customPrice 반영됨)
    if (isEditMode && cart.length > 0) {
      const total = cart.reduce((sum, item) => {
        // customPrice 최우선
        if (item.customPrice !== undefined && item.customPrice !== null && item.customPrice > 0) {
          return sum + (item.customPrice * (item.quantity || 1));
        }
        // unitPrice
        if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice > 0) {
          return sum + (item.unitPrice * (item.quantity || 1));
        }
        // totalPrice 직접 사용
        return sum + (item.totalPrice || 0);
      }, 0);

      console.log('💰 편집 모드 최종 가격:', total, '원');
      return total;
    }

    // ✅ 일반 모드 (기존 로직 유지)
    if (!currentBOM || currentBOM.length === 0) {
      return currentPrice;
    }

    let hasAdminPrice = false;
    let totalPrice = 0;

    currentBOM.forEach(item => {
      const adminPrice = localStorage.getItem(`adminPrice_${item.id}`);
      if (adminPrice !== null && !isNaN(parseInt(adminPrice))) {
        hasAdminPrice = true;
        totalPrice += parseInt(adminPrice) * item.quantity;
      } else {
        totalPrice += (item.price || 0) * (item.quantity || 0);
      }
    });

    return (hasAdminPrice && totalPrice > 0) ? totalPrice : currentPrice;
  };


  useEffect(() => {
    const handleStorageChange = () => {
      setAdminPricesVersion(prev => prev + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('adminPriceUpdate', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('adminPriceUpdate', handleStorageChange);
    };
  }, []);

  const finalPrice = getFinalPrice();
  const canAddItem = isEditMode ? true : (finalPrice > 0);  // ✅ 편집 모드에서는 항상 추가 가능
  const canProceed = cart.length > 0;

  // ✅ 수정: 편집/일반 모드 모두 cart.bom에서 BOM 추출
  // ✅ 최종 수정: 모든 모드에서 BOM 추출
  const totalBomForDisplay = useMemo(() => {
    console.log('🔍 totalBomForDisplay 계산 시작');
    console.log('  isEditMode:', isEditMode);
    console.log('  cart.length:', cart?.length);
    console.log('  editingData.materials?.length:', editingData.materials?.length);
    console.log('  cartBOMView.length:', cartBOMView?.length);

    // 1순위: 편집 모드에서 editingData.materials가 있으면 사용
    if (isEditMode && editingData.materials && editingData.materials.length > 0) {
      console.log('✅ [편집모드] editingData.materials 사용:', editingData.materials.length, '개');
      return editingData.materials;
    }

    // 2순위: cart에서 BOM 추출
    if (cart && cart.length > 0) {
      const regeneratedBOM = [];
      cart.forEach(item => {
        if (item.bom && item.bom.length > 0) {
          regeneratedBOM.push(...item.bom);
          console.log(`  - ${item.displayName || item.name}: ${item.bom.length}개 부품 추가`);
        }
      });

      if (regeneratedBOM.length > 0) {
        console.log('✅ cart.bom 사용:', regeneratedBOM.length, '개');
        return regeneratedBOM;
      }
    }

    // 3순위: cartBOMView 사용 (fallback)
    console.log('⚠️ cartBOMView 사용:', cartBOMView?.length, '개');
    return cartBOMView || [];
  }, [isEditMode, editingData.materials, cart, cartBOMView]);


  // ✅ 중요: editingData.materials 의존성 제거!

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
      {/* ✅ 편집 모드 표시 */}
      {isEditMode && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          padding: '12px 20px',
          marginBottom: '20px',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>📝 문서 편집 모드</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
              거래번호: <strong>{editingData.editingDocumentData?.documentNumber}</strong> |
              유형: {editingData.editingDocumentType === 'estimate' ? '견적서' :
                editingData.editingDocumentType === 'purchase' ? '청구서' : '거래명세서'}
            </p>
          </div>
          <button
            onClick={() => navigate('/history')}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            편집 취소
          </button>
        </div>
      )}

      <h2>랙 제품 견적</h2>

      <div className="main-layout">
        <div className="left-section" style={{ flex: '1', marginRight: '20px' }}>
          <div className="option-section">
            <OptionSelector />
          </div>

          <div className="price-section">
            <div className="price-display">
              <h3>현재 항목 예상 가격</h3>
              <p className="price">{(finalPrice > 0) ? finalPrice.toLocaleString() : currentPrice.toLocaleString()}원</p>
              {finalPrice !== currentPrice && finalPrice > 0 && (
                <p className="price-note" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  (관리자 수정 단가 반영됨)
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="right-section" style={{ flex: '1' }}>
          <MaterialPriceManager currentUser={currentUser} cart={cart} />
        </div>
      </div>

      <div className="action-buttons" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
      </div>

      <CartDisplay />

      {canProceed && (
        <div className="action-buttons mt-4" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => {
              console.log('🚀 견적서 버튼 클릭!');
              console.log('cart:', cart);
              console.log('totalBomForDisplay:', totalBomForDisplay);
              navigate('/estimate/new', {
                state: {
                  cart,
                  cartTotal: cart.reduce((sum, i) => sum + (i.price ?? 0), 0),
                  totalBom: totalBomForDisplay,
                  materials: totalBomForDisplay,
                  ...(isEditMode ? {
                    customItems: editingData.customItems || [],
                    customMaterials: editingData.customMaterials || [],
                    editingDocumentId: editingData.editingDocumentType === 'estimate' ? editingData.editingDocumentId : undefined,
                    editingDocumentData: editingData.editingDocumentData || {},
                    estimateData: editingData.editingDocumentData || {}
                  } : {})
                }
              });
            }}
            className="create-estimate-button"
          >
            견적서 작성
          </button>
          <button
            onClick={() => {
              // 🔴 디버깅 로그 추가
              console.log('🚀 거래명세서 버튼 클릭!');
              console.log('cart:', cart);
              console.log('cart.length:', cart?.length);
              console.log('totalBomForDisplay:', totalBomForDisplay);
              console.log('totalBomForDisplay.length:', totalBomForDisplay?.length);
              console.log('전달할 materials:', totalBomForDisplay);
              navigate('/delivery-note/new', {
                state: {
                  cart,
                  cartTotal: cart.reduce((sum, i) => sum + (i.price ?? 0), 0),
                  totalBom: totalBomForDisplay,
                  materials: totalBomForDisplay,
                  ...(isEditMode ? {
                    customItems: editingData.customItems || [],
                    customMaterials: editingData.customMaterials || [],
                    editingDocumentId: editingData.editingDocumentType === 'delivery' ? editingData.editingDocumentId : undefined,
                    editingDocumentData: editingData.editingDocumentData || {},
                    estimateData: editingData.editingDocumentData || {}
                  } : {})
                }
              });
            }}
            className="create-delivery-note-button"
          >
            거래명세서 작성
          </button>
          <button
            onClick={() => {
              // 🔴 디버깅 로그 추가
              console.log('청구서 작성 버튼 클릭!');
              console.log('cart:', cart);
              console.log('cart.length:', cart?.length);
              console.log('cart[0]:', cart[0]);
              console.log('cart[0]?.bom:', cart[0]?.bom);
              console.log('cartBOMView:', cartBOMView);
              console.log('cartBOMView?.length:', cartBOMView?.length);
              console.log('totalBomForDisplay:', totalBomForDisplay);
              console.log('totalBomForDisplay?.length:', totalBomForDisplay?.length);
              console.log('전달할 materials:', totalBomForDisplay);
              navigate('/purchase-order/new', {
                state: {
                  cart,
                  cartTotal: cart.reduce((sum, i) => sum + (i.price ?? 0), 0),
                  totalBom: totalBomForDisplay,
                  materials: totalBomForDisplay,
                  ...(isEditMode ? {
                    customItems: editingData.customItems || [],
                    customMaterials: editingData.customMaterials || [],
                    editingDocumentId: editingData.editingDocumentType === 'purchase' ? editingData.editingDocumentId : undefined,
                    editingDocumentData: editingData.editingDocumentData || {},
                    estimateData: editingData.editingDocumentData || {}
                  } : {})
                }
              });
            }}
            className="create-order-button"
          >
            청구서 작성
          </button>

        </div>
      )}
      {showTotalBOM && (
        <BOMDisplay
          bom={totalBomForDisplay}
          title="전체 부품 목록 (BOM)"
          currentUser={currentUser}
          selectedRackOption={getCurrentRackOptionName()}
        />
      )}
      <UpdateHistory />
    </div>
  );
};

const InventoryPage = ({ currentUser }) => {
  return (
    <div className="app-container">
      <h2>재고 관리</h2>
      <InventoryManager currentUser={currentUser} />
    </div>
  );
};

export default App;
