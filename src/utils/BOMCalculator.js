/**
 * BOM Calculator utility class
 * Calculates BOM components for different rack product types
 */
export class BOMCalculator {
  /**
   * Calculate Bill of Materials based on product type
   * @param {Object} product - The rack product configuration
   * @returns {Array<Object>} Array of BOM components
   */
  calculateBOM(product) {
    switch (product.type) {
      case '스텐랙':
        return this.calculateStainlessRackBOM(product);
      case '하이랙':
        if (product.color && product.color.includes('700kg')) {
          return this.calculateHighRackBOM(product, true);
        } else if (product.color && product.color.includes('350kg')) {
          return this.calculateHeavyDutyRackBOM(product);
        } else {
          return this.calculateLightweightRackBOM(product);
        }
      default:
        throw new Error(`Unknown product type: ${product.type}`);
    }
  }

  /**
   * Calculate BOM for lightweight rack type
   * @private
   * @param {Object} product - Rack product configuration
   * @returns {Array<Object>} Array of BOM components
   */
  calculateLightweightRackBOM(product) {
    const components = [];
    const levelCount = parseInt(product.levels.replace(/\D/g, ''));
    
    // Add poles
    components.push({
      name: '기둥',
      description: `기둥 세트 (${product.dimensions.height}cm)`,
      quantity: 4,
      unit: '개',
      unitPrice: this._getPolePrice(product),
      totalPrice: this._getPolePrice(product) * 4
    });

    // Add shelves
    components.push({
      name: '선반',
      description: `선반 (${product.dimensions.width}x${product.dimensions.length})`,
      quantity: levelCount,
      unit: '개',
      unitPrice: this._getShelfPrice(product),
      totalPrice: this._getShelfPrice(product) * levelCount
    });

    // Add horizontal beams
    components.push({
      name: '가로대',
      description: `가로대 세트 (${product.dimensions.length}cm)`,
      quantity: levelCount,
      unit: '세트',
      unitPrice: this._getBeamPrice(product),
      totalPrice: this._getBeamPrice(product) * levelCount
    });

    // Add bolts and fixation parts
    components.push({
      name: '고정볼트',
      description: '고정볼트 세트',
      quantity: 1,
      unit: '세트',
      unitPrice: this._getFixationPrice(product),
      totalPrice: this._getFixationPrice(product)
    });

    // Add extra shelves if configured
    if (product.extraShelves && product.extraShelves.quantity > 0) {
      components.push({
        name: '추가 선반',
        description: `추가 선반 (${product.extraShelves.size})`,
        quantity: product.extraShelves.quantity,
        unit: '개',
        unitPrice: this._getExtraShelfPrice(product),
        totalPrice: this._getExtraShelfPrice(product) * product.extraShelves.quantity
      });
    }

    // Add extra poles if configured
    if (product.extraPoles && product.extraPoles.quantity > 0) {
      components.push({
        name: '추가 기둥',
        description: `추가 기둥 세트 (${product.extraPoles.height}cm)`,
        quantity: product.extraPoles.quantity,
        unit: '세트',
        unitPrice: this._getExtraPolePrice(product),
        totalPrice: this._getExtraPolePrice(product) * product.extraPoles.quantity
      });
    }

    return components;
  }

  /**
   * Calculate BOM for heavy-duty rack type (350kg)
   * @private
   * @param {Object} product - Rack product configuration
   * @returns {Array<Object>} Array of BOM components
   */
  calculateHeavyDutyRackBOM(product) {
    const components = [];
    const levelCount = parseInt(product.levels.replace(/\D/g, ''));
    
    // Add reinforced poles
    components.push({
      name: '강화 기둥',
      description: `350kg용 강화 기둥 세트 (${product.dimensions.height}cm)`,
      quantity: 4,
      unit: '개',
      unitPrice: this._getPolePrice(product, '350kg'),
      totalPrice: this._getPolePrice(product, '350kg') * 4
    });

    // Add reinforced shelves
    components.push({
      name: '강화 선반',
      description: `350kg용 강화 선반 (${product.dimensions.width}x${product.dimensions.length})`,
      quantity: levelCount,
      unit: '개',
      unitPrice: this._getShelfPrice(product, '350kg'),
      totalPrice: this._getShelfPrice(product, '350kg') * levelCount
    });

    // Add reinforced horizontal beams
    components.push({
      name: '강화 가로대',
      description: `350kg용 강화 가로대 세트 (${product.dimensions.length}cm)`,
      quantity: levelCount,
      unit: '세트',
      unitPrice: this._getBeamPrice(product, '350kg'),
      totalPrice: this._getBeamPrice(product, '350kg') * levelCount
    });

    // Add special bolts and fixation parts
    components.push({
      name: '강화 고정볼트',
      description: '350kg용 강화 고정볼트 세트',
      quantity: 1,
      unit: '세트',
      unitPrice: this._getFixationPrice(product, '350kg'),
      totalPrice: this._getFixationPrice(product, '350kg')
    });

    // Add extra shelves if configured
    if (product.extraShelves && product.extraShelves.quantity > 0) {
      components.push({
        name: '추가 강화 선반',
        description: `추가 350kg용 강화 선반 (${product.extraShelves.size})`,
        quantity: product.extraShelves.quantity,
        unit: '개',
        unitPrice: this._getExtraShelfPrice(product, '350kg'),
        totalPrice: this._getExtraShelfPrice(product, '350kg') * product.extraShelves.quantity
      });
    }

    // Add extra poles if configured
    if (product.extraPoles && product.extraPoles.quantity > 0) {
      components.push({
        name: '추가 강화 기둥',
        description: `추가 350kg용 강화 기둥 세트 (${product.extraPoles.height}cm)`,
        quantity: product.extraPoles.quantity,
        unit: '세트',
        unitPrice: this._getExtraPolePrice(product, '350kg'),
        totalPrice: this._getExtraPolePrice(product, '350kg') * product.extraPoles.quantity
      });
    }

    return components;
  }

