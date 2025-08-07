import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import data from '../public/data.json';
import { BOMCalculator } from '../utils/BOMCalculator';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  
  // 모든 가능한 옵션 추출
  const allOptions = useMemo(() => {
    const options = { types: [] };
    
    data.products.forEach(product => {
      if (!options.types.includes(product.type)) {
        options.types.push(product.type);
      }
    });
    
    return options;
  }, []);

  // 선택된 타입에 따른 가능한 옵션 조합
  const availableOptions = useMemo(() => {
    if (!selectedType) return {};
    
    const options = {
      versions: [],
      colors: [],
      sizes: [],
      heights: [],
      levels: []
    };
    
    const productsOfType = data.products.filter(p => p.type === selectedType);
    
    productsOfType.forEach(product => {
      // 버전 옵션
      if (product.version && !options.versions.includes(product.version)) {
        options.versions.push(product.version);
      }
      
      // 색상 옵션
      if (product.color && !options.colors.includes(product.color)) {
        options.colors.push(product.color);
      }
      
      // 사이즈 옵션
      if (product.size && !options.sizes.includes(product.size)) {
        options.sizes.push(product.size);
      }
      
      // 높이 옵션
      if (product.height && !options.heights.includes(product.height)) {
        options.heights.push(product.height);
      }
      
      // 단수 옵션
      if (product.level && !options.levels.includes(product.level)) {
        options.levels.push(product.level);
      }
    });
    
    // EXTRA_OPTIONS 병합 (스텐랙/하이랙에만 적용)
    if (['스텐랙', '하이랙'].includes(selectedType)) {
      const extraOptions = data.EXTRA_OPTIONS[selectedType] || {};
      
      Object.keys(extraOptions).forEach(key => {
        extraOptions[key].forEach(option => {
          if (!options[key].includes(option)) {
            options[key].push(option);
          }
        });
      });
    }
    
    return options;
  }, [selectedType]);

  // 현재 선택된 옵션에 따른 필터링된 옵션
  const filteredOptions = useMemo(() => {
    if (!selectedType) return {};
    
    const filtered = JSON.parse(JSON.stringify(availableOptions));
    const currentProducts = data.products.filter(p => p.type === selectedType);
    
    // 버전에 따라 필터링
    if (selectedOptions.version) {
      const versionProducts = currentProducts.filter(p => p.version === selectedOptions.version);
      
      ['colors', 'sizes', 'heights', 'levels'].forEach(key => {
        filtered[key] = Array.from(new Set(versionProducts.map(p => p[key]).filter(Boolean)));
      });
    }
    
    // 색상에 따라 필터링 (하이랙)
    if (selectedOptions.color) {
      const colorProducts = currentProducts.filter(p => p.color === selectedOptions.color);
      
      ['sizes', 'heights', 'levels'].forEach(key => {
        filtered[key] = Array.from(new Set(colorProducts.map(p => p[key]).filter(Boolean)));
      });
    }
    
    // 사이즈에 따라 필터링
    if (selectedOptions.size) {
      const sizeProducts = currentProducts.filter(p => p.size === selectedOptions.size);
      
      ['heights', 'levels'].forEach(key => {
        filtered[key] = Array.from(new Set(sizeProducts.map(p => p[key]).filter(Boolean)));
      });
    }
    
    // 높이에 따라 필터링
    if (selectedOptions.height) {
      const heightProducts = currentProducts.filter(p => p.height === selectedOptions.height);
      
      filtered.levels = Array.from(new Set(heightProducts.map(p => p.level).filter(Boolean)));
    }
    
    return filtered;
  }, [selectedType, selectedOptions, availableOptions]);

  // 현재 선택된 옵션 조합이 유효한지 확인
  const isValidCombination = useMemo(() => {
    if (!selectedType) return false;
    
    const { version, color, size, height, level } = selectedOptions;
    const products = data.products.filter(p => p.type === selectedType);
    
    return products.some(product => (
      product.version === version &&
      product.color === color &&
      product.size === size &&
      product.height === height &&
      product.level === level
    ));
  }, [selectedType, selectedOptions]);

  // 가격 계산
  const price = useMemo(() => {
    if (isCustomPrice) return customPrice * quantity * (applyRate / 100);
    
    if (!isValidCombination) return 0;
    
    const product = data.products.find(p => (
      p.type === selectedType &&
      p.version === selectedOptions.version &&
      p.color === selectedOptions.color &&
      p.size === selectedOptions.size &&
      p.height === selectedOptions.height &&
      p.level === selectedOptions.level
    ));
    
    return product ? product.price * quantity * (applyRate / 100) : 0;
  }, [selectedType, selectedOptions, quantity, applyRate, customPrice, isCustomPrice, isValidCombination]);

  // BOM 계산
  const bom = useMemo(() => {
    if (!selectedType || !isValidCombination) return null;
    
    return BOMCalculator.calculateBOM({
      type: selectedType,
      ...selectedOptions
    });
  }, [selectedType, selectedOptions, isValidCombination]);

  // 옵션 선택 핸들러
  const handleOptionChange = (optionName, value) => {
    setSelectedOptions(prev => {
      const newOptions = { ...prev, [optionName]: value };
      
      // 상위 옵션이 변경되면 하위 옵션 초기화
      const optionHierarchy = ['type', 'version', 'color', 'size', 'height', 'level'];
      const changedIndex = optionHierarchy.indexOf(optionName);
      
      if (changedIndex >= 0) {
        for (let i = changedIndex + 1; i < optionHierarchy.length; i++) {
          newOptions[optionHierarchy[i]] = '';
        }
      }
      
      return newOptions;
    });
    
    // 사용자 정의 가격 모드 해제 (새 옵션 선택 시)
    if (optionName !== 'customPrice') {
      setIsCustomPrice(false);
    }
  };

  // 장바구니 추가
  const addToCart = () => {
    const cartItem = {
      type: selectedType,
      options: { ...selectedOptions },
      quantity,
      applyRate,
      price,
      isCustomPrice,
      bom,
      timestamp: Date.now()
    };
    
    // 여기서는 콘솔에 출력하지만 실제로는 상태 또는 API에 저장
    console.log('Added to cart:', cartItem);
    return cartItem;
  };

  // 컨텍스트 값
  const value = {
    allOptions,
    availableOptions,
    filteredOptions,
    selectedType,
    selectedOptions,
    setSelectedType: (type) => handleOptionChange('type', type),
    handleOptionChange,
    quantity,
    setQuantity,
    applyRate,
    setApplyRate,
    customPrice,
    setCustomPrice,
    isCustomPrice,
    setIsCustomPrice,
    isValidCombination,
    price,
    bom,
    addToCart
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProduct = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProduct must be used within a ProductProvider');
  }
  return context;
};
