import React, { useState, useEffect, useMemo } from 'react';
import { sortBOMByMaterialRule } from '../utils/materialSort';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

export default function InventoryManager({ currentUser }) {
  const [allMaterials, setAllMaterials] = useState([]);
  const [inventory, setInventory] = useState({});
  const [selectedRackType, setSelectedRackType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPart, setEditingPart] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [rackOptions, setRackOptions] = useState([]);

  // 관리자가 아닌 경우 접근 차단
  if (currentUser?.role !== 'admin') {
    return (
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center', 
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        color: '#6c757d'
      }}>
        <h3>접근 권한이 없습니다</h3>
        <p>재고관리는 관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  useEffect(() => {
    loadAllMaterials();
    loadInventory();
    loadRackOptions();
  }, []);

  // 부품 고유 ID 생성
  const generatePartId = (item) => {
    const { rackType, name, specification } = item;
    const cleanName = (name || '').replace(/[^\w가-힣]/g, '');
    const cleanSpec = (specification || '').replace(/[^\w가-힣]/g, '');
    return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
  };

  // 랙옵션 고유 ID 생성
  const generateRackOptionId = (rackType, size, height, level, formType, color = '') => {
    const parts = [rackType, formType, size, height, level, color].filter(Boolean);
    return parts.join('-').replace(/[^\w가-힣-]/g, '').toLowerCase();
  };

  // 전체 원자재 로드
  const loadAllMaterials = async () => {
    try {
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
                      size, height, level, formType
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

  // 랙옵션 목록 로드
  const loadRackOptions = async () => {
    try {
      const bomResponse = await fetch('./bom_data.json');
      const bomData = await bomResponse.json();
      
      const options = [];
      
      Object.keys(bomData).forEach(rackType => {
        const rackData = bomData[rackType];
        Object.keys(rackData).forEach(size => {
          Object.keys(rackData[size]).forEach(height => {
            Object.keys(rackData[size][height]).forEach(level => {
              Object.keys(rackData[size][height][level]).forEach(formType => {
                const productData = rackData[size][height][level][formType];
                if (productData) {
                  const optionId = generateRackOptionId(rackType, size, height, level, formType);
                  const displayName = `${rackType} ${formType} ${size} ${height} ${level}`;
                  
                  options.push({
                    id: optionId,
                    rackType,
                    size,
                    height,
                    level,
                    formType,
                    displayName,
                    components: productData.components || []
                  });
                }
              });
            });
          });
        });
      });
      
      setRackOptions(options);
    } catch (error) {
      console.error('랙옵션 로드 실패:', error);
      setRackOptions([]);
    }
  };

  // 재고 데이터 로드
  const loadInventory = () => {
    try {
      const stored = localStorage.getItem('inventory_data') || '{}';
      const inventoryData = JSON.parse(stored);
      setInventory(inventoryData);
    } catch (error) {
      console.error('재고 데이터 로드 실패:', error);
      setInventory({});
    }
  };

  // 재고 데이터 저장
  const saveInventory = (newInventory) => {
    try {
      localStorage.setItem('inventory_data', JSON.stringify(newInventory));
      setInventory(newInventory);
      
      // 재고 변경 이벤트 발송
      window.dispatchEvent(new CustomEvent('inventoryChanged', { 
        detail: newInventory 
      }));
    } catch (error) {
      console.error('재고 데이터 저장 실패:', error);
    }
  };

  // 랙타입별 고유 재료 목록
  const rackTypes = useMemo(() => {
    return [...new Set(allMaterials.map(m => m.rackType))].sort();
  }, [allMaterials]);

  // 필터링된 재료 목록
  const filteredMaterials = useMemo(() => {
    let filtered = allMaterials;
    
    if (selectedRackType) {
      filtered = filtered.filter(m => m.rackType === selectedRackType);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(material => {
        const name = kgLabelFix(material.name || '').toLowerCase();
        const spec = kgLabelFix(material.specification || '').toLowerCase();
        return name.includes(term) || spec.includes(term);
      });
    }
    
    return sortBOMByMaterialRule(filtered);
  }, [allMaterials, selectedRackType, searchTerm]);

  // 재고 수정 시작
  const handleEditStock = (partId, currentStock) => {
    setEditingPart(partId);
    setEditQuantity(currentStock || '0');
  };

  // 재고 수정 완료
  const handleStockSave = () => {
    if (editingPart) {
      const newInventory = {
        ...inventory,
        [editingPart]: Math.max(0, Number(editQuantity) || 0)
      };
      saveInventory(newInventory);
      setEditingPart(null);
      setEditQuantity('');
    }
  };

  // 재고 수정 취소
  const handleStockCancel = () => {
    setEditingPart(null);
    setEditQuantity('');
  };

  // 특정 랙옵션에서 사용되는 부품들 찾기
  const getPartsUsedInRackOptions = (partId) => {
    const usedIn = rackOptions.filter(option => 
      option.components.some(comp => 
        generatePartId({
          rackType: option.rackType,
          name: comp.name,
          specification: comp.specification || ''
        }) === partId
      )
    );
    return usedIn;
  };

  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #dee2e6'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: '#495057' }}>재고 관리</h2>
        <div style={{ 
          fontSize: '14px',
          color: '#6c757d',
          backgroundColor: '#e9ecef',
          padding: '8px 12px',
          borderRadius: '4px'
        }}>
          관리자 전용
        </div>
      </div>

      {/* 필터 및 검색 영역 */}
      <div style={{ 
        display: 'flex',
        gap: '16px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ 
            display: 'block',
            marginBottom: '4px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            랙 타입 필터
          </label>
          <select
            value={selectedRackType}
            onChange={(e) => setSelectedRackType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">전체 랙 타입</option>
            {rackTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ 
            display: 'block',
            marginBottom: '4px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            부품 검색
          </label>
          <input
            type="text"
            placeholder="부품명 또는 규격으로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* 재고 현황 안내 */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#e7f3ff',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#0c5aa6',
        border: '1px solid #b8daff'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          💡 재고 관리 안내
        </div>
        <div>• 부품별 재고 수량을 입력하고 관리할 수 있습니다.</div>
        <div>• 재고 수량 변경은 전체 시스템에 실시간으로 반영됩니다.</div>
        <div>• 필터링된 부품: {filteredMaterials.length}개</div>
      </div>

      {/* 재고 테이블 */}
      <div style={{ 
        border: '1px solid #dee2e6',
        borderRadius: '6px',
        backgroundColor: 'white',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        <table style={{ 
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead style={{ 
            backgroundColor: '#e9ecef',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <tr>
              <th style={{ 
                padding: '12px 8px',
                textAlign: 'left',
                borderBottom: '1px solid #dee2e6',
                minWidth: '150px'
              }}>
                랙 타입
              </th>
              <th style={{ 
                padding: '12px 8px',
                textAlign: 'left',
                borderBottom: '1px solid #dee2e6',
                minWidth: '200px'
              }}>
                부품명
              </th>
              <th style={{ 
                padding: '12px 8px',
                textAlign: 'left',
                borderBottom: '1px solid #dee2e6',
                minWidth: '150px'
              }}>
                규격
              </th>
              <th style={{ 
                padding: '12px 8px',
                textAlign: 'center',
                borderBottom: '1px solid #dee2e6',
                minWidth: '100px'
              }}>
                현재 재고
              </th>
              <th style={{ 
                padding: '12px 8px',
                textAlign: 'center',
                borderBottom: '1px solid #dee2e6',
                minWidth: '120px'
              }}>
                관리
              </th>
              <th style={{ 
                padding: '12px 8px',
                textAlign: 'left',
                borderBottom: '1px solid #dee2e6',
                minWidth: '200px'
              }}>
                사용 랙옵션
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map((material, index) => {
              const currentStock = inventory[material.partId] || 0;
              const isEditing = editingPart === material.partId;
              const usedInOptions = getPartsUsedInRackOptions(material.partId);
              
              return (
                <tr key={`${material.partId}-${index}`} style={{ 
                  borderBottom: '1px solid #eee',
                  backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white'
                }}>
                  <td style={{ padding: '10px 8px' }}>
                    {material.rackType}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {kgLabelFix(material.name)}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {kgLabelFix(material.specification) || '-'}
                  </td>
                  <td style={{ 
                    padding: '10px 8px', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: currentStock > 0 ? '#28a745' : '#dc3545'
                  }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        min="0"
                        style={{
                          width: '60px',
                          padding: '4px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          textAlign: 'center'
                        }}
                        autoFocus
                      />
                    ) : (
                      `${currentStock}개`
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={handleStockSave}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #28a745',
                            borderRadius: '4px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          저장
                        </button>
                        <button
                          onClick={handleStockCancel}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #6c757d',
                            borderRadius: '4px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditStock(material.partId, currentStock)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          backgroundColor: 'white',
                          color: '#007bff',
                          cursor: 'pointer',
                          fontSize: '12px',
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
                        수정
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: '12px' }}>
                    {usedInOptions.length > 0 ? (
                      <div style={{ maxHeight: '60px', overflowY: 'auto' }}>
                        {usedInOptions.slice(0, 3).map((option, idx) => (
                          <div key={idx} style={{ 
                            marginBottom: '2px',
                            color: '#6c757d'
                          }}>
                            {option.displayName}
                          </div>
                        ))}
                        {usedInOptions.length > 3 && (
                          <div style={{ color: '#007bff', fontStyle: 'italic' }}>
                            +{usedInOptions.length - 3}개 더
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#6c757d', fontStyle: 'italic' }}>
                        사용 정보 없음
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredMaterials.length === 0 && (
        <div style={{ 
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>📦</div>
          <div>해당 조건에 맞는 부품이 없습니다.</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>
            다른 필터나 검색어를 시도해보세요.
          </div>
        </div>
      )}
    </div>
  );
}