  /**
   * Calculate BOM for pallet rack (700kg high rack) type
   * @private
   * @param {Object} product - Rack product configuration
   * @returns {Array<Object>} Array of BOM components
   */
  calculateHighRackBOM(product, isPalletRack = false) {
    const components = [];
    const levelCount = parseInt(product.levels.replace(/\D/g, ''));
    
    if (isPalletRack) {
      // For 700kg pallet racks (special case)
      components.push({
        name: '블루 선반',
        description: `700kg용 블루 선반 (${product.dimensions.width}x${product.dimensions.length})`,
        quantity: levelCount,
        unit: '개',
        unitPrice: this._getPalletRackShelfPrice(product),
        totalPrice: this._getPalletRackShelfPrice(product) * levelCount
      });

      components.push({
        name: '오렌지 빔',
        description: `700kg용 오렌지 빔 세트 (${product.dimensions.length}cm)`,
        quantity: levelCount * 2,
        unit: '개',
        unitPrice: this._getPalletRackBeamPrice(product),
        totalPrice: this._getPalletRackBeamPrice(product) * levelCount * 2
      });

      components.push({
        name: '특수 고정장치',
        description: '700kg용 특수 고정장치 세트',
        quantity: 1,
        unit: '세트',
        unitPrice: this._getPalletRackFixationPrice(product),
        totalPrice: this._getPalletRackFixationPrice(product)
      });

      // Add extra levels if configured
      if (product.extraLevels && product.extraLevels > 0) {
        components.push({
          name: '추가 700kg 단',
          description: `추가 700kg 단 (${product.dimensions.width}x${product.dimensions.length})`,
          quantity: product.extraLevels,
          unit: '단',
          unitPrice: this._getExtra700kgLevelPrice(product),
          totalPrice: this._getExtra700kgLevelPrice(product) * product.extraLevels
        });
      }
    } else {
      // Regular high rack
      components.push({
        name: '기둥',
        description: `하이랙 기둥 세트 (${product.dimensions.height}cm)`,
        quantity: 4,
        unit: '개',
        unitPrice: this._getPolePrice(product),
        totalPrice: this._getPolePrice(product) * 4
      });

      components.push({
        name: '선반',
        description: `하이랙 선반 (${product.dimensions.width}x${product.dimensions.length})`,
        quantity: levelCount,
        unit: '개',
        unitPrice: this._getShelfPrice(product),
        totalPrice: this._getShelfPrice(product) * levelCount
      });

      components.push({
        name: '가로대',
        description: `하이랙 가로대 세트 (${product.dimensions.length}cm)`,
        quantity: levelCount,
        unit: '세트',
        unitPrice: this._getBeamPrice(product),
        totalPrice: this._getBeamPrice(product) * levelCount
      });

      components.push({
        name: '고정볼트',
        description: '하이랙 고정볼트 세트',
        quantity: 1,
        unit: '세트',
        unitPrice: this._getFixationPrice(product),
        totalPrice: this._getFixationPrice(product)
      });

      // Add extra shelves if configured
      if (product.extraShelves && product.extraShelves.quantity > 0) {
        components.push({
          name: '추가 선반',
          description: `추가 하이랙 선반 (${product.extraShelves.size})`,
          quantity: product.extraShelves.quantity,
          unit: '개',
          unitPrice: this._getExtraShelfPrice(product),
          totalPrice: this._getExtraShelfPrice(product) * product.extraShelves.quantity
        });
      }

      // Add extra poles if configured
      if (product.extraPoles && product.extraPoles.quantity > 0) {
        components.push({
          name: '추가 기둥',
          description: `추가 하이랙 기둥 세트 (${product.extraPoles.height}cm)`,
          quantity: product.extraPoles.quantity,
          unit: '세트',
          unitPrice: this._getExtraPolePrice(product),
          totalPrice: this._getExtraPolePrice(product) * product.extraPoles.quantity
        });
      }
    }

    return components;
  }

