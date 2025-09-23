// src/components/InventoryManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { sortBOMByMaterialRule } from '../utils/materialSort';
import { loadAllMaterials, generatePartId, generateRackOptionId } from '../utils/unifiedPriceManager';

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
  const [isLoading, setIsLoading] = useState(false);

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
    loadAllMaterialsData();
    loadInventory();
    loadRackOptions();
  }, []);

  // ✅ 개선된 전체 원자재 로드 (통합 함수 사용)
  const loadAllMaterialsData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 InventoryManager: 전체 원자재 로드 시작');
      const materials = await loadAllMaterials();
      setAllMaterials(materials);
      console.log(`✅ InventoryManager: ${materials.length}개 원자재 로드 완료`);
      
      // 앙카볼트 등 주요 부품들이 포함되었는지 확인
      const anchorBolts = materials.filter(m => m.name.includes('앙카볼트'));
      const bracings = materials.filter(m => m.name.includes('브레싱'));
      console.log(`🔧 앙카볼트: ${anchorBolts.length}개, 브레싱 관련: ${bracings.length}개`);
      
    } catch (error) {
      console.error('❌ 전체 원자재 로드 실패:', error);
      setAllMaterials([]);
    } finally {
      setIsLoading(false);
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
                    displayName
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
    } catch (error) {
      console.error('재고 데이터 저장 실패:', error);
    }
  };

  // 재고 수량 수정
  const updateInventory = (partId, newQuantity) => {
    const quantity = Math.max(0, Number(newQuantity) || 0);
    const newInventory = { ...inventory };
    
    if (quantity > 0) {
      newInventory[partId] = quantity;
    } else {
      delete newInventory[partId];
    }
    
    saveInventory(newInventory);
  };

  // 재고 증감 버튼
  const adjustInventory = (partId, delta) => {
    const currentQty = inventory[partId] || 0;
    const newQty = Math.max(0, currentQty + delta);
    updateInventory(partId, newQty);
  };

  // 수정 모드 시작
  const startEdit = (material) => {
    setEditingPart(material.partId);
    setEditQuantity(String(inventory[material.partId] || 0));
  };

  // 수정 완료
  const finishEdit = () => {
    if (editingPart) {
      updateInventory(editingPart, editQuantity);
    }
    setEditingPart(null);
    setEditQuantity('');
  };

  // 수정 취소
  const cancelEdit = () => {
    setEditingPart(null);
    setEditQuantity('');
  };

  // 랙타입 목록 추출
  const rackTypes = useMemo(() => {
    const types = [...new Set(allMaterials.map(m => m.rackType))].filter(Boolean);
    return types.sort();
  }, [allMaterials]);

  // 필터링된 원자재 목록
  const filteredMaterials = useMemo(() => {
    let filtered = allMaterials;

    // 랙타입 필터
    if (selectedRackType) {
      filtered = filtered.filter(m => m.rackType === selectedRackType);
    }

    // 검색 필터
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(material => {
        const name = kgLabelFix(material.name || '').toLowerCase();
        const spec = kgLabelFix(material.specification || '').toLowerCase();
        const rackType = (material.rackType || '').toLowerCase();
        return name.includes(term) || spec.includes(term) || rackType.includes(term);
      });
    }

    return sortBOMByMaterialRule(filtered);
  }, [allMaterials, selectedRackType, searchTerm]);

  // 랙타입별 재고 통계
  const inventoryStats = useMemo(() => {
    const stats = {};
    Object.keys(inventory).forEach(partId => {
      const material = allMaterials.find(m => m.partId === partId);
      if (material) {
        const rackType = material.rackType;
        if (!stats[rackType]) {
          stats[rackType] = { count: 0, totalQty: 0 };
        }
        stats[rackType].count++;
        stats[rackType].totalQty += inventory[partId];
      }
    });
    return stats;
  }, [inventory, allMaterials]);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h2 style={{ margin: 0 }}>
          📦 재고 관리
          {allMaterials.length > 0 && (
            <span style={{ fontSize: '16px', fontWeight: 'normal', marginLeft: '8px', color: '#6c757d' }}>
              (총 {allMaterials.length.toLocaleString()}개 원자재)
            </span>
          )}
        </h2>
        
        {/* 새로고침 버튼 */}
        <button
          onClick={loadAllMaterialsData}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            border: '1px solid #007bff',
            backgroundColor: isLoading ? '#f8f9fa' : '#007bff',
            color: isLoading ? '#6c757d' : 'white',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? '🔄 로딩중...' : '🔄 새로고침'}
        </button>
      </div>

      {/* 재고 통계 */}
      {Object.keys(inventoryStats).length > 0 && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '16px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#495057' }}>📊 재고 현황</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {Object.entries(inventoryStats).map(([rackType, stats]) => (
              <div key={rackType} style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #dee2e6',
                minWidth: '120px'
              }}>
                <div style={{ fontSize: '12px', color: '#6c757d' }}>{rackType}</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '2px' }}>
                  {stats.count}종 / {stats.totalQty.toLocaleString()}개
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 영역 */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '16px', 
        backgroundColor: '#ffffff', 
        borderRadius: '8px',
        border: '1px solid #dee2e6',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center'
      }}>
        {/* 랙타입 필터 버튼 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', marginRight: '8px' }}>랙타입:</span>
          <button
            onClick={() => setSelectedRackType('')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #dee2e6',
              backgroundColor: selectedRackType === '' ? '#007bff' : '#f8f9fa',
              color: selectedRackType === '' ? 'white' : '#495057',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            전체
          </button>
          {rackTypes.map(rackType => (
            <button
              key={rackType}
              onClick={() => setSelectedRackType(rackType)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: '1px solid #dee2e6',
                backgroundColor: selectedRackType === rackType ? '#007bff' : '#f8f9fa',
                color: selectedRackType === rackType ? 'white' : '#495057',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {rackType}
              {inventoryStats[rackType] && (
                <span style={{ 
                  marginLeft: '4px', 
                  fontSize: '11px',
                  opacity: 0.8
                }}>
                  ({inventoryStats[rackType].count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 검색창 */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            placeholder="부품명, 규격으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* 재고 테이블 */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #dee2e6',
        overflow: 'hidden'
      }}>
        {isLoading ? (
          <div style={{ 
            padding: '60px 20px', 
            textAlign: 'center', 
            color: '#6c757d' 
          }}>
            <div style={{ fontSize: '20px', marginBottom: '12px' }}>🔄</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>원자재 데이터를 로드하고 있습니다...</div>
            <div style={{ fontSize: '14px' }}>
              BOM + Data + Extra Options 통합 처리 중
            </div>
          </div>
        ) : filteredMaterials.length > 0 ? (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderRight: '1px solid #dee2e6', width: '100px' }}>랙타입</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderRight: '1px solid #dee2e6', minWidth: '180px' }}>부품명</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderRight: '1px solid #dee2e6', width: '120px' }}>규격</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #dee2e6', width: '100px' }}>현재재고</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #dee2e6', width: '120px' }}>빠른조정</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '120px' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material, index) => {
                  const currentStock = inventory[material.partId] || 0;
                  const isEditing = editingPart === material.partId;
                  
                  return (
                    <tr key={material.partId || index} style={{ 
                      borderBottom: '1px solid #f1f3f4',
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                    }}>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #f1f3f4', fontSize: '12px' }}>
                        {material.rackType}
                        {material.source && (
                          <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '2px' }}>
                            {material.source}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #f1f3f4' }}>
                        <div style={{ fontWeight: '500' }}>
                          {kgLabelFix(material.name)}
                        </div>
                        {material.usedInOptions && material.usedInOptions.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
                            사용: {material.usedInOptions.length}개 옵션
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #f1f3f4', fontSize: '13px', color: '#6c757d' }}>
                        {kgLabelFix(material.specification || '-')}
                      </td>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #f1f3f4', textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: 'bold',
                          color: currentStock === 0 ? '#dc3545' : currentStock < 10 ? '#ffc107' : '#28a745'
                        }}>
                          {currentStock.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6c757d' }}>개</div>
                      </td>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #f1f3f4', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => adjustInventory(material.partId, -100)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              border: '1px solid #dc3545',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              minWidth: '35px'
                            }}
                          >
                            -100
                          </button>
                          <button
                            onClick={() => adjustInventory(material.partId, -50)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              border: '1px solid #dc3545',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              minWidth: '32px'
                            }}
                          >
                            -50
                          </button>
                          <button
                            onClick={() => adjustInventory(material.partId, -30)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              border: '1px solid #dc3545',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              minWidth: '32px'
                            }}
                          >
                            -30
                          </button>
                          <button
                            onClick={() => adjustInventory(material.partId, 30)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              border: '1px solid #28a745',
                              backgroundColor: '#28a745',
                              color: 'white',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              minWidth: '32px'
                            }}
                          >
                            +30
                          </button>
                          <button
                            onClick={() => adjustInventory(material.partId, 50)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              border: '1px solid #28a745',
                              backgroundColor: '#28a745',
                              color: 'white',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              minWidth: '32px'
                            }}
                          >
                            +50
                          </button>
                          <button
                            onClick={() => adjustInventory(material.partId, 100)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              border: '1px solid #28a745',
                              backgroundColor: '#28a745',
                              color: 'white',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              minWidth: '35px'
                            }}
                          >
                            +100
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') finishEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              style={{
                                width: '60px',
                                padding: '4px',
                                border: '1px solid #ced4da',
                                borderRadius: '3px',
                                fontSize: '12px',
                                textAlign: 'center'
                              }}
                              autoFocus
                            />
                            <button
                              onClick={finishEdit}
                              style={{
                                padding: '4px 6px',
                                fontSize: '11px',
                                border: '1px solid #28a745',
                                backgroundColor: '#28a745',
                                color: 'white',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                padding: '4px 6px',
                                fontSize: '11px',
                                border: '1px solid #6c757d',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(material)}
                            style={{
                              padding: '6px 10px',
                              fontSize: '12px',
                              border: '1px solid #007bff',
                              backgroundColor: '#007bff',
                              color: 'white',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ 
            padding: '60px 20px', 
            textAlign: 'center', 
            color: '#6c757d' 
          }}>
            <div style={{ fontSize: '20px', marginBottom: '12px' }}>📦</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              {searchTerm || selectedRackType ? '조건에 맞는 원자재가 없습니다.' : '원자재 데이터가 없습니다.'}
            </div>
            <div style={{ fontSize: '14px' }}>
              {searchTerm || selectedRackType ? '필터 조건을 확인해주세요.' : '새로고침 버튼을 눌러 데이터를 다시 로드해보세요.'}
            </div>
          </div>
        )}
      </div>

      {/* 하단 안내 정보 */}
      {filteredMaterials.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '16px', 
          backgroundColor: '#e7f3ff', 
          borderRadius: '8px',
          border: '1px solid #b8daff',
          fontSize: '14px',
          color: '#0c5aa6'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            💡 재고 관리 안내
          </div>
          <div>• 빠른조정 버튼으로 재고를 쉽게 증감할 수 있습니다 (+30, +50, +100, -30, -50, -100)</div>
          <div>• 정확한 수량 입력이 필요한 경우 "수정" 버튼을 사용하세요</div>
          <div>• 랙타입 필터를 통해 특정 제품군의 원자재만 볼 수 있습니다</div>
          <div>• 🆕 모든 랙옵션의 원자재가 포함됩니다 (2780높이, 앙카볼트 등)</div>
          <div>• 재고 현황: <span style={{color: '#28a745'}}>충분(10개 이상)</span>, <span style={{color: '#ffc107'}}>부족(1-9개)</span>, <span style={{color: '#dc3545'}}>없음(0개)</span></div>
        </div>
      )}
    </div>
  );
}
