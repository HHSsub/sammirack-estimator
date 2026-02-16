// BOMDisplay.jsx - 규격 표시 수정 (x 유지)

import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { sortBOMByMaterialRule } from '../utils/materialSort';
import {
  loadAdminPrices,
  getEffectivePrice,
  generatePartId,
  generateInventoryPartId,
  getRackOptionsUsingPart
} from '../utils/unifiedPriceManager';
import AdminPriceEditor from './AdminPriceEditor';

// ✅ 무게명칭 변환 + 규격 표시 수정
function kgLabelFix(str) {
  if (!str) return '';
  return String(str)
    .replace(/200kg/g, '270kg')
    .replace(/350kg/g, '450kg');
}

// ✅ 경량랙 색상 표시용 함수 (색상+부품명 조합)
function getDisplayName(item) {
  const name = kgLabelFix(item.name || '');
  // 경량랙 + 색상 있음 + 안전핀/안전좌 제외
  if (item.rackType === '경량랙' && item.color &&
    !['안전핀', '안전좌'].includes(item.name)) {
    return `${item.color}${name}`;  // "아이보리기둥", "블랙선반" 등
  }
  return name;
}

// ✅ 규격 표시용 함수 (x 유지)
function formatSpecification(str) {
  if (!str) return '-';

  // * → x 변환 (700*300 → 700x300)
  let formatted = String(str).replace(/\*/g, 'x');

  // 무게 라벨 변환도 적용
  formatted = kgLabelFix(formatted);

  return formatted;
}

