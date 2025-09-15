import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { sortBOMByMaterialRule } from '../utils/materialSort';
import AdminPriceEditor from './AdminPriceEditor';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

export default function BOMDisplay({ bom, title, currentUser, selectedRackOption }) {
  const { setTotalBomQuantity } = useProducts();
  const [editingPart, setEditingPart] = useState(null);
  const [adminPrices, setAdminPrices] = useState({});
  const [refreshKey, setRefreshKey] = useState(0); // 강제 리렌더링용

  // 관리자 수정 단가 로드
  useEffect(() => {
    loadAdminPrices();
  }, [refreshKey]); // refreshKey 변경시에도 재로드

  // 다른 컴포넌트에서 단가 변경시 실시간 업데이트
  useEffect(() => {
    const handlePriceChange = (event) => {
      console.log('BOMDisplay: 단가 변경 이벤트 수신', event.detail);
      loadAdminPrices();
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('adminPriceChanged', handlePriceChange);
    
    return () => {
      window.removeEventListener('adminPriceChanged', handlePriceChange);
    };
  }, []);

  const loadAdminPrices = () => {
    try {
      const stored = localStorage.getItem('admin_edit_prices') || '{}';
      const priceData = JSON.parse(stored);
      setAdminPrices(priceData);
    } catch (error) {
      console.error('관리자 단가 로드 실패:', error);
      setAdminPrices({});
    }
  };

  // 부품 고유 ID 생성 (AdminPriceEditor와 동일한 로직)
  const generatePartId = (item) => {
    const { rackType, name, specification } = item;
    const cleanName = name.replace(/[^\w가-힣]/g, '');
    const cleanSpec = (specification || '').replace(/[^\w가-힣]/g, '');
    return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
  };

  // 실제 사용할 단가 계산 (우선순위: 관리자 수정 > 기존 단가)
  const getEffectiveUnitPrice = (item) => {
    const partId = generatePartId(item);
    const adminPrice = adminPrices[partId];
    
    if (adminPrice && adminPrice.price > 0) {
      return adminPrice.price;
    }
    
    return Number(item.unitPrice ?? 0);
  };

  // 단가 수정 버튼 클릭 핸들러
  const handleEditPrice = (item) => {
    // 선택된 랙옵션 정보 추가
    const itemWithRackInfo = {
      ...item,
      displayName: selectedRackOption || `${item.rackType} ${item.specification || ''}`.trim()
    };
    setEditingPart(itemWithRackInfo);
  };

  // 단가 수정 완료 핸들러
  const handlePriceSaved = (partId, newPrice, oldPrice) => {
    // 관리자 단가 데이터 재로드
    loadAdminPrices();
    setRefreshKey(prev => prev + 1);
    
    console.log(`부품 ${partId}의 단가가 ${oldPrice}원에서 ${newPrice}원으로 변경되었습니다.`);
    
    // 전체 시스템에 변경 이벤트 발송
    window.dispatchEvent(new CustomEvent('adminPriceChanged', { 
      detail: { partId, newPrice, oldPrice } 
    }));
  };

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
  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      <div style={{ marginTop: 14, padding: 12, background: '#eef6ff', borderRadius: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{title || '부품 목록'}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: '800px' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'left', minWidth: '200px' }}>부품정보</th>
                <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center', minWidth: '120px' }}>규격</th>
                <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center', minWidth: '100px' }}>수량</th>
                <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center', minWidth: '100px' }}>단가</th>
                <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center', minWidth: '120px' }}>금액</th>
                {isAdmin && (
                  <th style={{ borderBottom: '1px solid #c5d9f9', padding: '4px 6px', textAlign: 'center', minWidth: '100px' }}>관리</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedBom.map((item, index) => {
                const key = `${item.rackType} ${item.size || ''} ${item.name}-${index}`;
                const effectiveUnitPrice = getEffectiveUnitPrice(item);
                const qty = Number(item.quantity ?? 0);
                const total = effectiveUnitPrice ? Math.round(effectiveUnitPrice * qty) : Number(item.totalPrice ?? 0);
                
                // 관리자가 수정한 단가인지 확인
                const partId = generatePartId(item);
                const hasAdminPrice = adminPrices[partId] && adminPrices[partId].price > 0;

                return (
                  <tr key={key}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #d8d8d8', wordBreak: 'break-word' }}>
                      {kgLabelFix(item.name)}
                      {hasAdminPrice && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 6px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          fontSize: '10px',
                          borderRadius: '3px'
                        }}>
                          수정됨
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', borderBottom: '1px solid #d8d8d8', padding: '6px 4px' }}>
                      {kgLabelFix(item.specification || '')}
                    </td>
                    <td style={{ textAlign: 'center', borderBottom: '1px solid #d8d8d8', padding: '6px 4px' }}>
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
                    <td style={{ textAlign: 'right', borderBottom: '1px solid #d8d8d8', padding: '6px 8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ color: effectiveUnitPrice ? 'inherit' : '#6c757d' }}>
                          {effectiveUnitPrice ? effectiveUnitPrice.toLocaleString() : '-'}
                        </div>
                        {hasAdminPrice && Number(item.unitPrice) > 0 && Number(item.unitPrice) !== effectiveUnitPrice && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#6c757d', 
                            textDecoration: 'line-through' 
                          }}>
                            원가: {Number(item.unitPrice).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', borderBottom: '1px solid #d8d8d8', padding: '6px 8px' }}>
                      {total ? total.toLocaleString() : '-'}
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'center', borderBottom: '1px solid #d8d8d8', padding: '6px 4px' }}>
                        <button
                          onClick={() => handleEditPrice(item)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #007bff',
                            borderRadius: '3px',
                            backgroundColor: 'white',
                            color: '#007bff',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                          onMouseOver={e => {
                            e.target.style.backgroundColor = '#007bff';
                            e.target.style.color = 'white';
                          }}
                          onMouseOut={e => {
                            e.target.style.backgroundColor = 'white';
                            e.target.style.color = '#007bff';
                          }}
                        >
                          단가수정
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 관리자 단가 수정 정보 표시 */}
        {isAdmin && Object.keys(adminPrices).length > 0 && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '6px',
            fontSize: '13px',
            color: '#6c757d'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              💡 관리자 단가 수정 정보
            </div>
            <div>
              • "수정됨" 표시가 있는 부품은 관리자가 단가를 수정한 부품입니다.
            </div>
            <div>
              • 원가와 수정된 단가가 다른 경우 두 가격이 모두 표시됩니다.
            </div>
            <div>
              • 상단 원자재 단가 관리에서 일괄 수정이 가능합니다.
            </div>
          </div>
        )}
      </div>

      {/* 단가 수정 모달 */}
      {editingPart && (
        <AdminPriceEditor
          item={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={handlePriceSaved}
        />
      )}
    </>
  );
}
