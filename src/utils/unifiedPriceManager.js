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
 * 5. 하이랙/스텐랙 기본 부품 추가
 * 6. 색상 제외한 부품 ID 생성
 * 7. extra_options 가격 자동 연동
 */

// 로컬스토리지 키
const ADMIN_PRICES_KEY = 'admin_edit_prices';
const PRICE_HISTORY_KEY = 'admin_price_history';
const INVENTORY_KEY = 'inventory_data';
const RACK_OPTIONS_KEY = 'rack_options_registry';
const EXTRA_OPTIONS_PRICES_KEY = 'extra_options_prices';

// ✅ 색상을 제외한 부품 고유 ID 생성 (규격+무게만 사용)
export const generatePartId = (item) => {
  const { rackType, name, specification } = item;
  
  // 이름에서 색상 관련 키워드 제거
  const nameWithoutColor = (name || '')
    .replace(/블루|메트그레이|오렌지|그레이|화이트/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // specification에서도 색상 제거
  const specWithoutColor = (specification || '')
    .replace(/블루|메트그레이|오렌지|그레이|화이트/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const cleanName = nameWithoutColor.replace(/[^\w가-힣]/g, '');
  const cleanSpec = specWithoutColor.replace(/[^\w가-힣]/g, '');
  
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

// ✅ extra_options 가격 로드
export const loadExtraOptionsPrices = () => {
  try {
    const stored = localStorage.getItem(EXTRA_OPTIONS_PRICES_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('extra_options 가격 로드 실패:', error);
    return {};
  }
};

// ✅ extra_options 가격 저장
export const saveExtraOptionsPrice = (optionId, price) => {
  try {
    const priceData = loadExtraOptionsPrices();
    
    if (price && price > 0) {
      priceData[optionId] = {
        price: Number(price),
        timestamp: new Date().toISOString()
      };
    } else {
      delete priceData[optionId];
    }
    
    localStorage.setItem(EXTRA_OPTIONS_PRICES_KEY, JSON.stringify(priceData));
    
    window.dispatchEvent(new CustomEvent('extraOptionsPriceChanged', { 
      detail: { optionId, price: Number(price) } 
    }));
    
    return true;
  } catch (error) {
    console.error('extra_options 가격 저장 실패:', error);
    return false;
  }
};

// ✅ 관련된 extra_options 가격 자동 업데이트
const updateRelatedExtraOptions = async (partInfo, newPrice) => {
  try {
    const response = await fetch('./extra_options.json');
    const extraOptions = await response.json();
    
    const { rackType, name, specification } = partInfo;
    
    Object.keys(extraOptions).forEach(type => {
      if (type !== rackType) return;
      
      Object.values(extraOptions[type]).forEach(categoryItems => {
        if (!Array.isArray(categoryItems)) return;
        
        categoryItems.forEach(option => {
          if (!option.bom || !Array.isArray(option.bom)) return;
          
          const hasMatchingPart = option.bom.some(bomItem => {
            const bomPartId = generatePartId({
              rackType,
              name: bomItem.name,
              specification: bomItem.specification || ''
            });
            const targetPartId = generatePartId({
              rackType,
              name,
              specification
            });
            return bomPartId === targetPartId;
          });
          
          if (hasMatchingPart) {
            saveExtraOptionsPrice(option.id, newPrice);
            console.log(`✅ extra_option "${option.id}" 가격이 ${newPrice}원으로 자동 업데이트되었습니다.`);
          }
        });
      });
    });
  } catch (error) {
    console.error('extra_options 자동 업데이트 실패:', error);
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
      delete priceData[partId];
    }

    localStorage.setItem(ADMIN_PRICES_KEY, JSON.stringify(priceData));
    
    // ✅ 관련된 모든 extra_options 가격도 동시 업데이트
    updateRelatedExtraOptions(partInfo, price);
    
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
  
  if (adminPrices[partId]?.price > 0) {
    return adminPrices[partId].price;
  }
  
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
  
  const baseHeight = 1500;
  const heightStep = 500;
  const baseDiagonal = isConn ? 2 : 4;
  const additionalSteps = Math.max(0, Math.floor((heightMm - baseHeight) / heightStep));
  const additionalDiagonal = (isConn ? 1 : 2) * additionalSteps;
  const diagonal = (baseDiagonal + additionalDiagonal) * qtyNum;
  const horizontal = (isConn ? 2 : 4) * qtyNum;
  const anchor = (isConn ? 2 : 4) * qtyNum;
  
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
      quantity: 2 * level * 2 * quantity,
      unitPrice: 0,
      totalPrice: 0
    }];
  }
  return [];
};

// ✅ 무게만 추출 (색상 제거)
const extractWeightOnly = (colorStr) => {
  if (!colorStr) return '';
  const match = String(colorStr).match(/(\d+kg)/);
  return match ? match[1] : '';
};

// ✅ 개선된 전체 원자재 목록 로드 (엑셀 기반 정확한 조합)
export const loadAllMaterials = async () => {
  try {
    console.log('🔄 전체 원자재 로드 시작...');
    
    const [bomResponse, dataResponse, extraResponse, excelResponse] = await Promise.all([
      fetch('./bom_data.json'),
      fetch('./data.json'), 
      fetch('./extra_options.json'),
      fetch('./sammirack_all_rackoptions.xlsx')
    ]);
    
    const bomData = await bomResponse.json();
    const dataJson = await dataResponse.json();
    const extraOptions = await extraResponse.json();
    const excelBuffer = await excelResponse.arrayBuffer();
    
    const materials = new Map();
    const optionsRegistry = {};

    console.log('📁 데이터 파일 로드 완료');
    
    // 1. BOM 데이터에서 컴포넌트 추출
    console.log('🔍 BOM 데이터에서 원자재 추출 중...');
    Object.keys(bomData).forEach(rackType => {
      const rackData = bomData[rackType];
      Object.keys(rackData).forEach(size => {
        Object.keys(rackData[size]).forEach(height => {
          Object.keys(rackData[size][height]).forEach(level => {
            Object.keys(rackData[size][height][level]).forEach(formType => {
              const productData = rackData[size][height][level][formType];
              const components = productData?.components || [];
              
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
                    usedInOptions: [],
                    source: 'bom_data'
                  });
                }
                
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

    // 2. data.json에서 추가 랙옵션들 탐색
    console.log('🔍 data.json에서 추가 랙옵션 탐색 중...');
    Object.keys(dataJson).forEach(rackType => {
      const rackData = dataJson[rackType];
      if (rackData && rackData["기본가격"]) {
        Object.keys(rackData["기본가격"]).forEach(formTypeOrColor => {
          Object.keys(rackData["기본가격"][formTypeOrColor]).forEach(size => {
            Object.keys(rackData["기본가격"][formTypeOrColor][size]).forEach(height => {
              Object.keys(rackData["기본가격"][formTypeOrColor][size][height]).forEach(level => {
                const bomExists = bomData[rackType]?.[size]?.[height]?.[level]?.[formTypeOrColor];
                
                if (!bomExists) {
                  console.log(`📋 data.json 전용 옵션 발견: ${rackType} ${size} ${height} ${level} ${formTypeOrColor}`);
                  
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

    // 3. 엑셀 기반 추가 fallback (bom/data 둘 다 없는 경우)
    console.log('📊 엑셀에서 추가 랙옵션 확인 중...');
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(excelBuffer);
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const dataRows = rows.slice(1);
      
      dataRows.forEach(row => {
        if (!row[1]) return;
        
        const rackType = row[1];
        let size, height, level, formType, color;
        
        if (rackType === '하이랙') {
          color = row[2];
          size = row[3];
          height = String(row[4]);
          level = row[5];
          formType = row[6];
        } else if (rackType === '스텐랙') {
          size = row[2];
          height = String(row[3]);
          level = row[4];
          formType = 'V1';
        } else {
          size = row[2];
          height = String(row[3]);
          level = row[4];
          formType = row[5] || row[4];
        }
        
        const bomExists = bomData[rackType]?.[size]?.[height]?.[level]?.[formType || color];
        const dataExists = dataJson[rackType]?.["기본가격"]?.[formType || color]?.[size]?.[height]?.[level];
        
        if (!bomExists && !dataExists) {
          const fallbackComponents = generateFallbackComponents(rackType, size, height, level, formType || color);
          
          const optionId = generateRackOptionId(rackType, size, height, level, formType || color);
          const displayName = `${rackType} ${formType || color} ${size} ${height} ${level}`;
          
          optionsRegistry[optionId] = {
            id: optionId,
            rackType,
            size,
            height,
            level,
            formType: formType || color,
            displayName,
            components: fallbackComponents.map(comp => ({
              ...comp,
              partId: generatePartId(comp)
            })),
            source: 'excel_fallback',
            lastUpdated: new Date().toISOString()
          };
          
          fallbackComponents.forEach(component => {
            const partId = generatePartId(component);
            
            if (!materials.has(partId)) {
              materials.set(partId, {
                partId,
                rackType: component.rackType,
                name: component.name,
                specification: component.specification || '',
                unitPrice: Number(component.unitPrice) || 0,
                usedInOptions: [],
                source: 'excel_fallback'
              });
            }
            
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

    // 4. extra_options 추가 (색상별 부품 제외 + 카테고리명 포함)
    console.log('🔍 extra_options.json에서 원자재 추출 중 (색상별 부품 제외)');
    
    const colorKeywords = ['블루', '메트그레이', '오렌지', '그레이', '화이트'];
    
    Object.keys(extraOptions).forEach(rackType => {
      const extraData = extraOptions[rackType];
      Object.keys(extraData).forEach(categoryName => {
        const items = extraData[categoryName];
        if (Array.isArray(items)) {
          items.forEach(item => {
            if (item.bom && Array.isArray(item.bom)) {
              item.bom.forEach(bomItem => {
                const bomItemName = bomItem.name || '';
                const hasColor = colorKeywords.some(keyword => bomItemName.includes(keyword));
                
                if (hasColor) {
                  console.log(`⏭️ 색상별 부품 스킵: ${bomItemName}`);
                  return;
                }
                
                // extra_options 부품은 카테고리명 포함
                const displayName = `${bomItem.name}_${categoryName}`;
                
                // 일반 partId와 구분되도록 별도 ID 생성
                const extraPartId = `extra-${rackType}-${bomItem.name}-${categoryName}`
                  .toLowerCase()
                  .replace(/[^\w가-힣-]/g, '');
                
                if (!materials.has(extraPartId)) {
                  materials.set(extraPartId, {
                    partId: extraPartId,
                    rackType,
                    name: displayName,
                    specification: bomItem.specification || categoryName,
                    unitPrice: Number(item.price) || 0,
                    usedInOptions: [],
                    source: 'extra_options',
                    extraOptionId: item.id,
                    categoryName: categoryName
                  });
                  console.log(`  ➕ ${displayName}`);
                }
              });
            }
          });
        }
      });
    });

    console.log(`✅ 원자재 로드 완료: 총 ${materials.size}개 원자재`);
    
    saveRackOptionsRegistry(optionsRegistry);
    
    return Array.from(materials.values());
  } catch (error) {
    console.error('❌ 전체 원자재 로드 실패:', error);
    return [];
  }
};

// Fallback 컴포넌트 생성 함수 (기존 로직 유지)
const generateFallbackComponents = (rackType, size, height, level, formType) => {
  const components = [];
  const qty = 1;
  const { w, d } = parseWD(size);
  
  if (rackType === "파렛트랙" || rackType === "파렛트랙 철판형") {
    const lvl = parseLevel(level);
    const tieSpec = d != null ? String(d) : `규격 ${size}`;
    const loadSpec = w != null ? String(Math.floor(w / 100) * 100) : `규격 ${size}`;
    
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
    
    if (rackType === "파렛트랙 철판형") {
      const frontNumMatch = (size || "").match(/\d+/);
      const frontNum = frontNumMatch ? frontNumMatch[0] : size;
      
      components.push({
        rackType,
        name: `선반(${frontNum.trim()})`,
        specification: `사이즈 ${size}`,
        quantity: lvl * qty,
        unitPrice: 0,
        totalPrice: 0
      });
    } else {
      components.push({
        rackType,
        name: `타이빔(${tieSpec})`,
        specification: tieSpec,
        quantity: 4 * lvl * qty,
        unitPrice: 0,
        totalPrice: 0
      });
    }
    
    const hardwareComponents = calcBracingComponents(rackType, size, height, formType, qty);
    components.push(...hardwareComponents);
    
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

    historyData[partId].unshift(newEntry);
    
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
