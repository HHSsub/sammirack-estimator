/**
 * BOM Calculator 유틸리티 클래스
 * 사용자가 선택한 옵션에 따라 부품의 종류와 '수량'을 계산합니다.
 * 이 클래스는 가격 정보에 관여하지 않습니다.
 */
export class BOMCalculator {
  /**
   * 제품 유형에 따라 BOM 계산을 분기합니다.
   * @param {string} productType - 예: '스텐랙'
   * @param {object} options - 예: { size: '50x75', height: '75', level: '4단', color: '...' }
   * @returns {Array<Object>} 부품 목록 배열 (이름, 수량 정보만 포함)
   */
  calculateBOM(productType, options) {
    if (!options.size || !options.height || !options.level) return [];

    switch (productType) {
      case '스텐랙':
        return this.calculateStainlessRackBOM(options);
      case '하이랙':
        return this.calculateHighRackBOM(options);
      default:
        return [];
    }
  }

  /**
   * 스텐랙의 BOM(부품 수량)을 계산합니다.
   */
  calculateStainlessRackBOM(options) {
    const components = [];
    const levelCount = parseInt(options.level.replace('단', ''), 10);

    components.push({ code: 'upright_frame_st', quantity: 4, options: { height: options.height } });
    components.push({ code: 'shelf_st', quantity: levelCount, options: { size: options.size } });
    components.push({ code: 'bolt_set_st', quantity: 1, options: {} });

    return components;
  }

  /**
   * 하이랙의 BOM(부품 수량)을 계산합니다.
   * 색상/타입 옵션에 따라 구성을 분기합니다.
   */
  calculateHighRackBOM(options) {
    if (!options.color) return []; // 하이랙은 색상/타입 선택이 필수

    const components = [];
    const levelCount = parseInt(options.level.replace('단', ''), 10);
    const is700kg = options.color.includes('700kg');
    const is350kg = options.color.includes('350kg');

    if (is700kg) {
      // 700kg 파렛트랙 구성
      components.push({ code: 'upright_frame_hr_700', quantity: 2, options: { height: options.height } }); // 파렛트랙은 보통 기둥 2개(독립형 기준)
      components.push({ code: 'load_beam_hr_700', quantity: levelCount * 2, options: { size: options.size } }); // 1단에 빔 2개
      components.push({ code: 'safety_pin_hr', quantity: levelCount * 4, options: {} }); // 빔 1개당 안전핀 2개
    } else {
      // 일반 하이랙 (200kg, 350kg) 구성
      const poleCode = is350kg ? 'upright_frame_hr_350' : 'upright_frame_hr_200';
      const shelfCode = is350kg ? 'shelf_hr_350' : 'shelf_hr_200';
      
      components.push({ code: poleCode, quantity: 4, options: { height: options.height } });
      components.push({ code: shelfCode, quantity: levelCount, options: { size: options.size } });
      components.push({ code: 'cross_beam_hr', quantity: levelCount * 2, options: { size: options.size } }); // 선반 1개당 가로대 2개
      components.push({ code: 'safety_pin_hr', quantity: levelCount * 4, options: {} });
    }

    return components;
  }
}