export default function BOMDisplay({ bom, title, currentUser, selectedRackOption }) {
  const { setTotalBomQuantity } = useProducts();
  const [editingPart, setEditingPart] = useState(null);
  const [adminPrices, setAdminPrices] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  // 관리자 수정 단가 로드
  useEffect(() => {
    loadAdminPricesData();
  }, [refreshKey]);

  // 다른 컴포넌트에서 단가 변경시 실시간 업데이트
  useEffect(() => {
    const handlePriceChange = (event) => {
      console.log('BOMDisplay: 단가 변경 이벤트 수신', event.detail);
      loadAdminPricesData();
      setRefreshKey(prev => prev + 1);
    };

    const handleSystemRestore = (event) => {
      console.log('BOMDisplay: 시스템 데이터 복원 이벤트 수신');
      loadAdminPricesData();
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('adminPriceChanged', handlePriceChange);
    window.addEventListener('systemDataRestored', handleSystemRestore);

    return () => {
      window.removeEventListener('adminPriceChanged', handlePriceChange);
      window.removeEventListener('systemDataRestored', handleSystemRestore);
    };
  }, []);

  const loadAdminPricesData = () => {
    try {
      const priceData = loadAdminPrices();
      setAdminPrices(priceData);
    } catch (error) {
      console.error('관리자 단가 로드 실패:', error);
      setAdminPrices({});
    }
  };

  // 실제 사용할 단가 계산 (통합 유틸리티 사용)
  const getEffectiveUnitPrice = (item) => {
    return getEffectivePrice(item);
  };

  // 단가 수정 버튼 클릭 핸들러 - 안전한 처리
  const handleEditPrice = (item) => {
    console.log('🔧 handleEditPrice 호출됨. item:', item);

    // item 유효성 검사
    if (!item) {
      console.error('❌ item이 undefined입니다.');
      alert('부품 정보를 가져올 수 없습니다.');
      return;
    }

    // 안전한 item 복사본 생성 (rackType 보장)
    const safeItem = {
      rackType: item.rackType || '미분류',
      name: item.name || '부품명없음',
      specification: item.specification || '',
      unitPrice: item.unitPrice || 0,
      quantity: item.quantity || 0,
      totalPrice: item.totalPrice || 0,
      ...item // 나머지 속성들 유지
    };

    console.log('🔧 안전한 item 생성:', safeItem);

    try {
      // ⚠️ 중요: BOM에 partId가 이미 저장되어 있으면 우선 사용 (가격용 ID)
      // 추가 옵션의 경우 올바른 가격용 ID가 이미 저장되어 있음
      let partId;
      if (safeItem.partId) {
        partId = safeItem.partId;
        console.log(`  ✅ BOM에 저장된 partId 사용: "${partId}"`);
      } else {
        // partId가 없으면 generatePartId로 생성 (하위 호환성)
        partId = generatePartId(safeItem);
        console.log(`  ⚠️ generatePartId로 생성: "${partId}"`);
      }

      const usingOptions = getRackOptionsUsingPart(partId);

      // 안전한 displayName 생성
      const displayName = selectedRackOption ||
        `${safeItem.rackType} ${safeItem.name} ${safeItem.specification}`.trim();

      // 선택된 랙옵션 정보 추가
      const itemWithRackInfo = {
        ...safeItem,
        partId,
        displayName,
        usingOptions
      };

      console.log('✅ 최종 itemWithRackInfo:', itemWithRackInfo);
      setEditingPart(itemWithRackInfo);

    } catch (error) {
      console.error('❌ handleEditPrice 오류:', error);
      alert('단가 수정 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 단가 수정 완료 핸들러
  const handlePriceSaved = (partId, newPrice, oldPrice) => {
    // 관리자 단가 데이터 재로드
    loadAdminPricesData();
    setRefreshKey(prev => prev + 1);

    console.log(`BOMDisplay: 부품 ${partId}의 단가가 ${oldPrice}원에서 ${newPrice}원으로 변경되었습니다.`);

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

  // BOM 항목들의 rackType 확인 및 수정
  const safeBom = bom.map((item, index) => {
    if (!item.rackType) {
      console.warn(`⚠️ BOM 항목 ${index}에 rackType이 없음:`, item);
      return {
        ...item,
        rackType: '미분류' // 기본값 설정
      };
    }
    return item;
  });

  // 기존 localeCompare 정렬 제거, 사용자 정의 정렬 사용
  const sortedBom = sortBOMByMaterialRule(safeBom);
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
                // 안전한 키 생성
                const key = `${item.rackType || 'unknown'} ${item.size || ''} ${item.name || 'noname'}-${index}`;
                const partId = generatePartId(item);
                const effectiveUnitPrice = getEffectiveUnitPrice(item);
                const hasAdminPrice = adminPrices[partId] && adminPrices[partId].price > 0;
                const qty = Number(item.quantity ?? 0);

                // ✅ 관리자 단가가 있으면 즉시 반영 (BOM 재생성 불필요)
                const total = effectiveUnitPrice * qty;

                return (
                  <tr key={key} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '4px 6px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div>
                          <strong>{getDisplayName(item)}</strong>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {item.rackType || '미분류'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {hasAdminPrice && (
                            <span style={{
                              fontSize: '10px',
                              color: '#dc3545',
                              backgroundColor: '#f8d7da',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              fontWeight: 'bold'
                            }}>
                              수정됨
                            </span>
                          )}
                          {item.note === '기타추가옵션' && (
                            <span style={{
                              fontSize: '10px',
                              color: '#17a2b8',
                              backgroundColor: '#d1ecf1',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              fontWeight: 'bold'
                            }}>
                              추가옵션
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {formatSpecification(item.specification)}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                      {qty}개
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      <div>
                        <div style={{
                          color: hasAdminPrice ? 'inherit' : '#6c757d',
                          fontWeight: hasAdminPrice ? '600' : 'normal'
                        }}>
                          {effectiveUnitPrice ? effectiveUnitPrice.toLocaleString() : '-'}원
                        </div>
                        {hasAdminPrice && Number(item.unitPrice) > 0 && Number(item.unitPrice) !== effectiveUnitPrice && (
                          <div style={{
                            fontSize: '11px',
                            color: '#6c757d',
                            textDecoration: 'line-through'
                          }}>
                            원가: {Number(item.unitPrice).toLocaleString()}원
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                      {total ? total.toLocaleString() : '-'}원
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleEditPrice(item)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
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

        {/* 통합 관리 안내 정보 */}
        {isAdmin && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            backgroundColor: '#e7f3ff',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#0c5aa6',
            border: '1px solid #b8daff'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              💡 BOM 단가 관리 안내
            </div>
            <div>• 이곳에서 수정한 단가는 우측 원자재 관리와 실시간 연동됩니다.</div>
            <div>• "수정됨" 표시가 있는 부품은 관리자가 단가를 수정한 부품입니다.</div>
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
