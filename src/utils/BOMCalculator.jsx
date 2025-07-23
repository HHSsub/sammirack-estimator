export class BOMCalculator {
  /**
   * 최종 BOM을 계산하는 메인 메소드
   * @param {string} productType - '스텐랙' 또는 '하이랙'
   * @param {object} selections - 사용자가 선택한 모든 옵션 (size, height, level, color 등)
   * @param {number} quantity - 사용자가 선택한 최종 수량 (예: 3개)
   * @returns {Array<object>} - { code, quantity, options } 형태의 부품 목록 배열
   */
  calculateBOM(productType, selections, quantity = 1) {
    // selections 객체가 없거나, 필수 선택값이 없으면 빈 배열 반환
    if (!selections || !productType) {
      return [];
    }

    let bomItems = [];
    switch (productType) {
      case '스텐랙':
        bomItems = this.calculateStainlessRackBOM(selections);
        break;
      case '하이랙':
        bomItems = this.calculateHighRackBOM(selections);
        break;
      default:
        return []; // 알려지지 않은 타입이면 빈 배열 반환
    }

    // 계산된 모든 부품의 수량에 최종 수량(quantity)을 곱해줌
    return bomItems.map(item => ({
      ...item,
      quantity: item.quantity * quantity,
    }));
  }

  /**
   * 스텐랙의 부품 목록을 계산 (수량 1개 기준)
   * @param {object} selections - 사용자 선택 옵션
   * @returns {Array<object>} - 부품 목록 배열
   */
  calculateStainlessRackBOM(selections) {
    const { size, height, level } = selections;
    // 필수 옵션이 없으면 계산 불가
    if (!size || !height || !level) return [];

    const components = [];
    const levelCount = parseInt(level.replace('단', ''), 10) || 0;

    // 부품 코드와 수량(1세트 기준)을 정의
    components.push({ code: 'upright_frame_st', quantity: 4, options: { height } });
    components.push({ code: 'shelf_st', quantity: levelCount, options: { size } });
    components.push({ code: 'bolt_set_st', quantity: 1, options: {} });

    // 수량이 0인 항목은 제외하고 반환
    return components.filter(item => item.quantity > 0);
  }

  /**
   * 하이랙의 부품 목록을 계산 (수량 1개 기준)
   * @param {object} selections - 사용자 선택 옵션
   * @returns {Array<object>} - 부품 목록 배열
   */
  calculateHighRackBOM(selections) {
    const { size, height, level, color } = selections;
    // 필수 옵션이 없으면 계산 불가
    if (!size || !height || !level || !color) return [];

    const components = [];
    const levelCount = parseInt(level.replace('단', ''), 10) || 0;
    const is700kg = color.includes('700kg');
    const is350kg = color.includes('350kg');

    if (is700kg) {
      // 700kg 파렛트랙 로직
      components.push({ code: 'upright_frame_hr_700', quantity: 2, options: { height } });
      components.push({ code: 'load_beam_hr_700', quantity: levelCount * 2, options: { size } });
      components.push({ code: 'safety_pin_hr', quantity: levelCount * 4, options: {} });
    } else {
      // 200kg 또는 350kg 일반 하이랙 로직
      const poleCode = is350kg ? 'upright_frame_hr_350' : 'upright_frame_hr_200';
      const shelfCode = is350kg ? 'shelf_hr_350' : 'shelf_hr_200';
      
      components.push({ code: poleCode, quantity: 4, options: { height } });
      components.push({ code: shelfCode, quantity: levelCount, options: { size } });
      components.push({ code: 'cross_beam_hr', quantity: levelCount * 2, options: { size } });
      components.push({ code: 'safety_pin_hr', quantity: levelCount * 4, options: {} });
    }

    // 수량이 0인 항목은 제외하고 반환
    return components.filter(item => item.quantity > 0);
  }
}
