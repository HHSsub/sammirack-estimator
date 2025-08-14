import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProductContext = createContext();

const formTypeRacks = ['경량랙', '중량랙', '파렛트랙 철판형'];

const EXTRA_OPTIONS = {
  '파렛트랙 철판형': { height: ['H4500', 'H5000', 'H5500', 'H6000'] },
  '하이랙': { size: ['45x150'], height: ['150','200','250'], level: ['5단','6단'] }, // 하이랙 필수높이노출 108제거 (150~250만)
  '스텐랙': { level: ['5단','6단'], height: ['210'] },
  '경량랙': { height: ['H750'] } 
};

const COMMON_LEVELS = ['2단','3단','4단','5단','6단'];

const colorLabelMap = { '200kg': '270kg', '350kg': '450kg', '700kg': '500kg' };

// 높이/사이즈 문자열 파서(가벼움)
const parseSize = (sizeStr='') => {
  const m = sizeStr.match(/W?(\d+)[xX]D?(\d+)/);
  return m ? { w: m[1], d: m[2] } : { w: '', d: '' };
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
  const [quantity, setQuantity] = useState(''); // 초기값을 빈 문자열로 (수량입력전엔 빈칸)

  const [customPrice, setCustomPrice] = useState(0);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  const [extraOptionsSel, setExtraOptionsSel] = useState([]);
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [customMaterialPrice, setCustomMaterialPrice] = useState(0);

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

  useEffect(()=>{
    if(!selectedType){ setAvailableOptions({}); return; }
    const extra = EXTRA_OPTIONS[selectedType] || {};

    // 1) 폼타입 랙 (경량랙/중량랙/파렛트랙 철판형) — 로딩 전에도 안전하게 동작
    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};
      const isH750 = selectedType==='경량랙' && /^H?750$/.test(String(selectedOptions.height || ''));

      setAvailableOptions({
        size: Object.keys(bd),
        height: selectedOptions.size
          ? [...Object.keys(bd[selectedOptions.size] || {}), ...(extra.height || [])]
          : [...(extra.height || [])],
        level: selectedOptions.size && selectedOptions.height
          ? (
              isH750
                ? [...COMMON_LEVELS]
                : Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {})
            )
          : [],
        formType: selectedOptions.size && selectedOptions.height && selectedOptions.level
          ? (
              isH750
                ? ['독립형','연결형']
                : (
                    Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {}).length > 0
                      ? Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {})
                      : ['독립형','연결형']
                  )
            )
          : []
      });
      return;
    }

    // 2) 하이랙
    if (selectedType === '하이랙' && data?.하이랙) {
      const rd = data['하이랙'];
      const opts = { color: rd['색상'] || [] };
    
      if (selectedOptions.color) {
        const sizeListSafe = Object.keys(rd['기본가격']?.[selectedOptions.color] || {});
    
        // 500kg(=구 700kg)면 EXTRA size(45x150) 제외
        const isHeaviest =
          /500kg$/.test(selectedOptions.color) || /700kg$/.test(selectedOptions.color);
    
        const extraSizes = EXTRA_OPTIONS['하이랙']?.size || [];
        opts.size = isHeaviest
          ? sizeListSafe
          : Array.from(new Set([...sizeListSafe, ...extraSizes]));
    
        if (selectedOptions.size) {
          const heightListSafe = Object.keys(
            rd['기본가격']?.[selectedOptions.color]?.[selectedOptions.size] || {}
          );
          
          const allow250ExtraFor = ['60x108', '60x150', '60x200'];
          const extraH = allow250ExtraFor.includes(selectedOptions.size)
            ? (EXTRA_OPTIONS['하이랙']?.height || []).filter(h => h === '250')
            : [];
          
          // 중복 방지
          opts.height = Array.from(new Set([...heightListSafe, ...extraH]));    
          
          if (selectedOptions.height) {
            const levelsFromData = Object.keys(
              rd['기본가격']?.[selectedOptions.color]?.[selectedOptions.size]?.[selectedOptions.height] || {}
            );
            // 500kg은 데이터 레벨만, 그 외는 기존대로 합침
            opts.level = isHeaviest
              ? levelsFromData
              : Array.from(new Set([
                  ...levelsFromData,
                  ...(EXTRA_OPTIONS['하이랙'].level || []),
                  ...COMMON_LEVELS
                ]));
          }
        }
      }
      setAvailableOptions(opts);
      return;
    }

    // ▶ 스텐랙
    if (selectedType === '스텐랙' && data?.스텐랙) {
      const rd = data['스텐랙'];
      const opts = { size: Object.keys(rd['기본가격'] || {}) };    
      if (selectedOptions.size) {
        // 높이: data + EXTRA(210)
        const heightsFromData  = Object.keys(rd['기본가격'][selectedOptions.size] || {});
        const heightsFromExtra = EXTRA_OPTIONS['스텐랙']?.height || [];
        opts.height = Array.from(new Set([...heightsFromData, ...heightsFromExtra]));
      }
      if (selectedOptions.size && selectedOptions.height) {
        // 레벨: data + EXTRA(level) + COMMON_LEVELS(2~6단) → 210이어도 2~6단 전부 노출
        const levelsFromData = Object.keys(
          rd['기본가격']?.[selectedOptions.size]?.[selectedOptions.height] || {}
        );
        const levelsFromExtra = EXTRA_OPTIONS['스텐랙']?.level || [];
        opts.level = Array.from(new Set([
          ...levelsFromData,
          ...levelsFromExtra,
          ...COMMON_LEVELS
        ]));
      }
      opts.version = ['V1'];    
      setAvailableOptions(opts);
      return;
    }
    setAvailableOptions({});
  },[selectedType,selectedOptions,data,bomData]);

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
        ?. [selectedOptions.height]?.[selectedOptions.level];
      if(p) basePrice = p * quantity;
    }
    let extraPrice = 0;
    if(extraProducts[selectedType]){
      Object.values(extraProducts[selectedType]).forEach(catArr => catArr.forEach(opt => {
        if(extraOptionsSel.includes(opt.id)){
          extraPrice += opt.id === 'l1-custom' ? customMaterialPrice : opt.price;
        }
      }));
    }
    return Math.round((basePrice + extraPrice) * (applyRate/100));
  },[selectedType,selectedOptions,quantity,customPrice,applyRate,data,bomData,extraProducts,extraOptionsSel,customMaterialPrice]);

  // ▶ 장바구니 아이템 수량 변경 (가격·BOM까지 동기 업데이트)
  const updateCartItemQuantity = (id, nextQtyRaw) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const oldQty = item.quantity > 0 ? item.quantity : 1;
        const nextQty = Math.max(0, Number(nextQtyRaw) || 0);

        // 단가/부품수 per-qty 로 환산해 다시 곱해줌
        const unitPrice = (item.price || 0) / oldQty;
        const newPrice = Math.round(unitPrice * nextQty);

        const newBOM = (item.bom || []).map(c => {
          const perUnitQty = (c.quantity || 0) / oldQty;
          const q = perUnitQty * nextQty;
          const unit = c.unitPrice ?? c.unit_price ?? 0;
          return {
            ...c,
            quantity: q,
            totalPrice: unit ? unit * q : (c.total_price ? (c.total_price / oldQty) * nextQty : 0)
          };
        });

        return { ...item, quantity: nextQty, price: newPrice, bom: newBOM };
      })
    );
  };

