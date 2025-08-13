import React from 'react';
import { useProducts } from '../contexts/ProductContext';

export default function CartDisplay() {
  const { cart, removeFromCart, cartTotal, updateCartItemQuantity } = useProducts();
  const safePrice = v => typeof v === 'number' && !isNaN(v) ? v.toLocaleString() : '0';

  if (!cart.length) {
    return (
      <div className="cart-section mt-6">
        <h3 className="text-xl font-semibold mb-2">견적 목록</h3>
        <div>목록이 비어 있습니다.</div>
      </div>
    );
  }
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
          {cart.map(item => (
            <tr key={item.id}>
              <td className="border-b p-2">{item.displayName}</td>
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
              <td className="border-b p-2 text-right">{safePrice(item.price)}원</td>
              <td className="border-b p-2 text-center">
                <button onClick={() => removeFromCart(item.id)} className="text-red-500">
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="p-2 font-bold">총 합계</td>
            <td className="p-2 text-right font-bold">{safePrice(cartTotal)}원</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
