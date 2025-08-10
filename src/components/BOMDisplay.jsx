import React from 'react';

function BOMDisplay({ bom, title, onQuantityChange }) {
  if (!bom || bom.length === 0)
    return (
      <div className="bom-section" style={{ marginTop: 12, padding: 8, borderRadius: 8, background: '#f8fcff' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 3 }}>{title || '부품 목록'}</h3>
        <div>표시할 부품이 없습니다.</div>
      </div>
    );

  return (
    <div className="bom-section" style={{
      marginTop: 14, padding: 12, background: '#eef7ff', borderRadius: 8,
      boxShadow: '0 2px 6px #ededed33'
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 7 }}>{title || '부품 목록'}</h3>
      <table
        className="bom-table"
        style={{
          width: '100%', borderCollapse: 'collapse', marginBottom: 8,
          fontSize: '15px'
        }}
      >
        <thead>
          <tr>
            <th style={{
              borderBottom: '1px solid #c5e0fd', padding: '5px 7px', textAlign: 'left',
              minWidth: 120,
              whiteSpace: 'normal'
            }}>부품정보</th>
            <th style={{
              borderBottom: '1px solid #c5e0fd', padding: '5px 0', textAlign: 'center',
              width: 70
            }}>수량</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((item, idx) => (
            <tr key={idx}>
              <td style={{
                borderBottom: '1px solid #e5e3e3', padding: '6px 8px',
                wordBreak: 'break-all', whiteSpace: 'normal',
              }}>
                {/* 랙종류, 규격, 부품명 */}
                {[item.rackType, item.size, item.name].filter(Boolean).join(' ')}
              </td>
              <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'center' }}>
                <input
                  type="number"
                  min={0}
                  value={item.quantity}
                  style={{ width: 50, fontSize: '15px', textAlign: 'right' }}
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
