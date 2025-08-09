import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  // 상태 관리
  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [filteredOptions, setFilteredOptions] = useState({});
  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);

  // 데이터 로드 (./data.json 경로 사용)
  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsRes, bomRes] = await Promise.all([
          fetch('./data.json'),
          fetch('./bom_data.json')
        ]);
        
        if (!productsRes.ok || !bomRes.ok) throw new Error('데이터 로드 실패');

        const [productsData, bomData] = await Promise.all([
          productsRes.json(),
          bomRes.json()
        ]);

        // 데이터 설정
        setData(productsData);
        setBomData(bomData);
        window.bomData = bomData;

        // 전체 제품 유형 설정
        const types = [...new Set(productsData.products.map(p => p.type))];
        setAllOptions({ ...allOptions, types });
        setLoading(false);
      } catch (error) {
        console.error('데이터 로드 에러:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 사용 가능한 옵션 계산
  useEffect(() => {
    if (!selectedType || !data) return;

    const products = data.products.filter(p => p.type === selectedType);
    const newAvailableOptions = {};
    const newFilteredOptions = {};

    // 기본 옵션 추출
    ['color', 'size', 'height', 'level', 'version', 'formType'].forEach(key => {
      const values = [...new Set(products.map(p => p[key]).filter(Boolean)];
      if (values.length) newAvailableOptions[key] = values;
    });

    // 필터링된 옵션 계산
    if (selectedOptions.size) {
      const sizeProducts = products.filter(p => p.size === selectedOptions.size);
      newFilteredOptions.heights = [...new Set(sizeProducts.map(p => p.height))];
    }

    if (selectedOptions.height) {
      const heightProducts = products.filter(p => 
        p.size === selectedOptions.size && 
        p.height === selectedOptions.height
      );
      newFilteredOptions.levels = [...new Set(heightProducts.map(p => p.level))];
    }

    setAvailableOptions(newAvailableOptions);
    setFilteredOptions(newFilteredOptions);
  }, [selectedType, selectedOptions, data]);

  // 현재 가격 계산
  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;

    // 수동 가격 입력 시
    if (isCustomPrice) return customPrice * quantity * (applyRate / 100);

    // BOM 기반 제품 (경량랙, 중량랙, 파렛트랙)
    if (['경량랙', '중량랙', '파렛트랙'].includes(selectedType)) {
      const bom = bomData?.[selectedType]?.find(item => 
        item.size === selectedOptions.size &&
        item.height === selectedOptions.height &&
        item.level === selectedOptions.level &&
        item.formType === selectedOptions.formType
      );
      return bom ? bom.total_price * quantity : 0;
    }

    // 일반 제품 (스탠랙, 하이랙)
    const product = data?.products?.find(p => 
      p.type === selectedType &&
      Object.keys(selectedOptions).every(key => p[key] === selectedOptions[key])
    );
    return product ? product.price * quantity : 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data, bomData]);

  // 현재 BOM 계산
  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions) return [];

    // BOM 기반 제품 처리
    if (['경량랙', '중량랙', '파렛트랙'].includes(selectedType)) {
      const bom = bomData?.[selectedType]?.find(item => 
        item.size === selectedOptions.size &&
        item.height === selectedOptions.height &&
        item.level === selectedOptions.level &&
        item.formType === selectedOptions.formType
      );
      return bom ? bom.components.map(comp => ({
        ...comp,
        quantity: comp.quantity * quantity
      })) : [];
    }

    // 스탠랙 BOM 계산
    if (selectedType === '스탠랙') {
      const levelCount = parseInt(selectedOptions.level?.replace('단', '')) || 0;
      return [
        { code: 'ST-FRAME', name: '스탠드 프레임', quantity: 4, unit: '개', unitPrice: 15000 },
        { code: 'ST-SHELF', name: '스탠드 선반', quantity: levelCount, unit: '개', unitPrice: 8000 },
        { code: 'ST-BOLT', name: '스탠드 볼트세트', quantity: 1, unit: '세트', unitPrice: 5000 }
      ];
    }

    // 하이랙 BOM 계산
    if (selectedType === '하이랙') {
      const levelCount = parseInt(selectedOptions.level?.replace('단', '')) || 0;
      const is700kg = selectedOptions.color?.includes('700kg');
      
      if (is700kg) {
        return [
          { code: 'HR-FRAME-700', name: '하이랙 프레임(700kg)', quantity: 2, unit: '개', unitPrice: 30000 },
          { code: 'HR-BEAM-700', name: '하이랙 빔(700kg)', quantity: levelCount * 2, unit: '개', unitPrice: 12000 },
          { code: 'HR-PIN', name: '하이랙 안전핀', quantity: levelCount * 4, unit: '개', unitPrice: 2000 }
        ];
      } else {
        return [
          { code: 'HR-FRAME', name: '하이랙 프레임', quantity: 4, unit: '개', unitPrice: 25000 },
          { code: 'HR-SHELF', name: '하이랙 선반', quantity: levelCount, unit: '개', unitPrice: 10000 },
          { code: 'HR-BEAM', name: '하이랙 빔', quantity: levelCount * 2, unit: '개', unitPrice: 8000 },
          { code: 'HR-PIN', name: '하이랙 안전핀', quantity: levelCount * 4, unit: '개', unitPrice: 2000 }
        ];
      }
    }

    return [];
  }, [selectedType, selectedOptions, quantity, bomData]);

  // 장바구니 BOM 계산
  const calculateCartBOM = useCallback(() => {
    return cart.reduce((acc, item) => {
      const itemBOM = calculateItemBOM(item.type, item.options, item.quantity);
      return [...acc, ...itemBOM];
    }, []);
  }, [cart]);

  // 개별 아이템 BOM 계산
  const calculateItemBOM = (type, options, qty) => {
    if (!type || !options) return [];

    // BOM 기반 제품 처리
    if (['경량랙', '중량랙', '파렛트랙'].includes(type)) {
      const bom = bomData?.[type]?.find(item => 
        item.size === options.size &&
        item.height === options.height &&
        item.level === options.level &&
        item.formType === options.formType
      );
      return bom ? bom.components.map(comp => ({
        ...comp,
        quantity: comp.quantity * qty
      })) : [];
    }

    // 스탠랙 BOM 계산
    if (type === '스탠랙') {
      const levelCount = parseInt(options.level?.replace('단', '')) || 0;
      return [
        { code: 'ST-FRAME', name: '스탠드 프레임', quantity: 4 * qty, unit: '개', unitPrice: 15000 },
        { code: 'ST-SHELF', name: '스탠드 선반', quantity: levelCount * qty, unit: '개', unitPrice: 8000 },
        { code: 'ST-BOLT', name: '스탠드 볼트세트', quantity: 1 * qty, unit: '세트', unitPrice: 5000 }
      ];
    }

    // 하이랙 BOM 계산
    if (type === '하이랙') {
      const levelCount = parseInt(options.level?.replace('단', '')) || 0;
      const is700kg = options.color?.includes('700kg');
      
      if (is700kg) {
        return [
          { code: 'HR-FRAME-700', name: '하이랙 프레임(700kg)', quantity: 2 * qty, unit: '개', unitPrice: 30000 },
          { code: 'HR-BEAM-700', name: '하이랙 빔(700kg)', quantity: levelCount * 2 * qty, unit: '개', unitPrice: 12000 },
          { code: 'HR-PIN', name: '하이랙 안전핀', quantity: levelCount * 4 * qty, unit: '개', unitPrice: 2000 }
        ];
      } else {
        return [
          { code: 'HR-FRAME', name: '하이랙 프레임', quantity: 4 * qty, unit: '개', unitPrice: 25000 },
          { code: 'HR-SHELF', name: '하이랙 선반', quantity: levelCount * qty, unit: '개', unitPrice: 10000 },
          { code: 'HR-BEAM', name: '하이랙 빔', quantity: levelCount * 2 * qty, unit: '개', unitPrice: 8000 },
          { code: 'HR-PIN', name: '하이랙 안전핀', quantity: levelCount * 4 * qty, unit: '개', unitPrice: 2000 }
        ];
      }
    }

    return [];
  };

  // 상태 업데이트 효과
  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

  useEffect(() => {
    setCartBOM(calculateCartBOM());
  }, [cart, calculateCartBOM]);

  // 장바구니 추가 함수
  const addToCart = () => {
    if (!selectedType || !selectedOptions) return;

    const newItem = {
      type: selectedType,
      options: { ...selectedOptions },
      quantity,
      price: currentPrice,
      bom: calculateCurrentBOM()
    };

    setCart([...cart, newItem]);
  };

  // 컨텍스트 값
  const contextValue = {
    // 상태
    allOptions,
    availableOptions,
    filteredOptions,
    selectedType,
    selectedOptions,
    quantity,
    applyRate,
    customPrice,
    isCustomPrice,
    currentPrice,
    currentBOM,
    cart,
    cartBOM,
    loading,

    // 핸들러
    setSelectedType,
    handleOptionChange: (key, value) => {
      setSelectedOptions(prev => {
        const newOptions = { ...prev, [key]: value };
        
        // 종속성 처리
        if (key === 'size') {
          delete newOptions.height;
          delete newOptions.level;
        } else if (key === 'height') {
          delete newOptions.level;
        }
        
        return newOptions;
      });
    },
    setQuantity,
    setApplyRate,
    setCustomPrice,
    setIsCustomPrice,
    addToCart,
    safePrice: (price) => Math.round(price).toLocaleString()
  };

  return (
    <ProductContext.Provider value={contextValue}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
