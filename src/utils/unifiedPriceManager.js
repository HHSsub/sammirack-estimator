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
 * 8. 파렛트랙-파렛트랙 철판형 기둥 공동 단가 관리 (같은 높이면 동시 수정)
 */

// 로컬스토리지 키
const ADMIN_PRICES_KEY = 'admin_edit_prices';
const PRICE_HISTORY_KEY = 'admin_price_history';
const INVENTORY_KEY = 'inventory_data';
const RACK_OPTIONS_KEY = 'rack_options_registry';
const EXTRA_OPTIONS_PRICES_KEY = 'extra_options_prices';


// ✅ 표준 partID 생성 함수 (전체 시스템에서 이것만 사용)
export const generatePartId = (item) => {
  if (!item) {
    console.warn('generatePartId: item이 undefined입니다');
    return 'unknown-part';
  }
  
  const { rackType = '', name = '', specification = '' } = item;
  
  // 1. 색상 키워드 제거
  const nameWithoutColor = String(name)
    .replace(/블루|메트그레이|오렌지|그레이|화이트/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const specWithoutColor = String(specification)
    .replace(/블루|메트그레이|오렌지|그레이|화이트/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 2. 특수문자 제거 (한글, 영문, 숫자만 남김)
  const cleanName = nameWithoutColor.replace(/[^\w가-힣]/g, '');
  const cleanSpec = specWithoutColor.replace(/[^\w가-힣]/g, '');
  const cleanRackType = String(rackType).replace(/[^\w가-힣]/g, '');
  
  // 3. 소문자 변환
  const partId = `${cleanRackType}-${cleanName}-${cleanSpec}`.toLowerCase();
  
  // 4. 디버깅용 로그 (필요시)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[partID 생성] ${rackType} ${name} ${specification} → ${partId}`);
  }
  
  return partId;
};

// ✅ 색상을 제외한 부품 고유 ID 생성 (규격+무게만 사용)
// export const generatePartId = (item) => {
//   const { rackType, name, specification } = item;
  
//   // 이름에서 색상 관련 키워드 제거
//   const nameWithoutColor = (name || '')
//     .replace(/블루|메트그레이|오렌지|그레이|화이트/g, '')
//     .replace(/\s+/g, ' ')
//     .trim();
  
//   // specification에서도 색상 제거
//   const specWithoutColor = (specification || '')
//     .replace(/블루|메트그레이|오렌지|그레이|화이트/g, '')
//     .replace(/\s+/g, ' ')
//     .trim();
  
//   const cleanName = nameWithoutColor.replace(/[^\w가-힣]/g, '');
//   const cleanSpec = specWithoutColor.replace(/[^\w가-힣]/g, '');
  
//   return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
// };

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
    const adminPrices = loadAdminPrices();
    
    Object.keys(extraOptions).forEach(type => {
      if (type !== rackType) return;
      
      Object.values(extraOptions[type]).forEach(categoryItems => {
        if (!Array.isArray(categoryItems)) return;
        
        categoryItems.forEach(option => {
          if (!option.bom || !Array.isArray(option.bom)) return;
          
          // ✅ 해당 추가옵션이 수정된 부품을 포함하는지 확인
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
            // ✅ 추가옵션의 모든 bom 부품 단가를 합산하여 전체 가격 계산
            let totalPrice = 0;
            let hasAllPrices = true;
            
            option.bom.forEach(bomItem => {
              const bomPartId = generatePartId({
                rackType,
                name: bomItem.name,
                specification: bomItem.specification || ''
              });
              
              const qty = Number(bomItem.qty) || 1;
              
              // 관리자가 수정한 단가 확인
              let partPrice = 0;
              if (adminPrices[bomPartId]?.price > 0) {
                partPrice = adminPrices[bomPartId].price;
              } else if (option.bom.length === 1) {
                // bom이 1개인 경우, 기본 option.price 사용
                partPrice = Number(option.price) / qty;
              } else {
                hasAllPrices = false;
              }
              
              totalPrice += partPrice * qty;
            });
            
            // ✅ 모든 부품의 단가가 설정되어 있으면 추가옵션 가격 업데이트
            if (hasAllPrices && totalPrice > 0) {
              saveExtraOptionsPrice(option.id, totalPrice);
              console.log(`✅ 추가옵션 "${option.id}" 가격이 ${totalPrice}원으로 재계산되어 업데이트되었습니다.`);
            }
          }
        });
      });
    });
  } catch (error) {
    console.error('extra_options 자동 업데이트 실패:', error);
  }
};

