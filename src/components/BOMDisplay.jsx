import React from 'react';
import { getKoreanName } from '../utils/nameMap';

function BOMDisplay({ bom, title = "부품 목록 (BOM)", showPrice = false }) {
  // Safe price formatter
  const safePrice = (value) =>
    typeof value === 'number' && !isNaN(value) ? value.toLocaleString() : '0';

  if (!bom || bom.length === 0) {
    return null; // 표시할 내용 없으면 아무것도 렌더링 안 함
  }

  return (
    <div className="bom-section mt-4 p-4 border rounded">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="border-b p-2">품명</th>
            <th className="border-b p-2 text-right">수량</th>
            {showPrice && (
              <>
                <th className="border-b p-2 text-right">단가</th>
                <th className="border-b p-2 text-right">합계</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {bom.map((item, index) => (
            <tr key={index}>
              <td className="border-b p-2">{getKoreanName(item)}</td>
              <td className="border-b p-2 text-right">{item.quantity}</td>
              {showPrice && (
                <>
                  <td className="border-b p-2 text-right">{safePrice(item.unitPrice)}원</td>
                  <td className="border-b p-2 text-right">{safePrice(item.totalPrice)}원</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {showPrice && (
          <tfoot>
            <tr>
              <td className="p-2 font-bold" colSpan="3">총 합계</td>
              <td className="p-2 text-right font-bold">
                {safePrice(bom.reduce((sum, item) => sum + (item.totalPrice || 0), 0))}원
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default BOMDisplay;
