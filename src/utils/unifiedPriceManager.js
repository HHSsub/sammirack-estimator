/**
 * 통합 단가 관리 시스템
 * 모든 컴포넌트에서 일관된 단가 관리를 위한 중앙화된 유틸리티
 */

// 로컬스토리지 키
const ADMIN_PRICES_KEY = 'admin_edit_prices';
const PRICE_HISTORY_KEY = 'admin_price_history';
const INVENTORY_KEY = 'inventory_data';
const RACK_OPTIONS_KEY = 'rack_options_registry';

// 부품 고유 ID 생성 (모든 컴포넌트에서 동일한 로직 사용)
export const generatePartId = (item) => {
  const { rackType, name, specification } = item;
  const cleanName = (name || '').replace(/[^\w가-힣]/g, '');
  const cleanSpec = (specification || '').replace(/[^\w가-힣]/g, '');
  return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
};

// 랙옵션 고유 ID 생성
export const generateRackOptionId = (rackType, size, height, level, formType, color = '') => {
  const parts = [rackType, formType, size, height, level, color].filter(Boolean);
  return parts.join('-').replace(/[^\w가-힣-]/g, '').toLowerCase();
};

// 관리자 수정 단가 로드
export const loadAdminPrices = () => {
  try {
    const stored = localStorage.getItem(ADMIN_PRICES_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('관리자 단가 로드 실패:', error);
    return {};
  }
};

// 관리자 수정 단가 저장
export const saveAdminPrice = (partId, price, partInfo = {}) => {
  try {
    const priceData = loadAdminPrices();
    
    if (price && price > 0) {
      priceData[partId] = {
        price: Number(price),
        timestamp: new Date().toISOString(),
        account: 'admin',
        partInfo
      };
    } else {
      // 가격이 0이거나 null이면 삭제 (기본값 사용)
      delete priceData[partId];
    }

    localStorage.setItem(ADMIN_PRICES_KEY, JSON.stringify(priceData));
    
    // 전체 시스템에 변경 이벤트 발송
    window.dispatchEvent(new CustomEvent('adminPriceChanged', { 
      detail: { partId, price: Number(price), partInfo } 
    }));
    
    return true;
  } catch (error) {
    console.error('관리자 단가 저장 실패:', error);
    return false;
  }
};

// 실제 사용할 단가 계산 (우선순위: 관리자 수정 > 기존 단가)
export const getEffectivePrice = (item) => {
  const partId = generatePartId(item);
  const adminPrices = loadAdminPrices();
  const adminPrice = adminPrices[partId];
  
  // 관리자 수정 단가가 있으면 우선 사용
  if (adminPrice && adminPrice.price > 0) {
    return adminPrice.price;
  }
  
  // 기존 단가 사용
  return Number(item.unitPrice) || 0;
};

// 가격 변경 히스토리 로드
export const loadPriceHistory = (partId) => {
  try {
    const stored = localStorage.getItem(PRICE_HISTORY_KEY) || '{}';
    const historyData = JSON.parse(stored);
    return historyData[partId] || [];
  } catch (error) {
    console.error('가격 히스토리 로드 실패:', error);
    return [];
  }
};

// 가격 변경 히스토리 저장
export const savePriceHistory = (partId, oldPrice, newPrice, rackOption = '') => {
  try {
    const stored = localStorage.getItem(PRICE_HISTORY_KEY) || '{}';
    const historyData = JSON.parse(stored);
    
    if (!historyData[partId]) {
      historyData[partId] = [];
    }

    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      account: 'admin',
      oldPrice: Number(oldPrice),
      newPrice: Number(newPrice),
      rackOption
    };

    historyData[partId].unshift(newEntry); // 최신 순으로 정렬
    
    // 히스토리 최대 100개로 제한
    if (historyData[partId].length > 100) {
      historyData[partId] = historyData[partId].slice(0, 100);
    }

    localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(historyData));
    return true;
  } catch (error) {
    console.error('가격 히스토리 저장 실패:', error);
    return false;
  }
};

// 재고 데이터 로드
export const loadInventory = () => {
  try {
    const stored = localStorage.getItem(INVENTORY_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('재고 데이터 로드 실패:', error);
    return {};
  }
};

// 재고 데이터 저장
export const saveInventory = (inventoryData) => {
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventoryData));
    
    // 재고 변경 이벤트 발송
    window.dispatchEvent(new CustomEvent('inventoryChanged', { 
      detail: inventoryData 
    }));
    
    return true;
  } catch (error) {
    console.error('재고 데이터 저장 실패:', error);
    return false;
  }
};

// 특정 부품의 재고 조회
export const getPartInventory = (partId) => {
  const inventory = loadInventory();
  return Number(inventory[partId]) || 0;
};

