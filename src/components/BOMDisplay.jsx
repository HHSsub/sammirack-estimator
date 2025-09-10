import React from 'react';
import { useProducts } from '../contexts/ProductContext';
import { sortBOMByMaterialRule } from '../utils/materialSort';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

export default function BOMDisplay({ bom, title }) {
  const { setTotalBomQuantity } = useProducts();

  if (!bom || !bom.length) {
    return (
      <div style={{ marginTop: 12, padding: 8, background: '#f0f8ff', borderRadius: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{title || '부품 목록'}</h3>
        <div>표시할 부품이 없습니다.</div>
      </div>
    );
  }

  // 기존 localeCompare 정렬 제거, 사용자 정의 정렬 사용
  const sortedBom = sortBOMByMaterialRule(bom);

  return (
    <div style={{ marginTop: 14, padding: 12, background: '#eef6ff', borderRadius: 8 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{title || '부품 목록'}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'left' }}>부품정보</th>
            <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center' }}>규격</th>
            <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center' }}>수량</th>
            <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center' }}>단가</th>
            <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center' }}>금액</th>
          </tr>
        </thead>
        <tbody>
          {sortedBom.map(item => {
            const key = `${item.rackType} ${item.size || ''} ${item.name}`;
            const unit = Number(item.unitPrice ?? 0);
            const qty = Number(item.quantity ?? 0);
            const total = unit ? Math.round(unit * qty) : Number(item.totalPrice ?? 0);

            return (
              <tr key={key}>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #d8d8d8', wordBreak: 'break-word' }}>
                  {kgLabelFix(item.name)}
                </td>
                <td style={{ textAlign: 'center', borderBottom: '1px solid #d8d8d8' }}>
                  {kgLabelFix(item.specification || '')}
                </td>
                <td style={{ textAlign: 'center', borderBottom: '1px solid #d8d8d8' }}>
                  <input
                    type="number"
                    min={0}
                    value={qty ?? ''}
                    onChange={e => setTotalBomQuantity(key, e.target.value)}
                    onBlur={e => { if (e.target.value === '') setTotalBomQuantity(key, 0); }}
                    style={{ width: 56, textAlign: 'right' }}
                  />{' '}
                  개
                </td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #d8d8d8' }}>
                  {unit ? unit.toLocaleString() : '-'}
                </td>
                <td style={{ textAlign: 'right', borderBottom: '1px solid #d8d8d8' }}>
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
