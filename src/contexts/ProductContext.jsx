import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();

const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];
const sizeToBom = size => size ? (size.startsWith('W') ? size : 'W' + size.replace('x', 'xD')) : '';
const heightToBom = h => h ? (h.startsWith('H') ? h : 'H' + h) : '';
const levelToBom = l => l ? (l.startsWith('L') ? l : 'L' + l.replace('단', '')) : '';

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);

  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  const [applyRate, setApplyRate] = useState(100);
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dRes, bRes] = await Promise.all([
          fetch('./data.json'),
          fetch('./bom_data.json')
        ]);
        const dj = await dRes.json();
        const bj = await bRes.json();
        setData(dj);
        setBomData(bj);
        setAllOptions({ types: Object.keys(dj) });
      } catch {
        setData({});
        setBomData({});
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 옵션 세팅
  useEffect(() => {
    setAvailableOptions({});
    if (!data || !selectedType) return;

    const rackData = data[selectedType];
    let opts = {};

    if (selectedType === '스텐랙') {
      opts.size = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.size) {
        opts.height = Object.keys(rackData['기본가격'][selectedOptions.size] || {});
      }
      if (selectedOptions.size && selectedOptions.height) {
        opts.level = [
          ...Object.keys(rackData['기본가격'][selectedOptions.size][selectedOptions.height] || {}),
          '5단', '6단'
        ];
      }
      opts.version = ['V1'];
    }

    else if (selectedType === '하이랙') {
      opts.color = rackData['색상']?.map(c =>
        c.replace('200kg', '270kg').replace('350kg', '450kg')
      ) || [];

      if (selectedOptions.color) {
        opts.size = [
          ...Object.keys(rackData['기본가격'][selectedOptions.color] || {}),
          '45x150'
        ];
        if (selectedOptions.size) {
          opts.height = [
            ...Object.keys(rackData['기본가격'][selectedOptions.color][selectedOptions.size] || {}),
            '108', '150', '200', '250'
          ];
          if (selectedOptions.height) {
            opts.level = Object.keys(
              rackData['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {}
            );
          }
        }
      }
    }

    else if (formTypeRacks.includes(selectedType)) {
      opts.formType = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.formType) {
        opts.size = Object.keys(rackData['기본가격'][selectedOptions.formType] || {});
        if (selectedOptions.size) {
          // 파렛트랙 높이 추가
          if (selectedType === '파렛트랙') {
            opts.height = [
              ...Object.keys(rackData['기본가격'][selectedOptions.formType][selectedOptions.size] || {}),
              '4500', '5000', '5500', '6000'
            ];
          } else {
            opts.height = Object.keys(rackData['기본가격'][selectedOptions.formType][selectedOptions.size] || {});
          }
          if (selectedOptions.height) {
            opts.level = Object.keys(
              rackData['기본가격'][selectedOptions.formType][selectedOptions.size][selectedOptions.height] || {}
            );
          }
        }
      }
    }

    setAvailableOptions(opts);
  }, [selectedType, selectedOptions, data]);

  // 가격 계산
  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) {
      return Math.round(customPrice * quantity * (applyRate / 100));
    }
    let price = 0;
    if (formTypeRacks.includes(selectedType)) {
      const formType = selectedOptions.formType;
      const size = sizeToBom(selectedOptions.size);
      const height = heightToBom(selectedOptions.height);
      const level = levelToBom(selectedOptions.level);
      const bomPrice = bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType]?.total_price;
      if (bomPrice) {
        price = bomPrice * quantity;
      } else {
        const basePrice = data?.[selectedType]?.['기본가격']?.[formType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
        if (basePrice) price = basePrice * quantity;
      }
      return Math.round(price * (applyRate / 100));
    }
    if (selectedType === '스텐랙') {
      const basePrice = data?.스텐랙?.['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (basePrice) {
        price = basePrice * quantity;
      }
      return Math.round(price * (applyRate / 100));
    }
    if (selectedType === '하이랙') {
      const basePrice = data?.하이랙?.['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (basePrice) {
        price = basePrice * quantity;
      }
      return Math.round(price * (applyRate / 100));
    }
    return 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data, bomData]);

  // 현재 BOM 계산
  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return [];
    let levelCount = parseInt((selectedOptions.level || '').replace('단', '')) || 0;

    if (formTypeRacks.includes(selectedType)) {
      // 파렛트랙/경량랙/중량랙 BOM 그대로 사용 (여기선 생략)
      return [];
    }
    if (selectedType === '스텐랙') {
      return [
        { name: '기둥', quantity: 4 * quantity },
        { name: '선반', quantity: levelCount * quantity },
        { name: '고정볼트세트', quantity: 1 * quantity }
      ];
    }
    if (selectedType === '하이랙') {
      // 예시: 기둥/선반/볼트세트
      return [
        { name: '기둥', quantity: 4 * quantity },
        { name: '선반', quantity: levelCount * quantity },
        { name: '고정볼트세트', quantity: 1 * quantity }
      ];
    }
    return [];
  }, [selectedType, selectedOptions, quantity]);

  // 전체 BOM 집계
  const calculateCartBOM = useCallback(() => {
    if (!cart || !bomData) return [];
    const bomMap = {};
    cart.forEach(item => {
      let components = [];
      if (Array.isArray(item.bom)) {
        components = item.bom;
      }
      if (Array.isArray(components)) {
        components.forEach(c => {
          const key = c.name;
          if (bomMap[key]) bomMap[key].quantity += c.quantity;
          else bomMap[key] = { ...c };
        });
      }
    });
    return Object.values(bomMap);
  }, [cart, bomData]);

  // 가격/BOM/총합계 계산
  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);
  useEffect(() => {
    setCartBOM(calculateCartBOM());
    setCartTotal(cart.reduce((sum, i) => sum + (i.price || 0), 0));
  }, [cart, calculateCartBOM]);

  // 옵션 변경
  const handleOptionChange = (key, value) => {
    if (key === 'type') {
      setSelectedType(value);
      setSelectedOptions(value === '스텐랙' ? { version: 'V1' } : {});
      return;
    }
    setSelectedOptions(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'color' && { size: undefined, height: undefined, level: undefined }),
      ...(key === 'formType' && { size: undefined, height: undefined, level: undefined }),
      ...(key === 'size' && { height: undefined, level: undefined }),
      ...(key === 'height' && { level: undefined })
    }));
  };

  // id 생성
  const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  // displayName 생성
  const makeDisplayName = (type, options, qty) =>
    [type, options.formType, options.size, options.height, options.level].filter(Boolean).join(' ') +
    ` x ${qty}개`;

  // 카트 추가
  const addToCart = () => {
    if (!selectedType || !selectedOptions) return;
    setCart(prev => [
      ...prev,
      {
        id: generateId(),
        type: selectedType,
        options: { ...selectedOptions },
        quantity,
        price: currentPrice,
        bom: currentBOM,
        displayName: makeDisplayName(selectedType, selectedOptions, quantity)
      }
    ]);
  };

  // 카트 삭제
  const removeFromCart = id => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // 카트 수량 변경
  const updateCartQuantity = (id, newQty) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              quantity: newQty,
              price: Math.round(
                (isCustomPrice ? customPrice : item.price / item.quantity) *
                  newQty *
                  (applyRate / 100)
              )
            }
          : item
      )
    );
  };

  return (
    <ProductContext.Provider
      value={{
        allOptions, availableOptions,
        selectedType, selectedOptions,
        setSelectedType, handleOptionChange,
        quantity, setQuantity,
        applyRate, setApplyRate,
        customPrice, setCustomPrice,
        isCustomPrice, setIsCustomPrice,
        currentPrice, currentBOM,
        cart, setCart, removeFromCart, updateCartQuantity, cartTotal,
        cartBOM,
        loading,
        addToCart
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