// 랙옵션 레지스트리 로드
export const loadRackOptionsRegistry = () => {
  try {
    const stored = localStorage.getItem(RACK_OPTIONS_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('랙옵션 레지스트리 로드 실패:', error);
    return {};
  }
};

// 랙옵션 레지스트리 저장
export const saveRackOptionsRegistry = (registry) => {
  try {
    localStorage.setItem(RACK_OPTIONS_KEY, JSON.stringify(registry));
    return true;
  } catch (error) {
    console.error('랙옵션 레지스트리 저장 실패:', error);
    return false;
  }
};

// 랙옵션 등록
export const registerRackOption = (rackType, size, height, level, formType, color = '', components = []) => {
  try {
    const registry = loadRackOptionsRegistry();
    const optionId = generateRackOptionId(rackType, size, height, level, formType, color);
    
    const displayName = [rackType, formType, size, height, level, color]
      .filter(Boolean)
      .join(' ');
    
    registry[optionId] = {
      id: optionId,
      rackType,
      size,
      height,
      level,
      formType,
      color,
      displayName,
      components: components.map(comp => ({
        ...comp,
        partId: generatePartId({
          rackType,
          name: comp.name,
          specification: comp.specification || ''
        })
      })),
      lastUpdated: new Date().toISOString()
    };
    
    saveRackOptionsRegistry(registry);
    return optionId;
  } catch (error) {
    console.error('랙옵션 등록 실패:', error);
    return null;
  }
};

// 랙옵션에서 사용하는 부품 목록 조회
export const getPartsForRackOption = (optionId) => {
  const registry = loadRackOptionsRegistry();
  const option = registry[optionId];
  return option ? option.components || [] : [];
};

// 특정 부품을 사용하는 랙옵션들 조회
export const getRackOptionsUsingPart = (partId) => {
  const registry = loadRackOptionsRegistry();
  const usingOptions = [];
  
  Object.values(registry).forEach(option => {
    if (option.components && option.components.some(comp => comp.partId === partId)) {
      usingOptions.push(option);
    }
  });
  
  return usingOptions;
};

// 전체 원자재 목록 로드 (BOM 데이터 기반)
export const loadAllMaterials = async () => {
  try {
    const bomResponse = await fetch('./bom_data.json');
    const bomData = await bomResponse.json();
    
    const materials = new Map();
    const optionsRegistry = {};
    
    // BOM 데이터에서 모든 컴포넌트 추출
    Object.keys(bomData).forEach(rackType => {
      const rackData = bomData[rackType];
      Object.keys(rackData).forEach(size => {
        Object.keys(rackData[size]).forEach(height => {
          Object.keys(rackData[size][height]).forEach(level => {
            Object.keys(rackData[size][height][level]).forEach(formType => {
              const productData = rackData[size][height][level][formType];
              const components = productData?.components || [];
              
              // 랙옵션 등록
              const optionId = generateRackOptionId(rackType, size, height, level, formType);
              const displayName = `${rackType} ${formType} ${size} ${height} ${level}`;
              
              optionsRegistry[optionId] = {
                id: optionId,
                rackType,
                size,
                height,
                level,
                formType,
                displayName,
                components: components.map(comp => ({
                  ...comp,
                  partId: generatePartId({
                    rackType,
                    name: comp.name,
                    specification: comp.specification || ''
                  })
                })),
                lastUpdated: new Date().toISOString()
              };
              
              // 부품 등록
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
                    size, height, level, formType,
                    usedInOptions: []
                  });
                }
                
                // 사용 옵션 정보 추가
                const material = materials.get(partId);
                if (!material.usedInOptions.find(opt => opt.id === optionId)) {
                  material.usedInOptions.push({
                    id: optionId,
                    displayName
                  });
                }
              });
            });
          });
        });
      });
    });

    // 랙옵션 레지스트리 저장
    saveRackOptionsRegistry(optionsRegistry);
    
    return Array.from(materials.values());
  } catch (error) {
    console.error('전체 원자재 로드 실패:', error);
    return [];
  }
};

// 단가 정보가 누락된 부품들 찾기
export const findMissingPriceParts = async () => {
  const allMaterials = await loadAllMaterials();
  const adminPrices = loadAdminPrices();
  
  const missingParts = allMaterials.filter(material => {
    const effectivePrice = getEffectivePrice(material);
    return effectivePrice === 0;
  });
  
  return missingParts;
};

// 시스템 전체 데이터 내보내기 (백업용)
export const exportSystemData = () => {
  try {
    const systemData = {
      adminPrices: loadAdminPrices(),
      priceHistory: JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY) || '{}'),
      inventory: loadInventory(),
      rackOptions: loadRackOptionsRegistry(),
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(systemData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `sammirack_system_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('시스템 데이터 내보내기 실패:', error);
    return false;
  }
};

// 시스템 데이터 가져오기 (복원용)
export const importSystemData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const systemData = JSON.parse(e.target.result);
        
        // 데이터 유효성 검사
        if (!systemData.version || !systemData.exportDate) {
          throw new Error('유효하지 않은 백업 파일입니다.');
        }
        
        // 데이터 복원
        if (systemData.adminPrices) {
          localStorage.setItem(ADMIN_PRICES_KEY, JSON.stringify(systemData.adminPrices));
        }
        if (systemData.priceHistory) {
          localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(systemData.priceHistory));
        }
        if (systemData.inventory) {
          localStorage.setItem(INVENTORY_KEY, JSON.stringify(systemData.inventory));
        }
        if (systemData.rackOptions) {
          localStorage.setItem(RACK_OPTIONS_KEY, JSON.stringify(systemData.rackOptions));
        }
        
        // 전체 시스템에 변경 이벤트 발송
        window.dispatchEvent(new CustomEvent('systemDataRestored', { 
          detail: systemData 
        }));
        
        resolve(systemData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsText(file);
  });
};
