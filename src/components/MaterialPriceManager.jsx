// src/components/MaterialPriceManager.jsx
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
  const [isLoading, setIsLoading] = useState(false);

  // 관리자 수정 단가 로드
  useEffect(() => {
    loadAdminPricesData();
  }, [refreshKey]);

  // ✅ 전체 시스템 원자재 로드 (개선된 함수 사용)
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

  // ✅ 개선된 원자재 로드 함수 사용
  const loadAllMaterialsData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 MaterialPriceManager: 전체 원자재 로드 시작');
      const materials = await loadAllMaterials();
      setAllMaterials(materials);
      console.log(`✅ MaterialPriceManager: ${materials.length}개 원자재 로드 완료`);
      
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
      maxHeight: '500px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        flexShrink: 0
      }}>
        <h3 style={{ margin: 0, color: '#495057' }}>
          💰 원자재 단가 관리
          {allMaterials.length > 0 && (
            <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '8px', color: '#6c757d' }}>
              (총 {allMaterials.length.toLocaleString()}개 원자재)
            </span>
          )}
        </h3>
        
        {/* 새로고침 버튼 */}
        <button
          onClick={loadAllMaterialsData}
          disabled={isLoading}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
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

      {/* 검색 입력창 */}
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="원자재명, 규격, 랙타입으로 검색..."
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
        {searchTerm && (
          <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
            "{searchTerm}" 검색 결과: {filteredMaterials.length}개
          </div>
        )}
      </div>

      {/* 원자재 테이블 */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        overflowX: 'auto',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        backgroundColor: 'white'
      }}>
        {isLoading ? (
          <div style={{ 
            padding: '40px 20px', 
            textAlign: 'center', 
            color: '#6c757d' 
          }}>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>🔄</div>
            <div>원자재 데이터를 로드하고 있습니다...</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              BOM + Data + Extra Options 통합 처리 중
            </div>
          </div>
        ) : filteredMaterials.length > 0 ? (
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', borderRight: '1px solid #dee2e6', width: '120px' }}>랙타입</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', borderRight: '1px solid #dee2e6', minWidth: '160px' }}>부품명</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', borderRight: '1px solid #dee2e6', width: '120px' }}>규격</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderRight: '1px solid #dee2e6', width: '80px' }}>기본단가</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderRight: '1px solid #dee2e6', width: '80px' }}>적용단가</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #dee2e6', width: '60px' }}>상태</th>
                {isAdmin && (
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '70px' }}>관리</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material, index) => {
                const effectivePrice = getEffectiveUnitPrice(material);
                const isModified = adminPrices[material.partId];
                const basePrice = material.unitPrice || 0;
                
                return (
                  <tr key={material.partId || index} style={{ 
                    borderBottom: '1px solid #f1f3f4',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                  }}>
                    <td style={{ padding: '8px', borderRight: '1px solid #f1f3f4', fontSize: '12px' }}>
                      {material.rackType}
                      {material.source && (
                        <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '2px' }}>
                          {material.source}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #f1f3f4' }}>
                      <div style={{ fontWeight: '500' }}>
                        {kgLabelFix(material.name)}
                      </div>
                      {material.count && (
                        <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
                          수량: {material.count}개
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #f1f3f4', fontSize: '12px', color: '#6c757d' }}>
                      {kgLabelFix(material.specification || '-')}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #f1f3f4', textAlign: 'right' }}>
                      {basePrice > 0 ? `${basePrice.toLocaleString()}원` : '-'}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #f1f3f4', textAlign: 'right', fontWeight: '600' }}>
                      {effectivePrice > 0 ? (
                        <span style={{ color: isModified ? '#dc3545' : '#28a745' }}>
                          {effectivePrice.toLocaleString()}원
                        </span>
                      ) : (
                        <span style={{ color: '#6c757d' }}>미설정</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid #f1f3f4', textAlign: 'center' }}>
                      {isModified ? (
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 6px', 
                          backgroundColor: '#dc3545', 
                          color: 'white', 
                          borderRadius: '3px' 
                        }}>
                          수정됨
                        </span>
                      ) : (
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#6c757d' 
                        }}>
                          기본값
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleEditPrice(material)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            border: '1px solid #007bff',
                            backgroundColor: '#007bff',
                            color: 'white',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          수정
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ 
            padding: '40px 20px', 
            textAlign: 'center', 
            color: '#6c757d' 
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
          <div>• 🆕 이제 모든 랙옵션의 원자재가 포함됩니다 (2780높이, 앙카볼트 등)</div>
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
