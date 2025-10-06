import React, { useEffect, useState } from 'react';
import { useProducts } from '../contexts/ProductContext';

export default function CartDisplay() {
  const { cart, removeFromCart, cartTotal, updateCartItemQuantity, getEffectivePrice } = useProducts();
  const [refreshKey, setRefreshKey] = useState(0);
  
  const safePrice = v => typeof v === 'number' && !isNaN(v) ? v.toLocaleString() : '0';

  // ✅ 관리자 단가 변경 이벤트 리스너 추가
  useEffect(() => {
    const handlePriceChange = () => {
      console.log('CartDisplay: 관리자 단가 변경 감지, 장바구니 가격 업데이트');
      setRefreshKey(prev => prev + 1);
    };

    const handleSystemRestore = () => {
      console.log('CartDisplay: 시스템 데이터 복원 감지, 장바구니 가격 업데이트');
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('adminPriceChanged', handlePriceChange);
    window.addEventListener('systemDataRestored', handleSystemRestore);
    
    return () => {
      window.removeEventListener('adminPriceChanged', handlePriceChange);
      window.removeEventListener('systemDataRestored', handleSystemRestore);
    };
  }, []);

  // ✅ 장바구니 아이템의 실제 가격 계산 (BOM 기반)
  const calculateItemPrice = (item) => {
    if (!item.bom || !Array.isArray(item.bom) || item.bom.length === 0) {
      return item.price || 0;
    }

    // BOM 기반으로 실제 가격 계산
    const bomTotalPrice = item.bom.reduce((sum, bomItem) => {
      const effectivePrice = getEffectivePrice ? getEffectivePrice(bomItem) : (Number(bomItem.unitPrice) || 0);
      const quantity = Number(bomItem.quantity) || 0;
      return sum + (effectivePrice * quantity);
    }, 0);

    return bomTotalPrice * (Number(item.quantity) || 1);
  };

  // ✅ 전체 장바구니 총액 계산 (실시간 반영)
  const calculateCartTotal = () => {
    return cart.reduce((sum, item) => {
      return sum + calculateItemPrice(item);
    }, 0);
  };

  if (!cart.length) {
    return (
      <div className="cart-section mt-6">
        <h3 className="text-xl font-semibold mb-2">견적 목록</h3>
        <div>목록이 비어 있습니다.</div>
      </div>
    );
  }

  const realTimeCartTotal = calculateCartTotal();

  return (
    <div className="cart-section mt-6">
      <h3 className="text-xl font-semibold mb-3">견적 목록</h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="border-b p-2">항목</th>
            <th className="border-b p-2 text-center">수량</th>
            <th className="border-b p-2 text-right">금액</th>
            <th className="border-b p-2"></th>
          </tr>
        </thead>
        <tbody>
          {cart.map(item => {
            // ✅ 각 아이템의 실시간 가격 계산
            const itemPrice = calculateItemPrice(item);
            
            return (
              <tr key={`${item.id}-${refreshKey}`}>
                <td className="border-b p-2">
                  <div>
                    {item.displayName}
                    {/* ✅ BOM 기반 가격 표시 여부 표시 */}
                    {item.bom && item.bom.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#007bff', marginTop: '2px' }}>
                        💰 BOM 기반 실시간 가격 ({item.bom.length}개 부품)
                      </div>
                    )}
                  </div>
                </td>
                <td className="border-b p-2 text-center">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => updateCartItemQuantity(item.id, e.target.value)}
                      onBlur={(e) => {
                        // 빈칸 방지: 비우고 포커스 아웃하면 0으로
                        if (e.target.value === '') updateCartItemQuantity(item.id, 0);
                      }}
                      style={{ width: 64, textAlign: 'right' }}
                    />
                    <span>개</span>
                  </div>
                </td>
                <td className="border-b p-2 text-right">
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {safePrice(itemPrice)}원
                    </div>
                    {/* ✅ 기존 가격과 다른 경우 비교 표시 */}
                    {Math.abs(itemPrice - (item.price || 0)) > 1 && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6c757d', 
                        textDecoration: 'line-through',
                        marginTop: '2px'
                      }}>
                        기존: {safePrice(item.price)}원
                      </div>
                    )}
                  </div>
                </td>
                <td className="border-b p-2 text-center">
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500">
                    삭제
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="p-2 font-bold">
              <div>
                총 합계
                {/* ✅ 실시간 계산 표시 */}
                <div style={{ fontSize: '11px', fontWeight: 'normal', color: '#007bff', marginTop: '2px' }}>
                  💡 관리자 단가 수정 시 실시간 반영
                </div>
              </div>
            </td>
            <td className="p-2 text-right font-bold">
              <div>
                <div style={{ fontSize: '18px' }}>
                  {safePrice(realTimeCartTotal)}원
                </div>
                {/* ✅ 기존 cartTotal과 다른 경우 비교 표시 */}
                {Math.abs(realTimeCartTotal - cartTotal) > 1 && (
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6c757d', 
                    textDecoration: 'line-through',
                    marginTop: '2px'
                  }}>
                    기존: {safePrice(cartTotal)}원
                  </div>
                )}
              </div>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
