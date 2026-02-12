// src/components/InventoryManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { sortBOMByMaterialRule } from '../utils/materialSort';
import {
  loadAllMaterials,
  generatePartId,
  generateInventoryPartId,  // ✅ 추가
  generateRackOptionId,
  loadAdminPrices,
  getEffectivePrice,
  mapExtraToBaseInventoryPart  // ✅ 기타추가옵션 매핑
} from '../utils/unifiedPriceManager';
import {
  saveInventorySync,
  loadInventory,
  forceServerSync
} from '../utils/realtimeAdminSync';
import AdminPriceEditor from './AdminPriceEditor';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

// ✅ 규격 표시용 함수 추가 (x 유지)
function formatSpecification(str) {
  if (!str) return '-';

  // * → x 변환 (700*300 → 700x300)
  let formatted = String(str).replace(/\*/g, 'x');

  // 무게 라벨 변환도 적용
  formatted = kgLabelFix(formatted);

  return formatted;
}

// ✅ 재고 감소 함수 수정 (export 필요)
// ✅ 서버 기반 재고 감소 함수
// ✅ materialsOverride: cart에 bom이 없을 때(예: 청구서 생성 플로우) 원자재 배열로 재고 차감
export const deductInventoryOnPrint = async (cartItems, documentType = 'document', documentNumber = '', materialsOverride = null) => {
  if (!cartItems || !Array.isArray(cartItems)) {
    console.warn('재고 감소: 유효하지 않은 카트 데이터');
    return { success: false, message: '유효하지 않은 데이터' };
  }

  console.log(`📋 프린트 재고 감소 시작: ${documentType} ${documentNumber}`);
  console.log('📦 카트 아이템:', cartItems);
  if (materialsOverride && materialsOverride.length > 0) {
    console.log('📦 materialsOverride 사용 (BOM 대신):', materialsOverride.length, '개');
  }

  try {
    // ✅ 1. 서버에서 최신 재고 데이터 가져오기
    const { inventoryService } = await import('../services/InventoryService');
    const serverInventory = await inventoryService.getInventory();

    console.log('📦 서버 재고 데이터:', serverInventory);
    console.log('📦 서버 재고 항목 수:', Object.keys(serverInventory).length);

    const deductedParts = [];
    const warnings = [];
    const deductions = {}; // ✅ 감소량 수집용 객체

    // ✅ 2. 처리할 BOM/원자재 목록: materialsOverride 있으면 사용, 없으면 cartItems[].bom
    const bomItemsToProcess = (materialsOverride && Array.isArray(materialsOverride) && materialsOverride.length > 0)
      ? materialsOverride
      : cartItems.flatMap(item => (item.bom && Array.isArray(item.bom) ? item.bom : []));

    if (bomItemsToProcess.length === 0) {
      console.log('⚠️ 재고 감소할 BOM/원자재 없음');
      return {
        success: true,
        message: '재고 감소할 항목이 없습니다.',
        deductedParts: [],
        warnings: []
      };
    }

    console.log(`  📦 처리할 BOM/원자재 항목 수: ${bomItemsToProcess.length}`);

    bomItemsToProcess.forEach((bomItem, bomIndex) => {
      // ✅ 재고용 Part ID 생성 (기타추가옵션 매핑 고려)
      let inventoryPartId;

      // 1. BOM 아이템에 이미 inventoryPartId가 있으면 우선 사용
      if (bomItem.inventoryPartId) {
        inventoryPartId = bomItem.inventoryPartId;
        console.log(`    🔑 BOM에서 inventoryPartId 사용: "${inventoryPartId}"`);
      } else {
        // 2. 기타추가옵션인지 확인 (스텐랙의 경우)
        const rackType = bomItem.rackType || '';
        const name = bomItem.name || '';
        const spec = bomItem.specification || '';

        // 스텐랙 기타추가옵션 extraOptionId 생성
        let extraOptionId = null;
        if (rackType === '스텐랙') {
          const sizeMatch = name.match(/(\d+)x(\d+)/);
          // 기둥: "75(4개 1set)", "120(4개 1set)" 등
          const heightMatch = name.match(/^(\d+)/);
          if (sizeMatch) {
            // 선반: 스텐랙-50x120선반-
            extraOptionId = `${rackType}-${sizeMatch[0]}선반-`;
          } else if (heightMatch && (name.includes('기둥') || name.includes('set') || name.includes('('))) {
            // 기둥: 스텐랙-75기둥- 또는 스텐랙-75(4개 1set)-
            extraOptionId = `${rackType}-${heightMatch[1]}기둥-`;
          }
        } else if (rackType === '하이랙') {
          // 하이랙 기타추가옵션 extraOptionId 생성
          // ⚠️ 중요: 추가상품3은 name에 "(블루기둥)" 또는 "(메트그레이기둥)" 명시
          // 추가상품4 (메트그레이): 하이랙-60x108선반450kg-
          // 추가상품5 (블루+오렌지): 하이랙-60x108선반450kg- (같은 ID지만 색상 정보로 구분)
          const sizeMatch = name.match(/(\d+)x(\d+)/);
          const note = bomItem.note || '';
          const colorWeight = bomItem.colorWeight || '';

          // 추가상품3 (270kg 기둥추가): name에 "(블루기둥)" 또는 "(메트그레이기둥)" 명시
          if (name.includes('(블루기둥)') || name.includes('블루기둥')) {
            // 블루+오렌지 기둥
            if (sizeMatch && name.includes('기둥')) {
              extraOptionId = `${rackType}-${sizeMatch[0]}기둥-`;
            }
          } else if (name.includes('(메트그레이기둥)') || name.includes('메트그레이기둥') || name.includes('매트그레이기둥')) {
            // 메트그레이 기둥
            if (sizeMatch && name.includes('기둥')) {
              extraOptionId = `${rackType}-${sizeMatch[0]}메트그레이기둥-`;
            }
          } else if (sizeMatch && (name.includes('선반') || name.includes('기둥'))) {
            if (name.includes('450kg')) {
              // 추가상품4/5 (450kg): 색상 정보로 구분
              // 추가상품4는 메트그레이, 추가상품5는 블루+오렌지
              // note나 colorWeight에서 색상 정보 확인
              const isBlueOrange = note.includes('추가상품5') ||
                note.includes('블루+오렌지') ||
                note.includes('블루') && note.includes('오렌지') ||
                colorWeight.includes('블루') && colorWeight.includes('오렌지') ||
                name.includes('블루') && name.includes('오렌지');
              const isMetGray = note.includes('추가상품4') ||
                note.includes('메트그레이') ||
                note.includes('매트그레이') ||
                colorWeight.includes('메트그레이') ||
                colorWeight.includes('매트그레이') ||
                name.includes('메트그레이') ||
                name.includes('매트그레이');

              if (name.includes('선반')) {
                extraOptionId = `${rackType}-${sizeMatch[0]}선반450kg-`;
              } else if (name.includes('기둥')) {
                extraOptionId = `${rackType}-${sizeMatch[0]}기둥450kg-`;
              }
            } else if (name.includes('270kg') || name.includes('메트그레이') || name.includes('오렌지') || name.includes('매트그레이')) {
              // 추가상품1/2 (270kg 선반): 추가상품1은 메트그레이, 추가상품2는 오렌지
              if (name.includes('메트그레이') || name.includes('매트그레이')) {
                // 추가상품1 (메트그레이 선반)
                if (name.includes('선반') && sizeMatch) {
                  extraOptionId = `${rackType}-${sizeMatch[0]}매트그레이선반-`;
                }
              } else if (name.includes('오렌지')) {
                // 추가상품2 (오렌지 선반)
                if (name.includes('선반') && sizeMatch) {
                  extraOptionId = `${rackType}-${sizeMatch[0]}선반-`;
                }
              }
              // 추가상품3 (270kg 기둥) - 위에서 이미 처리됨
            } else if (name.includes('600kg') || (name.includes('블루') && name.includes('오렌지'))) {
              // 추가상품6 (600kg 블루+오렌지)
              if (sizeMatch && (name.includes('선반') || name.includes('빔'))) {
                extraOptionId = `${rackType}-${sizeMatch[0]}선반+빔-`;
              }
            }
          }
        }

        // 3. 기타추가옵션 매핑 확인
        if (extraOptionId) {
          // ⚠️ 하이랙 추가상품5 (블루+오렌지 450kg)는 매핑 테이블에 없으므로 색상 정보 확인
          const note = bomItem.note || '';
          const colorWeight = bomItem.colorWeight || '';
          const isBlueOrange450kg = (rackType === '하이랙' && extraOptionId.includes('450kg') &&
            (note.includes('추가상품5') ||
              note.includes('블루+오렌지') ||
              (note.includes('블루') && note.includes('오렌지')) ||
              (colorWeight.includes('블루') && colorWeight.includes('오렌지')) ||
              (name.includes('블루') && name.includes('오렌지'))));

          if (isBlueOrange450kg) {
            // 추가상품5 (블루+오렌지 450kg): 서버에 존재하는 ID 직접 생성
            const sizeMatch = name.match(/(\d+)x(\d+)/);
            if (sizeMatch) {
              if (name.includes('선반')) {
                // 하이랙-선반블루(기둥)+오렌지(가로대)(볼트식)450kg-사이즈60x108450kg
                const directSpec = `사이즈${sizeMatch[1]}x${sizeMatch[2]}450kg`;
                inventoryPartId = `하이랙-선반블루(기둥)+오렌지(가로대)(볼트식)450kg-${directSpec}`;
                console.log(`    🔗 추가상품5 블루+오렌지 선반 직접 생성: "${inventoryPartId}"`);
              } else if (name.includes('기둥')) {
                // 하이랙-기둥블루(기둥)+오렌지(가로대)(볼트식)450kg-높이150450kg
                const heightMatch = name.match(/(\d+)x(\d+)/);
                if (heightMatch) {
                  const directSpec = `높이${heightMatch[2]}450kg`;
                  inventoryPartId = `하이랙-기둥블루(기둥)+오렌지(가로대)(볼트식)450kg-${directSpec}`;
                  console.log(`    🔗 추가상품5 블루+오렌지 기둥 직접 생성: "${inventoryPartId}"`);
                }
              }
            }
          } else {
            // 매핑 테이블 확인
            // ⚠️ 하이랙 추가상품4 (메트그레이 450kg)는 매핑 테이블에 있음
            // 추가상품5는 위에서 이미 처리되었으므로, 여기서는 추가상품4 또는 기타 추가상품 처리
            const mappedId = mapExtraToBaseInventoryPart(extraOptionId);
            if (mappedId && mappedId !== extraOptionId) {
              inventoryPartId = mappedId;
              console.log(`    🔗 기타추가옵션 매핑: "${extraOptionId}" → "${inventoryPartId}"`);
            } else {
              // 매핑 없으면 일반 생성
              inventoryPartId = generateInventoryPartId({
                rackType: rackType,
                name: name,
                specification: spec,
                colorWeight: bomItem.colorWeight || ''
              });
            }
          }
        } else {
          // 일반 부품은 그대로 생성
          inventoryPartId = generateInventoryPartId({
            rackType: rackType,
            name: name,
            specification: spec,
            colorWeight: bomItem.colorWeight || ''
          });
        }
      }

      const requiredQty = Number(bomItem.quantity) || 0;
      const currentStock = Number(serverInventory[inventoryPartId]) || 0;

      console.log(`\n  📌 BOM ${bomIndex + 1}: ${bomItem.name}`);
      console.log(`    🔑 inventoryPartId: "${inventoryPartId}"`);
      console.log(`    📊 서버 재고: ${currentStock}개`);
      console.log(`    📈 필요 수량: ${requiredQty}개`);

      if (requiredQty > 0) {
        // ✅ 감소량만 수집 (절대값 계산 안 함)
        if (!deductions[inventoryPartId]) {
          deductions[inventoryPartId] = 0;
        }
        deductions[inventoryPartId] += requiredQty;

        // 부족 예상 체크 (서버에서도 체크하지만 미리 경고)
        if (currentStock < requiredQty) {
          warnings.push({
            partId: inventoryPartId,
            name: bomItem.name,
            specification: bomItem.specification || '',
            rackType: bomItem.rackType || '',
            required: requiredQty,
            available: currentStock,
            shortage: requiredQty - currentStock
          });
          console.log(`    ⚠️ 재고 부족 예상: ${currentStock} < ${requiredQty} (부족: ${requiredQty - currentStock}개)`);
        } else {
          console.log(`    ✅ 재고 충분: ${currentStock} >= ${requiredQty}`);
        }
      }
    });

    console.log('\n📊 수집된 감소량:', deductions);
    console.log('📊 수집된 감소량 항목 수:', Object.keys(deductions).length);

    if (Object.keys(deductions).length === 0) {
      console.log('⚠️ 재고 감소할 항목이 없습니다.');
      return {
        success: true,
        message: '재고 감소할 항목이 없습니다.',
        deductedParts: [],
        warnings: []
      };
    }

    // ✅ 3. 서버에 원자적 차감 요청 (Race Condition 방지)
    console.log('\n🚀 서버에 원자적 재고 차감 요청...');
    const response = await inventoryService.deductInventory(deductions, documentNumber);

    if (!response.success) {
      console.error('❌ 서버 재고 차감 실패:', response.error);
      throw new Error(response.error || '서버 재고 차감 실패');
    }

    console.log('✅ 서버 재고 차감 완료:', response.results);

    // ✅ 4. 로컬스토리지 업데이트 (서버 응답 기반)
    const localInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');
    Object.assign(localInventory, response.results);
    localStorage.setItem('inventory_data', JSON.stringify(localInventory));

    console.log('💾 로컬스토리지 재고 업데이트 완료');

    // ✅ 5. inventoryUpdated 이벤트 발생
    window.dispatchEvent(new CustomEvent('inventoryUpdated', {
      detail: { inventory: localInventory }
    }));

    // ✅ 6. 결과 정리
    for (const [partId, newQty] of Object.entries(response.results)) {
      const deducted = deductions[partId] || 0;
      const originalQty = (serverInventory[partId] || 0);

      deductedParts.push({
        partId,
        name: bomItemsToProcess.find(b => generateInventoryPartId(b) === partId || b.inventoryPartId === partId)?.name || partId,
        deducted,
        remainingStock: newQty,
        wasShortage: newQty === 0 && deducted > 0
      });
    }

    // ✅ 서버 경고 추가 (재고 부족)
    if (response.warnings && response.warnings.length > 0) {
      warnings.push(...response.warnings.map(w => ({
        partId: w.partId,
        name: w.partId,
        required: w.requested,
        available: w.available,
        shortage: w.requested - w.available
      })));
    }

    console.log('\n📊 재고 감소 완료:', {
      감소된부품: deductedParts.length,
      부족경고: warnings.length
    });

    return {
      success: true,
      message: '재고가 성공적으로 감소되었습니다.',
      deductedParts,
      warnings
    };

  } catch (error) {
    console.error('❌ 재고 감소 실패:', error);
    return {
      success: false,
      message: `재고 감소 실패: ${error.message}`,
      deductedParts: [],
      warnings: []
    };
  }
};

