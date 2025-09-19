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
      // 1. bomData에서 모든 원자재 추출 (기존 로직)
      const bomResponse = await fetch('./bom_data.json');
      const bomData = await bomResponse.json();
      
      // 2. data.json에서 가격 정보 추출
      const dataResponse = await fetch('./data.json');
      const priceData = await dataResponse.json();
      
      const materials = new Map();
      
      // BOM 데이터에서 모든 컴포넌트 추출 (기존)
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

      // 3. 하이랙 동적 BOM 생성 및 추가
      if (priceData['하이랙']) {
        const hiRackData = priceData['하이랙'];
        const colors = hiRackData['색상'] || [];
        const heights = ['150', '200', '250'];
        const levels = ['1단', '2단', '3단', '4단', '5단', '6단'];
        const formTypes = ['독립형', '연결형'];

        colors.forEach(color => {
          const weightOnly = extractWeightOnly(color);
          const basePrice = hiRackData['기본가격']?.[color] || {};
          const sizes = Object.keys(basePrice);

          sizes.forEach(size => {
            heights.forEach(height => {
              levels.forEach(level => {
                formTypes.forEach(formType => {
                  const levelNum = parseInt(level) || 1;
                  const isConn = formType === '연결형';
                  
                  // 기둥
                  const pillarPartId = generatePartId({
                    rackType: '하이랙',
                    name: `기둥(${height})`,
                    specification: `높이 ${height}${weightOnly ? ` ${weightOnly}` : ''}`
                  });
                  if (!materials.has(pillarPartId)) {
                    materials.set(pillarPartId, {
                      partId: pillarPartId,
                      rackType: '하이랙',
                      name: `기둥(${height})`,
                      specification: `높이 ${height}${weightOnly ? ` ${weightOnly}` : ''}`,
                      unitPrice: 0,
                      size, height, level, formType
                    });
                  }

                  // 로드빔
                  const sizeMatch = String(size).replace(/\s+/g, '').match(/(\d+)[xX](\d+)/);
                  const rodBeamNum = sizeMatch ? sizeMatch[2] : '';
                  if (rodBeamNum) {
                    const beamPartId = generatePartId({
                      rackType: '하이랙',
                      name: `로드빔(${rodBeamNum})`,
                      specification: `${rodBeamNum}${weightOnly ? ` ${weightOnly}` : ''}`
                    });
                    if (!materials.has(beamPartId)) {
                      materials.set(beamPartId, {
                        partId: beamPartId,
                        rackType: '하이랙',
                        name: `로드빔(${rodBeamNum})`,
                        specification: `${rodBeamNum}${weightOnly ? ` ${weightOnly}` : ''}`,
                        unitPrice: 0,
                        size, height, level, formType
                      });
                    }
                  }

                  // 선반
                  const shelfNum = sizeMatch ? sizeMatch[1] : '';
                  if (shelfNum) {
                    const shelfPartId = generatePartId({
                      rackType: '하이랙',
                      name: `선반(${shelfNum})`,
                      specification: `사이즈 ${size}${weightOnly ? ` ${weightOnly}` : ''}`
                    });
                    if (!materials.has(shelfPartId)) {
                      materials.set(shelfPartId, {
                        partId: shelfPartId,
                        rackType: '하이랙',
                        name: `선반(${shelfNum})`,
                        specification: `사이즈 ${size}${weightOnly ? ` ${weightOnly}` : ''}`,
                        unitPrice: 0,
                        size, height, level, formType
                      });
                    }
                  }
                });
              });
            });
          });
        });
      }

      // 4. 스텐랙 동적 BOM 생성 및 추가
      if (priceData['스텐랙']) {
        const stainlessData = priceData['스텐랙'];
        const basePrice = stainlessData['기본가격'] || {};
        const sizes = Object.keys(basePrice);
        const heights = ['75', '90', '120', '150', '180', '210'];
        const levels = ['2단', '3단', '4단', '5단', '6단'];

        sizes.forEach(size => {
          heights.forEach(height => {
            levels.forEach(level => {
              // 기둥
              const pillarPartId = generatePartId({
                rackType: '스텐랙',
                name: `기둥(${height})`,
                specification: `높이 ${height}`
              });
              if (!materials.has(pillarPartId)) {
                materials.set(pillarPartId, {
                  partId: pillarPartId,
                  rackType: '스텐랙',
                  name: `기둥(${height})`,
                  specification: `높이 ${height}`,
                  unitPrice: 0,
                  size, height, level
                });
              }

              // 선반
              const sizeFront = (size.split("x")[0]) || size;
              const shelfPartId = generatePartId({
                rackType: '스텐랙',
                name: `선반(${sizeFront})`,
                specification: `사이즈 ${size}`
              });
              if (!materials.has(shelfPartId)) {
                materials.set(shelfPartId, {
                  partId: shelfPartId,
                  rackType: '스텐랙',
                  name: `선반(${sizeFront})`,
                  specification: `사이즈 ${size}`,
                  unitPrice: 0,
                  size, height, level
                });
              }
            });
          });
        });
      }

      // 5. 파렛트랙/파렛트랙 철판형 추가 옵션 처리
      ['파렛트랙', '파렛트랙 철판형'].forEach(rackType => {
        if (bomData[rackType]) {
          const rackData = bomData[rackType];
          const extraHeights = ['H4500', 'H5000', 'H5500', 'H6000'];
          const extraSizes = rackType === '파렛트랙 철판형' ? ['2080x800', '2080x1000'] : [];
          
          // 추가 높이에 대한 BOM 생성
          Object.keys(rackData).forEach(size => {
            extraHeights.forEach(height => {
              ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].forEach(level => {
                ['독립형', '연결형'].forEach(formType => {
                  // 기본 컴포넌트들 생성
                  const components = [
                    {
                      name: `기둥(${height})`,
                      specification: `높이 ${height}`,
                      unit_price: 0
                    },
                    {
                      name: `로드빔(${size.split('x')[0] || '1000'})`,
                      specification: size.split('x')[0] || '1000',
                      unit_price: 0
                    }
                  ];

                  if (rackType === '파렛트랙') {
                    components.push({
                      name: `타이빔(${size.split('x')[1] || '600'})`,
                      specification: size.split('x')[1] || '600',
                      unit_price: 0
                    });
                  }

                  components.push({
                    name: '안전핀(파렛트랙)',
                    specification: '안전핀',
                    unit_price: 0
                  });

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
                        size, height, level, formType
                      });
                    }
                  });
                });
              });
            });
          });

          // 추가 사이즈에 대한 BOM 생성
          extraSizes.forEach(size => {
            Object.keys(rackData).forEach(existingSize => {
              Object.keys(rackData[existingSize]).forEach(height => {
                Object.keys(rackData[existingSize][height]).forEach(level => {
                  Object.keys(rackData[existingSize][height][level]).forEach(formType => {
                    const components = rackData[existingSize][height][level][formType]?.components || [];
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
                          size, height, level, formType
                        });
                      }
                    });
                  });
                });
              });
            });
          });
        }
      });

      setAllMaterials(Array.from(materials.values()));
    } catch (error) {
      console.error('전체 원자재 로드 실패:', error);
      setAllMaterials([]);
    }
  };

  // 무게 추출 함수
  const extractWeightOnly = (color = '') => {
    const m = String(color).match(/(\d{2,4}kg)/);
    return m ? m[1] : "";
  };

  const updateCurrentCartMaterials = () => {
    // 원래: 카트 BOM을 allMaterials에서 partId로 추림 → 누락 발생
    // 개선: 카트 BOM의 원자재를 그대로 쭉 펼침 (중복 제거, 정렬)
    if (!cart || cart.length === 0) return;

    const bomMaterialMap = new Map();
    cart.forEach(item => {
      if (item.bom && Array.isArray(item.bom)) {
        item.bom.forEach(bomItem => {
          const partId = generatePartId(bomItem);
          // 같은 이름/규격이면 개수만 합침 (중복 부품 누락 방지)
          if (!bomMaterialMap.has(partId)) {
            bomMaterialMap.set(partId, { ...bomItem, partId, count: bomItem.count || 1 });
          } else {
            const prev = bomMaterialMap.get(partId);
            bomMaterialMap.set(partId, {
              ...prev,
              count: (prev.count || 1) + (bomItem.count || 1)
            });
          }
        });
      }
    });
    // 정렬 규칙 적용
    setCurrentCartMaterials(sortBOMByMaterialRule(Array.from(bomMaterialMap.values())));
  };

  // 부품 고유 ID 생성 (AdminPriceEditor와 동일한 로직)
  const generatePartId = (item) => {
    const { rackType, name, specification } = item;
    const cleanName = (name || '').replace(/[^\w가-힣]/g, '');
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
    // BOM item에 unitPrice가 없으면 allMaterials에서 찾아옴
    if (typeof item.unitPrice === 'number' && item.unitPrice > 0) {
      return item.unitPrice;
    }
    const found = allMaterials.find(mat => mat.partId === partId);
    if (found && typeof found.unitPrice === 'number') return found.unitPrice;
    return 0;
  };

  // 카트 BOM 원자재 목록 (누락 없이)
  const [currentCartMaterials, setCurrentCartMaterials] = useState([]);
  useEffect(() => {
    if (cart && cart.length > 0) updateCurrentCartMaterials();
    else setCurrentCartMaterials([]);
  }, [cart, allMaterials]);

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
    // 검색없고, 카트 없으면 빈 배열 (혹은 allMaterials 전체 보여주고 싶으면 return allMaterials)
    return [];
  }, [searchTerm, allMaterials, cart, currentCartMaterials]);

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
    loadAdminPrices();
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
            height: '100%',
            overflowY: 'auto',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            backgroundColor: 'white'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '13px', 
              minWidth: '700px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'left', 
                    minWidth: '80px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    랙타입
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'left', 
                    minWidth: '80px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    부품명
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'left', 
                    minWidth: '80px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    규격
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'right', 
                    minWidth: '80px',
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
                      padding: '7px 6px', 
                      textAlign: 'center', 
                      minWidth: '80px',
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
                {filteredMaterials.map((material, index) => {
                  const effectiveUnitPrice = getEffectiveUnitPrice(material);
                  const partId = generatePartId(material);
                  const hasAdminPrice = adminPrices[partId] && adminPrices[partId].price > 0;

                  return (
                    <tr key={partId || index} style={{ 
                      borderBottom: '1px solid #dee2e6',
                      height: '28px'
                    }}>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        fontSize: '13px',
                        color: '#495057',
                        verticalAlign: 'middle'
                      }}>
                        {material.rackType}
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        wordBreak: 'break-word',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        fontSize: '13px',
                        verticalAlign: 'middle'
                      }}>
                        {kgLabelFix(material.specification || '-')}
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        textAlign: 'right',
                        verticalAlign: 'middle'
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
          <div>• 검색 기능을 통해 특정 원자재를 빠르게 찾을 수 있습니다</div>
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
