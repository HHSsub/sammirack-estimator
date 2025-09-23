// src/utils/unifiedPriceManager.js
/**
 * 통합 단가 관리 시스템
 * 모든 컴포넌트에서 일관된 단가 관리를 위한 중앙화된 유틸리티
 * 
 * ✅ 수정사항:
 * 1. bom_data.json + data.json + extra_options.json 모든 원자재 포함
 * 2. getFallbackBOM에서 생성되는 하드웨어 부품들도 포함
 * 3. 2780 높이 등 추가 옵션들 누락 방지
 * 4. 앙카볼트 등 모든 원자재 단가 관리 가능
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
  
  // 관리자가 수정한 단가가 있으면 우선 사용
  if (adminPrices[partId]?.price > 0) {
    return adminPrices[partId].price;
  }
  
  // 아니면 기존 단가 사용
  return Number(item.unitPrice) || 0;
};

// 랙옵션 레지스트리 저장
export const saveRackOptionsRegistry = (registry) => {
  try {
    localStorage.setItem(RACK_OPTIONS_KEY, JSON.stringify(registry));
  } catch (error) {
    console.error('랙옵션 레지스트리 저장 실패:', error);
  }
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

// 특정 랙옵션의 컴포넌트 조회
export const getRackOptionComponents = (optionId) => {
  const registry = loadRackOptionsRegistry();
  return registry[optionId]?.components || [];
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

// 높이에서 숫자 추출
const parseHeightMm = (height) => {
  if (!height) return 0;
  const match = String(height).replace(/[^\d]/g, '');
  return Number(match) || 0;
};

// 수평/경사 브레싱 계산 로직
const calcBracingComponents = (rackType, size, height, formType, quantity = 1) => {
  if (rackType !== "파렛트랙" && rackType !== "파렛트랙 철판형") {
    return [];
  }

  const isConn = formType === "연결형";
  const heightMm = parseHeightMm(height);
  const qtyNum = Number(quantity) || 1;
  
  // 기본 계산
  const baseHeight = 1500;
  const heightStep = 500;
  const baseDiagonal = isConn ? 2 : 4;
  const additionalSteps = Math.max(0, Math.floor((heightMm - baseHeight) / heightStep));
  const additionalDiagonal = (isConn ? 1 : 2) * additionalSteps;
  const diagonal = (baseDiagonal + additionalDiagonal) * qtyNum;
  const horizontal = (isConn ? 2 : 4) * qtyNum;
  const anchor = (isConn ? 2 : 4) * qtyNum;
  
  // 브레싱볼트와 브러싱고무 계산
  const postQty = isConn ? 2 * qtyNum : 4 * qtyNum;
  const braceBolt = diagonal + horizontal;
  const rubber = postQty;

  const { d } = parseWD(size);
  const bracingSpec = d ? String(d) : "";

  return [
    {
      rackType,
      name: "수평브레싱",
      specification: bracingSpec,
      quantity: horizontal,
      unitPrice: 0,
      totalPrice: 0
    },
    {
      rackType,
      name: "경사브레싱", 
      specification: bracingSpec,
      quantity: diagonal,
      unitPrice: 0,
      totalPrice: 0
    },
    {
      rackType,
      name: "앙카볼트",
      specification: "",
      quantity: anchor,
      unitPrice: 0,
      totalPrice: 0
    },
    {
      rackType,
      name: "브레싱볼트",
      specification: "",
      quantity: braceBolt,
      unitPrice: 0,
      totalPrice: 0
    },
    {
      rackType,
      name: "브러싱고무",
      specification: "",
      quantity: rubber,
      unitPrice: 0,
      totalPrice: 0
    }
  ];
};

// 사이즈에서 W, D 파싱
const parseWD = (size = "") => {
  const match = String(size).replace(/\s+/g, "").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return match ? { w: Number(match[1]), d: Number(match[2]) } : { w: null, d: null };
};

// 안전핀 계산
const calcSafetyPins = (rackType, level, quantity = 1) => {
  if (rackType === "파렛트랙" || rackType === "파렛트랙 철판형") {
    return [{
      rackType,
      name: "안전핀(파렛트랙)",
      specification: "안전핀",
      quantity: 2 * level * 2 * quantity, // 레벨당 2개씩, 양쪽, 수량배수
      unitPrice: 0,
      totalPrice: 0
    }];
  }
  return [];
};

// ✅ 개선된 전체 원자재 목록 로드 (모든 소스 통합)
export const loadAllMaterials = async () => {
  try {
    console.log('🔄 전체 원자재 로드 시작...');
    
    // 1. 기본 데이터 로드
    const [bomResponse, dataResponse, extraResponse] = await Promise.all([
      fetch('./bom_data.json'),
      fetch('./data.json'), 
      fetch('./extra_options.json')
    ]);
    
    const bomData = await bomResponse.json();
    const dataJson = await dataResponse.json();
    const extraOptions = await extraResponse.json();
    
    const materials = new Map();
    const optionsRegistry = {};

    console.log('📁 데이터 파일 로드 완료');
    
    // 2. BOM 데이터에서 컴포넌트 추출 (기존 로직)
    console.log('🔍 BOM 데이터에서 원자재 추출 중...');
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

    // 3. ✅ data.json에서 추가 랙옵션들 탐색 (2780 높이 등)
    console.log('🔍 data.json에서 추가 랙옵션 탐색 중...');
    Object.keys(dataJson).forEach(rackType => {
      const rackData = dataJson[rackType];
      if (rackData && rackData["기본가격"]) {
        Object.keys(rackData["기본가격"]).forEach(formTypeOrColor => {
          Object.keys(rackData["기본가격"][formTypeOrColor]).forEach(size => {
            Object.keys(rackData["기본가격"][formTypeOrColor][size]).forEach(height => {
              Object.keys(rackData["기본가격"][formTypeOrColor][size][height]).forEach(level => {
                // data.json에만 있고 bom_data.json에 없는 옵션들 감지
                const bomExists = bomData[rackType]?.[size]?.[height]?.[level]?.[formTypeOrColor];
                
                if (!bomExists) {
                  console.log(`📋 data.json 전용 옵션 발견: ${rackType} ${size} ${height} ${level} ${formTypeOrColor}`);
                  
                  // getFallbackBOM 방식으로 부품 생성
                  const fallbackComponents = generateFallbackComponents(rackType, size, height, level, formTypeOrColor);
                  
                  const optionId = generateRackOptionId(rackType, size, height, level, formTypeOrColor);
                  const displayName = `${rackType} ${formTypeOrColor} ${size} ${height} ${level}`;
                  
                  optionsRegistry[optionId] = {
                    id: optionId,
                    rackType,
                    size,
                    height,
                    level,
                    formType: formTypeOrColor,
                    displayName,
                    components: fallbackComponents.map(comp => ({
                      ...comp,
                      partId: generatePartId(comp)
                    })),
                    source: 'data.json_fallback',
                    lastUpdated: new Date().toISOString()
                  };
                  
                  // 부품들 등록
                  fallbackComponents.forEach(component => {
                    const partId = generatePartId(component);
                    
                    if (!materials.has(partId)) {
                      materials.set(partId, {
                        partId,
                        rackType: component.rackType,
                        name: component.name,
                        specification: component.specification || '',
                        unitPrice: Number(component.unitPrice) || 0,
                        size, height, level, formType: formTypeOrColor,
                        usedInOptions: [],
                        source: 'fallback'
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
                }
              });
            });
          });
        });
      }
    });

    // 4. ✅ extra_options.json에서 추가 원자재들 탐색
    console.log('🔍 extra_options.json에서 추가 원자재 추출 중...');
    Object.keys(extraOptions).forEach(rackType => {
      const extraData = extraOptions[rackType];
      Object.keys(extraData).forEach(categoryName => {
        const items = extraData[categoryName];
        if (Array.isArray(items)) {
          items.forEach(item => {
            if (item.bom && Array.isArray(item.bom)) {
              item.bom.forEach(bomItem => {
                const partId = generatePartId({
                  rackType,
                  name: bomItem.name,
                  specification: bomItem.specification || ''
                });
                
                if (!materials.has(partId)) {
                  materials.set(partId, {
                    partId,
                    rackType,
                    name: bomItem.name,
                    specification: bomItem.specification || '',
                    unitPrice: 0, // extra_options는 기본적으로 단가 없음
                    usedInOptions: [],
                    source: 'extra_options'
                  });
                  
                  console.log(`➕ extra_options 원자재 추가: ${bomItem.name}`);
                }
              });
            }
          });
        }
      });
    });

    console.log(`✅ 원자재 로드 완료: 총 ${materials.size}개 원자재`);
    
    // 랙옵션 레지스트리 저장
    saveRackOptionsRegistry(optionsRegistry);
    
    return Array.from(materials.values());
  } catch (error) {
    console.error('❌ 전체 원자재 로드 실패:', error);
    return [];
  }
};

// ✅ Fallback 컴포넌트 생성 함수 (getFallbackBOM 로직 기반)
const generateFallbackComponents = (rackType, size, height, level, formType) => {
  const components = [];
  const qty = 1; // 기본 수량
  const { w, d } = parseWD(size);
  
  if (rackType === "파렛트랙" || rackType === "파렛트랙 철판형") {
    const lvl = parseLevel(level);
    const tieSpec = d != null ? String(d) : `규격 ${size}`;
    const loadSpec = w != null ? String(Math.floor(w / 100) * 100) : `규격 ${size}`;
    
    // 기본 컴포넌트들
    components.push(
      {
        rackType,
        name: `기둥(${height})`,
        specification: `높이 ${height}`,
        quantity: (formType === "연결형" ? 2 : 4) * qty,
        unitPrice: 0,
        totalPrice: 0
      },
      {
        rackType,
        name: `로드빔(${loadSpec})`,
        specification: loadSpec,
        quantity: 2 * lvl * qty,
        unitPrice: 0,
        totalPrice: 0
      }
    );
    
    // 파렛트랙 철판형인 경우 타이빔 대신 철판
    if (rackType === "파렛트랙 철판형") {
      const frontNumMatch = (size || "").match(/\d+/);
      const frontNum = frontNumMatch ? frontNumMatch[0] : size;
      
      // 선반 추가
      components.push({
        rackType,
        name: `선반(${frontNum.trim()})`,
        specification: `사이즈 ${size}`,
        quantity: lvl * qty, // 철판형은 레벨당 선반 1개
        unitPrice: 0,
        totalPrice: 0
      });
    } else {
      // 일반 파렛트랙인 경우 타이빔
      components.push({
        rackType,
        name: `타이빔(${tieSpec})`,
        specification: tieSpec,
        quantity: 4 * lvl * qty,
        unitPrice: 0,
        totalPrice: 0
      });
    }
    
    // 하드웨어 부품들 추가
    const hardwareComponents = calcBracingComponents(rackType, size, height, formType, qty);
    components.push(...hardwareComponents);
    
    // 안전핀 추가
    const safetyPins = calcSafetyPins(rackType, lvl, qty);
    components.push(...safetyPins);
  }
  
  return components;
};

// 레벨 파싱
const parseLevel = (levelStr) => {
  if (!levelStr) return 1;
  const match = String(levelStr).match(/(\d+)/);
  return match ? parseInt(match[1]) : 1;
};
