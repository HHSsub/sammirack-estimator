 import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import { ProductProvider } from './contexts/ProductContext';
import EstimateForm from './components/EstimateForm';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import HistoryPage from './components/HistoryPage';
import PrintTemplate from './components/PrintTemplate';
import { BOMCalculator } from '@/utils/BOMCalculator';

// BOMCalculator를 전역에서 접근 가능하게 하여 PrintService 등에서 사용
window.BOMCalculator = BOMCalculator;

function App() {
  // --- 상태 관리 (State Management) ---
  const [products, setProducts] = useState([]); // 제품 데이터 (배열)
  const [loading, setLoading] = useState(true); // 데이터 로딩 상태
  const [error, setError] = useState(null); // 에러 상태

  // 사용자 선택 옵션
  const [rackType, setRackType] = useState(''); // 제품 유형 (예: "스텐랙")
  const [rackColor, setRackColor] = useState(''); // 하이랙 색상/타입
  const [rackSize, setRackSize] = useState(''); // 규격 (예: "50x75")
  const [rackHeight, setRackHeight] = useState(''); // 높이 (예: "75")
  const [rackLevel, setRackLevel] = useState(''); // 단수 (예: "4단")
  const [quantity, setQuantity] = useState(1); // 수량

  // 계산된 결과
  const [price, setPrice] = useState(0); // 최종 가격
  const [showBOM, setShowBOM] = useState(false); // BOM 표시 여부

  // --- 데이터 로딩 및 가공 ---
useEffect(() => {
  fetch('./data.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // ✅ 원본 객체 데이터를 배열로 변환 + UI에서 바로 쓰기 좋은 구조
      const productsArray = Object.entries(data).map(([name, productData]) => ({
        name,
        versions: productData.버전 ? Object.keys(productData.버전) : [],
        basePrices: productData.기본가격 || {},
        colors: productData.색상 || [],
        additionalParts: productData.추가상품 || {},
        bomComponents: productData.부품구성 || {},
        sizeOptions: productData.기본가격
          ? Object.keys(productData.기본가격).map(size => ({
              size,
              priceModifier: 0
            }))
          : [],
        levelOptions: [{ level: '3단', priceModifier: 0 }, { level: '4단', priceModifier: 0 }],
        heightOptions: [{ height: '1800', priceModifier: 0 }]
      }));

      setProducts(productsArray);  // 이게 핵심
      setLoading(false);
    })
    .catch(err => {
      console.error("데이터 로딩 또는 처리 중 에러 발생:", err);
      setError(err.message);
      setLoading(false);
    });
}, []);

  // --- 선택된 제품 찾기 ---
  const selectedProduct = products.find(p => p.name === rackType);

  // --- 옵션 재설정 로직 ---
  // 상위 선택이 변경되면 하위 선택을 초기화
  useEffect(() => {
    setRackColor('');
    setRackSize('');
    setRackHeight('');
    setRackLevel('');
    setQuantity(1);
  }, [rackType]);

  useEffect(() => {
    setRackHeight('');
    setRackLevel('');
  }, [rackSize, rackColor]);
  
  useEffect(() => {
    setRackLevel('');
  }, [rackHeight]);


  // --- 가격 계산 로직 ---
  useEffect(() => {
    if (!selectedProduct || !rackSize || !rackHeight || !rackLevel) {
      setPrice(0);
      return;
    }

    let basePrice = 0;
    const productData = selectedProduct.data;

    try {
      if (rackType === '스텐랙') {
        basePrice = productData.기본가격[rackSize][rackHeight][rackLevel];
      } else if (rackType === '하이랙') {
        // 하이랙은 색상(타입)에 따라 가격 구조가 다름
        basePrice = productData.기본가격[rackColor][rackSize][rackHeight][rackLevel];
      }

      if (basePrice !== undefined) {
        setPrice(basePrice * quantity);
      } else {
        setPrice(0); // 해당하는 가격 정보가 없을 경우
      }
    } catch (e) {
      // console.warn("가격 정보 조회 실패. 사용자가 아직 모든 옵션을 선택하지 않았을 수 있습니다.");
      setPrice(0); // 중첩 객체 접근 중 에러 발생 시 (예: 옵션 선택 중)
    }

  }, [rackType, rackColor, rackSize, rackHeight, rackLevel, quantity, selectedProduct]);


  // --- 동적 옵션 목록 생성 헬퍼 ---
  const getAvailableOptions = (level) => {
    if (!selectedProduct) return [];
    const productData = selectedProduct.data;

    try {
      switch (level) {
        case 'colors': // 하이랙 전용
          return productData.색상 || [];
        case 'sizes':
          if (rackType === '스텐랙') return Object.keys(productData.기본가격);
          if (rackType === '하이랙' && rackColor) return Object.keys(productData.기본가격[rackColor]);
          return [];
        case 'heights':
          if (rackType === '스텐랙' && rackSize) return Object.keys(productData.기본가격[rackSize]);
          if (rackType === '하이랙' && rackColor && rackSize) return Object.keys(productData.기본가격[rackColor][rackSize]);
          return [];
        case 'levels':
          if (rackType === '스텐랙' && rackSize && rackHeight) return Object.keys(productData.기본가격[rackSize][rackHeight]);
          if (rackType === '하이랙' && rackColor && rackSize && rackHeight) return Object.keys(productData.기본가격[rackColor][rackSize][rackHeight]);
          return [];
        default:
          return [];
      }
    } catch (e) {
      return []; // 데이터 구조가 완성되기 전에 접근 시 빈 배열 반환
    }
  };

  // --- UI 컴포넌트 ---
  const Navigation = () => (
    <nav className="main-nav">
      <div className="nav-logo"><h1>(주)삼미앵글</h1></div>
      <div className="nav-links">
        <Link to="/" className="nav-link">홈</Link>
        <Link to="/estimate/new" className="nav-link">견적서 작성</Link>
        <Link to="/purchase-order/new" className="nav-link">발주서 작성</Link>
        <Link to="/history" className="nav-link">문서 관리</Link>
      </div>
    </nav>
  );

  const HomePage = () => (
    <div className="app-container">
      <h2>랙 제품 견적</h2>
      {loading && <p>데이터를 불러오는 중...</p>}
      {error && <p className="error">오류: {error}</p>}
      {!loading && !error && (
        <>
          <div className="product-selection">
            {/* 제품 유형 */}
            <div className="form-group">
              <label>제품 유형:</label>
              <select value={rackType} onChange={(e) => setRackType(e.target.value)}>
                <option value="">선택하세요</option>
                {products.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            {rackType && (
              <>
                {/* 색상 (하이랙 전용) */}
                {rackType === '하이랙' && (
                  <div className="form-group">
                    <label>색상/타입:</label>
                    <select value={rackColor} onChange={(e) => setRackColor(e.target.value)}>
                      <option value="">선택하세요</option>
                      {getAvailableOptions('colors').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* 규격 */}
                <div className="form-group">
                  <label>규격:</label>
                  <select value={rackSize} onChange={(e) => setRackSize(e.target.value)} disabled={rackType === '하이랙' && !rackColor}>
                    <option value="">선택하세요</option>
                    {getAvailableOptions('sizes').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* 높이 */}
                <div className="form-group">
                  <label>높이:</label>
                  <select value={rackHeight} onChange={(e) => setRackHeight(e.target.value)} disabled={!rackSize}>
                    <option value="">선택하세요</option>
                    {getAvailableOptions('heights').map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 단수 */}
                <div className="form-group">
                  <label>단수:</label>
                  <select value={rackLevel} onChange={(e) => setRackLevel(e.target.value)} disabled={!rackHeight}>
                    <option value="">선택하세요</option>
                    {getAvailableOptions('levels').map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* 수량 */}
                <div className="form-group">
                  <label>수량:</label>
                  <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} />
                </div>
              </>
            )}
          </div>

          <div className="price-display">
            <h3>예상 가격</h3>
            <p className="price">{price.toLocaleString()}원</p>
          </div>

          <div className="action-buttons">
            <button className="toggle-bom-button" onClick={() => setShowBOM(!showBOM)} disabled={!price}>
              {showBOM ? 'BOM 숨기기' : 'BOM 보기'}
            </button>
            <Link to="/estimate/new" className="create-estimate-button" onClick={e => !price && e.preventDefault()}>견적서 작성</Link>
            <Link to="/purchase-order/new" className="create-order-button" onClick={e => !price && e.preventDefault()}>발주서 작성</Link>
          </div>

          {showBOM && price > 0 && (
            <div className="bom-section">
              <h3>부품 목록 (BOM)</h3>
              {React.createElement(React.lazy(() => import('./components/BOMDisplay')), {
                productType: rackType,
                selectedOptions: { size: rackSize, level: rackLevel, height: rackHeight, color: rackColor },
                quantity: quantity
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

  // --- 최종 렌더링 ---
  return (
    <ProductProvider initialState={{
      productType: rackType,
      setProductType: setRackType,
      selectedOptions: { size: rackSize, level: rackLevel, height: rackHeight, color: rackColor },
      setSelectedOption: (option, value) => {
        switch (option) {
          case 'size': setRackSize(value); break;
          case 'level': setRackLevel(value); break;
          case 'height': setRackHeight(value); break;
          case 'color': setRackColor(value); break;
          default: break;
        }
      },
      quantity,
      setQuantity,
      price,
      availableProducts: products,
      getAvailableOptions
    }}>
      <div className="app">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/estimate/new" element={<EstimateForm />} />
            <Route path="/estimate/edit/:id" element={<EstimateForm />} />
            <Route path="/estimate/print/:id" element={<PrintTemplateWrapper type="estimate" />} />
            <Route path="/purchase-order/new" element={<PurchaseOrderForm />} />
            <Route path="/purchase-order/edit/:id" element={<PurchaseOrderForm />} />
            <Route path="/purchase-order/print/:id" element={<PrintTemplateWrapper type="order" />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <p>© 2025 (주)삼미앵글. All rights reserved.</p>
        </footer>
      </div>
    </ProductProvider>
  );
}

// Wrapper component to handle print view with data from URL
function PrintTemplateWrapper({ type }) {
  const [data, setData] = useState(null);
  const { state } = React.useLocation();

  useEffect(() => {
    if (state && state.item) {
      setData(state.item);
    }
  }, [state]);

  if (!data) return <div>출력할 데이터를 불러오는 중입니다...</div>;

  return <PrintTemplate type={type} data={data} />;
}

export default App;