// 🔹 사용자가 '전체 BOM'에서 수량을 직접 고친 값(오버라이드)을 보관
const [bomOverrides, setBomOverrides] = useState({}); // key -> 수량

// 🔹 표에서 보일 BOM = 집계(cartBOM) + 오버라이드 반영본
const cartBOMView = React.useMemo(() => {
  return (cartBOM || []).map(row => {
    const key = `${row.rackType} ${row.size || ''} ${row.name}`;
    const qty = bomOverrides[key];
    return qty === undefined ? row : { ...row, quantity: qty };
  });
}, [cartBOM, bomOverrides]);

// 🔹 '전체 BOM' 수량 직접 변경
const setTotalBomQuantity = (key, nextQtyRaw) => {
  const q = Math.max(0, Number(nextQtyRaw) || 0);
  setBomOverrides(prev => ({ ...prev, [key]: q }));
};
  
  const makeExtraOptionBOM = () => {
    if (!extraOptionsSel || !extraProducts[selectedType]) return [];
    const result = [];
    Object.values(extraProducts[selectedType]).forEach(catArr => {
      catArr.forEach(opt => {
        if (extraOptionsSel.includes(opt.id)) {
          result.push({
            rackType: selectedType,
            name: opt.name,
            specification: opt.specification || '',
            quantity: quantity,
            unitPrice: opt.price || 0,
            totalPrice: (opt.price || 0) * quantity,
            note: opt.note || '추가옵션'
          });
        }
      });
    });
    return result;
  };

  // 경량랙 H750 전용 BOM
  const makeLightRackH750BOM = () => {
    if (selectedType !== '경량랙') return [];
    if (!/^H?750$/.test(String(selectedOptions.height || ''))) return [];
    const q = Math.max(0, Number(quantity) || 0);
    if (q <= 0) return [];

    const sizeStr = selectedOptions.size || '';
    const { w, d } = parseSize(sizeStr);
    const lvl = parseInt(String(selectedOptions.level || '').replace(/[^\d]/g, ''), 10) || 5;
    const isConn = selectedOptions.formType === '연결형';

    const pillarQty = (isConn ? 2 : 4) * q;
    const connectBarQty = 4 * q;
    const shelfQty = lvl * q;
    const padTopQty = 2 * q;
    const padBottomQty = (isConn ? 8 : 10) * q;
    const seatQty = (isConn ? 2 : 4) * q;
    const pinQty = 8 * q;

    const sizeLabel = (w && d) ? `${w}*${d}` : sizeStr;
    const dOnly = d || '';

    return [
      { rackType:selectedType, size:sizeStr, name:`기둥(750)`, specification:`높이 750`, quantity:pillarQty, unitPrice:0, totalPrice:0 },
      { rackType:selectedType, size:sizeStr, name:'연결대', specification:'', quantity:connectBarQty, unitPrice:0, totalPrice:0 },
      { rackType:selectedType, size:sizeStr, name:'선반', specification:`사이즈 ${sizeLabel}`, quantity:shelfQty, unitPrice:0, totalPrice:0 },
      { rackType:selectedType, size:sizeStr, name:'받침(상)', specification:dOnly ? `(${dOnly})` : '', quantity:padTopQty, unitPrice:0, totalPrice:0 },
      { rackType:selectedType, size:sizeStr, name:'받침(하)', specification:dOnly ? `(${dOnly})` : '', quantity:padBottomQty, unitPrice:0, totalPrice:0 },
      { rackType:selectedType, size:sizeStr, name:'안전좌', specification:'', quantity:seatQty, unitPrice:0, totalPrice:0 },
      { rackType:selectedType, size:sizeStr, name:'안전핀', specification:'', quantity:pinQty, unitPrice:0, totalPrice:0 },
      ...makeExtraOptionBOM()
    ];
  };

  const getFallbackBOM = () => {
    // 경량랙 H750일 때도 customPrice 사용 시 BOM이 비지 않도록
    if (selectedType === '경량랙') {
      if (/^H?750$/.test(String(selectedOptions.height || ''))) {
        return makeLightRackH750BOM();
      }
    }

    if(selectedType==='파렛트랙 철판형'){
      const lvl = parseInt(selectedOptions.level || '') || 1;
      const sz = selectedOptions.size || '';
      const ht = selectedOptions.height || '';
      const form = selectedOptions.formType || '독립형';
      const baseSafetyLeftQty = 2 * quantity;
      const baseSafetyRightQty = form==='연결형'? 0 : 2 * quantity;
      return [
        { rackType:selectedType, size:sz, name:`기둥(${ht})`, specification:`높이 ${ht}`, quantity:2*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'로드빔', specification:`규격 ${sz}`, quantity:2*lvl*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'타이빔', specification:`규격 ${sz}`, quantity:2*lvl*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'베이스(안전좌)', specification:'', quantity:baseSafetyLeftQty, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'베이스(안전우)', specification:'', quantity:baseSafetyRightQty, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'안전핀', specification:'', quantity:2*lvl*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'수평브레싱', specification:'', quantity:1*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'경사브레싱', specification:'', quantity:1*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'앙카볼트', specification:'', quantity:4*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'베이스볼트', specification:'', quantity:4*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'브레싱볼트', specification:'', quantity:4*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'볼트세트', specification:'', quantity:1*quantity, unitPrice:0, totalPrice:0 },
        ...makeExtraOptionBOM()
      ];
    }
    if(selectedType==='하이랙'){
      return [
        { rackType:selectedType, name:'기둥', specification:`높이 ${selectedOptions.height||''}`, quantity:4*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, name:'선반', specification:`사이즈 ${selectedOptions.size||''}`, quantity:(parseInt(selectedOptions.level)||5)*quantity, unitPrice:0, totalPrice:0 },
        ...makeExtraOptionBOM()
      ];
    }
    if(selectedType==='스텐랙'){
      return [
        { rackType:selectedType, name:'기둥', specification:`높이 ${selectedOptions.height||''}`, quantity:4*quantity, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, name:'선반', specification:`사이즈 ${selectedOptions.size||''}`, quantity:(parseInt(selectedOptions.level)||5)*quantity, unitPrice:0, totalPrice:0 },
        ...makeExtraOptionBOM()
      ];
    }
    return makeExtraOptionBOM();
  };

  const calculateCurrentBOM = useCallback(()=>{
    if(customPrice>0) return getFallbackBOM();
    if(!selectedType||quantity<=0) return [];
    // 경량랙 H750: 데이터에 없더라도 실제 BOM 생성
    if (selectedType === '경량랙') {
      if (/^H?750$/.test(String(selectedOptions.height || ''))) {
        return makeLightRackH750BOM();
      }
    }
    if(selectedType==='파렛트랙 철판형'){
      const rec = bomData['파렛트랙 철판형']?.[selectedOptions.size]?.[selectedOptions.height]
        ?. [selectedOptions.level]?.[selectedOptions.formType];
      if(rec?.components){
        return [
          ...rec.components.map(c=>({
            rackType:'파렛트랙 철판형',
            size:selectedOptions.size,
            name:c.name,
            specification: c.specification ?? '',
            note: c.note ?? '',
            quantity:c.quantity * quantity,
            unitPrice: c.unit_price ?? 0,
            totalPrice: c.total_price ? (c.total_price * quantity) : (c.unit_price ? (c.unit_price * c.quantity * quantity) : 0)
          })),
          ...makeExtraOptionBOM()
        ];
      }
      return getFallbackBOM();
    }
    if(['하이랙','스텐랙'].includes(selectedType)){
      return getFallbackBOM();
    }
    if(['경량랙','중량랙'].includes(selectedType)){
      const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]
        ?. [selectedOptions.level]?.[selectedOptions.formType];
      return [
        ...(rec?.components ? rec.components.map(c=>({
          ...c,
          name: c.name,
          specification: c.specification ?? '',
          note: c.note ?? '',
          quantity: c.quantity * quantity,
          unitPrice: c.unit_price ?? 0,
          totalPrice: c.total_price ? (c.total_price * quantity) : (c.unit_price ? (c.unit_price * c.quantity * quantity) : 0)
        })) : []),
        ...makeExtraOptionBOM()
      ];
    }
    return makeExtraOptionBOM();
  },[selectedType,selectedOptions,quantity,customPrice,bomData,extraOptionsSel,extraProducts]);

  const handleOptionChange = (k,v) => {
    if(k==='type'){
      setSelectedType(v);
      setSelectedOptions({});
      setExtraOptionsSel([]);
      setQuantity();
      setCustomPrice();
      return;
    }
    setSelectedOptions(prev=>({...prev,[k]:v}));
  };

  const addToCart = () => {
    if(!selectedType||quantity<=0) return;
    setCart(prev=>[...prev,{
      id:`${Date.now()}`,
      type:selectedType,
      options:Object.fromEntries(Object.entries(selectedOptions).map(
        ([key,val]) => [key, val]
      )),
      extraOptions:[...extraOptionsSel],
      quantity,
      price: customPrice >0 ? customPrice : currentPrice,
      bom: customPrice >0 ? getFallbackBOM() : calculateCurrentBOM(),
      displayName:[
        selectedType,
        selectedOptions.formType,
        selectedOptions.size,
        selectedOptions.height,
        selectedOptions.level,
        selectedOptions.color ? selectedOptions.color : ''
      ].filter(Boolean).join(' ')
    }]);
  };

  const removeFromCart = id => setCart(prev=>prev.filter(i=>i.id!==id));

  useEffect(()=>{
    setCurrentPrice(calculatePrice());
    setCurrentBOM(customPrice>0 ? getFallbackBOM() : calculateCurrentBOM());
  },[calculatePrice,calculateCurrentBOM]);

  useEffect(()=>{
    const map={};
    cart.forEach(item=>{
      item.bom?.forEach(c=>{
        const key=`${c.rackType} ${c.size||''} ${c.name}`;
        if(map[key]) map[key].quantity += c.quantity;
        else map[key] = {...c};
      });
    });
    setCartBOM(Object.values(map));
    setCartTotal(cart.reduce((sum,i)=>sum+(i.price||0),0));
    // 원천(cart)이 바뀌면, 기존 오버라이드는 남겨둠(사용자 편집 유지)
  },[cart]);

  return (
    <ProductContext.Provider value={{
      allOptions, availableOptions, colorLabelMap,
      selectedType, selectedOptions,
      handleOptionChange,
      extraOptionsSel, handleExtraOptionChange:setExtraOptionsSel,
      quantity, setQuantity, applyRate, setApplyRate,
      customPrice, setCustomPrice,
      currentPrice, currentBOM, cart, cartTotal, cartBOM, loading,
      cartBOMView, setTotalBomQuantity, // ⬅⬅ 추가 공개
      addToCart, removeFromCart,
      extraProducts, customMaterialName, setCustomMaterialName,
      customMaterialPrice, setCustomMaterialPrice,
      updateCartItemQuantity
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = ()=>useContext(ProductContext);
