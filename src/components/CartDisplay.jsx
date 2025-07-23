import React from 'react';
import { useProducts } from '../contexts/ProductContext';

function CartDisplay() {
  const { cart, removeFromCart, cartTotal } = useProducts();

  if (cart.length === 0) return null;

  return (
    <div className="cart-section mt-6">
      <h3 className="text-xl font-semibold mb-2">견적 목록</h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="border-b p-2">항목</th>
            <th className="border-b p-2 text-right">금액</th>
            <th className="border-b p-2"></th>
          </tr>
        </thead>
        <tbody>
          {cart.map(item => (
            <tr key={item.id}>
              <td className="border-b p-2">
                {item.selections.type} ({item.selections.version || item.selections.color}) - {item.selections.size} / {item.selections.height} / {item.selections.level} x {item.selections.quantity}개
              </td>
              <td className="border-b p-2 text-right">{item.price.toLocaleString()}원</td>
              <td className="border-b p-2 text-center">
                <button onClick={() => removeFromCart(item.id)} className="text-red-500">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="p-2 font-bold">총 합계</td>
            <td className="p-2 text-right font-bold">{cartTotal.toLocaleString()}원</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default CartDisplay;