// ✅ 파렛트랙-파렛트랙 철판형 기둥 공동 단가 저장 헬퍼 함수
const savePalletRackPillarPrices = (partId, price, partInfo, priceData) => {
  const { rackType, name, specification } = partInfo;
  
  // 기둥이고 높이 정보가 있는 경우만 처리
  const isPillar = name && name.includes('기둥');
  const hasHeight = specification && specification.includes('높이');
  
  if (!isPillar || !hasHeight) {
    return; // 기둥이 아니면 공동 단가 관리 불필요
  }
  
  // 파렛트랙 계열인지 확인
  const isPalletRack = rackType === '파렛트랙';
  const isPalletRackIron = rackType === '파렛트랙 철판형';
  
  if (!isPalletRack && !isPalletRackIron) {
    return; // 파렛트랙 계열이 아니면 공동 단가 관리 불필요
  }
  
  // 현재 부품 저장
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
  
  // 공동 단가 관리: 다른 타입의 동일 높이 기둥도 같이 저장
  const counterpartRackType = isPalletRack ? '파렛트랙 철판형' : '파렛트랙';
  const counterpartPartId = generatePartId({
    rackType: counterpartRackType,
    name,
    specification
  });
  
  if (price && price > 0) {
    priceData[counterpartPartId] = {
      price: Number(price),
      timestamp: new Date().toISOString(),
      account: 'admin',
      partInfo: {
        ...partInfo,
        rackType: counterpartRackType
      }
    };
    console.log(`✅ 공동 단가 적용: ${counterpartRackType} ${name} ${specification} → ${price}원`);
  } else {
    delete priceData[counterpartPartId];
    console.log(`✅ 공동 단가 삭제: ${counterpartRackType} ${name} ${specification}`);
  }
};

