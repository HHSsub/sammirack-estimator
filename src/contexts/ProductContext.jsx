import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
const ProductContext = createContext();
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [bomData, setBomData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(0);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dRes, bRes] = await Promise.all([
          fetch('./data.json'),
          fetch('./bom_data.json'),
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

  useEffect(() => {
    setAvailableOptions({});
    if (!data || !selectedType) return;
    const rackData = data[selectedType];
    let opts = {};

    if (selectedType === '스텐랙') {
      opts.size = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.size)
        opts.height = Object.keys(rackData['기본가격'][selectedOptions.size] || {});
      if (selectedOptions.size && selectedOptions.height)
        opts.level = [
          ...Object.keys(rackData['기본가격'][selectedOptions.size][selectedOptions.height] || {}),
          '5단', '6단',
        ];
      opts.version = ['V1'];
    } else if (selectedType === '하이랙') {
      opts.color = rackData['색상']?.map(c =>
        c.replace('200kg', '270kg').replace('350kg', '450kg')
      ) || [];
      if (selectedOptions.color) {
        opts.size = [
          ...Object.keys(rackData['기본가격'][selectedOptions.color] || {}),
          '45x150',
        ];
        if (selectedOptions.size) {
          opts.height = [
            ...Object.keys(rackData['기본가격'][selectedOptions.color][selectedOptions.size] || {}),
            '108', '150', '200', '250',
          ];
          if (selectedOptions.height) {
            opts.level = Object.keys(
              rackData['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {}
            );
          }
        }
      }
    } else if (formTypeRacks.includes(selectedType)) {
      opts.formType = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.formType) {
        opts.size = Object.keys(rackData['기본가격'][selectedOptions.formType] || {});
        if (selectedOptions.size) {
          opts.height =
            selectedType === '파렛트랙'
              ? [
                  ...Object.keys(
                    rackData['기본가격'][selectedOptions.formType][selectedOptions.size] || {}
                  ),
                  '4500', '5000', '5500', '6000',
                ]
              : Object.keys(
                  rackData['기본가격'][selectedOptions.formType][selectedOptions.size] || {}
                );
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

  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) {
      return Math.round(customPrice * quantity * (applyRate / 100));
    }
    let price = 0;
    if (formTypeRacks.includes(selectedType)) {
      const b = data[selectedType]?.['기본가격'];
      const basePrice = b?.[selectedOptions.formType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (basePrice) price = basePrice * quantity;
      return Math.round(price * (applyRate / 100));
    }
    if (selectedType === '스텐랙') {
      const basePrice = data?.스텐랙?.['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (basePrice) price = basePrice * quantity;
      return Math.round(price * (applyRate / 100));
    }
    if (selectedType === '하이랙') {
      const basePrice = data?.하이랙?.['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (basePrice) price = basePrice * quantity;
      return Math.round(price * (applyRate / 100));
    }
    return 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data]);

  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return [];
    let levelCount = parseInt((selectedOptions.level || '').replace('단', '')) || 0;
    const sizeLabel = selectedOptions.size || '';
    const rackLabel = selectedType;
    if (selectedType === '스텐랙' || selectedType === '하이랙') {
      return [
        { rackType: rackLabel, size: sizeLabel, name: '기둥', quantity: 4 * quantity },
        { rackType: rackLabel, size: sizeLabel, name: '선반', quantity: levelCount * quantity },
        { rackType: rackLabel, size: sizeLabel, name: '고정볼트세트', quantity: 1 * quantity },
      ];
    }
    return [];
  }, [selectedType, selectedOptions, quantity]);

  const calculateCartBOM = useCallback(() => {
    if (!cart) return [];
    const bomMap = {};
    cart.forEach(item => {
      item.bom?.forEach(c => {
        const key = `${c.rackType} ${c.size} ${c.name}`;
        if (bomMap[key]) {
          bomMap[key].quantity += c.quantity;
        } else {
          bomMap[key] = { ...c };
        }
      });
    });
    return Object.values(bomMap);
  }, [cart]);

  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

  useEffect(() => {
    setCartBOM(calculateCartBOM());
    setCartTotal(cart.reduce((sum, i) => sum + (i.price || 0), 0));
  }, [cart, calculateCartBOM]);

  const handleOptionChange = (key, value) => {
    if (key === 'type') {
      setSelectedType(value);
      setSelectedOptions(value === '스텐랙' ? { version: 'V1' } : {});
      setQuantity(0);
      return;
    }
    setSelectedOptions(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'color' && { size: undefined, height: undefined, level: undefined }),
      ...(key === 'formType' && { size: undefined, height: undefined, level: undefined }),
      ...(key === 'size' && { height: undefined, level: undefined }),
      ...(key === 'height' && { level: undefined }),
    }));
  };

  const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const makeDisplayName = (type, options, qty) =>
    [type, options.formType, options.size, options.height, options.level].filter(Boolean).join(' ') + ` x ${qty}개`;

  const addToCart = () => {
    if (!selectedType || !selectedOptions || quantity <= 0) return;
    setCart(prev => [
      ...prev,
      {
        id: generateId(),
        type: selectedType,
        options: { ...selectedOptions },
        quantity,
        price: currentPrice,
        bom: currentBOM.map(c => ({ ...c })),
        displayName: makeDisplayName(selectedType, selectedOptions, quantity)
      }
    ]);
  };

  const removeFromCart = id => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateCartQuantity = (id, newQty) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              quantity: newQty,
              price: Math.round((isCustomPrice ? customPrice : item.price / item.quantity) * newQty * (applyRate / 100)),
              displayName: makeDisplayName(item.type, item.options, newQty)
            }
          : item
      )
    );
  };

  const updateCurrentBOMQuantity = (idx, newQty) => {
    setCurrentBOM(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: newQty };
      return next;
    });
  };

  const updateCartBOMQuantity = (idx, newQty) => {
    if (!cartBOM[idx]) return;
    const target = cartBOM[idx];
    setCart(prev =>
      prev.map(item => ({
        ...item,
        bom: item.bom.map(b =>
          b.rackType === target.rackType && b.size === target.size && b.name === target.name
            ? { ...b, quantity: newQty }
            : b
        )
      }))
    );
  };

  return (
    <ProductContext.Provider value={{
      allOptions, availableOptions,
      selectedType, selectedOptions,
      setSelectedType, handleOptionChange,
      quantity, setQuantity, applyRate, setApplyRate,
      customPrice, setCustomPrice, isCustomPrice, setIsCustomPrice,
      currentPrice, currentBOM, setCurrentBOM,
      cart, setCart, cartTotal, cartBOM,
      updateCurrentBOMQuantity, updateCartBOMQuantity,
      removeFromCart, updateCartQuantity,
      loading, addToCart
    }}>
      {children}
    </ProductContext.Provider>
  );
};
export const useProducts = () => useContext(ProductContext);
