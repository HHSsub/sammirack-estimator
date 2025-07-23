import React from 'react';
import { getKoreanName } from '../utils/nameMap';

function BOMDisplay({ bom, title = "부품 목록 (BOM)" }) {
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
          </tr>
        </thead>
        <tbody>
          {bom.map((item, index) => (
            <tr key={index}>
              {/* item.code가 있으면 getKoreanName 사용, 없으면(합산된 경우) item.name 사용 */}
              <td className="border-b p-2">{item.code ? getKoreanName(item) : item.name}</td>
              <td className="border-b p-2 text-right">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BOMDisplay;