// 재고 감소 결과 사용자에게 표시
// ✅ 추가: showInventoryResult 함수 export
export const showInventoryResult = (result, documentType) => {
  if (!result) {
    console.warn('showInventoryResult: 결과 데이터 없음');
    return;
  }

  console.log('📊 재고 결과 표시:', result);

  let message = `📄 ${documentType} 출력 완료\n`;

  if (result.success) {
    message += `📦 재고 감소: ${result.deductedParts.length}개 부품 처리`;

    if (result.warnings.length > 0) {
      message += `\n⚠️ 재고 부족 경고: ${result.warnings.length}개 부품`;

      // 재고 부족 부품 상세 (최대 3개)
      const warningDetails = result.warnings.slice(0, 3).map(w =>
        `• ${w.name} (${w.specification || ''}): 필요 ${w.required}개, 가용 ${w.available}개`
      ).join('\n');

      message += '\n' + warningDetails;

      if (result.warnings.length > 3) {
        message += `\n• 외 ${result.warnings.length - 3}개 부품...`;
      }

      // ✅ 재고 부족 시 컴포넌트 표시 이벤트 발생
      message += '\n\n재고 부족 상세 정보를 확인하시겠습니까?';

      // 결과 표시 - 부족한 부품들 컴포넌트 표시
      if (window.confirm(message)) {
        // ✅ 부족한 부품들의 정보를 정리
        const shortageInfo = result.warnings.map(w => ({
          name: w.name,
          partId: w.partId || w.name,
          required: w.required,
          available: w.available,
          shortage: w.shortage || (w.required - w.available),
          rackType: w.rackType || '',
          specification: w.specification || ''
        }));

        console.log('📋 재고 부족 정보:', shortageInfo);

        // ✅ 재고 부족 컴포넌트 표시 이벤트 발생
        window.dispatchEvent(new CustomEvent('showShortageInventoryPanel', {
          detail: {
            shortageItems: shortageInfo,
            documentType: documentType,
            timestamp: Date.now()
          }
        }));

        // ✅ 로컬스토리지에도 저장 (백업용)
        localStorage.setItem('shortageInventoryData', JSON.stringify({
          shortageItems: shortageInfo,
          documentType: documentType,
          timestamp: Date.now()
        }));

        console.log('✅ 재고 부족 컴포넌트 표시 이벤트 발생');

        // ✅ 중요: 여기서 return하여 인쇄 팝업이 뜨지 않도록 함
        return;
      }
    } else {
      // 정상 완료는 간단히 alert
      alert(message);
    }

  } else {
    message += `❌ 재고 감소 실패: ${result.message}`;
    alert(message);
  }
};

