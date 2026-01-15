/**
 * BOM 표시명 생성 유틸리티
 * 원자재명세서 및 문서에서 사용할 부품명을 생성하는 함수들
 */

/**
 * colorWeight에서 색상 텍스트 추출
 * @param {string} colorWeight - colorWeight 문자열 (예: "메트그레이(볼트식)270kg")
 * @param {string} partName - 부품명 ("기둥", "선반", "로드빔")
 * @returns {string} 색상 텍스트 ("메트그레이", "블루", "오렌지" 등)
 */
export const extractColorFromColorWeight = (colorWeight, partName = '') => {
  if (!colorWeight) return '';
  
  if (colorWeight.includes('메트그레이') || colorWeight.includes('매트그레이')) {
    return '메트그레이';
  } else if (colorWeight.includes('블루') && colorWeight.includes('오렌지')) {
    // 블루+오렌지 조합인 경우 부품 종류에 따라 색상 결정
    if (partName === '기둥') {
      return '블루';
    } else if (partName === '선반' || partName === '로드빔') {
      return '오렌지';
    }
    // 기본값: 부품명이 없으면 빈 문자열 반환
    return '';
  } else if (colorWeight.includes('블루')) {
    return '블루';
  } else if (colorWeight.includes('오렌지')) {
    return '오렌지';
  }
  
  return '';
};

/**
 * 부품명에서 색상 정보 제거 (partId/inventoryPartId 생성용)
 * @param {string} partName - 색상이 포함된 부품명 (예: "메트그레이 기둥")
 * @returns {string} 색상이 제거된 부품명 (예: "기둥")
 */
export const removeColorFromPartName = (partName) => {
  if (!partName) return '';
  // "메트그레이 기둥" → "기둥", "오렌지 선반" → "선반"
  return partName.replace(/^(메트그레이|매트그레이|블루|오렌지)\s+/, '');
};

/**
 * cleanName에서 부품 종류 추출
 * @param {string} cleanName - 정제된 이름 (예: "45x150메트그레이기둥", "45x108선반")
 * @returns {string} 부품 종류 ("기둥", "선반", "로드빔" 또는 빈 문자열)
 */
export const extractPartNameFromCleanName = (cleanName) => {
  if (!cleanName) return '';
  
  if (cleanName.includes('기둥')) {
    return '기둥';
  } else if (cleanName.includes('선반')) {
    return '선반';
  } else if (cleanName.includes('로드빔') || cleanName.includes('빔')) {
    return '로드빔';
  }
  
  return '';
};

/**
 * 스텐랙 기타추가옵션 표시명 생성
 * @param {Object} opt - 추가옵션 객체
 * @returns {string} 표시명 (예: "50x90 선반")
 */
export const generateStainlessRackDisplayName = (opt) => {
  if (!opt) return '';
  
  // bom에 정확한 이름이 있으면 사용
  if (opt.bom && opt.bom.length > 0 && opt.bom[0].name) {
    return opt.bom[0].name;
  }
  
  // opt.name이 숫자만 있으면 부품 종류 추가
  if (opt.name && !opt.name.includes('선반') && !opt.name.includes('기둥')) {
    if (opt.name.match(/\d+x\d+/)) {
      return `${opt.name} 선반`;
    } else if (opt.name.match(/^\d+$/)) {
      return `${opt.name} 기둥`;
    }
  }
  
  // 기본값: opt.name 그대로 반환
  return opt.name || '';
};

/**
 * 하이랙 원자재명세서 부품명 생성 (색상 정보 포함)
 * @param {string} bomName - BOM 이름 (예: "선반", "기둥", "로드빔")
 * @param {string} colorWeight - colorWeight 문자열 (예: "메트그레이(볼트식)270kg")
 * @returns {string} 표시명 (예: "메트그레이 기둥", "블루 기둥", "오렌지 선반")
 */
export const generateHighRackDisplayName = (bomName, colorWeight) => {
  if (!bomName) return '';
  
  // 부품 종류 추출
  const partName = extractPartNameFromCleanName(bomName);
  if (!partName) return bomName; // 부품 종류를 찾을 수 없으면 원본 반환
  
  // 색상 추출
  const colorText = extractColorFromColorWeight(colorWeight, partName);
  
  if (colorText) {
    return `${colorText} ${partName}`;
  } else {
    return partName;
  }
};

/**
 * 하이랙 원자재명세서 부품명 생성 (cleanName 기반)
 * @param {string} cleanName - 정제된 이름 (예: "45x150메트그레이기둥")
 * @param {string} colorWeight - colorWeight 문자열 (예: "메트그레이(볼트식)270kg")
 * @returns {string} 표시명 (예: "메트그레이 기둥", "블루 기둥", "오렌지 선반")
 */
