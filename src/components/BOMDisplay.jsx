import React from 'react';

function BOMDisplay({ bom, title, onQuantityChange }) {
  if (!bom || bom.length === 0)
    return (
      <div className="bom-section mt-6">
        <h3 className="text-xl font-semibold mb-2">{title || '부품 목록'}</h3>
        <div>표시할 부품이 없습니다.</div>
      </div>
    );

  return (
    <div className="bom-section mt-6">
      <h3 className="text-md font-semibold mb-2">{title || '부품 목록'}</h3>
      <table className="w-full text-left border-collapse" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th className="border-b p-2">부품</th>
            <th className="border-b p-2 text-center">수량</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((item, idx) => (
            <tr key={idx}>
              <td className="border-b p-2">
                {[item.rackType, item.size, item.name].filter(Boolean).join(' ')}
              </td>
              <td className="border-b p-2 text-center">
                <input
                  type="number"
                  min={0}
                  value={item.quantity}
                  style={{ width: 45 }}
                  onChange={e =>
                    onQuantityChange && onQuantityChange(idx, Math.max(0, Number(e.target.value)))
                  }
                /> 개
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BOMDisplay;