const InventoryManager = ({ currentUser }) => {
  const [allMaterials, setAllMaterials] = useState([]);
  const [inventory, setInventory] = useState({});
  const [adminPrices, setAdminPrices] = useState({});
  const [rackOptions, setRackOptions] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyInUse, setShowOnlyInUse] = useState(false);
  const [showOnlyOutOfStock, setShowOnlyOutOfStock] = useState(false);
  const [selectedRackType, setSelectedRackType] = useState('');
  const [editingPart, setEditingPart] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: '', direction: '' });
  const [showAdminPriceEditor, setShowAdminPriceEditor] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);

  // 실시간 동기화 관련
  const [syncStatus, setSyncStatus] = useState('✅ 동기화됨');
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  // 일괄 작업 관련
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('inventory'); // ✅ 기본값을 'inventory'로 설정
  const [bulkValue, setBulkValue] = useState('');

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
    const initializeData = async () => {
      try {
        setSyncStatus('🔄 초기화 중...');

        await loadAllMaterialsData();
        await syncAndLoadInventoryData();  // ✅ 최초 1회만 서버 동기화
        loadAdminPricesData();
        await loadRackOptions();
        setupRealtimeListeners();

        setSyncStatus('✅ 초기화 완료');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error('❌ 초기화 실패:', error);
        setSyncStatus('❌ 초기화 오류');
      }
    };

    initializeData();
  }, []);

  // 실시간 동기화 리스너 설정
  const setupRealtimeListeners = () => {
    const handleInventoryUpdate = (event) => {
      console.log('📦 실시간 재고 업데이트:', event.detail);
      setSyncStatus('🔄 동기화 중...');
      loadInventoryData();
      setLastSyncTime(new Date());

      setTimeout(() => {
        setSyncStatus('✅ 동기화됨');
      }, 1000);
    };

    const handlePriceUpdate = (event) => {
      console.log('💰 실시간 단가 업데이트:', event.detail);
      setSyncStatus('🔄 동기화 중...');
      loadAdminPricesData();
      setLastSyncTime(new Date());

      setTimeout(() => {
        setSyncStatus('✅ 동기화됨');
      }, 1000);
    };

    const handleForceReload = () => {
      console.log('🔄 전체 데이터 강제 새로고침');
      loadAllData();
    };

    window.addEventListener('inventoryUpdated', handleInventoryUpdate);
    window.addEventListener('adminPricesUpdated', handlePriceUpdate);
    window.addEventListener('forceDataReload', handleForceReload);

    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
      window.removeEventListener('adminPricesUpdated', handlePriceUpdate);
      window.removeEventListener('forceDataReload', handleForceReload);
    };
  };

  // 전체 원자재 로드
  const loadAllMaterialsData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 InventoryManager: 전체 원자재 로드 시작');
      const materials = await loadAllMaterials();
      setAllMaterials(materials);
      console.log(`✅ InventoryManager: ${materials.length}개 원자재 로드 완료`);

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

  // 재고 데이터 로드 (서버에서 먼저 동기화)
  const loadInventoryData = () => {
    try {
      console.log('📦 로컬 재고 데이터 로드...');
      const data = loadInventory();
      setInventory(data);
      console.log(`✅ 재고 로드 완료: ${Object.keys(data).length}개`);
    } catch (error) {
      console.error('❌ 재고 로드 실패:', error);
      setInventory({});
    }
  };

  const syncAndLoadInventoryData = async () => {
    try {
      console.log('🔄 서버 동기화 중...');
      await forceServerSync();
      loadInventoryData();
    } catch (error) {
      console.error('❌ 서버 동기화 실패:', error);
      loadInventoryData(); // 실패해도 로컬 데이터는 로드
    }
  };

  // 관리자 단가 데이터 로드
  const loadAdminPricesData = () => {
    try {
      const data = loadAdminPrices();
      setAdminPrices(data);
      console.log(`💰 관리자 단가 로드: ${Object.keys(data).length}개 항목`);
    } catch (error) {
      console.error('❌ 관리자 단가 로드 실패:', error);
      setAdminPrices({});
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
      console.error('❌ 랙옵션 로드 실패:', error);
    }
  };

  // 전체 데이터 로드
  const loadAllData = async () => {
    setIsLoading(true);
    setSyncStatus('🔄 서버 동기화 중...');

    try {
      // ✅ 서버 동기화 먼저 실행
      console.log('🔄 전체 데이터 로드 시작 - 서버 동기화 중...');
      await forceServerSync();

      // ✅ 동기화 후 각 데이터 로드
      await Promise.all([
        loadAllMaterialsData(),
        loadInventoryData(),
        loadAdminPricesData()
      ]);

      setSyncStatus('✅ 동기화 완료');
      setLastSyncTime(new Date());
      console.log('✅ 전체 데이터 로드 완료');
    } catch (error) {
      console.error('❌ 데이터 로드 실패:', error);
      setSyncStatus('❌ 동기화 오류');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ 수정: 재고 수량 변경 (즉시 서버 저장, CSV partId 그대로 사용)
  const handleInventoryChange = async (material, newQuantity) => {
    // ✅ CSV partId를 그대로 사용
    const partId = material.partId;
    const quantity = Math.max(0, Number(newQuantity) || 0);

    setSyncStatus('📤 저장 중...');

    try {
      const userInfo = {
        username: currentUser?.username || 'admin',
        role: currentUser?.role || 'admin'
      };

      // ✅ 로컬스토리지에 먼저 저장
      const success = await saveInventorySync(partId, quantity, userInfo);

      if (success) {
        setInventory(prev => ({
          ...prev,
          [partId]: quantity
        }));

        // ✅ 즉시 서버에 저장 (재시도 로직 포함)
        const { inventoryService } = await import('../services/InventoryService');
        const currentInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');

        let serverSaveSuccess = false;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await inventoryService.updateInventory(currentInventory);
            serverSaveSuccess = true;
            setSyncStatus('✅ 서버 저장 완료');
            console.log(`✅ 서버 저장 성공 (시도 ${attempt}/${maxRetries})`);
            break;
          } catch (serverError) {
            console.error(`❌ 서버 저장 실패 (시도 ${attempt}/${maxRetries}):`, serverError);

            if (attempt < maxRetries) {
              // Exponential backoff: 1초, 2초, 4초
              const waitTime = Math.pow(2, attempt - 1) * 1000;
              setSyncStatus(`🔄 재시도 중... (${attempt}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              // 최종 실패
              setSyncStatus('❌ 서버 저장 실패 (재시도 초과)');
              console.error('❌ 서버 저장 최종 실패:', serverError);
            }
          }
        }

        if (!serverSaveSuccess) {
          setSyncStatus('⚠️ 로컬 저장됨 (서버 저장 실패)');
        }

        setLastSyncTime(new Date());
      } else {
        setSyncStatus('❌ 저장 실패');
      }
    } catch (error) {
      console.error('재고 저장 실패:', error);
      setSyncStatus('❌ 오류');
    }
  };

  // ✅ 빠른 재고 조정 함수 (즉시 서버 저장, CSV partId 그대로 사용)
  const adjustInventory = async (material, adjustment) => {
    // ✅ CSV partId를 그대로 사용
    const partId = material.partId;
    const currentQty = inventory[partId] || 0;
    const newQty = Math.max(0, currentQty + adjustment);

    setSyncStatus('📤 저장 중...');

    try {
      const userInfo = {
        username: currentUser?.username || 'admin',
        role: currentUser?.role || 'admin'
      };

      // ✅ 로컬스토리지에 먼저 저장
      const success = await saveInventorySync(partId, newQty, userInfo);

      if (success) {
        setInventory(prev => ({
          ...prev,
          [partId]: newQty
        }));

        // ✅ 즉시 서버에 저장 (재시도 로직 포함)
        const { inventoryService } = await import('../services/InventoryService');
        const currentInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');

        let serverSaveSuccess = false;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await inventoryService.updateInventory(currentInventory);
            serverSaveSuccess = true;
            setSyncStatus('✅ 서버 저장 완료');
            console.log(`✅ 서버 저장 성공 (시도 ${attempt}/${maxRetries})`);
            break;
          } catch (serverError) {
            console.error(`❌ 서버 저장 실패 (시도 ${attempt}/${maxRetries}):`, serverError);

            if (attempt < maxRetries) {
              // Exponential backoff: 1초, 2초, 4초
              const waitTime = Math.pow(2, attempt - 1) * 1000;
              setSyncStatus(`🔄 재시도 중... (${attempt}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              // 최종 실패
              setSyncStatus('❌ 서버 저장 실패 (재시도 초과)');
              console.error('❌ 서버 저장 최종 실패:', serverError);
            }
          }
        }

        if (!serverSaveSuccess) {
          setSyncStatus('⚠️ 로컬 저장됨 (서버 저장 실패)');
        }

        setLastSyncTime(new Date());
      } else {
        setSyncStatus('❌ 저장 실패');
      }
    } catch (error) {
      console.error('재고 조정 실패:', error);
      setSyncStatus('❌ 오류');
    }
  };

  // 서버에서 강제 동기화
  const handleForceSync = async () => {
    setSyncStatus('🔄 서버 동기화 중...');

    try {
      await forceServerSync();
      await loadAllData();
      setSyncStatus('✅ 서버 동기화 완료');
    } catch (error) {
      console.error('서버 동기화 실패:', error);
      setSyncStatus('❌ 동기화 실패');
    }
  };

  // 검색 및 필터링 로직
  useEffect(() => {
    let result = [...allMaterials];

    // 검색어 필터링
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(material => {
        const nameMatch = (material.name || '').toLowerCase().includes(searchLower);
        const specMatch = (material.specification || '').toLowerCase().includes(searchLower);
        const rackTypeMatch = (material.rackType || '').toLowerCase().includes(searchLower);
        const categoryMatch = material.categoryName && material.categoryName.toLowerCase().includes(searchLower);
        return nameMatch || specMatch || rackTypeMatch || categoryMatch;
      });
    }

    // 랙타입 필터링
    if (selectedRackType) {
      if (selectedRackType === '파렛트랙') {
        // 파렛트랙 구형만 (partId가 "파렛트랙-"으로 시작하고 "파렛트랙신형-"이 아닌 것)
        result = result.filter(material => {
          const partId = material.partId || '';
          return material.rackType === '파렛트랙' &&
            partId.startsWith('파렛트랙-') &&
            !partId.startsWith('파렛트랙신형-');
        });
      } else if (selectedRackType === '파렛트랙신형') {
        // 파렛트랙 신형만 (partId가 "파렛트랙신형-"으로 시작하는 것)
        result = result.filter(material => {
          const partId = material.partId || '';
          return partId.startsWith('파렛트랙신형-');
        });
      } else {
        // 기타 랙타입은 기존 로직
        result = result.filter(material => material.rackType === selectedRackType);
      }
    }

    // ✅ CSV partId 그대로 사용
    if (showOnlyInUse) {
      result = result.filter(material => {
        return (inventory[material.partId] || 0) > 0;
      });
    } else if (showOnlyOutOfStock) {
      result = result.filter(material => {
        return (inventory[material.partId] || 0) === 0;
      });
    }


    // 정렬
    if (sortConfig.field) {
      result.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.field) {
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
          case 'rackType':
            aValue = a.rackType || '';
            bValue = b.rackType || '';
            break;
          case 'quantity':
            // ✅ CSV partId 그대로 사용
            aValue = inventory[a.partId] || 0;
            bValue = inventory[b.partId] || 0;
            break;
          case 'price':
            aValue = getEffectivePrice(a);
            bValue = getEffectivePrice(b);
            break;
          default:
            return 0;
        }


        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredMaterials(result);
  }, [allMaterials, searchTerm, selectedRackType, showOnlyInUse, showOnlyOutOfStock, sortConfig, inventory]);

  // 정렬 처리
  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 체크박스 처리 (CSV partId 그대로 사용)
  const handleSelectAll = (checked) => {
    if (checked) {
      // ✅ CSV partId 그대로 사용
      const allIds = new Set(filteredMaterials.map(m => m.partId));
      setSelectedItems(allIds);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (material, checked) => {
    // ✅ CSV partId 그대로 사용
    const partId = material.partId;

    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(partId);
      } else {
        newSet.delete(partId);
      }
      return newSet;
    });
  };

  // 일괄 작업 처리 (즉시 서버 저장)
  const handleBulkAction = async () => {
    if (!bulkAction || selectedItems.size === 0) {
      alert('작업을 선택하고 항목을 체크해주세요.');
      return;
    }

    const selectedCount = selectedItems.size;

    if (!confirm(`선택된 ${selectedCount}개 항목에 ${bulkAction === 'inventory' ? '재고 설정' : '단가 설정'}을 적용하시겠습니까?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setSyncStatus('📤 저장 중...');

      // ✅ 일괄 작업: selectedItems에는 CSV partId가 들어있음
      for (const partId of selectedItems) {
        if (bulkAction === 'inventory') {
          const quantity = Math.max(0, Number(bulkValue) || 0);

          // ✅ CSV partId를 직접 사용하여 재고 업데이트
          const userInfo = {
            username: currentUser?.username || 'admin',
            role: currentUser?.role || 'admin'
          };

          await saveInventorySync(partId, quantity, userInfo);

          setInventory(prev => ({
            ...prev,
            [partId]: quantity
          }));
        }
      }

      // ✅ 일괄 작업 후 즉시 서버에 저장 (재시도 로직 포함)
      const { inventoryService } = await import('../services/InventoryService');
      const currentInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');

      let serverSaveSuccess = false;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await inventoryService.updateInventory(currentInventory);
          serverSaveSuccess = true;
          setSyncStatus('✅ 서버 저장 완료');
          console.log(`✅ 서버 저장 성공 (시도 ${attempt}/${maxRetries})`);
          break;
        } catch (serverError) {
          console.error(`❌ 서버 저장 실패 (시도 ${attempt}/${maxRetries}):`, serverError);

          if (attempt < maxRetries) {
            // Exponential backoff: 1초, 2초, 4초
            const waitTime = Math.pow(2, attempt - 1) * 1000;
            setSyncStatus(`🔄 재시도 중... (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // 최종 실패
            setSyncStatus('❌ 서버 저장 실패 (재시도 초과)');
            console.error('❌ 서버 저장 최종 실패:', serverError);
          }
        }
      }

      if (!serverSaveSuccess) {
        setSyncStatus('⚠️ 로컬 저장됨 (서버 저장 실패)');
      }

      alert(`${selectedCount}개 항목의 ${bulkAction === 'inventory' ? '재고' : '단가'}가 업데이트되었습니다.`);
      setSelectedItems(new Set());
      setBulkValue(''); // ✅ bulkAction은 유지 (기본값이므로)

    } catch (error) {
      console.error('일괄 작업 실패:', error);
      alert('일괄 작업 중 오류가 발생했습니다.');
      setSyncStatus('❌ 오류');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ CSV 내보내기 함수 (기존 exportInventory 함수 교체)
  const exportInventory = () => {
    try {
      const inventoryData = filteredMaterials.map(material => {
        const quantity = inventory[material.partId] || 0;
        const effectivePrice = getEffectivePrice(material);

        return {
          부품ID: material.partId,
          랙타입: material.rackType,
          부품명: material.name,
          규격: material.specification || '',
          재고수량: quantity,
          단가: effectivePrice,
          재고가치: quantity * effectivePrice,
          소스: material.source || '',
          카테고리: material.categoryName || ''
        };
      });

      // CSV 형식으로 변환
      const headers = ['부품ID', '랙타입', '부품명', '규격', '재고수량', '단가', '재고가치', '소스', '카테고리'];
      const csvRows = [];

      // 헤더 추가
      csvRows.push(headers.join(','));

      // 데이터 행 추가
      inventoryData.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // CSV 이스케이프 처리
          const stringValue = String(value || '');
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');

      // BOM 추가 (한글 깨짐 방지)
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

      const exportFileName = `재고현황_${new Date().toISOString().split('T')[0]}.csv`;

      // 다운로드
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', exportFileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ 재고 데이터 CSV 내보내기 완료: ${inventoryData.length}개 항목`);
      alert(`재고 데이터가 CSV 파일로 저장되었습니다.\n파일명: ${exportFileName}`);

    } catch (error) {
      console.error('재고 내보내기 실패:', error);
      alert('재고 내보내기에 실패했습니다.');
    }
  };


  // ✅ 수정: 재고 가치 계산 (CSV partId 그대로 사용)
  const getTotalInventoryValue = () => {
    return filteredMaterials.reduce((total, material) => {
      // ✅ CSV partId 그대로 사용
      const quantity = inventory[material.partId] || 0;
      const effectivePrice = getEffectivePrice(material);
      return total + (quantity * effectivePrice);
    }, 0);
  };

  // ✅ 수정: 부족한 재고 알림 (CSV partId 그대로 사용)
  const getLowStockItems = () => {
    return filteredMaterials.filter(material => {
      // ✅ CSV partId 그대로 사용
      const quantity = inventory[material.partId] || 0;
      return quantity <= 5;
    });
  };

  // 랙타입 목록 생성
  const uniqueRackTypes = [...new Set(allMaterials.map(m => m.rackType).filter(Boolean))];

  // ✅ 파렛트랙신형을 별도 랙타입으로 추가 (partId 기반)
  const hasPalletRackNew = allMaterials.some(m => {
    const partId = m.partId || '';
    return partId.startsWith('파렛트랙신형-');
  });

  // ✅ 랙타입 목록 정렬 및 파렛트랙신형 추가
  const sortedRackTypes = [...uniqueRackTypes].sort((a, b) => {
    // 파렛트랙 관련 순서: 파렛트랙 → 파렛트랙신형 → 파렛트랙 철판형
    const order = ['경량랙', '중량랙', '파렛트랙', '파렛트랙신형', '파렛트랙 철판형', '하이랙', '스텐랙'];
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  // 파렛트랙신형이 있으면 목록에 추가 (이미 있으면 중복 제거)
  const finalRackTypes = hasPalletRackNew && !sortedRackTypes.includes('파렛트랙신형')
    ? [...sortedRackTypes, '파렛트랙신형'].sort((a, b) => {
      const order = ['경량랙', '중량랙', '파렛트랙', '파렛트랙신형', '파렛트랙 철판형', '하이랙', '스텐랙'];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    })
    : sortedRackTypes;

  // ✅ 재고관리 탭에서만 표시용 랙타입 이름 변환 (파렛트랙 → 파렛트랙구형)
  const getDisplayRackTypeName = (rackType) => {
    if (rackType === '파렛트랙') {
      return '파렛트랙구형';
    }
    return rackType;
  };

  // ✅ 수정: 재고 수량 가져오기 (CSV partId 그대로 사용)
  const getInventoryQuantity = (material) => {
    // ✅ CSV partId를 그대로 사용 (inventory.json의 키와 일치)
    const partId = material.partId;
    const stockData = inventory[partId];

    if (typeof stockData === 'number') {
      return stockData;
    } else if (typeof stockData === 'object' && stockData !== null) {
      return Number(stockData.quantity) || 0;
    }
    return 0;
  };

  // 표시 가격 정보 가져오기
  const getDisplayPrice = (material) => {
    const effectivePrice = getEffectivePrice(material);
    // ✅ CSV partId 그대로 사용
    const hasAdminPrice = adminPrices[material.partId]?.price > 0;

    return {
      price: effectivePrice,
      isModified: hasAdminPrice
    };
  };

  return (
    <div className="inventory-manager">
      <div className="inventory-header">
        <div className="header-title">
          <h2>📦 재고관리 시스템</h2>
          <div className="sync-status">
            <span className="status">{syncStatus}</span>
            <small>마지막 동기화: {lastSyncTime.toLocaleTimeString()}</small>
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={handleForceSync}
            className="sync-btn"
            disabled={isLoading}
          >
            🔄 서버 동기화
          </button>
          <button onClick={exportInventory} className="export-btn">
            📤 재고 내보내기
          </button>
        </div>
      </div>

      {/* 재고 통계 */}
      <div className="inventory-stats">
        <div className="stat-card">
          <div className="stat-label">전체 부품 수</div>
          <div className="stat-value">{allMaterials.length.toLocaleString()}개</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">필터링된 부품</div>
          <div className="stat-value">{filteredMaterials.length.toLocaleString()}개</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">총 재고 가치</div>
          <div className="stat-value">{getTotalInventoryValue().toLocaleString()}원</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">부족한 재고</div>
          <div className="stat-value">{getLowStockItems().length}개</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="search-section">
        <div className="search-row">
          <input
            type="text"
            placeholder="부품명, 규격, 랙타입으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={selectedRackType}
            onChange={(e) => setSelectedRackType(e.target.value)}
            className="filter-select"
          >
            <option value="">모든 랙타입</option>
            {finalRackTypes.map(type => (
              <option key={type} value={type}>{getDisplayRackTypeName(type)}</option>
            ))}
          </select>
        </div>

        {/* ✅ 랙타입 버튼 필터 추가 (복원) */}
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginTop: '12px',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => setSelectedRackType('')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              border: selectedRackType === '' ? '2px solid #007bff' : '1px solid #ddd',
              backgroundColor: selectedRackType === '' ? '#007bff' : 'white',
              color: selectedRackType === '' ? 'white' : '#333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: selectedRackType === '' ? 'bold' : 'normal'
            }}
          >
            전체
          </button>
          {finalRackTypes.map(type => (
            <button
              key={type}
              onClick={() => setSelectedRackType(type)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: selectedRackType === type ? '2px solid #007bff' : '1px solid #ddd',
                backgroundColor: selectedRackType === type ? '#007bff' : 'white',
                color: selectedRackType === type ? 'white' : '#333',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: selectedRackType === type ? 'bold' : 'normal'
              }}
            >
              {getDisplayRackTypeName(type)}
            </button>
          ))}
        </div>

        <div className="filter-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showOnlyInUse}
              onChange={(e) => {
                setShowOnlyInUse(e.target.checked);
                if (e.target.checked) setShowOnlyOutOfStock(false);
              }}
            />
            재고가 있는 부품만 보기
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showOnlyOutOfStock}
              onChange={(e) => {
                setShowOnlyOutOfStock(e.target.checked);
                if (e.target.checked) setShowOnlyInUse(false);
              }}
            />
            재고가 없는 부품만 보기
          </label>

          <div className="search-stats">
            {filteredMaterials.length}개 부품 표시 (전체 {allMaterials.length}개)
          </div>
        </div>
      </div>

      {/* 일괄 작업 */}
      <div className="bulk-actions">
        <div className="bulk-controls">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="bulk-action-select"
          >
            <option value="inventory">재고 수량 설정</option>
          </select>

          <input
            type="number"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="설정할 값"
            className="bulk-value-input"
          />

          <button
            onClick={handleBulkAction}
            disabled={!bulkAction || selectedItems.size === 0 || !bulkValue}
            className="bulk-apply-btn"
          >
            선택된 {selectedItems.size}개에 적용
          </button>

          {/* ✅ 적용 버튼 추가 - 모든 변경사항을 서버에 저장 (재시도 로직 포함) */}
          <button
            onClick={async () => {
              setSyncStatus('📤 서버 저장 중...');

              const { inventoryService } = await import('../services/InventoryService');
              const currentInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');

              let serverSaveSuccess = false;
              const maxRetries = 3;

              for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                  await inventoryService.updateInventory(currentInventory);
                  serverSaveSuccess = true;
                  setSyncStatus('✅ 서버 저장 완료');
                  setLastSyncTime(new Date());
                  console.log(`✅ 서버 저장 성공 (시도 ${attempt}/${maxRetries})`);
                  alert('모든 재고 변경사항이 서버에 저장되었습니다.');
                  break;
                } catch (error) {
                  console.error(`❌ 서버 저장 실패 (시도 ${attempt}/${maxRetries}):`, error);

                  if (attempt < maxRetries) {
                    // Exponential backoff: 1초, 2초, 4초
                    const waitTime = Math.pow(2, attempt - 1) * 1000;
                    setSyncStatus(`🔄 재시도 중... (${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                  } else {
                    // 최종 실패
                    setSyncStatus('❌ 서버 저장 실패 (재시도 초과)');
                    console.error('❌ 서버 저장 최종 실패:', error);
                    alert('서버 저장 중 오류가 발생했습니다: ' + error.message + '\n재시도 횟수를 초과했습니다.');
                  }
                }
              }

              if (!serverSaveSuccess) {
                setSyncStatus('❌ 서버 저장 실패');
              }
            }}
            className="bulk-apply-btn"
            style={{
              backgroundColor: '#007bff',
              marginLeft: '10px',
              fontWeight: 'bold'
            }}
          >
            적용
          </button>
        </div>
      </div>

      <div className="sync-info-banner">
        🌐 재고 및 단가 변경사항은 모든 PC에서 실시간으로 동기화됩니다.
      </div>

      <div className="inventory-table-container">
        {isLoading ? (
          <div className="loading">데이터 로딩 중...</div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredMaterials.length && filteredMaterials.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="sortable"
                >
                  부품명 {sortConfig.field === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>규격</th>
                <th
                  onClick={() => handleSort('rackType')}
                  className="sortable"
                >
                  랙타입 {sortConfig.field === 'rackType' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('quantity')}
                  className="sortable"
                >
                  현재 재고 {sortConfig.field === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                {/* ✅ 빠른조정 컬럼 추가 (복원) */}
                <th>빠른조정</th>
                <th
                  onClick={() => handleSort('price')}
                  className="sortable"
                >
                  단가 {sortConfig.field === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>재고 가치</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material, index) => {
                // ✅ CSV partId 그대로 사용
                const partId = material.partId;
                const quantity = getInventoryQuantity(material);
                const { price, isModified } = getDisplayPrice(material);
                const totalValue = quantity * price;
                const isLowStock = quantity <= 5;
                const isEditing = editingPart === partId;

                return (
                  <tr key={material.partId || index} className={isLowStock ? 'low-stock' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(partId)}
                        onChange={(e) => handleSelectItem(material, e.target.checked)}
                      />
                    </td>
                    <td>
                      <div className="part-name">
                        {material.name}
                        {material.source && (
                          <span className="source-tag">{material.source}</span>
                        )}
                        {material.categoryName && (
                          <span className="category-tag">{material.categoryName}</span>
                        )}
                      </div>
                    </td>
                    <td>{formatSpecification(material.specification)}</td>
                    <td>
                      <span className="rack-type">{material.rackType}</span>
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleInventoryChange(material, editQuantity);
                              setEditingPart(null);
                            } else if (e.key === 'Escape') {
                              setEditingPart(null);
                            }
                          }}
                          onBlur={() => {
                            handleInventoryChange(material, editQuantity);
                            setEditingPart(null);
                          }}
                          className={`quantity-input ${isLowStock ? 'low-stock-input' : ''}`}
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingPart(partId);
                            setEditQuantity(quantity.toString());
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            backgroundColor: quantity === 0 ? '#dc3545' :
                              quantity < 100 ? '#ffc107' : '#28a745',
                            color: 'white',
                            display: 'inline-block',
                            minWidth: '50px'
                          }}
                        >
                          {quantity.toLocaleString()}개
                        </span>
                      )}
                      {isLowStock && <span className="low-stock-badge">부족</span>}
                    </td>
                    {/* ✅ 빠른조정 버튼들 추가 (복원) */}
                    <td>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => adjustInventory(material, -100)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #dc3545',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          -100
                        </button>
                        <button
                          onClick={() => adjustInventory(material, -50)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #dc3545',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          -50
                        </button>
                        <button
                          onClick={() => adjustInventory(material, -10)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #ffc107',
                            backgroundColor: '#ffc107',
                            color: 'white',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          -10
                        </button>
                        <button
                          onClick={() => adjustInventory(material, 10)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #28a745',
                            backgroundColor: '#28a745',
                            color: 'white',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          +10
                        </button>
                        <button
                          onClick={() => adjustInventory(material, 50)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #28a745',
                            backgroundColor: '#28a745',
                            color: 'white',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          +50
                        </button>
                        <button
                          onClick={() => adjustInventory(material, 100)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #17a2b8',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          +100
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="price-display">
                        <span className={`price ${isModified ? 'modified' : ''}`}>
                          {price.toLocaleString()}원
                        </span>
                        {isModified && <span className="modified-tag">수정됨</span>}
                      </div>
                    </td>
                    <td>
                      <span className="total-value">
                        {totalValue.toLocaleString()}원
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setEditingPrice({
                          ...material,
                          partId: partId  // ❌ 색상 포함된 재고용 ID
                        })}
                        className="edit-price-btn"
                      >
                        💰 단가수정
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 관리자 단가 편집기 */}
      {editingPrice && (
        <AdminPriceEditor
          part={editingPrice}
          onClose={() => setEditingPrice(null)}
          currentUser={currentUser}
        />
      )}

      <style jsx>{`
        .inventory-manager {
          padding: 20px;
          max-width: 1800px;
          margin: 0 auto;
        }

        .inventory-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e0e0e0;
        }

        .header-title h2 {
          margin: 0 0 5px 0;
          color: #333;
        }

        .sync-status {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .status {
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 4px;
          background: #e8f5e8;
          color: #2d5a2d;
          font-size: 14px;
        }

        .sync-status small {
          color: #666;
          font-size: 12px;
          margin-top: 2px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .sync-btn, .export-btn {
          padding: 10px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        }

        .export-btn {
          background: #28a745;
        }

        .sync-btn:hover:not(:disabled), .export-btn:hover {
          background: #0056b3;
        }

        .export-btn:hover {
          background: #218838;
        }

        .sync-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .inventory-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border-left: 4px solid #007bff;
        }

        .stat-card.warning {
          border-left-color: #dc3545;
        }

        .stat-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: bold;
          color: #333;
        }

        .search-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .search-row {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
        }

        .search-input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 16px;
        }

        .filter-select {
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 16px;
          min-width: 200px;
        }

        .filter-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #333;
        }

        .search-stats {
          font-size: 14px;
          color: #666;
        }

        .bulk-actions {
          background: #fff3cd;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 15px;
        }

        .bulk-controls {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .bulk-action-select, .bulk-value-input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .bulk-apply-btn {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }

        .bulk-apply-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .sync-info-banner {
          background: #d1ecf1;
          color: #0c5460;
          padding: 12px;
          border-radius: 6px;
          text-align: center;
          margin-bottom: 15px;
          font-size: 14px;
          font-weight: 500;
        }

        .inventory-table-container {
          overflow-x: auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .inventory-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1200px;
        }

        .inventory-table th {
          background: #f8f9fa;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          color: #333;
          border-bottom: 2px solid #dee2e6;
          position: sticky;
          top: 0;
        }

        .inventory-table input[type="checkbox"] {
          width: 20px;
          height: 20px;
          transform: scale(1.5);  /* 1.5배 확대 */
        }

        .inventory-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .inventory-table th.sortable:hover {
          background: #e9ecef;
        }

        .inventory-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #dee2e6;
        }

        .inventory-table tr:hover {
          background: #f8f9fa;
        }

        .inventory-table tr.low-stock {
          background: #fff5f5;
        }

        .part-name {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .source-tag, .category-tag {
          background: #e9ecef;
          color: #495057;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
        }

        .category-tag {
          background: #d1ecf1;
          color: #0c5460;
        }

        .rack-type {
          background: #007bff;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .quantity-input {
          width: 80px;
          padding: 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          text-align: center;
        }

        .quantity-input.low-stock-input {
          border-color: #dc3545;
          background: #fff5f5;
        }

        .low-stock-badge {
          background: #dc3545;
          color: white;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 10px;
          margin-left: 5px;
        }

        .price-display {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .price.modified {
          color: #28a745;
          font-weight: bold;
        }

        .modified-tag {
          background: #28a745;
          color: white;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 10px;
          margin-top: 2px;
        }

        .total-value {
          font-weight: bold;
          color: #495057;
        }

        .edit-price-btn {
          background: #ffc107;
          color: #212529;
          border: none;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
        }

        .edit-price-btn:hover {
          background: #e0a800;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
          font-size: 18px;
        }
      `}</style>
    </div>
  );
};

export default InventoryManager;
