import React, { useState, useEffect, useMemo } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { sortBOMByMaterialRule } from '../utils/materialSort';
import { 
  loadAllMaterials, 
  loadAdminPrices, 
  getEffectivePrice, 
  generatePartId,
  getRackOptionsUsingPart 
} from '../utils/unifiedPriceManager';
import AdminPriceEditor from './AdminPriceEditor';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

export default function MaterialPriceManager({ currentUser, cart }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPart, setEditingPart] = useState(null);
  const [adminPrices, setAdminPrices] = useState({});
  const [allMaterials, setAllMaterials] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // 관리자 수정 단가 로드
  useEffect(() => {
    loadAdminPricesData();
  }, [refreshKey]);

  // 전체 시스템 원자재 로드
  useEffect(() => {
    loadAllMaterialsData();
  }, []);

  // cart가 변경될 때마다 현재 카트의 원자재도 업데이트
  useEffect(() => {
    if (cart && cart.length > 0) {
      updateCurrentCartMaterials();
    }
  }, [cart]);

  // 다른 컴포넌트에서 단가 변경시 실시간 업데이트
  useEffect(() => {
    const handlePriceChange = (event) => {
      console.log('MaterialPriceManager: 단가 변경 이벤트 수신', event.detail);
      loadAdminPricesData();
      setRefreshKey(prev => prev + 1);
    };

    const handleSystemRestore = (event) => {
      console.log('MaterialPriceManager: 시스템 데이터 복원 이벤트 수신');
      loadAdminPricesData();
      loadAllMaterialsData();
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

  const loadAllMaterialsData = async () => {
    try {
      const materials = await loadAllMaterials();
      setAllMaterials(materials);
    } catch (error) {
      console.error('전체 원자재 로드 실패:', error);
      setAllMaterials([]);
    }
  };

  // 카트 BOM 원자재 목록 (누락 없이)
  const [currentCartMaterials, setCurrentCartMaterials] = useState([]);
  
  const updateCurrentCartMaterials = () => {
    // 카트 BOM의 원자재를 그대로 쭉 펼침 (중복 제거, 정렬)
    if (!cart || cart.length === 0) return;

    const bomMaterialMap = new Map();
    cart.forEach(item => {
      if (item.bom && Array.isArray(item.bom)) {
        item.bom.forEach(bomItem => {
          const partId = generatePartId(bomItem);
          // 같은 이름/규격이면 개수만 합침 (중복 부품 누락 방지)
          if (!bomMaterialMap.has(partId)) {
            bomMaterialMap.set(partId, { 
              ...bomItem, 
              partId, 
              count: bomItem.count || bomItem.quantity || 1,
              unitPrice: bomItem.unitPrice || 0
            });
          } else {
            const prev = bomMaterialMap.get(partId);
            bomMaterialMap.set(partId, {
              ...prev,
              count: (prev.count || 1) + (bomItem.count || bomItem.quantity || 1)
            });
          }
        });
      }
    });
    // 정렬 규칙 적용
    setCurrentCartMaterials(sortBOMByMaterialRule(Array.from(bomMaterialMap.values())));
  };

  // 실제 사용할 단가 계산 (통합 유틸리티 사용)
  const getEffectiveUnitPrice = (item) => {
    return getEffectivePrice(item);
  };

  // 검색된 원자재 필터링
  const filteredMaterials = useMemo(() => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return allMaterials.filter(material => {
        const name = kgLabelFix(material.name || '').toLowerCase();
        const spec = kgLabelFix(material.specification || '').toLowerCase();
        const rackType = (material.rackType || '').toLowerCase();
        return name.includes(term) || spec.includes(term) || rackType.includes(term);
      });
    }
    // 검색없고, 카트 있으면 카트 BOM을 그대로 보여줌
    if (cart && cart.length > 0) return currentCartMaterials;
    // 검색없고, 카트 없으면 빈 배열
    return [];
  }, [searchTerm, allMaterials, cart, currentCartMaterials]);

  // 단가 수정 버튼 클릭 핸들러
  const handleEditPrice = (item) => {
    const usingOptions = getRackOptionsUsingPart(item.partId);
    const itemWithRackInfo = {
      ...item,
      displayName: `${item.rackType} - ${item.name} ${item.specification || ''}`.trim(),
      usingOptions
    };
    setEditingPart(itemWithRackInfo);
  };

  // 단가 수정 완료 핸들러
  const handlePriceSaved = (partId, newPrice, oldPrice) => {
    loadAdminPricesData();
    setRefreshKey(prev => prev + 1);
    
    console.log(`MaterialPriceManager: 부품 ${partId}의 단가가 ${oldPrice}원에서 ${newPrice}원으로 변경되었습니다.`);
    
    // 전체 시스템에 변경 이벤트 발송 (BOMDisplay 등에서 수신)
    window.dispatchEvent(new CustomEvent('adminPriceChanged', { 
      detail: { partId, newPrice, oldPrice } 
    }));
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="material-price-manager-container" style={{ 
      marginTop: '20px',
      padding: '16px', 
      background: '#f8f9fa', 
      borderRadius: '8px',
      border: '1px solid #dee2e6',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#495057', flex: '0 0 auto' }}>
        원자재 단가 관리
      </h3>
      
      {/* 검색 영역 */}
      <div style={{ marginBottom: '16px', flex: '0 0 auto' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="원자재 검색 (이름, 규격, 랙타입으로 검색)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 40px 10px 12px',
              border: '1px solid #ced4da',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <div style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#6c757d',
            fontSize: '16px'
          }}>
            🔍
          </div>
        </div>
        {/* 검색 결과 안내 */}
        {searchTerm.trim() && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#6c757d' 
          }}>
            "{searchTerm}" 검색 결과: {filteredMaterials.length}개 원자재
          </div>
        )}
        {!searchTerm.trim() && cart && cart.length > 0 && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#28a745' 
          }}>
            현재 선택된 제품의 원자재: {filteredMaterials.length}개
          </div>
        )}
      </div>

      {/* 원자재 테이블 */}
      <div style={{ flex: '1', minHeight: '0', overflow: 'hidden' }}>
        {filteredMaterials.length > 0 ? (
          <div className="material-table-container" style={{ 
            maxHeight: '400px',
            minHeight: '200px',
            height: '400px',
            overflowY: 'auto',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            backgroundColor: 'white'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '13px',
              minWidth: '800px'
            }}>
              <thead style={{ 
                backgroundColor: '#e9ecef',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <tr>
                  <th style={{ 
                    padding: '8px 6px', 
                    textAlign: 'left',
                    borderBottom: '1px solid #dee2e6',
                    minWidth: '120px',
                    fontWeight: '600'
                  }}>
                    랙타입
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    textAlign: 'left',
                    borderBottom: '1px solid #dee2e6',
                    minWidth: '180px',
                    fontWeight: '600'
                  }}>
                    부품명
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    textAlign: 'left',
                    borderBottom: '1px solid #dee2e6',
                    minWidth: '120px',
                    fontWeight: '600'
                  }}>
                    규격
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    textAlign: 'center',
                    borderBottom: '1px solid #dee2e6',
                    minWidth: '80px',
                    fontWeight: '600'
                  }}>
                    수량
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    textAlign: 'center',
                    borderBottom: '1px solid #dee2e6',
                    minWidth: '100px',
                    fontWeight: '600'
                  }}>
                    단가
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    textAlign: 'center',
                    borderBottom: '1px solid #dee2e6',
                    minWidth: '100px',
                    fontWeight: '600'
                  }}>
                    금액
                  </th>
                  {isAdmin && (
                    <th style={{ 
                      padding: '8px 6px', 
                      textAlign: 'center',
                      borderBottom: '1px solid #dee2e6',
                      minWidth: '80px',
                      fontWeight: '600'
                    }}>
                      관리
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material, index) => {
                  const partId = material.partId || generatePartId(material);
                  const effectiveUnitPrice = getEffectiveUnitPrice(material);
                  const hasAdminPrice = adminPrices[partId] && adminPrices[partId].price > 0;
                  const qty = Number(material.count || material.quantity || 1);
                  const totalPrice = Math.round(effectiveUnitPrice * qty);
                  
                  return (
                    <tr key={`${partId}-${index}`} style={{ 
                      borderBottom: '1px solid #eee',
                      height: '35px'
                    }}>
                      <td style={{ 
                        padding: '7px 6px',
                        verticalAlign: 'middle'
                      }}>
                        {material.rackType}
                      </td>
                      <td style={{ 
                        padding: '7px 6px',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{kgLabelFix(material.name)}</span>
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
                        </div>
                      </td>
                      <td style={{ 
                        padding: '7px 6px',
                        verticalAlign: 'middle'
                      }}>
                        {kgLabelFix(material.specification) || '-'}
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontWeight: 'bold'
                      }}>
                        {qty}개
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        textAlign: 'center',
                        verticalAlign: 'middle'
                      }}>
                        <div>
                          <div style={{ 
                            color: hasAdminPrice ? 'inherit' : '#6c757d',
                            fontWeight: hasAdminPrice ? '600' : 'normal'
                          }}>
                            {effectiveUnitPrice ? effectiveUnitPrice.toLocaleString() : '-'}원
                          </div>
                          {hasAdminPrice && Number(material.unitPrice) > 0 && Number(material.unitPrice) !== effectiveUnitPrice && (
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#6c757d', 
                              textDecoration: 'line-through' 
                            }}>
                              원가: {Number(material.unitPrice).toLocaleString()}원
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontWeight: 'bold',
                        color: totalPrice > 0 ? '#000' : '#6c757d'
                      }}>
                        {totalPrice > 0 ? totalPrice.toLocaleString() : '-'}원
                      </td>
                      {isAdmin && (
                        <td style={{ 
                          padding: '7px 6px', 
                          textAlign: 'center',
                          verticalAlign: 'middle'
                        }}>
                          <button
                            onClick={() => handleEditPrice(material)}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #007bff',
                              borderRadius: '4px',
                              backgroundColor: 'white',
                              color: '#007bff',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              transition: 'all 0.2s'
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
        ) : (
          <div style={{ 
            padding: '40px 20px', 
            textAlign: 'center', 
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            color: '#6c757d',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {searchTerm.trim() ? (
              <>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>🔍</div>
                <div>"{searchTerm}" 검색 결과가 없습니다.</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  다른 검색어를 입력해보세요.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>📦</div>
                <div>제품을 선택하면 해당 원자재 목록이 표시됩니다.</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  또는 검색을 통해 전체 원자재를 확인할 수 있습니다.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 관리자 안내 정보 */}
      {isAdmin && filteredMaterials.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          backgroundColor: '#e7f3ff', 
          borderRadius: '6px',
          fontSize: '13px',
          color: '#0c5aa6',
          border: '1px solid #b8daff',
          flex: '0 0 auto'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            💡 원자재 단가 관리 안내
          </div>
          <div>• 이곳에서 수정한 단가는 전체 시스템에 적용됩니다.</div>
          <div>• "수정됨" 표시가 있는 부품은 관리자가 단가를 수정한 부품입니다.</div>
          <div>• 검색 기능을 통해 특정 원자재를 빠르게 찾을 수 있습니다.</div>
          <div>• 하단 BOM 표시와 실시간으로 연동됩니다.</div>
        </div>
      )}

      {/* 단가 수정 모달 */}
      {editingPart && (
        <AdminPriceEditor
          item={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={handlePriceSaved}
        />
      )}
    </div>
  );
}