  /**
   * Calculate BOM for stainless rack type
   * @private
   * @param {Object} product - Rack product configuration
   * @returns {Array<Object>} Array of BOM components
   */
  calculateStainlessRackBOM(product) {
    const components = [];
    const levelCount = parseInt(product.levels.replace(/\D/g, ''));
    
    // Add stainless poles
    components.push({
      name: '스텐 기둥',
      description: `스텐 기둥 세트 (${product.dimensions.height}cm)`,
      quantity: 4,
      unit: '개',
      unitPrice: this._getStainlessPolePricePrice(product),
      totalPrice: this._getStainlessPolePricePrice(product) * 4
    });

    // Add stainless shelves
    components.push({
      name: '스텐 선반',
      description: `스텐 선반 (${product.dimensions.width}x${product.dimensions.length})`,
      quantity: levelCount,
      unit: '개',
      unitPrice: this._getStainlessShelfPrice(product),
      totalPrice: this._getStainlessShelfPrice(product) * levelCount
    });

    // Add fixation parts
    components.push({
      name: '고정 앵글',
      description: '스텐 랙용 고정 앵글 세트',
      quantity: 1,
      unit: '세트',
      unitPrice: this._getStainlessFixationPrice(product),
      totalPrice: this._getStainlessFixationPrice(product)
    });

    // Add extra shelves if configured
    if (product.extraShelves && product.extraShelves.quantity > 0) {
      components.push({
        name: '추가 스텐 선반',
        description: `추가 스텐 선반 (${product.extraShelves.size})`,
        quantity: product.extraShelves.quantity,
        unit: '개',
        unitPrice: this._getExtraStainlessShelfPrice(product),
        totalPrice: this._getExtraStainlessShelfPrice(product) * product.extraShelves.quantity
      });
    }

    // Add extra poles if configured
    if (product.extraPoles && product.extraPoles.quantity > 0) {
      components.push({
        name: '추가 스텐 기둥',
        description: `추가 스텐 기둥 세트 (${product.extraPoles.height}cm)`,
        quantity: product.extraPoles.quantity,
        unit: '세트',
        unitPrice: this._getExtraStainlessPolePrice(product),
        totalPrice: this._getExtraStainlessPolePrice(product) * product.extraPoles.quantity
      });
    }

    // Add version-specific adjustment if needed
    if (product.version) {
      components.push({
        name: '버전 옵션',
        description: `${product.version}`,
        quantity: 1,
        unit: '옵션',
        unitPrice: this._getVersionPrice(product),
        totalPrice: this._getVersionPrice(product)
      });
    }

    return components;
  }

  /**
   * Helper methods for price lookups
   * These would typically access the product pricing data
   * from a data source (like data.json)
   */

  _getPolePrice(product, type = 'standard') {
    // Placeholder - actual implementation would look up pole price from data
    return 25000;
  }

  _getShelfPrice(product, type = 'standard') {
    // Placeholder - actual implementation would look up shelf price from data
    return 30000;
  }

  _getBeamPrice(product, type = 'standard') {
    // Placeholder - actual implementation would look up beam price from data
    return 15000;
  }

  _getFixationPrice(product, type = 'standard') {
    // Placeholder - actual implementation would look up fixation price from data
    return 10000;
  }

  _getExtraShelfPrice(product, type = 'standard') {
    // Placeholder - actual implementation would look up extra shelf price from data
    return 35000;
  }

  _getExtraPolePrice(product, type = 'standard') {
    // Placeholder - actual implementation would look up extra pole price from data
    return 30000;
  }

  _getPalletRackShelfPrice(product) {
    // Placeholder - actual implementation would look up pallet rack shelf price from data
    return 150000;
  }

  _getPalletRackBeamPrice(product) {
    // Placeholder - actual implementation would look up pallet rack beam price from data
    return 75000;
  }

  _getPalletRackFixationPrice(product) {
    // Placeholder - actual implementation would look up pallet rack fixation price from data
    return 50000;
  }

  _getExtra700kgLevelPrice(product) {
    // Placeholder - actual implementation would look up extra 700kg level price from data
    return 200000;
  }

  _getStainlessPolePricePrice(product) {
    // Placeholder - actual implementation would look up stainless pole price from data
    return 35000;
  }

  _getStainlessShelfPrice(product) {
    // Placeholder - actual implementation would look up stainless shelf price from data
    return 50000;
  }

  _getStainlessFixationPrice(product) {
    // Placeholder - actual implementation would look up stainless fixation price from data
    return 15000;
  }

  _getExtraStainlessShelfPrice(product) {
    // Placeholder - actual implementation would look up extra stainless shelf price from data
    return 55000;
  }

  _getExtraStainlessPolePrice(product) {
    // Placeholder - actual implementation would look up extra stainless pole price from data
    return 40000;
  }

  _getVersionPrice(product) {
    // Placeholder - actual implementation would look up version price from data
    return 0; // Base version has no additional cost
  }
}