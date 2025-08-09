import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();

const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

const sizeToBom = size => size ? (size.startsWith('W') ? size : 'W' + size.replace('x', 'xD')) : '';
const heightToBom = height => height ? (height.startsWith('H') ? height : 'H' + height) : '';
const levelToBom = level => level ? (level.startsWith('L') ? level : 'L' + level.replace('단', '')) : '';

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [filteredOptions, setFilteredOptions] = useState({});

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);

  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);

  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dRes, bRes] = await Promise.all([
          fetch('./data.json'),
          fetch('./bom_data.json')
        ]);
        const d = await dRes.json();
        const b = await bRes.json();
        console.log('[DEBUG] data.json keys:', Object.keys(d));
        console.log('[DEBUG] bom_data.json keys:', Object.keys(b));
        setData(d);
        setBomData(b);
        setAllOptions({ types: Object.keys(d) });
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        setData({});
        setBomData({});
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    console.log('[DEBUG] useEffect 옵션 세팅 실행');
    console.log('[DEBUG] selectedType:', selectedType);
    console.log('[DEBUG] selectedOptions:', selectedOptions);

    setAvailableOptions({});
    setFilteredOptions({});
    if (!data || !selectedType) return;

    const rackData = data[selectedType];
    let opts = {};

    if (selectedType === '스텐랙') {
      opts.size = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.size) {
        opts.height = Object.keys(rackData['기본가격'][selectedOptions.size] || {});
      }
      if (selectedOptions.size && selectedOptions.height) {
        opts.level = Object.keys(rackData['기본가격'][selectedOptions.size][selectedOptions.height] || {});
      }
      opts.version = ['V1'];
    }
    else if (selectedType === '하이랙') {
      opts.color = rackData['색상'] || [];
      if (selectedOptions.color) {
        opts.size = Object.keys(rackData['기본가격'][selectedOptions.color] || {});
        if (selectedOptions.size) {
          opts.height = Object.keys(rackData['기본가격'][selectedOptions.color][selectedOptions.size] || {});
          if (selectedOptions.height) {
            opts.level = Object.keys(rackData['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {});
          }
        }
      }
    }
    else if (formTypeRacks.includes(selectedType)) {
      opts.formType = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.formType) {
        opts.size = Object.keys(rackData['기본가격'][selectedOptions.formType] || {});
        if (selectedOptions.size) {
          opts.height = Object.keys(rackData['기본가격'][selectedOptions.formType][selectedOptions.size] || {});
          if (selectedOptions.height) {
            opts.level = Object.keys(rackData['기본가격'][selectedOptions.formType][selectedOptions.size][selectedOptions.height] || {});
          }
        }
      }
    }
    console.log('[DEBUG] availableOptions 세팅:', opts);
    setAvailableOptions(opts);
  }, [selectedType, selectedOptions, data]);

  const calculatePrice = useCallback(() => {
    console.log('[DEBUG] 가격 계산 호출 - type:', selectedType, ', options:', selectedOptions);

    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) {
      return customPrice * quantity * (applyRate / 100);
    }
    if (formTypeRacks.includes(selectedType)) {
      const formType = selectedOptions.formType;
      const size = sizeToBom(selectedOptions.size);
      const height = heightToBom(selectedOptions.height);
      const level = levelToBom(selectedOptions.level);

      const bomPrice = bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType]?.total_price;
      if (bomPrice) return bomPrice * quantity;

      const price = data?.[selectedType]?.['기본가격']?.[formType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (price) return price * quantity;
      return 0;
    }
    if (selectedType === '스텐랙') {
      const price = data?.스텐랙?.['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      return price ? price * quantity : 0;
    }
    if (selectedType === '하이랙') {
      const price = data?.하이랙?.['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      return price ? price * quantity : 0;
    }
    return 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data, bomData]);

  const calculateCurrentBOM = useCallback(() => {
    console.log('[DEBUG] BOM 계산 호출 - type:', selectedType, ', options:', selectedOptions);
    if (!selectedType || !selectedOptions || !quantity) return [];
    if (formTypeRacks.includes(selectedType)) {
      const formType = selectedOptions.formType;
      const size = sizeToBom(selectedOptions.size);
      const height = heightToBom(selectedOptions.height);
      const level = levelToBom(selectedOptions.level);
      const bom = bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (bom && Array.isArray(bom.components)) {
        return bom.components.map(c => ({
          name: c.name,
          quantity: c.quantity * quantity,
          unitPrice: c.unit_price,
          unit: c.unit ?? '',
        }));
      }
      return [];
    }
    let levelCount = parseInt((selectedOptions.level || '').replace('단', '')) || 0;
    if (selectedType === '스텐랙') {
      return [
        { name: '기둥 4개', quantity: 4 * quantity },
        { name: `선반 ${levelCount}개`, quantity: levelCount * quantity },
        { name: '고정볼트세트', quantity: 1 * quantity },
      ];
    }
    if (selectedType === '하이랙') {
      return [
        { name: '기둥 4개', quantity: 4 * quantity },
        { name: '가로대', quantity: levelCount * quantity },
        { name: '선반', quantity: levelCount * quantity },
        { name: '고정볼트세트', quantity: 1 * quantity },
      ];
    }
    return [];
  }, [selectedType, selectedOptions, quantity, bomData, data]);

  const calculateCartBOM = useCallback(() => {
    console.log('[DEBUG] 전체 BOM 합산 호출 - cart:', cart);
    if (!cart || !bomData) return [];
    const bomMap = {};
    cart.forEach(item => {
      let components = [];
      try {
        if (formTypeRacks.includes(item.type)) {
          const size = sizeToBom(item.options.size);
          const height = heightToBom(item.options.height);
          const level = levelToBom(item.options.level);
          const formType = item.options.formType;
          const found = bomData?.[item.type]?.[size]?.[height]?.[level]?.[formType];
          if (found && Array.isArray(found.components)) {
            components = found.components.map(c => ({
              name: c.name,
              unit: c.unit ?? '',
              unitPrice: c.unit_price,
              quantity: c.quantity * item.quantity,
            }));
          } else {
            console.warn('BOM 데이터 누락/포맷오류:', { item, size, height, level, formType, found });
            components = [];
          }
        } else if (item.type === '스텐랙' || item.type === '하이랙') {
          let levelCount = parseInt((item.options.level || '').replace('단', '')) || 0;
          components = [
            { name: '기둥 4개', quantity: 4 * item.quantity },
            { name: '선반', quantity: levelCount * item.quantity },
            { name: '고정볼트세트', quantity: 1 * item.quantity },
          ];
        }
      } catch (e) {
        console.error('BOM 변환 에러:', e, item);
        components = [];
      }
      components.forEach(c => {
        const key = c.name;
        if (bomMap[key]) {
          bomMap[key].quantity += c.quantity;
        } else {
          bomMap[key] = { ...c };
        }
      });
    });
    return Object.values(bomMap);
  }, [cart, bomData]);

  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

  useEffect(() => {
    setCartBOM(calculateCartBOM());
  }, [cart, calculateCartBOM]);

  const handleOptionChange = (key, value) => {
    console.log(`[DEBUG] handleOptionChange: ${key} = ${value}`);
    if (key === 'type') {
      setSelectedType(value);
      setSelectedOptions(value === '스텐랙' ? { version: 'V1' } : {});
      return;
    }
    setSelectedOptions(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'size' && { height: undefined, level: undefined }),
      ...(key === 'height' && { level: undefined }),
    }));
  };

  const addToCart = () => {
    console.log('[DEBUG] addToCart - 현재 선택:', selectedType, selectedOptions, '가격:', currentPrice);
    if (!selectedType || !selectedOptions) return;
    setCart(prev => [
      ...prev,
      {
        type: selectedType,
        options: { ...selectedOptions },
        quantity,
        price: currentPrice,
      }
    ]);
  };

  const safePrice = price => Math.round(price).toLocaleString();

  return (
    <ProductContext.Provider
      value={{
        allOptions,
        availableOptions,
        filteredOptions,
        selectedType,
        selectedOptions,
        setSelectedType,
        handleOptionChange,
        quantity,
        setQuantity,
        applyRate,
        setApplyRate,
        customPrice,
        setCustomPrice,
        isCustomPrice,
        setIsCustomPrice,
        currentPrice,
        currentBOM,
        cart,
        cartBOM,
        loading,
        addToCart,
        safePrice,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
