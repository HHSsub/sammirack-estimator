import React from 'react';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

export default function BOMDisplay({ bom, title, onQuantityChange }) {
  if (!bom || !bom.length) {
    return (
      <div style={{ marginTop: 12, padding: 8, background: '#f8fcff', borderRadius: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{title || '부품 목록'}</h3>
        <div>표시할 부품이 없습니다.</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 14, padding: 12, background: '#eef7ff', borderRadius: 8 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{title || '부품 목록'}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #c5e0fd', padding: '4px 6px', textAlign: 'left' }}>부품정보</th>
            <th style={{ borderBottom: '1px solid #c5e0fd', padding: '4px 6px', textAlign: 'center' }}>규격</th>
            <th style={{ borderBottom: '1px solid #c5e0fd', padding: '4px 6px', textAlign: 'center' }}>수량</th>
            <th style={{ borderBottom: '1px solid #c5e0fd', padding: '4px 6px', textAlign: 'center' }}>단가</th>
            <th style={{ borderBottom: '1px solid #c5e0fd', padding: '4px 6px', textAlign: 'center' }}>금액</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((item, idx) => (
            <tr key={item.rackType + '-' + (item.size || '') + '-' + item.name}>
              <td style={{
                borderBottom: '1px solid #e5e3e3',
                padding: '6px 8px',
                wordBreak: 'break-all'
              }}>
                {kgLabelFix(item.name)}
              </td>
              <td style={{
                borderBottom: '1px solid #e5e3e3',
                textAlign: 'center'
              }}>
                {kgLabelFix(item.specification || '')}
              </td>
              <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'center' }}>
                <input
                  type="number"
                  min={0}
                  value={item.quantity}
                  onChange={e => onQuantityChange && onQuantityChange(idx, Math.max(0, Number(e.target.value)))}
                  style={{ width: 50, textAlign: 'right' }}
                /> 개
              </td>
              <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'right' }}>
                {item.unitPrice ? Number(item.unitPrice).toLocaleString() : '-'}
              </td>
              <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'right' }}>
                {item.totalPrice ? Number(item.totalPrice).toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
