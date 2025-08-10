import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [bomData, setBomData] = useState({});
  const [loading, setLoading] = useState(true);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [selectedType, setSelectedType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(0);

  const [customPrice, setCustomPrice] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  const colorLabelMap = { '200kg': '270kg', '350kg': '450kg' };

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
      } catch (err) {
        console.error('데이터 로드 실패', err);
        setData({});
        setBomData({});
        setAllOptions({ types: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedType) { setAvailableOptions({}); return; }

    if (formTypeRacks.includes(selectedType) && bomData?.[selectedType]) {
      const bd = bomData[selectedType];
      setAvailableOptions({
        size: Object.keys(bd),
        height: selectedOptions.size ? Object.keys(bd[selectedOptions.size] || {}) : [],
        level: selectedOptions.size && selectedOptions.height
          ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {}) : [],
        formType: selectedOptions.size && selectedOptions.height && selectedOptions.level
          ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {}) : [],
      });
      return;
    }

    if (selectedType === '하이랙' && data?.하이랙) {
      const rd = data[selectedType];
      const opts = { color: rd['색상'] || [] };
      if (selectedOptions.color) {
        opts.size = Object.keys(rd['기본가격'][selectedOptions.color] || {});
        if (selectedOptions.size) {
          opts.height = Object.keys(rd['기본가격'][selectedOptions.color]?.[selectedOptions.size] || {});
          if (selectedOptions.height) {
            opts.level = Object.keys(rd['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {});
          }
        }
      }
      setAvailableOptions(opts); return;
    }

    if (selectedType === '스텐랙' && data?.스텐랙) {
      const rd = data[selectedType];
      const opts = { size: Object.keys(rd['기본가격'] || {}) };
      if (selectedOptions.size)
        opts.height = Object.keys(rd['기본가격'][selectedOptions.size] || {});
      if (selectedOptions.size && selectedOptions.height)
        opts.level = Object.keys(rd['기본가격'][selectedOptions.size][selectedOptions.height] || {});
      opts.version = ['V1'];
      setAvailableOptions(opts); return;
    }

    setAvailableOptions({});
  }, [selectedType, selectedOptions, data, bomData]);

  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) return Math.round(customPrice * quantity * (applyRate / 100));

    if (formTypeRacks.includes(selectedType) && bomData) {
      const { size, height, level, formType } = selectedOptions;
      const record = bomData[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (record?.total_price) return Math.round(record.total_price * quantity * (applyRate / 100));
      return 0;
    }
    if (selectedType === '스텐랙' && data?.스텐랙) {
      const p = data[selectedType]['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) return Math.round(p * quantity * (applyRate / 100));
    }
    if (selectedType === '하이랙' && data?.하이랙) {
      const p = data[selectedType]['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) return Math.round(p * quantity * (applyRate / 100));
    }
    return 0;
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, bomData, data]);

  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return [];

    if (formTypeRacks.includes(selectedType) && bomData) {
      const { size, height, level, formType } = selectedOptions;
      const record = bomData[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (!record?.components) return [];
      return record.components.map(c => ({
        rackType: selectedType,
        size,
        name: c.name,
        quantity: c.quantity * quantity,
        unitPrice: c.unit_price,
        totalPrice: c.total_price * quantity
      }));
    }
    if (selectedType === '스텐랙' || selectedType === '하이랙') {
      const lvl = parseInt(selectedOptions.level || '') || 0;
      return [
        { rackType: selectedType, size: selectedOptions.size, name: '기둥', quantity: 4 * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '선반', quantity: lvl * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '볼트세트', quantity: 1 * quantity }
      ];
    }
    return [];
  }, [selectedType, selectedOptions, quantity, bomData]);

  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(calculateCurrentBOM());
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

  const handleOptionChange = (key, value) => {
    if (key === 'type') {
      setSelectedType(value);
      setSelectedOptions({});
      setQuantity(0);
      return;
    }
    setSelectedOptions(prev => {
      let u = { ...prev, [key]: value };
      if (formTypeRacks.includes(selectedType)) {
        if (key === 'size') { u.height = undefined; u.level = undefined; u.formType = undefined; }
        else if (key === 'height') { u.level = undefined; u.formType = undefined; }
        else if (key === 'level') { u.formType = undefined; }
      } else if (selectedType === '하이랙') {
        if (key === 'color') { u.size=undefined; u.height=undefined; u.level=undefined; }
        else if (key === 'size') { u.height = undefined; u.level = undefined; }
        else if (key === 'height') { u.level = undefined; }
      } else if (selectedType === '스텐랙') {
        if (key === 'size') { u.height=undefined; u.level=undefined; }
        else if (key === 'height') { u.level=undefined; }
      }
      return u;
    });
  };

  const addToCart = () => {
    if (!selectedType || !selectedOptions || quantity <= 0) return;
    setCart(prev => [...prev, {
      id: `${Date.now()}`,
      type: selectedType,
      options: { ...selectedOptions },
      quantity,
      price: currentPrice,
      bom: currentBOM,
      displayName: [selectedType, selectedOptions.formType, selectedOptions.size, selectedOptions.height, selectedOptions.level].filter(Boolean).join(' ') + ` x ${quantity}개`
    }]);
  };

  const removeFromCart = id => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  return (
    <ProductContext.Provider value={{
      allOptions, availableOptions, colorLabelMap,
      selectedType, selectedOptions, handleOptionChange,
      quantity, setQuantity, applyRate, setApplyRate,
      customPrice, setCustomPrice, isCustomPrice, setIsCustomPrice,
      currentPrice, currentBOM, cart, cartTotal, cartBOM,
      loading, addToCart, removeFromCart
    }}>
      {children}
    </ProductContext.Provider>
  );
};
export const useProducts = () => useContext(ProductContext);
