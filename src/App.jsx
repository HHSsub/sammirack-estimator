// ... import 생략
const HomePage = () => {
  const { currentPrice, currentBOM, addToCart, cart, cartTotal } = useProducts();
  const [showCurrentBOM, setShowCurrentBOM] = useState(false);
  const [showTotalBOM, setShowTotalBOM] = useState(false);

  const canAddItem = currentPrice > 0;
  const canProceed = cart.length > 0;

  // 전체 BOM 합산 (bom이 배열인지 체크)
  const totalBom = cart.reduce((acc, item) => {
    if (Array.isArray(item.bom)) {
      item.bom.forEach(bomItem => {
        const key = getKoreanName(bomItem);
        if (acc[key]) acc[key] += bomItem.quantity;
        else acc[key] = bomItem.quantity;
      });
    }
    return acc;
  }, {});

  const totalBomForDisplay = Object.entries(totalBom).map(([name, quantity]) => ({
    name, quantity
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

      {showCurrentBOM && <BOMDisplay bom={currentBOM} title="현재 항목 부품 목록 (BOM)" />}
      <CartDisplay />

      {canProceed && (
        <div className="action-buttons mt-4">
          <button onClick={() => setShowTotalBOM(!showTotalBOM)}>
            {showTotalBOM ? '전체 BOM 숨기기' : '전체 BOM 보기'}
          </button>
          <Link to="/estimate/new" state={{ cart, cartTotal, totalBom: totalBomForDisplay }}>
            견적서 작성
          </Link>
          <Link to="/purchase-order/new" state={{ cart, cartTotal, totalBom: totalBomForDisplay }}>
            발주서 작성
          </Link>
        </div>
      )}

      {showTotalBOM && <BOMDisplay bom={totalBomForDisplay} title="전체 부품 목록 (BOM)" />}
    </div>
  );
};