// 관리자 수정 단가 저장
export const saveAdminPrice = (partId, price, partInfo = {}) => {
  try {
    const priceData = loadAdminPrices();
    
    // ✅ 파렛트랙-파렛트랙 철판형 기둥 공동 단가 관리
    savePalletRackPillarPrices(partId, price, partInfo, priceData);
    
    // 기본 저장 (파렛트랙 기둥이 아닌 경우)
    const { rackType, name, specification } = partInfo;
    const isPillar = name && name.includes('기둥');
    const hasHeight = specification && specification.includes('높이');
    const isPalletRackFamily = rackType === '파렛트랙' || rackType === '파렛트랙 철판형';
    
    // 파렛트랙 기둥이 아닌 경우에만 기본 저장 (위에서 이미 처리됨)
    if (!isPalletRackFamily || !isPillar || !hasHeight) {
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

// ✅ 완전 수정: 엑셀만 사용
export const loadAllMaterials = async () => {
  try {
    console.log('🔄 전체 원자재 로드 시작...');
    console.log('📋 단일 소스: sammirack_all_rackoptions.xlsx');
    
    const materials = new Map();
    
    // ✅ 엑셀 파일만 사용
    const excelResponse = await fetch('./sammirack_all_rackoptions.xlsx');
    if (!excelResponse.ok) {
      throw new Error(`엑셀 파일 로드 실패: ${excelResponse.status}`);
    }
    
    const excelBuffer = await excelResponse.arrayBuffer();
    
    // XLSX 라이브러리 동적 import
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(excelBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 엑셀 데이터: ${excelData.length}개 행 로드됨`);
    
    // 엑셀의 각 행을 부품으로 변환
    let validCount = 0;
    let skippedCount = 0;
    
    excelData.forEach((row, index) => {
      const rackType = String(row['랙타입'] || '').trim();
      const name = String(row['부품명'] || '').trim();
      const specification = String(row['규격'] || '').trim();
      const unitPrice = Number(row['단가']) || 0;
      const displayName = String(row['표시명'] || '').trim();
      const source = String(row['출처'] || '').trim();
      const categoryName = String(row['카테고리'] || '').trim();
      
      // 빈 행이나 유효하지 않은 데이터 스킵
      if (!rackType || !name) {
        skippedCount++;
        return;
      }
      
      // ✅ generatePartId로 정규화된 partId 생성
      const normalizedPartId = generatePartId({
        rackType,
        name,
        specification
      });
      
      // 중복 체크
      if (materials.has(normalizedPartId)) {
        console.warn(`⚠️ 중복 부품 발견: ${normalizedPartId} (행 ${index + 2})`);
        return;
      }
      
      materials.set(normalizedPartId, {
        partId: normalizedPartId,
        rackType,
        name,
        specification,
        unitPrice,
        displayName: displayName || `${rackType} ${name} ${specification}`.trim(),
        source: source || 'excel',
        categoryName: categoryName || '',
        note: ''
      });
      
      validCount++;
      
      // 디버깅: 처음 5개, 마지막 5개만 출력
      if (validCount <= 5 || validCount > excelData.length - 5) {
        console.log(`  ➕ [${validCount}] ${normalizedPartId}`);
      } else if (validCount === 6) {
        console.log(`  ... (중간 ${excelData.length - 10}개 생략)`);
      }
    });
    
    const finalMaterials = Array.from(materials.values());
    
    console.log(`\n✅ ===== 엑셀 기반 원자재 로드 완료 =====`);
    console.log(`📦 총 부품 수: ${finalMaterials.length}개`);
    console.log(`✅ 유효 부품: ${validCount}개`);
    console.log(`⏭️  스킵된 행: ${skippedCount}개`);
    
    // 랙타입별 통계
    const rackTypes = {};
    finalMaterials.forEach(m => {
      rackTypes[m.rackType] = (rackTypes[m.rackType] || 0) + 1;
    });
    
    console.log('\n🏷️ 랙타입별 부품 수:');
    Object.entries(rackTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}개`);
      });
    
    // ✅ 기존 재고 데이터와 호환성 확인
    const existingInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');
    const existingKeys = Object.keys(existingInventory);
    const newKeys = new Set(finalMaterials.map(m => m.partId));
    
    const missingInNew = existingKeys.filter(k => !newKeys.has(k));
    const matchCount = existingKeys.filter(k => newKeys.has(k)).length;
    
    console.log('\n🔍 기존 재고 데이터 호환성:');
    console.log(`   - 기존 재고 부품: ${existingKeys.length}개`);
    console.log(`   - 매칭: ${matchCount}개`);
    
    if (missingInNew.length > 0) {
      console.warn(`   ⚠️  엑셀에 없는 부품: ${missingInNew.length}개`);
      console.warn('   누락된 부품 (최대 10개):');
      missingInNew.slice(0, 10).forEach(k => {
        console.warn(`      - ${k}: ${existingInventory[k]}개`);
      });
      
      if (missingInNew.length > 10) {
        console.warn(`      ... 외 ${missingInNew.length - 10}개`);
      }
    } else {
      console.log('   ✅ 모든 기존 재고 부품이 엑셀에 존재합니다!');
    }
    
    return finalMaterials;
  } catch (error) {
    console.error('❌ 원자재 로드 실패:', error);
    console.error('스택:', error.stack);
    
    // 에러 상세 정보
    if (error.message.includes('fetch')) {
      console.error('💡 힌트: 엑셀 파일이 public/ 폴더에 있는지 확인하세요.');
    } else if (error.message.includes('XLSX')) {
      console.error('💡 힌트: xlsx 라이브러리가 설치되어 있는지 확인하세요.');
    }
    
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
