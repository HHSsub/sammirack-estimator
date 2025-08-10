import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

// 🔹 수정된 EXTRA_OPTIONS
// - 경량랙, 중량랙, 파렛트랙: level 제거 (이미 데이터에 존재)
// - 하이랙, 스텐랙만 5단/6단 추가
const EXTRA_OPTIONS = {
  '파렛트랙': {
    height: ['4500', '5000', '5500', '6000']
  },
  '하이랙': {
    size: ['45x150'],
    height: ['108', '150', '200', '250'],
    level: ['5단', '6단']
  },
  '스텐랙': {
    level: ['5단', '6단']
  }
};

// 예시: 기타 추가상품 데이터는 외부 extra_options.json 으로 분리 가능
import { EXTRA_PRODUCTS } from '../extra_options_data';

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

  const [extraOptions, setExtraOptions] = useState([]); // 기타 추가 옵션 id 목록

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
    if (!selectedType) {
      setAvailableOptions({});
      return;
    }
    const extra = EXTRA_OPTIONS[selectedType] || {};

    // 경중파렛: SIZE/HEIGHT/LEVEL/FormType 생성
    if (formTypeRacks.includes(selectedType) && bomData?.[selectedType]) {
      const bd = bomData[selectedType];
      setAvailableOptions({
        size: [...Object.keys(bd)],
        height: selectedOptions.size
          ? [...Object.keys(bd[selectedOptions.size] || {}), ...(extra.height || [])]
          : [...(extra.height || [])],
        level: selectedOptions.size && selectedOptions.height
          ? [...Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {})]
          : []
        ,
        formType: selectedOptions.size && selectedOptions.height && selectedOptions.level
          ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {})
          : []
      });
      return;
    }

    // 하이랙
    if (selectedType === '하이랙' && data?.하이랙) {
      const rd = data[selectedType];
      const opts = { color: rd['색상'] || [] };
      if (selectedOptions.color) {
        opts.size = [
          ...Object.keys(rd['기본가격'][selectedOptions.color] || {}),
          ...(extra.size || [])
        ];
        if (selectedOptions.size) {
          opts.height = [
            ...Object.keys(rd['기본가격'][selectedOptions.color]?.[selectedOptions.size] || {}),
            ...(extra.height || [])
          ];
          if (selectedOptions.height) {
            opts.level = [
              ...Object.keys(rd['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {}),
              ...(extra.level || [])
            ];
          }
        }
      }
      setAvailableOptions(opts);
      return;
    }

    // 스텐랙
    if (selectedType === '스텐랙' && data?.스텐랙) {
      const rd = data[selectedType];
      const opts = { size: Object.keys(rd['기본가격'] || {}) };
      if (selectedOptions.size)
        opts.height = Object.keys(rd['기본가격'][selectedOptions.size] || {});
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
    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) return Math.round(customPrice * quantity * (applyRate / 100));

    let basePrice = 0;
    if (formTypeRacks.includes(selectedType) && bomData) {
      const { size, height, level, formType } = selectedOptions;
      const record = bomData[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (record?.total_price) basePrice = record.total_price * quantity;
    } else if (selectedType === '스텐랙' && data?.스텐랙) {
      const p = data[selectedType]['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) basePrice = p * quantity;
    } else if (selectedType === '하이랙' && data?.하이랙) {
      const p = data[selectedType]['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) basePrice = p * quantity;
    }

    const extraPrice = extraOptions.reduce((sum, eid) => {
      const extraProd = (EXTRA_PRODUCTS[selectedType] || []).find(e => e.id === eid);
      return extraProd ? sum + extraProd.price : sum;
    }, 0);

    return Math.round((basePrice + extraPrice) * (applyRate / 100));
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, bomData, data, extraOptions]);

  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return [];

    let baseBOM = [];
    if (formTypeRacks.includes(selectedType) && bomData) {
      const { size, height, level, formType } = selectedOptions;
      const record = bomData[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (record?.components) {
        baseBOM = record.components.map(c => ({
          rackType: selectedType,
          size,
          name: c.name,
          quantity: c.quantity * quantity,
          unitPrice: c.unit_price,
          totalPrice: c.total_price * quantity
        }));
      }
    } else if (['스텐랙', '하이랙'].includes(selectedType)) {
      const lvl = parseInt(selectedOptions.level || '') || 0;
      baseBOM = [
        { rackType: selectedType, size: selectedOptions.size, name: '기둥', quantity: 4 * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '선반', quantity: lvl * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '볼트세트', quantity: 1 * quantity }
      ];
    }

    const extraBOMs = extraOptions.flatMap(eid => {
      const extraProd = (EXTRA_PRODUCTS[selectedType] || []).find(e => e.id === eid);
      if (!extraProd || !extraProd.bom) return [];
      return extraProd.bom.map(b => ({
        rackType: selectedType,
        size: '',
        name: b.name,
        quantity: b.qty || b.quantity,
        unitPrice: extraProd.price / (b.qty || b.quantity),
        totalPrice: extraProd.price
      }));
    });

    return [...baseBOM, ...extraBOMs];
  }, [selectedType, selectedOptions, quantity, bomData, extraOptions]);

  const handleExtraOptionChange = ids => setExtraOptions(ids);

  const handleOptionChange = (key, value) => {
    if (key === 'type') {
      setSelectedType(value);
      setSelectedOptions({});
      setExtraOptions([]);
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
      extraOptions: [...extraOptions],
      quantity,
      price: currentPrice,
      bom: calculateCurrentBOM(),
      displayName: [selectedType, selectedOptions.formType, selectedOptions.size, selectedOptions.height, selectedOptions.level].filter(Boolean).join(' ') + ` x ${quantity}개`
    }]);
  };

  const removeFromCart = id => setCart(prev => prev.filter(item => item.id !== id));

  const updateCurrentBOMQuantity = (idx, newQty) => {
    setCurrentBOM(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: newQty };
      return copy;
    });
  };
  const updateCartBOMQuantity = (idx, newQty) => {
    if (!cartBOM[idx]) return;
    const target = cartBOM[idx];
    setCart(prev =>
      prev.map(item => ({
        ...item,
        bom: item.bom.map(b =>
          b.rackType === target.rackType &&
          b.size === target.size &&
          b.name === target.name
            ? { ...b, quantity: newQty }
            : b
        ),
      }))
    );
  };

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

  return (
    <ProductContext.Provider value={{
      allOptions, availableOptions, colorLabelMap,
      selectedType, selectedOptions, handleOptionChange,
      extraOptions, handleExtraOptionChange,
      quantity, setQuantity, applyRate, setApplyRate,
      customPrice, setCustomPrice, isCustomPrice,
      currentPrice, currentBOM, cart, cartTotal, cartBOM,
      loading, addToCart, removeFromCart,
      updateCurrentBOMQuantity, updateCartBOMQuantity
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
