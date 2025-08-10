import React,
  { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();
const formTypeRacks = ['경량랙','중량랙','파렛트랙'];

const EXTRA_OPTIONS = {
  '파렛트랙': { height: ['H4500','H5000','H5500','H6000'] },
  '하이랙': { size: ['45x150'], height: ['108','150','200','250'], level: ['5단','6단'] },
  '스텐랙': { level: ['5단','6단'] }
};

export const ProductProvider = ({children}) => {
  const [data,setData] = useState({});
  const [bomData,setBomData] = useState({});
  const [extraProducts,setExtraProducts] = useState({});
  const [loading,setLoading] = useState(true);

  const [allOptions,setAllOptions] = useState({types: []});
  const [availableOptions,setAvailableOptions] = useState({});
  const [selectedType,setSelectedType] = useState('');
  const [selectedOptions,setSelectedOptions] = useState({});
  const [quantity,setQuantity] = useState(0);

  const [customPrice,setCustomPrice] = useState(0);
  const [applyRate,setApplyRate] = useState(100);

  const [currentPrice,setCurrentPrice] = useState(0);
  const [currentBOM,setCurrentBOM] = useState([]);

  const [cart,setCart] = useState([]);
  const [cartBOM,setCartBOM] = useState([]);
  const [cartTotal,setCartTotal] = useState(0);

  const [extraOptionsSel,setExtraOptionsSel] = useState([]);
  const [customMaterialName,setCustomMaterialName] = useState('');
  const [customMaterialPrice,setCustomMaterialPrice] = useState(0);

  const colorLabelMap = { '200kg':'270kg','350kg':'450kg' };

  // 데이터 로드
  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const dj = await (await fetch('./data.json')).json();
        setData(dj);
        setAllOptions({ types:Object.keys(dj) });

        const bj = await (await fetch('./bom_data.json')).json();
        setBomData(bj);

        const ej = await (await fetch('./extra_options.json')).json();
        setExtraProducts(ej);
      }catch(e){
        console.error('데이터 로드 실패',e);
        setAllOptions({types:[]});
      }finally{
        setLoading(false);
      }
    })();
  },[]);

  // 옵션 목록 구성
  useEffect(()=>{
    if(!selectedType){ setAvailableOptions({}); return; }
    const extra = EXTRA_OPTIONS[selectedType] || {};

    // 경량,중량,파렛트랙
    if(formTypeRacks.includes(selectedType) && bomData[selectedType]){
      const bd = bomData[selectedType];
      setAvailableOptions({
        size: Object.keys(bd),
        height: selectedOptions.size
          ? [...Object.keys(bd[selectedOptions.size] || {}), ...(extra.height||[])]
          : [...(extra.height||[])],
        level: selectedOptions.size && selectedOptions.height
          ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {})
          : [],
        formType: selectedOptions.size && selectedOptions.height && selectedOptions.level
          ? (
            Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {}).length > 0
              ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {})
              : ['독립형','연결형']
          )
          : []
      });
      return;
    }

    // 하이랙
    if(selectedType==='하이랙' && data?.하이랙){
      const rd = data['하이랙'];
      const opts = { color: rd['색상'] || [] };
      if(selectedOptions.color){
        opts.size = [...Object.keys(rd['기본가격'][selectedOptions.color] || {}), ...(extra.size||[])];
        if(selectedOptions.size){
          opts.height = [...Object.keys(rd['기본가격'][selectedOptions.color]?.[selectedOptions.size] || {}), ...(extra.height||[])];
          if(selectedOptions.height){
            opts.level = [...Object.keys(rd['기본가격'][selectedOptions.color][selectedOptions.size][selectedOptions.height]||{}), ...(extra.level||[])];
          }
        }
      }
      setAvailableOptions(opts);
      return;
    }

    // 스텐랙
    if(selectedType==='스텐랙' && data?.스텐랙){
      const rd = data['스텐랙'];
      const opts = { size:Object.keys(rd['기본가격'] || {}) };
      if(selectedOptions.size)
        opts.height = Object.keys(rd['기본가격'][selectedOptions.size] || {});
      if(selectedOptions.size && selectedOptions.height)
        opts.level = [...Object.keys(rd['기본가격'][selectedOptions.size][selectedOptions.height]||{}), ...(extra.level||[])];
      opts.version = ['V1'];
      setAvailableOptions(opts);
      return;
    }
    setAvailableOptions({});
  },[selectedType,selectedOptions,bomData,data]);

  // 가격 계산
  const calculatePrice = useCallback(()=>{
    if(!selectedType||quantity<=0) return 0;
    if(customPrice>0) return Math.round(customPrice*quantity*(applyRate/100));
    let basePrice = 0;
    if(formTypeRacks.includes(selectedType)){
      const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]
        ?. [selectedOptions.level]?.[selectedOptions.formType];
      if(rec?.total_price) basePrice = rec.total_price * quantity;
    }else if(selectedType==='스텐랙'){
      const p = data['스텐랙']['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if(p) basePrice = p * quantity;
    }else if(selectedType==='하이랙'){
      const p = data['하이랙']['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]
        ?.[selectedOptions.height]?.[selectedOptions.level];
      if(p) basePrice = p * quantity;
    }
    let extraPrice = 0;
    if(extraProducts[selectedType]){
      Object.values(extraProducts[selectedType]).forEach(catArr=>catArr.forEach(opt=>{
        if(extraOptionsSel.includes(opt.id)){
          extraPrice += opt.id==='l1-custom' ? customMaterialPrice : opt.price;
        }
      }));
    }
    return Math.round((basePrice + extraPrice) * (applyRate/100));
  },[selectedType,selectedOptions,quantity,customPrice,applyRate,data,bomData,extraProducts,extraOptionsSel,customMaterialPrice]);

  // BOM 추정 규칙
  const getFallbackBOM = ()=>{
    // 파렛트랙
    if(selectedType==='파렛트랙'){
      const lvl = parseInt(selectedOptions.level||'')||1;
      const sz = selectedOptions.size || '';
      const ht = selectedOptions.height || '';
      const form = selectedOptions.formType || '독립형';
      const baseSafetyLeftQty = 2*quantity;
      const baseSafetyRightQty = form==='연결형'? 0 : 2*quantity;
      return [
        { rackType:selectedType, size:sz, name:`기둥(${ht})`, quantity:2*quantity },
        { rackType:selectedType, size:sz, name:'로드빔', quantity:2*lvl*quantity },
        { rackType:selectedType, size:sz, name:'타이빔', quantity:2*lvl*quantity },
        { rackType:selectedType, size:sz, name:'베이스(안전좌)', quantity:baseSafetyLeftQty },
        { rackType:selectedType, size:sz, name:'베이스(안전우)', quantity:baseSafetyRightQty },
        { rackType:selectedType, size:sz, name:'안전핀', quantity:2*lvl*quantity },
        { rackType:selectedType, size:sz, name:'수평브레싱', quantity:1*quantity },
        { rackType:selectedType, size:sz, name:'경사브래싱', quantity:1*quantity },
        { rackType:selectedType, size:sz, name:'앙카볼트', quantity:4*quantity },
        { rackType:selectedType, size:sz, name:'베이스볼트', quantity:4*quantity },
        { rackType:selectedType, size:sz, name:'브레싱볼트', quantity:4*quantity },
        { rackType:selectedType, size:sz, name:'볼트세트', quantity:1*quantity },
      ];
    }
    // 하이랙 / 스텐랙 - 5단/6단 포함
    if(['하이랙','스텐랙'].includes(selectedType)){
      const lvl = parseInt(selectedOptions.level)|| (selectedOptions.level && selectedOptions.level.includes('5')?5:selectedOptions.level.includes('6')?6:0);
      return [
        { rackType:selectedType, size:selectedOptions.size, name:'기둥', quantity:4*quantity },
        { rackType:selectedType, size:selectedOptions.size, name:'선반', quantity:lvl*quantity },
        { rackType:selectedType, size:selectedOptions.size, name:'볼트세트', quantity:1*quantity }
      ];
    }
    return [];
  };

  const calculateCurrentBOM = useCallback(()=>{
    if(customPrice>0) return getFallbackBOM();
    if(!selectedType||quantity<=0) return [];
    if(selectedType==='파렛트랙'){
      const rec = bomData['파렛트랙']?.[selectedOptions.size]?.[selectedOptions.height]
        ?. [selectedOptions.level]?.[selectedOptions.formType];
      if(rec?.components){
        return rec.components.map(c=>({
          rackType:'파렛트랙',
          size:selectedOptions.size,
          name:c.name,
          quantity:c.quantity*quantity
        }));
      }
      return getFallbackBOM();
    }
    if(['하이랙','스텐랙'].includes(selectedType)) return getFallbackBOM();
    if(['경량랙','중량랙'].includes(selectedType)){
        const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]
          ?. [selectedOptions.level]?.[selectedOptions.formType];
        return rec?.components ? rec.components.map(c=>({...c, quantity:c.quantity*quantity})) : [];
    }
    return [];
  },[selectedType,selectedOptions,quantity,customPrice,bomData]);

  // 장바구니
  const addToCart = ()=>{
    if(!selectedType || quantity<=0) return;
    setCart(p=>[...p,{
      id:`${Date.now()}`,
      type:selectedType,
      options:{...selectedOptions},
      extraOptions: [...extraOptionsSel],
      quantity,
      price: customPrice>0? customPrice : currentPrice,
      bom: customPrice>0? getFallbackBOM() : calculateCurrentBOM(),
      displayName:[selectedType,selectedOptions.formType,selectedOptions.size,selectedOptions.height,selectedOptions.level]
        .filter(Boolean).join(' ')
    }]);
  };

  const removeFromCart = id => setCart(p=>p.filter(i=>i.id!==id));

  const updateCurrentBOMQuantity = (idx,newQty)=>{
    setCurrentBOM(b=>{
      const copy=[...b];
      copy[idx] = {...copy[idx], quantity:newQty};
      return copy;
    });
  };
  const updateCartBOMQuantity = (idx,newQty)=>{
    if(!cartBOM[idx])return;
    const target = cartBOM[idx];
    setCart(prev=>prev.map(item=>({
      ...item,
      bom: item.bom.map(b=>
        b.rackType===target.rackType && b.size===target.size && b.name===target.name
          ? {...b, quantity:newQty}
          : b
      )
    })));
  };

  useEffect(()=>{
    setCurrentPrice(calculatePrice());
    setCurrentBOM(customPrice>0? getFallbackBOM() : calculateCurrentBOM());
  },[calculatePrice,calculateCurrentBOM]);

  useEffect(()=>{
    const map={};
    cart.forEach(item=>{
      item.bom?.forEach(c=>{
        const key=`${c.rackType} ${c.size} ${c.name}`;
        if(map[key]) map[key].quantity += c.quantity;
        else map[key]={...c};
      });
    });
    setCartBOM(Object.values(map));
    setCartTotal(cart.reduce((sum,i)=>sum+(i.price||0),0));
  },[cart]);

  return (
    <ProductContext.Provider value={{
      allOptions, availableOptions, colorLabelMap,
      selectedType, selectedOptions,
      handleOptionChange:(k,v)=>{
        if(k==='type'){ setSelectedType(v); setSelectedOptions({}); setExtraOptionsSel([]); setQuantity(0); setCustomPrice(0); return;}
        setSelectedOptions(prev=>({...prev,[k]:v}));
      },
      extraOptionsSel, handleExtraOptionChange:setExtraOptionsSel,
      quantity,setQuantity, applyRate,setApplyRate,
      customPrice,setCustomPrice,
      currentPrice,currentBOM,cart,cartTotal,cartBOM,loading,
      addToCart, removeFromCart,
      updateCurrentBOMQuantity, updateCartBOMQuantity,
      extraProducts, customMaterialName, setCustomMaterialName, customMaterialPrice, setCustomMaterialPrice
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = ()=>useContext(ProductContext);
