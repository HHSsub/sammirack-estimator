import React from 'react';
import { useProducts } from '../contexts/ProductContext';
import { getKoreanName } from '../utils/nameMap';

function BomDisplay({ bom }) {
  if (!bom || bom.length === 0) {
    return <div className="bom-section"><p>표시할 부품 목록이 없습니다. 옵션을 모두 선택해주세요.</p></div>;
  }

  return (
    <div className="bom-section mt-4">
      <h3 className="text-lg font-semibold mb-2">부품 목록 (BOM)</h3>
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
              <td className="border-b p-2">{getKoreanName(item)}</td>
              <td className="border-b p-2 text-right">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BomDisplay;
