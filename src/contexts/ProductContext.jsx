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

  // 하이랙 표시에만 사용하는 라벨 매핑
  const colorLabelMap = { '200kg': '270kg', '350kg': '450kg' };

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dRes, bRes] = await Promise.all([
          fetch('data.json'),
          fetch('bom_data.json'),
        ]);
        const dj = await dRes.json();
        const bj = await bRes.json();
        setData(dj);
        setBomData(bj);
        setAllOptions({ types: Object.keys(dj) });
      } catch (err) {
        console.error(err);
        setData({});
        setBomData({});
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 옵션 생성 : bomData의 실제 키를 기반으로
  useEffect(() => {
    if (!selectedType) {
      setAvailableOptions({});
      return;
    }

    // 경량/중량/파렛트랙 → bom_data.json에서 키 빼오기
    if (formTypeRacks.includes(selectedType) && bomData?.[selectedType]) {
      const bd = bomData[selectedType];
      const sizeKeys = Object.keys(bd);
      const heightKeys =
        selectedOptions.size && bd[selectedOptions.size]
          ? Object.keys(bd[selectedOptions.size])
          : [];
      const levelKeys =
        selectedOptions.size &&
        selectedOptions.height &&
        bd[selectedOptions.size]?.[selectedOptions.height]
          ? Object.keys(bd[selectedOptions.size][selectedOptions.height])
          : [];
      const formTypeKeys =
        selectedOptions.size &&
        selectedOptions.height &&
        selectedOptions.level &&
        bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]
          ? Object.keys(bd[selectedOptions.size][selectedOptions.height][selectedOptions.level])
          : [];

      setAvailableOptions({
        size: sizeKeys,
        height: heightKeys,
        level: levelKeys,
        formType: formTypeKeys,
      });
      return;
    }

    // 하이ラック
    if (selectedType === '하이랙' && data?.하이랙) {
      const rackData = data[selectedType];
      let opts = {};
      const originalColors = rackData['색상'] || [];
      opts.color = originalColors;
      if (selectedOptions.color) {
        opts.size = [
          ...Object.keys(rackData['기본가격'][selectedOptions.color] || {}),
          '45x150',
        ];
        if (selectedOptions.size) {
          opts.height = [
            ...Object.keys(
              rackData['기본가격'][selectedOptions.color][selectedOptions.size] || {}
            ),
            '108',
            '150',
            '200',
            '250',
          ];
          if (selectedOptions.height) {
            opts.level = Object.keys(
              rackData['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {}
            );
          }
        }
      }
      setAvailableOptions(opts);
      return;
    }

    // 스텐랙
    if (selectedType === '스텐랙' && data?.스텐랙) {
      const rackData = data[selectedType];
      let opts = {};
      opts.size = Object.keys(rackData['기본가격'] || {});
      if (selectedOptions.size)
        opts.height = Object.keys(rackData['기본가격'][selectedOptions.size] || {});
      if (selectedOptions.size && selectedOptions.height)
        opts.level = [
          ...Object.keys(
            rackData['기본가격'][selectedOptions.size][selectedOptions.height] || {}
          ),
          '5단',
          '6단',
        ];
      opts.version = ['V1'];
      setAvailableOptions(opts);
      return;
    }

    setAvailableOptions({});
  }, [selectedType, selectedOptions, bomData, data]);

  // 가격 계산
  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) {
      return Math.round(customPrice * quantity * (applyRate / 100));
    }
    let price = 0;
    if (formTypeRacks.includes(selectedType)) {
      const p =
        data[selectedType]?.['기본가격']?.[selectedOptions.formType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) price = p * quantity;
      return Math.round(price * (applyRate / 100));
    }
    if (selectedType === '스텐랙') {
      const p =
        data?.스텐랙?.['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) price = p * quantity;
      return Math.round(price * (applyRate / 100));
    }
    if (selectedType === '하이랙') {
      const p =
        data?.하이랙?.['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) price = p * quantity;
      return Math.round(price * (applyRate / 100));
    }
    return 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, data]);

  // BOM 계산
  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return [];

    // 경량/중량/파렛트랙
    if (formTypeRacks.includes(selectedType) && bomData) {
      const { size, height, level, formType } = selectedOptions;
      const record =
        bomData?.[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (!record) {
        console.error('BOMDATA MISSING', selectedType, size, height, level, formType);
        return [];
      }
      return record.components.map(comp => ({
        rackType: selectedType,
        size,
        name: comp.name,
        quantity: comp.quantity * quantity,
        unitPrice: comp.unit_price,
        totalPrice: comp.total_price * quantity,
      }));
    }

    // 스텐랙/하이랙 (간이)
    if (selectedType === '스텐랙' || selectedType === '하이랙') {
      const lvl = parseInt(selectedOptions.level || '') || 0;
      return [
        { rackType: selectedType, size: selectedOptions.size, name: '기둥', quantity: 4 * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '선반', quantity: lvl * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '볼트세트', quantity: 1 * quantity },
      ];
    }
    return [];
  }, [selectedType, selectedOptions, quantity, bomData]);

  const calculateCartBOM = useCallback(() => {
    const map = {};
    cart.forEach(item => {
      item.bom?.forEach(comp => {
        const key = `${comp.rackType} ${comp.size} ${comp.name}`;
        if (map[key]) {
          map[key].quantity += comp.quantity;
        } else {
          map[key] = { ...comp };
        }
      });
    });
    return Object.values(map);
  }, [cart]);

  // 동기화
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
    [type, options.formType, options.size, options.height, options.level]
      .filter(Boolean)
      .join(' ') + ` x ${qty}개`;

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
        bom: currentBOM,
        displayName: makeDisplayName(selectedType, selectedOptions, quantity),
      },
    ]);
  };

  const removeFromCart = id => setCart(prev => prev.filter(item => item.id !== id));

  const updateCartQuantity = (id, newQty) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              quantity: newQty,
              price: (item.price / item.quantity) * newQty,
              displayName: makeDisplayName(item.type, item.options, newQty),
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
        ),
      }))
    );
  };

  return (
    <ProductContext.Provider
      value={{
        allOptions,
        availableOptions,
        colorLabelMap,
        selectedType,
        selectedOptions,
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
        cartTotal,
        cartBOM,
        updateCurrentBOMQuantity,
        updateCartBOMQuantity,
        removeFromCart,
        updateCartQuantity,
        loading,
        addToCart,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