export const generateHighRackDisplayNameFromCleanName = (cleanName, colorWeight) => {
  if (!cleanName) return '';
  
  // 부품 종류 추출
  const partName = extractPartNameFromCleanName(cleanName);
  if (!partName) return cleanName; // 부품 종류를 찾을 수 없으면 원본 반환
  
  // 색상 추출
  const colorText = extractColorFromColorWeight(colorWeight, partName);
  
  if (colorText) {
    return `${colorText} ${partName}`;
  } else {
    return partName;
  }
};

/**
 * 하이랙 원자재명세서 부품명 생성 (baseName과 finalColorWeight 기반 - ProductContext.jsx에서 사용)
 * @param {string} baseName - 기본 부품명 (예: "기둥", "선반", "로드빔")
 * @param {string} finalColorWeight - colorWeight 문자열 (예: "메트그레이(볼트식)270kg")
 * @returns {string} 표시명 (예: "메트그레이 기둥", "블루 기둥", "오렌지 선반")
 */
export const generateHighRackDisplayNameFromBaseName = (baseName, finalColorWeight) => {
  // 하이랙: 색상 정보를 포함하여 "메트그레이 기둥", "블루 기둥", "오렌지 선반" 형식으로 생성
  if (baseName) {
    // colorWeight에서 색상 추출
    let colorText = '';
    if (finalColorWeight) {
      if (finalColorWeight.includes('메트그레이') || finalColorWeight.includes('매트그레이')) {
        colorText = '메트그레이';
      } else if (finalColorWeight.includes('블루') && finalColorWeight.includes('오렌지')) {
        // 블루+오렌지 조합인 경우 부품 종류에 따라 색상 결정
        if (baseName === '기둥') {
          colorText = '블루';
        } else if (baseName === '선반' || baseName === '로드빔') {
          colorText = '오렌지';
        }
      } else if (finalColorWeight.includes('블루')) {
        colorText = '블루';
      } else if (finalColorWeight.includes('오렌지')) {
        colorText = '오렌지';
      }
    }
    
    if (colorText) {
      return `${colorText} ${baseName}`;
    } else {
      return baseName;
    }
  }
  return '';
};

/**
 * BOM 표시명 생성 (통합 함수)
 * @param {string} rackType - 랙 타입 ("스텐랙", "하이랙" 등)
 * @param {Object} opt - 추가옵션 객체
 * @param {string} cleanName - 정제된 이름 (하이랙의 경우 필요)
 * @param {string} colorWeight - colorWeight 문자열 (하이랙의 경우 필요)
 * @returns {string} 표시명
 */
export const generateBOMDisplayName = (rackType, opt, cleanName = '', colorWeight = '') => {
  if (!rackType || !opt) return opt?.name || '';
  
  if (rackType === '스텐랙') {
    return generateStainlessRackDisplayName(opt);
  } else if (rackType === '하이랙') {
    return generateHighRackDisplayName(cleanName, colorWeight);
  }
  
  // 기본값: opt.name 그대로 반환
  return opt.name || '';
};

/**
 * 문서에서 extraOptions 표시명 생성 (extraProducts에서 이름 찾기)
 * @param {string} rackType - 랙 타입
 * @param {string|number} optId - 추가옵션 ID
 * @param {Object} extraProducts - extraProducts 객체
 * @returns {Object} { name: string, price: number } 또는 null
 */
export const getExtraOptionDisplayInfo = (rackType, optId, extraProducts) => {
  if (!rackType || !optId || !extraProducts) return null;
  
  const optIdStr = String(optId);
  let optName = '';
  let optPrice = 0;
  
  // extraProducts에서 해당 ID 찾기
  if (extraProducts[rackType]) {
    Object.values(extraProducts[rackType]).forEach(category => {
      if (Array.isArray(category)) {
        const found = category.find(o => String(o.id) === optIdStr);
        if (found) {
          optName = found.name || '';
          optPrice = found.price || 0;
          
          // ✅ 스텐랙: opt.name이 "50x90"만 있을 때 "50x90 선반" 형식으로 생성
          if (rackType === '스텐랙') {
            if (found.bom && found.bom.length > 0 && found.bom[0].name) {
              optName = found.bom[0].name;
            } else if (optName && !optName.includes('선반') && !optName.includes('기둥')) {
              if (optName.match(/\d+x\d+/)) {
                optName = `${optName} 선반`;
              } else if (optName.match(/^\d+$/)) {
                optName = `${optName} 기둥`;
              }
            }
          }
        }
      }
    });
  }
  
  if (optName) {
    return { name: optName, price: optPrice };
  }
  
  return null;
};

