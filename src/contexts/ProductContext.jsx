import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙'];

const EXTRA_OPTIONS = {
  '파렛트랙': { height: ['4500', '5000', '5500', '6000'] },
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
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  const [extraOptions, setExtraOptions] = useState([]);
  const colorLabelMap = { '200kg': '270kg', '350kg': '450kg' };

  // 데이터 fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // data.json 필수
        const dRes = await fetch('./data.json');
        if (!dRes.ok) throw new Error('data.json 로드 실패');
        const dj = await dRes.json();
        console.log('[DEBUG] data.json keys:', Object.keys(dj)); // 🔹 콘솔 확인
        setData(dj);
        setAllOptions({ types: Object.keys(dj) });

        // bom_data.json
        try {
          const bRes = await fetch('./bom_data.json');
          if (bRes.ok) {
            const bj = await bRes.json();
            setBomData(bj);
          }
        } catch (err) { console.warn('bom_data.json 로드 실패', err); }

        // extra_options.json
        try {
          const eRes = await fetch('./extra_options.json');
          if (eRes.ok) {
            const ej = await eRes.json();
            setExtraProducts(ej);
          }
        } catch (err) { console.warn('extra_options.json 로드 실패', err); }

      } catch (err) {
        console.error('필수 data.json 로드 실패:', err);
        setData({});
        setAllOptions({ types: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // 옵션 목록 생성
  useEffect(() => {
    if (!selectedType) { setAvailableOptions({}); return; }
    const extra = EXTRA_OPTIONS[selectedType] || {};

    if (formTypeRacks.includes(selectedType) && bomData[selectedType]) {
      const bd = bomData[selectedType];
      setAvailableOptions({
        size: [...Object.keys(bd)],
        height: selectedOptions.size
          ? [...Object.keys(bd[selectedOptions.size] || {}), ...(extra.height || [])]
          : [...(extra.height || [])],
        level:
          selectedOptions.size && selectedOptions.height
            ? [...Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {})]
            : [],
        formType:
          selectedOptions.size && selectedOptions.height && selectedOptions.level
            ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {})
            : []
      });
      return;
    }

    if (selectedType === '하이랙' && data?.하이랙) {
      const rd = data[selectedType], opts = { color: rd['색상'] || [] };
      if (selectedOptions.color) {
        opts.size = [...Object.keys(rd['기본가격'][selectedOptions.color] || {}), ...(extra.size || [])];
        if (selectedOptions.size) {
          opts.height = [...Object.keys(rd['기본가격'][selectedOptions.color]?.[selectedOptions.size] || {}), ...(extra.height || [])];
          if (selectedOptions.height) {
            opts.level = [...Object.keys(rd['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height] || {}), ...(extra.level || [])];
          }
        }
      }
      setAvailableOptions(opts); return;
    }

    if (selectedType === '스텐랙' && data?.스텐랙) {
      const rd = data[selectedType];
      const opts = { size: Object.keys(rd['기본가격'] || {}) };
      if (selectedOptions.size) opts.height = Object.keys(rd['기본가격'][selectedOptions.size] || {});
      if (selectedOptions.size && selectedOptions.height)
        opts.level = [...Object.keys(rd['기본가격'][selectedOptions.size][selectedOptions.height] || {}), ...(extra.level || [])];
      opts.version = ['V1'];
      setAvailableOptions(opts); return;
    }

    setAvailableOptions({});
  }, [selectedType, selectedOptions, data, bomData]);

  // 가격 계산
  const calculatePrice = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return 0;
    if (isCustomPrice) return Math.round(customPrice * quantity * (applyRate / 100));
    let basePrice = 0;

    if (formTypeRacks.includes(selectedType) && bomData) {
      const { size, height, level, formType } = selectedOptions;
      const rec = bomData[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (rec?.total_price) basePrice = rec.total_price * quantity;
    } else if (selectedType === '스텐랙' && data?.스텐랙) {
      const p = data[selectedType]['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) basePrice = p * quantity;
    } else if (selectedType === '하이랙' && data?.하이랙) {
      const p = data[selectedType]['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) basePrice = p * quantity;
    }

    let extraPrice = 0;
    if (extraProducts[selectedType]) {
      Object.values(extraProducts[selectedType]).forEach(catArr =>
        catArr.forEach(opt => { if (extraOptions.includes(opt.id)) extraPrice += opt.price; })
      );
    }
    return Math.round((basePrice + extraPrice) * (applyRate / 100));
  }, [selectedType, selectedOptions, quantity, isCustomPrice, customPrice, applyRate, bomData, data, extraProducts, extraOptions]);

  // BOM 계산
  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || !selectedOptions || !quantity) return [];
    let baseBOM = [];

    if (formTypeRacks.includes(selectedType) && bomData) {
      const { size, height, level, formType } = selectedOptions;
      const rec = bomData[selectedType]?.[size]?.[height]?.[level]?.[formType];
      if (rec?.components) {
        baseBOM = rec.components.map(c => ({
          rackType: selectedType, size, name: c.name,
          quantity: c.quantity * quantity, unitPrice: c.unit_price, totalPrice: c.total_price * quantity
        }));
      }
    } else if (['스텐랙','하이랙'].includes(selectedType)) {
      const lvl = parseInt(selectedOptions.level || '') || 0;
      baseBOM = [
        { rackType: selectedType, size: selectedOptions.size, name: '기둥', quantity: 4 * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '선반', quantity: lvl * quantity },
        { rackType: selectedType, size: selectedOptions.size, name: '볼트세트', quantity: 1 * quantity }
      ];
    }

    let extraBOMs = [];
    if (extraProducts[selectedType]) {
      Object.values(extraProducts[selectedType]).forEach(catArr =>
        catArr.forEach(opt => {
          if (extraOptions.includes(opt.id) && opt.bom) {
            opt.bom.forEach(b =>
              extraBOMs.push({
                rackType: selectedType, size: '', name: b.name,
                quantity: b.qty || b.quantity || 1,
                unitPrice: opt.price, totalPrice: opt.price
              })
            );
          }
        })
      );
    }
    return [...baseBOM, ...extraBOMs];
  }, [selectedType, selectedOptions, quantity, bomData, extraProducts, extraOptions]);

  const handleExtraOptionChange = ids => setExtraOptions(ids);

  const handleOptionChange = (key,value) => {
    if(key==='type'){ setSelectedType(value); setSelectedOptions({}); setExtraOptions([]); setQuantity(0); return; }
    setSelectedOptions(prev => {
      let u={...prev,[key]:value};
      if(formTypeRacks.includes(selectedType)) {
        if(key==='size'){u.height=undefined;u.level=undefined;u.formType=undefined;}
        else if(key==='height'){u.level=undefined;u.formType=undefined;}
        else if(key==='level'){u.formType=undefined;}
      }else if(selectedType==='하이랙') {
        if(key==='color'){u.size=undefined;u.height=undefined;u.level=undefined;}
        else if(key==='size'){u.height=undefined;u.level=undefined;}
        else if(key==='height'){u.level=undefined;}
      }else if(selectedType==='스텐랙') {
        if(key==='size'){u.height=undefined;u.level=undefined;}
        else if(key==='height'){u.level=undefined;}
      }
      return u;
    });
  };

  const addToCart = () => {
    if(!selectedType||!selectedOptions||quantity<=0) return;
    setCart(prev => [...prev, {
      id: `${Date.now()}`, type: selectedType,
      options: { ...selectedOptions }, extraOptions: [...extraOptions],
      quantity, price: currentPrice, bom: calculateCurrentBOM(),
      displayName: [selectedType, selectedOptions.formType, selectedOptions.size, selectedOptions.height, selectedOptions.level]
        .filter(Boolean).join(' ') + ` x ${quantity}개`
    }]);
  };
  const removeFromCart = id => setCart(prev => prev.filter(item => item.id !== id));
  const updateCurrentBOMQuantity = (idx,newQty) => setCurrentBOM(p => { const c=[...p]; c[idx]={...c[idx],quantity:newQty}; return c; });
  const updateCartBOMQuantity = (idx,newQty) => {
    if(!cartBOM[idx])return;
    const target=cartBOM[idx];
    setCart(prev=>prev.map(item=>({
      ...item,
      bom:item.bom.map(b=>
        b.rackType===target.rackType&&b.size===target.size&&b.name===target.name
          ? {...b,quantity:newQty}:b
      ),
    })));
  };

  useEffect(()=>{ setCurrentPrice(calculatePrice()); setCurrentBOM(calculateCurrentBOM()); },[calculatePrice,calculateCurrentBOM]);
  useEffect(()=>{
    const map={};
    cart.forEach(item=>{
      item.bom?.forEach(c=>{
        const key=`${c.rackType} ${c.size} ${c.name}`;
        if(map[key]) map[key].quantity+=c.quantity;
        else map[key]={...c};
      });
    });
    setCartBOM(Object.values(map));
    setCartTotal(cart.reduce((sum,i)=>sum+(i.price||0),0));
  },[cart]);

  return (
    <ProductContext.Provider value={{
      allOptions, availableOptions, colorLabelMap,
      selectedType, selectedOptions, handleOptionChange,
      extraOptions, handleExtraOptionChange,
      quantity, setQuantity, applyRate, setApplyRate,
      customPrice, setCustomPrice, isCustomPrice,
      currentPrice, currentBOM, cart, cartTotal, cartBOM,
      loading, addToCart, removeFromCart,
      updateCurrentBOMQuantity, updateCartBOMQuantity,
      extraProducts
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
