import React, { useState, useEffect, useMemo } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { sortBOMByMaterialRule } from '../utils/materialSort';
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

  // 관리자 수정 단가 로드
  useEffect(() => {
    loadAdminPrices();
  }, []);

  // 전체 시스템 원자재 로드
  useEffect(() => {
    loadAllMaterials();
  }, []);

  // cart가 변경될 때마다 현재 카트의 원자재도 업데이트
  useEffect(() => {
    if (cart && cart.length > 0) {
      updateCurrentCartMaterials();
    }
  }, [cart]);

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

  const loadAllMaterials = async () => {
    try {
      // bomData에서 모든 원자재 추출
      const bomResponse = await fetch('./bom_data.json');
      const bomData = await bomResponse.json();
      
      const materials = new Map();
      
      // BOM 데이터에서 모든 컴포넌트 추출
      Object.keys(bomData).forEach(rackType => {
        const rackData = bomData[rackType];
        Object.keys(rackData).forEach(size => {
          Object.keys(rackData[size]).forEach(height => {
            Object.keys(rackData[size][height]).forEach(level => {
              Object.keys(rackData[size][height][level]).forEach(formType => {
                const components = rackData[size][height][level][formType]?.components || [];
                components.forEach(component => {
                  const partId = generatePartId({
                    rackType,
                    name: component.name,
                    specification: component.specification || ''
                  });
                  
                  if (!materials.has(partId)) {
                    materials.set(partId, {
                      partId,
                      rackType,
                      name: component.name,
                      specification: component.specification || '',
                      unitPrice: Number(component.unit_price) || 0,
                      // 고유 식별을 위한 추가 정보
                      size,
                      height,
                      level,
                      formType
                    });
                  }
                });
              });
            });
          });
        });
      });

      setAllMaterials(Array.from(materials.values()));
    } catch (error) {
      console.error('전체 원자재 로드 실패:', error);
      setAllMaterials([]);
    }
  };

  const updateCurrentCartMaterials = () => {
    // 현재 카트의 BOM에서 원자재 추출하여 allMaterials 업데이트
    const cartMaterials = new Map();
    
    cart.forEach(item => {
      if (item.bom && Array.isArray(item.bom)) {
        item.bom.forEach(bomItem => {
          const partId = generatePartId(bomItem);
          if (!cartMaterials.has(partId)) {
            cartMaterials.set(partId, {
              partId,
              rackType: bomItem.rackType,
              name: bomItem.name,
              specification: bomItem.specification || '',
              unitPrice: Number(bomItem.unitPrice) || 0,
              fromCart: true
            });
          }
        });
      }
    });

    // 기존 allMaterials와 카트 원자재 병합
    setAllMaterials(prev => {
      const merged = new Map();
      
      // 기존 전체 원자재 추가
      prev.forEach(material => {
        merged.set(material.partId, material);
      });
      
      // 카트 원자재 추가 (이미 있으면 업데이트)
      Array.from(cartMaterials.values()).forEach(material => {
        merged.set(material.partId, material);
      });
      
      return Array.from(merged.values());
    });
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

  // 현재 카트의 원자재만 필터링 (카트에 제품이 있을 때)
  const currentCartMaterials = useMemo(() => {
    if (!cart || cart.length === 0) return [];
    
    const cartMaterialIds = new Set();
    cart.forEach(item => {
      if (item.bom && Array.isArray(item.bom)) {
        item.bom.forEach(bomItem => {
          const partId = generatePartId(bomItem);
          cartMaterialIds.add(partId);
        });
      }
    });

    return allMaterials.filter(material => cartMaterialIds.has(material.partId));
  }, [cart, allMaterials]);

  // 검색된 원자재 필터링
  const filteredMaterials = useMemo(() => {
    if (!searchTerm.trim()) {
      return currentCartMaterials;
    }

    const term = searchTerm.toLowerCase();
    return allMaterials.filter(material => {
      const name = kgLabelFix(material.name || '').toLowerCase();
      const spec = kgLabelFix(material.specification || '').toLowerCase();
      const rackType = (material.rackType || '').toLowerCase();
      
      return name.includes(term) || spec.includes(term) || rackType.includes(term);
    });
  }, [searchTerm, allMaterials, currentCartMaterials]);

  // 정렬된 원자재 목록
  const sortedMaterials = useMemo(() => {
    return sortBOMByMaterialRule(filteredMaterials);
  }, [filteredMaterials]);

  // 단가 수정 버튼 클릭 핸들러
  const handleEditPrice = (item) => {
    const itemWithRackInfo = {
      ...item,
      displayName: `${item.rackType} - ${item.name} ${item.specification || ''}`.trim()
    };
    setEditingPart(itemWithRackInfo);
  };

  // 단가 수정 완료 핸들러
  const handlePriceSaved = (partId, newPrice, oldPrice) => {
    // 관리자 단가 데이터 재로드
    loadAdminPrices();
    
    console.log(`부품 ${partId}의 단가가 ${oldPrice}원에서 ${newPrice}원으로 변경되었습니다.`);
    
    // 전체 시스템에 변경 이벤트 발송 (다른 컴포넌트들이 업데이트할 수 있도록)
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
            "{searchTerm}" 검색 결과: {sortedMaterials.length}개 원자재
          </div>
        )}
        
        {!searchTerm.trim() && cart && cart.length > 0 && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#28a745' 
          }}>
            현재 선택된 제품의 원자재: {sortedMaterials.length}개
          </div>
        )}
      </div>

      {/* 원자재 테이블 */}
      <div style={{ flex: '1', minHeight: '0', overflow: 'hidden' }}>
        {sortedMaterials.length > 0 ? (
          <div className="material-table-container" style={{ 
            height: '100%',
            overflowY: 'auto',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            backgroundColor: 'white'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '14px', 
              minWidth: '700px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '12px 8px', 
                    textAlign: 'left', 
                    minWidth: '150px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    랙타입
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '12px 8px', 
                    textAlign: 'left', 
                    minWidth: '200px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    부품명
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '12px 8px', 
                    textAlign: 'left', 
                    minWidth: '150px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    규격
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '12px 8px', 
                    textAlign: 'right', 
                    minWidth: '100px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    단가
                  </th>
                  {isAdmin && (
                    <th style={{ 
                      borderBottom: '2px solid #dee2e6', 
                      padding: '12px 8px', 
                      textAlign: 'center', 
                      minWidth: '100px',
                      fontWeight: '600',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#e9ecef'
                    }}>
                      관리
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedMaterials.map((material, index) => {
                  const effectiveUnitPrice = getEffectiveUnitPrice(material);
                  const hasAdminPrice = adminPrices[material.partId] && adminPrices[material.partId].price > 0;

                  return (
                    <tr key={material.partId || index} style={{ 
                      borderBottom: '1px solid #dee2e6'
                    }}>
                      <td style={{ 
                        padding: '10px 8px', 
                        borderRight: '1px solid #dee2e6',
                        fontSize: '13px',
                        color: '#495057'
                      }}>
                        {material.rackType}
                      </td>
                      <td style={{ 
                        padding: '10px 8px', 
                        borderRight: '1px solid #dee2e6',
                        wordBreak: 'break-word'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{kgLabelFix(material.name)}</span>
                          {hasAdminPrice && (
                            <span style={{
                              padding: '2px 6px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              fontSize: '10px',
                              borderRadius: '3px',
                              flexShrink: 0
                            }}>
                              수정됨
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ 
                        padding: '10px 8px', 
                        borderRight: '1px solid #dee2e6',
                        fontSize: '13px'
                      }}>
                        {kgLabelFix(material.specification || '-')}
                      </td>
                      <td style={{ 
                        padding: '10px 8px', 
                        borderRight: '1px solid #dee2e6',
                        textAlign: 'right'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <div style={{ 
                            color: effectiveUnitPrice ? 'inherit' : '#6c757d',
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
                      {isAdmin && (
                        <td style={{ 
                          padding: '10px 8px', 
                          textAlign: 'center'
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
      {isAdmin && sortedMaterials.length > 0 && (
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
