import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  // public/data.json 비동기 fetch
  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('data.json 불러오기 실패:', err);
        setLoading(false);
      });
  }, []);

  // 모든 가능한 옵션 추출
  const allOptions = useMemo(() => {
    const options = { types: [] };
    if (!data?.products) return options;

    data.products.forEach(product => {
      if (!options.types.includes(product.type)) {
        options.types.push(product.type);
      }
    });

    return options;
  }, [data]);

  // 선택된 타입에 따른 가능한 옵션 조합
  const availableOptions = useMemo(() => {
    if (!data || !selectedType) return {};

    const options = {
      versions: [],
      colors: [],
      sizes: [],
      heights: [],
      levels: []
    };

    const productsOfType = data.products.filter(p => p.type === selectedType);

    productsOfType.forEach(product => {
      if (product.version && !options.versions.includes(product.version)) {
        options.versions.push(product.version);
      }
      if (product.color && !options.colors.includes(product.color)) {
        options.colors.push(product.color);
      }
      if (product.size && !options.sizes.includes(product.size)) {
        options.sizes.push(product.size);
      }
      if (product.height && !options.heights.includes(product.height)) {
        options.heights.push(product.height);
      }
      if (product.level && !options.levels.includes(product.level)) {
        options.levels.push(product.level);
      }
    });

    // EXTRA_OPTIONS 병합 (스텐랙/하이랙)
    if (['스텐랙', '하이랙'].includes(selectedType)) {
      const extraOptions = data.EXTRA_OPTIONS?.[selectedType] || {};
      Object.keys(extraOptions).forEach(key => {
        extraOptions[key].forEach(option => {
          if (!options[key].includes(option)) {
            options[key].push(option);
          }
        });
      });
    }

    return options;
  }, [data, selectedType]);

  const filteredOptions = useMemo(() => {
    if (!data || !selectedType) return {};

    const filtered = JSON.parse(JSON.stringify(availableOptions));
    const currentProducts = data.products.filter(p => p.type === selectedType);

    if (selectedOptions.version) {
      const versionProducts = currentProducts.filter(p => p.version === selectedOptions.version);
      ['colors', 'sizes', 'heights', 'levels'].forEach(key => {
        filtered[key] = Array.from(new Set(versionProducts.map(p => p[key]).filter(Boolean)));
      });
    }

    if (selectedOptions.color) {
      const colorProducts = currentProducts.filter(p => p.color === selectedOptions.color);
      ['sizes', 'heights', 'levels'].forEach(key => {
        filtered[key] = Array.from(new Set(colorProducts.map(p => p[key]).filter(Boolean)));
      });
    }

    if (selectedOptions.size) {
      const sizeProducts = currentProducts.filter(p => p.size === selectedOptions.size);
      ['heights', 'levels'].forEach(key => {
        filtered[key] = Array.from(new Set(sizeProducts.map(p => p[key]).filter(Boolean)));
      });
    }

    if (selectedOptions.height) {
      const heightProducts = currentProducts.filter(p => p.height === selectedOptions.height);
      filtered.levels = Array.from(new Set(heightProducts.map(p => p.level).filter(Boolean)));
    }

    return filtered;
  }, [data, selectedType, selectedOptions, availableOptions]);

  const isValidCombination = useMemo(() => {
    if (!data || !selectedType) return false;

    const { version, color, size, height, level } = selectedOptions;
    const products = data.products.filter(p => p.type === selectedType);

    return products.some(product => (
      product.version === version &&
      product.color === color &&
      product.size === size &&
      product.height === height &&
      product.level === level
    ));
  }, [data, selectedType, selectedOptions]);

  const price = useMemo(() => {
    if (isCustomPrice) return customPrice * quantity * (applyRate / 100);
    if (!data || !isValidCombination) return 0;

    const product = data.products.find(p => (
      p.type === selectedType &&
      p.version === selectedOptions.version &&
      p.color === selectedOptions.color &&
      p.size === selectedOptions.size &&
      p.height === selectedOptions.height &&
      p.level === selectedOptions.level
    ));

    return product ? product.price * quantity * (applyRate / 100) : 0;
  }, [data, selectedType, selectedOptions, quantity, applyRate, customPrice, isCustomPrice, isValidCombination]);

  const bom = useMemo(() => {
    if (!selectedType || !isValidCombination) return null;

    return BOMCalculator.calculateBOM({
      type: selectedType,
      ...selectedOptions
    });
  }, [selectedType, selectedOptions, isValidCombination]);

  const handleOptionChange = (optionName, value) => {
    setSelectedOptions(prev => {
      const newOptions = { ...prev, [optionName]: value };
      const optionHierarchy = ['type', 'version', 'color', 'size', 'height', 'level'];
      const changedIndex = optionHierarchy.indexOf(optionName);

      if (changedIndex >= 0) {
        for (let i = changedIndex + 1; i < optionHierarchy.length; i++) {
          newOptions[optionHierarchy[i]] = '';
        }
      }
      return newOptions;
    });

    if (optionName !== 'customPrice') {
      setIsCustomPrice(false);
    }
  };

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

    console.log('Added to cart:', cartItem);
    return cartItem;
  };

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
    addToCart,
    loading
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
