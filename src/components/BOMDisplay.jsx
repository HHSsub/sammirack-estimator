import React from 'react';
import { useProducts } from '../contexts/ProductContext';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

export default function BOMDisplay({ bom, title }) {
  const { setTotalBomQuantity } = useProducts();

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
          {bom.map((item) => {
            const key = `${item.rackType} ${item.size || ''} ${item.name}`;
            const unit = Number(item.unitPrice ?? 0);
            const qty = Number(item.quantity ?? 0);
            const total = unit ? Math.round(unit * qty) : Number(item.totalPrice ?? 0);

            return (
              <tr key={key}>
                <td style={{ borderBottom: '1px solid #e5e3e3', padding: '6px 8px', wordBreak: 'break-all' }}>
                  {kgLabelFix(item.name)}
                </td>
                <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'center' }}>
                  {kgLabelFix(item.specification || '')}
                </td>
                <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'center' }}>
                  <input
                    type="number"
                    min={0}
                    value={qty ?? ''}
                    onChange={(e) => setTotalBomQuantity(key, e.target.value)}
                    onBlur={(e) => { if (e.target.value === '') setTotalBomQuantity(key, 0); }}
                    style={{ width: 56, textAlign: 'right' }}
                  />{' '}
                  개
                </td>
                <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'right' }}>
                  {unit ? unit.toLocaleString() : '-'}
                </td>
                <td style={{ borderBottom: '1px solid #e5e3e3', textAlign: 'right' }}>
                  {total ? total.toLocaleString() : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
