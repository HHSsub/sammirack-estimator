import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

const EXTRA_OPTIONS = {
  '파렛트랙': { height: ['H4500', 'H5000', 'H5500', 'H6000'] },
  '하이랙': { size: ['45x150'], height: ['108', '150', '200', '250'], level: ['5단', '6단'] },
  '스텐랙': { level: ['5단', '6단'] }
};

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [bomData, setBomData] = useState({});
  const [extraProducts, setExtraProducts] = useState({});
  const [loading, setLoading] = useState(true);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(0);

  const [customPrice, setCustomPrice] = useState(0);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);

  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  const [extraOptions, setExtraOptions] = useState([]);
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [customMaterialPrice, setCustomMaterialPrice] = useState(0);

  const colorLabelMap = { '200kg': '270kg', '350kg': '450kg' };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const dj = await (await fetch('./data.json')).json();
        setData(dj);
        setAllOptions({ types: Object.keys(dj) });

        const bj = await (await fetch('./bom_data.json')).json();
        setBomData(bj);

        const ej = await (await fetch('./extra_options.json')).json();
        setExtraProducts(ej);
      } catch (err) {
        console.error('데이터 로드 실패', err);
        setAllOptions({ types: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 파렛트랙 독립형/연결형, 폭에 따라 베이스 위치 등 다르게 분기
  const getFallbackBOM = () => {
    if (selectedType !== '파렛트랙' || quantity <= 0) return [];

    const lvl = parseInt(selectedOptions.level || '') || 1;
    const size = selectedOptions.size || '';
    const height = selectedOptions.height || '';
    const isLinked = selectedOptions.formType === '연결형';
    const widthDesc = size.includes('2580') ? 'W2580xD1000' :
                      size.includes('1380') ? 'W1380xD1000' : size;

    // 베이스 위치 분기
    // 독립형은 베이스(안전좌 + 안전우 둘 다 2개씩)
    // 연결형은 베이스(안전좌 2개, 안전우 0개)
    const baseSafetyLeftQty = 2 * quantity;
    const baseSafetyRightQty = isLinked ? 0 : 2 * quantity;

    return [
      { rackType: selectedType, size, name: `기둥(${height})`, quantity: 2 * quantity },
      { rackType: selectedType, size, name: '로드빔', quantity: 2 * lvl * quantity },
      { rackType: selectedType, size, name: '타이빔', quantity: 2 * lvl * quantity },
      { rackType: selectedType, size, name: '베이스(안전좌)', quantity: baseSafetyLeftQty },
      { rackType: selectedType, size, name: '베이스(안전우)', quantity: baseSafetyRightQty },
      { rackType: selectedType, size, name: '안전핀', quantity: 2 * lvl * quantity },
      { rackType: selectedType, size, name: '수평브레싱', quantity: 1 * quantity },
      { rackType: selectedType, size, name: '경사브래싱', quantity: 1 * quantity },
      { rackType: selectedType, size, name: '앙카볼트', quantity: 4 * quantity },
      { rackType: selectedType, size, name: '베이스볼트', quantity: 4 * quantity },
      { rackType: selectedType, size, name: '브레싱볼트', quantity: 4 * quantity },
      { rackType: selectedType, size, name: '볼트세트', quantity: 1 * quantity },
    ];
  };

  useEffect(() => {
    if (!selectedType) {
      setAvailableOptions({});
      return;
    }
    const extra = EXTRA_OPTIONS[selectedType] || {};

    if (formTypeRacks.includes(selectedType) && bomData[selectedType]) {
      const bd = bomData[selectedType];
      setAvailableOptions({
        size: Object.keys(bd),
        height: selectedOptions.size
          ? [...Object.keys(bd[selectedOptions.size] || {}), ...(extra.height || [])]
          : [...(extra.height || [])],
        level: selectedOptions.size && selectedOptions.height
          ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {})
          : [],
        formType:
          selectedOptions.size && selectedOptions.height && selectedOptions.level
            ? Object.keys(
                bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {}
              )
            : []
      });
      return;
    }
    if (selectedType === '하이랙' && data?.하이랙) {
      const rd = data['하이랙'];
      const opts = { color: rd['색상'] || [] };
      if (selectedOptions.color) {
        opts.size = [...Object.keys(rd['기본가격'][selectedOptions.color] || {}), ...(extra.size || [])];
        if (selectedOptions.size) {
          opts.height = [
            ...Object.keys(rd['기본가격'][selectedOptions.color]?.[selectedOptions.size] || {}),
            ...(extra.height || [])
          ];
          if (selectedOptions.height) {
            opts.level = [
              ...Object.keys(
                rd['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {}
              ),
              ...(extra.level || [])
            ];
          }
        }
      }
      setAvailableOptions(opts);
      return;
    }
    if (selectedType === '스텐랙' && data?.스텐랙) {
      const rd = data['스텐랙'];
      const opts = { size: Object.keys(rd['기본가격'] || {}) };
      if (selectedOptions.size) opts.height = Object.keys(rd['기본가격'][selectedOptions.size] || {});
      if (selectedOptions.size && selectedOptions.height)
        opts.level = [
          ...Object.keys(rd['기본가격'][selectedOptions.size][selectedOptions.height] || {}),
          ...(extra.level || [])
        ];
      opts.version = ['V1'];
      setAvailableOptions(opts);
      return;
    }
    setAvailableOptions({});
  }, [selectedType, selectedOptions, data, bomData]);

  const calculatePrice = useCallback(() => {
    if (!selectedType || quantity <= 0) return 0;
    if (customPrice > 0) return Math.round(customPrice * quantity * (applyRate / 100));
    let base = 0;
    if (formTypeRacks.includes(selectedType)) {
      const r = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType];
      if (r?.total_price) base = r.total_price * quantity;
    } else if (selectedType === '스텐랙') {
      const p = data['스텐랙']['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) base = p * quantity;
    } else if (selectedType === '하이랙') {
      const p = data['하이랙']['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) base = p * quantity;
    }
    let extraP = 0;
    if (extraProducts[selectedType]) {
      Object.values(extraProducts[selectedType]).forEach(catArr => catArr.forEach(opt => {
        if (extraOptions.includes(opt.id)) {
          extraP += opt.id === 'l1-custom' ? customMaterialPrice : opt.price;
        }
      }));
    }
    return Math.round((base + extraP) * (applyRate / 100));
  }, [selectedType, selectedOptions, quantity, customPrice, applyRate, data, bomData, extraProducts, extraOptions, customMaterialPrice]);

  const calculateCurrentBOM = useCallback(() => {
    if (customPrice > 0) return getFallbackBOM();
    if (!selectedType || quantity <= 0) return [];

    if (selectedType === '파렛트랙') {
      const rec = bomData['파렛트랙']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType];
      if (rec?.components) {
        return rec.components.map(c => ({
          rackType: '파렛트랙',
          size: selectedOptions.size,
          name: c.name,
          quantity: c.quantity * quantity
        }));
      }
      return getFallbackBOM();
    }
    if (['스텐랙', '하이랙'].includes(selectedType)) return getFallbackBOM();

    const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType];
    return rec?.components ? rec.components.map(c => ({ ...c, quantity: c.quantity * quantity })) : [];
  }, [selectedType, selectedOptions, quantity, customPrice, bomData]);

  const handleOptionChange = (key, value) => {
    if (key === 'type') {
      setSelectedType(value);
      setSelectedOptions({});
      setExtraOptions([]);
      setQuantity(0);
      setCustomPrice(0);
      return;
    }
    setSelectedOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleExtraOptionChange = ids => setExtraOptions(ids);

  const updateCurrentBOMQuantity = (idx, newQty) => {
    setCurrentBOM(b => {
      const c = [...b];
      c[idx] = { ...c[idx], quantity: newQty };
      return c;
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

  const addToCart = () => {
    if (!selectedType || quantity <= 0) return;
    setCart(prev => [
      ...prev,
      {
        id: `${Date.now()}`,
        type: selectedType,
        options: { ...selectedOptions },
        extraOptions: [...extraOptions],
        quantity,
        price: customPrice > 0 ? customPrice : currentPrice,
        bom: customPrice > 0 ? getFallbackBOM() : calculateCurrentBOM(),
        displayName: [selectedType, selectedOptions.formType, selectedOptions.size, selectedOptions.height, selectedOptions.level]
          .filter(Boolean)
          .join(' ')
      }
    ]);
  };

  const removeFromCart = id => setCart(prev => prev.filter(i => i.id !== id));

  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(customPrice > 0 ? getFallbackBOM() : calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

  useEffect(() => {
    const map = {};
    cart.forEach(item => {
      item.bom?.forEach(c => {
        const key = `${c.rackType} ${c.size} ${c.name}`;
        if (map[key]) map[key].quantity += c.quantity;
        else map[key] = { ...c };
      });
    });
    setCartBOM(Object.values(map));
    setCartTotal(cart.reduce((sum, i) => sum + (i.price || 0), 0));
  }, [cart]);

  return (
    <ProductContext.Provider
      value={{
        allOptions,
        availableOptions,
        colorLabelMap,
        selectedType,
        selectedOptions,
        handleOptionChange,
        extraOptions,
        handleExtraOptionChange,
        quantity,
        setQuantity,
        applyRate,
        setApplyRate,
        customPrice,
        setCustomPrice,
        currentPrice,
        currentBOM,
        cart,
        cartTotal,
        cartBOM,
        loading,
        addToCart,
        removeFromCart,
        updateCurrentBOMQuantity,
        updateCartBOMQuantity,
        extraProducts,
        customMaterialName,
        setCustomMaterialName,
        customMaterialPrice,
        setCustomMaterialPrice
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
