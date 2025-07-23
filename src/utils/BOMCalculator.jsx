export class BOMCalculator {
  calculateBOM(productType, selections) {
    const { size, height, level, color } = selections;
    if (!size || !height || !level) return [];

    switch (productType) {
      case '스텐랙':
        return this.calculateStainlessRackBOM(selections);
      case '하이랙':
        return this.calculateHighRackBOM(selections);
      default:
        return [];
    }
  }

  calculateStainlessRackBOM(selections) {
    const components = [];
    const levelCount = parseInt(selections.level.replace('단', ''), 10);

    components.push({ code: 'upright_frame_st', quantity: 4, options: { height: selections.height } });
    components.push({ code: 'shelf_st', quantity: levelCount, options: { size: selections.size } });
    components.push({ code: 'bolt_set_st', quantity: 1, options: {} });

    return components;
  }

  calculateHighRackBOM(selections) {
    if (!selections.color) return [];

    const components = [];
    const levelCount = parseInt(selections.level.replace('단', ''), 10);
    const is700kg = selections.color.includes('700kg');
    const is350kg = selections.color.includes('350kg');

    if (is700kg) {
      components.push({ code: 'upright_frame_hr_700', quantity: 2, options: { height: selections.height } });
      components.push({ code: 'load_beam_hr_700', quantity: levelCount * 2, options: { size: selections.size } });
      components.push({ code: 'safety_pin_hr', quantity: levelCount * 4, options: {} });
    } else {
      const poleCode = is350kg ? 'upright_frame_hr_350' : 'upright_frame_hr_200';
      const shelfCode = is350kg ? 'shelf_hr_350' : 'shelf_hr_200';
      
      components.push({ code: poleCode, quantity: 4, options: { height: selections.height } });
      components.push({ code: shelfCode, quantity: levelCount, options: { size: selections.size } });
      components.push({ code: 'cross_beam_hr', quantity: levelCount * 2, options: { size: selections.size } });
      components.push({ code: 'safety_pin_hr', quantity: levelCount * 4, options: {} });
    }

    return components.filter(item => item.quantity > 0);
  }
}
