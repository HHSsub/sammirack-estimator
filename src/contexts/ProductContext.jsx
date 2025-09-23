import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo
} from "react";
import { sortBOMByMaterialRule } from "../utils/materialSort";

const ProductContext = createContext();

const formTypeRacks = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형"];

// 하이랙 고정 높이
const HIGH_RACK_HEIGHTS = ["150","200","250"];

const EXTRA_OPTIONS = {
  파렛트랙: { height: ["H4500","H5000","H5500","H6000"] },
  "파렛트랙 철판형": {
    height: ["1500","2000","2500","3000","3500","4000","H4500","H5000","H5500","H6000"],
    size: ["2080x800","2080x1000"]
  },
  하이랙: { size:["45x150"], level:["5단","6단"] },
  스텐랙: { level:["5단","6단"], height:["210"] },
  경량랙: { height:["H750"] }
};

const COMMON_LEVELS = ["2단","3단","4단","5단","6단"];
export const colorLabelMap = { "200kg":"270kg", "350kg":"450kg", "700kg":"550kg" };

const parseSizeKey=(s="")=>{
  const m=String(s).replace(/\s+/g,"").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m?{a:Number(m[1]),b:Number(m[2])}:null;
};
const sortSizes=(arr=[])=>[...new Set(arr)].sort((A,B)=>{
  const a=parseSizeKey(A),b=parseSizeKey(B);
  if(a&&b){ if(a.a!==b.a)return a.a-b.a; if(a.b!==b.b)return a.b-b.b; }
  return String(A).localeCompare(String(B),"ko");
});
const parseNum=(s="")=>{
  const m=String(s).match(/\d+/);
  return m?Number(m[0]):Number.POSITIVE_INFINITY;
};
const sortHeights=(arr=[])=>[...new Set(arr)].sort((a,b)=>parseNum(a)-parseNum(b));
const sortLevels=(arr=[])=>[...new Set(arr)].sort((a,b)=>parseNum(a)-parseNum(b));

const HIGHRACK_550_ALIAS_VIEW_FROM_DATA = { "80x146":"80x108", "80x206":"80x150" };
const HIGHRACK_550_ALIAS_DATA_FROM_VIEW = { "80x108":"80x146", "80x150":"80x206" };

const parseHeightMm = (h)=>Number(String(h||"").replace(/[^\d]/g,""))||0;
const parseLevel=(levelStr,rackType)=>{
  if(!levelStr) return 1;
  if(rackType==="파렛트랙 철판형"){
    const m=String(levelStr).match(/L?(\d+)/); return m?parseInt(m[1]):1;
  } else {
    const m=String(levelStr).match(/(\d+)/); return m?parseInt(m[1]):1;
  }
};

const parseWD=(size="")=>{
  const m=String(size).replace(/\s+/g,"").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m?{w:Number(m[1]),d:Number(m[2])}:{w:null,d:null};
};

const calcPalletIronShelfPerLevel=(size)=>{
  const {w}=parseWD(size);
  if(w===1380) return 2;
  if(w===2080) return 3;
  if(w===2580) return 4;
  return 1;
};
const calcHighRackShelfPerLevel=(size)=>{
  const {d}=parseWD(size);
  if(d===108) return 1;
  if(d===150||d===200) return 2;
  return 1;
};

// 브레싱볼트 규칙
function calcBracingBoltCount(heightRaw, isConn, qty) {
  let heightMm = parseHeightMm(heightRaw);
  const baseHeight = 1500;
  let perUnit = 10 + Math.max(0, Math.floor((heightMm-baseHeight)/500))*2;
  if(isConn) perUnit = Math.floor(perUnit/2);
  return perUnit * qty;
}

// 브러싱고무는 기둥 갯수와 동일
function calcBrushingRubberCount(postQty) {
  return postQty;
}

const extractWeightOnly = (color="")=>{
  const m = String(color).match(/(\d{2,4}kg)/);
  return m?m[1]:"";
};

const normalizePartName=(name="")=>{
  return name.replace(/브레싱고무/g,"브러싱고무");
};

const generatePartId = (item) => {
  const { rackType, name, specification } = item;
  const cleanName = name.replace(/[^\w가-힣]/g, '');
  const cleanSpec = (specification || '').replace(/[^\w가-힣]/g, '');
  return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
};

const applyAdminEditPrice = (item) => {
  try {
    const stored = localStorage.getItem('admin_edit_prices') || '{}';
    const priceData = JSON.parse(stored);
    const partId = generatePartId(item);
    const adminPrice = priceData[partId];
    if (adminPrice && adminPrice.price > 0) {
      return {
        ...item,
        unitPrice: adminPrice.price,
        totalPrice: adminPrice.price * (Number(item.quantity) || 0),
        hasAdminPrice: true,
        originalUnitPrice: item.unitPrice
      };
    }
  } catch (error) {
    console.error('관리자 단가 적용 실패:', error);
  }
  return item;
};

const ensureSpecification=(row,ctx={})=>{
  if(!row) return row;
  const {size,height,weight}=ctx;
  row.name = normalizePartName(row.name||"");
  const weightOnly = weight ? extractWeightOnly(weight) : "";
  if(!row.specification || !row.specification.trim()){
    const nm=row.name||"";
    if(/안전좌|안전핀/.test(nm) && row.rackType && row.rackType!=="하이랙" && !/파렛트랙/.test(nm)){
      row.specification=row.rackType;
    }
    if(/브러싱고무|브레싱고무|브레싱볼트|앙카볼트/.test(nm)){
      row.specification="";
    }
    else if(/(수평|경사)브레?싱/.test(nm)){
      const {d}=parseWD(size||"");
      row.specification=d?`${d}`:"";
    }
    else if(/기둥\(/.test(nm)&&height) row.specification=`높이 ${height}${weightOnly?` ${weightOnly}`:""}`;
    else if(/로드빔\(/.test(nm)){
      const m=nm.match(/\((\d+)\)/); if(m) row.specification=`${m[1]}${weightOnly?` ${weightOnly}`:""}`;
    } else if(/타이빔\(/.test(nm)){
      const m=nm.match(/\((\d+)\)/); if(m) row.specification=`${m[1]}${weightOnly?` ${weightOnly}`:""}`;
    } else if(/선반\(/.test(nm)){
      row.specification=`사이즈 ${size||""}${weightOnly?` ${weightOnly}`:""}`;
    } else if(/받침\(상\)\(/.test(nm)||/받침\(하\)\(/.test(nm)){
      const {d}=parseWD(size||""); row.specification=row.specification || (d?`D${d}`:"");
    }
    else if(/안전핀/.test(nm)&&(/파렛트랙/.test(nm)||/파렛트랙 철판형/.test(nm))){
      row.specification="안전핀";
    }
    else if(/브레싱/.test(nm)){
      const {d}=parseWD(size||"");
      row.specification=d?`${d}`:"";
    }
    else if(!row.specification && size){
      row.specification=`사이즈 ${size}${weightOnly?` ${weightOnly}`:""}`;
    }
  } else {
    if(weightOnly && row.rackType==="하이랙" && !row.specification.includes(weightOnly)){
      row.specification=`${row.specification} ${weightOnly}`;
    }
  }
  return row;
};

export const ProductProvider=({children})=>{
  const [data,setData]=useState({});
  const [bomData,setBomData]=useState({});
  const [extraProducts,setExtraProducts]=useState({});
  const [loading,setLoading]=useState(true);
  const [allOptions,setAllOptions]=useState({types:[]});
  const [availableOptions,setAvailableOptions]=useState({});
  const [selectedType,setSelectedType]=useState("");
  const [selectedOptions,setSelectedOptions]=useState({});
  const [quantity,setQuantity]=useState("");
  const [customPrice,setCustomPrice]=useState(0);
  const [applyRate,setApplyRate]=useState(100);
  const [currentPrice,setCurrentPrice]=useState(0);
  const [currentBOM,setCurrentBOM]=useState([]);
  const [cart,setCart]=useState([]);
  const [cartBOM,setCartBOM]=useState([]);
  const [cartTotal,setCartTotal]=useState(0);
  const [extraOptionsSel,setExtraOptionsSel]=useState([]);
  const [customMaterials,setCustomMaterials]=useState([]);

  const addCustomMaterial=(name,price)=>{
    if(!String(name).trim()||!(Number(price)>0)) return;
    setCustomMaterials(prev=>[...prev,{id:`cm-${Date.now()}-${prev.length}`,name:String(name),price:Number(price)}]);
  };
  const removeCustomMaterial=(id)=>setCustomMaterials(prev=>prev.filter(m=>m.id!==id));
  const clearCustomMaterials=()=>setCustomMaterials([]);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const dj=await (await fetch("./data.json")).json();
        const bj=await (await fetch("./bom_data.json")).json();
        const ejRaw=await (await fetch("./extra_options.json")).json();
        setData(dj); setBomData(bj);
        const canonical=["경량랙","중량랙","파렛트랙","파렛트랙 철판형","하이랙","스텐랙"];
        const fromData=Object.keys(dj||{});
        const types=canonical.filter(t=>fromData.includes(t));
        const leftovers=fromData.filter(t=>!types.includes(t));
        setAllOptions({types:[...types,...leftovers]});
        const ej={...(ejRaw||{})};
        canonical.forEach(t=>{ if(!ej[t]) ej[t]={}; });
        setExtraProducts(ej);
      }catch(e){ console.error("데이터 로드 실패",e); setAllOptions({types:[]}); }
      finally{ setLoading(false); }
    })();
  },[]);

  useEffect(()=>{
    if(!selectedType){ setAvailableOptions({}); return; }
    if(formTypeRacks.includes(selectedType)){
      const bd=bomData[selectedType]||{};
      const next={size:[],height:[],level:[],formType:[]};
      const sizesFromData=Object.keys(bd||{});
      const extraSizes=EXTRA_OPTIONS[selectedType]?.size||[];
      next.size=sortSizes([...sizesFromData,...extraSizes]);
      if(selectedOptions.size){
        const heightsFromData=Object.keys(bd[selectedOptions.size]||{});
        next.height=sortHeights([...heightsFromData,...(EXTRA_OPTIONS[selectedType]?.height||[])]);
      } else {
        next.height=sortHeights([...(EXTRA_OPTIONS[selectedType]?.height||[])]);
      }
      if(selectedOptions.size && selectedOptions.height){
        if(selectedType==="경량랙"&&selectedOptions.height==="H750"){
          const lk=Object.keys(bd[selectedOptions.size]?.["H900"]||{});
            next.level=lk.length?lk:[];
          if(selectedOptions.level){
            const fm=bd[selectedOptions.size]?.["H900"]?.[selectedOptions.level]||{};
            next.formType=Object.keys(fm).length?Object.keys(fm):["독립형","연결형"];
          }
        } else {
          const levelKeys=Object.keys(bd[selectedOptions.size]?.[selectedOptions.height]||{})||[];
          next.level=levelKeys.length?sortLevels(levelKeys):["L1","L2","L3","L4","L5","L6"];
          if(selectedOptions.level){
            const fm=bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]||{};
            next.formType=Object.keys(fm).length?Object.keys(fm):["독립형","연결형"];
          }
        }
      }
      setAvailableOptions(next);
      return;
    }
    if(selectedType==="하이랙" && data?.하이랙){
      const rd=data["하이랙"];
      const opts={ color: rd["색상"] || [] };
      if(selectedOptions.color){
        const color=selectedOptions.color;
        const weightOnly = extractWeightOnly(color);
        const hide45 = ["450kg","550kg","700kg"].includes(weightOnly);
        const isHeaviest = /(550kg|700kg)$/.test(color);
        const rawSizes=Object.keys(rd["기본가격"]?.[color]||{});
        const sizeViewList=rawSizes.map(s=>
          isHeaviest && HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s]
            ? HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s]
            : s
        );
        let baseSizes = hide45
          ? sizeViewList.filter(s=>s!=="45x150")
          : sizeViewList;
        (EXTRA_OPTIONS["하이랙"]?.size||[]).forEach(s=>{
            if(hide45 && s==="45x150") return;
          if(!baseSizes.includes(s)) baseSizes.push(s);
        });
        if(isHeaviest && !baseSizes.includes("80x200")) baseSizes.push("80x200");
        opts.size=sortSizes(baseSizes);
        if(selectedOptions.size){
          opts.height=[...HIGH_RACK_HEIGHTS];
          if(selectedOptions.height && !opts.height.includes(selectedOptions.height)){
            setSelectedOptions(prev=>({...prev,height:"",level:""}));
          }
          if(selectedOptions.height){
            const sizeKey = isHeaviest
              ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[selectedOptions.size]||selectedOptions.size
              : selectedOptions.size;
            const levelKeys = Object.keys(
              rd["기본가격"]?.[color]?.[sizeKey]?.[selectedOptions.height] || {}
            );
            const full = ["1단","2단","3단","4단","5단","6단"];
            let merged = levelKeys.length ? levelKeys : full;
            (EXTRA_OPTIONS["하이랙"]?.level||[]).forEach(l=>{
              if(!merged.includes(l)) merged.push(l);
            });
            if(isHeaviest){
              full.forEach(l=>{ if(!merged.includes(l)) merged.push(l); });
            }
            opts.level=sortLevels(merged);
            if(selectedOptions.level && !opts.level.includes(selectedOptions.level)){
              setSelectedOptions(prev=>({...prev,level:""}));
            }
          }
        }
      }
      opts.formType=["독립형","연결형"];
      setAvailableOptions(opts);
      return;
    }
    if(selectedType==="스텐랙" && data?.스텐랙){
      const rd=data["스텐랙"];
      const opts={ size: sortSizes(Object.keys(rd["기본가격"]||{})) };
      if(selectedOptions.size){
        const heightsFromData=Object.keys(rd["기본가격"][selectedOptions.size]||{});
        opts.height=sortHeights([...heightsFromData,(EXTRA_OPTIONS["스텐랙"]?.height||[])]);
      }
      if(selectedOptions.size && selectedOptions.height){
        const levelsFromData=Object.keys(
          rd["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height]||{}
        );
        opts.level=sortLevels([
          ...levelsFromData,
          ...(EXTRA_OPTIONS["스텐랙"]?.level||[]),
          ...COMMON_LEVELS,
        ]);
      }
      opts.version=["V1"];
      setAvailableOptions(opts);
      return;
    }
    setAvailableOptions({});
  },[selectedType,selectedOptions,data,bomData]);

  const sumComponents=(arr=[])=>arr.reduce((s,c)=>{
    const tp=Number(c.total_price)||0;
    const up=Number(c.unit_price)||0;
    const q=Number(c.quantity)||0;
    return s+(tp>0?tp:up*q);
  },0);

  // ========== 수정된 calculatePrice 함수 - BOM 가격 우선 계산 ==========
  const calculatePrice = useCallback(() => {
    if (!selectedType || quantity <= 0) return 0;
    if (selectedType === "하이랙" && !selectedOptions.formType) return 0;
    
    // 1순위: 사용자가 직접 입력한 커스텀 가격
    if (customPrice > 0) return Math.round(customPrice * quantity * (applyRate / 100));
    
    let basePrice = 0;
    let bomPrice = 0; // BOM 부품 단가 합산 가격
    let basicPrice = 0; // 기본 가격 (pData)
  
    if (formTypeRacks.includes(selectedType)) {
      const { size, height: heightRaw, level: levelRaw, formType } = selectedOptions;
      const height = selectedType === "경량랙" && heightRaw === "H750" ? "H900" : heightRaw;
      
      // ✅ BOM 부품 단가 합산 가격 계산 (우선 계산)
      const bom = calculateCurrentBOM();
      if (bom && bom.length > 0) {
        bomPrice = bom.reduce((sum, item) => {
          const effectivePrice = getEffectivePrice ? getEffectivePrice(item) : (Number(item.unitPrice) || 0);
          const quantity = Number(item.quantity) || 0;
          return sum + (effectivePrice * quantity);
        }, 0);
        console.log(`💰 BOM 총 가격 계산: ${bomPrice}원 (${bom.length}개 부품)`);
      }
      
      // 기본가격(pData) 조회 (백업용)
      let pData;
      if (selectedType === "파렛트랙 철판형") {
        const hKey = String(height || "").replace(/^H/i, "");
        const lKey = (String(levelRaw || "").replace(/^L/i, "").replace(/^\s*$/, "0")) + "단";
        pData = data?.[selectedType]?.["기본가격"]?.[formType]?.[size]?.[hKey]?.[lKey];
      } else {
        pData = data?.[selectedType]?.["기본가격"]?.[size]?.[height]?.[levelRaw]?.[formType];
      }
      
      if (pData) basicPrice = Number(pData);
      
      // ✅ 우선순위: BOM 가격 > 기본가격
      if (bomPrice > 0) {
        basePrice = bomPrice * (Number(quantity) || 0);
        console.log(`✅ BOM 가격 사용: ${basePrice}원 (BOM: ${bomPrice}원 × 수량: ${quantity})`);
      } else if (basicPrice > 0) {
        basePrice = basicPrice * (Number(quantity) || 0);
        console.log(`📋 기본가격 사용: ${basePrice}원 (기본: ${basicPrice}원 × 수량: ${quantity})`);
      }
      
    } else if (selectedType === "스텐랙") {
      const p = data["스텐랙"]["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) basePrice = p * quantity;
    } else if (selectedType === "하이랙") {
      const { size, color, height, level, formType } = selectedOptions;
      if (size && color && height && level && formType) {
        const isHeaviest = /550kg$/.test(color) || /700kg$/.test(color);
        const dataSizeKey = isHeaviest
          ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[size] || size
          : size;
        const p = data["하이랙"]["기본가격"]?.[color]?.[dataSizeKey]?.[height]?.[level];
        if (p) basePrice = p * quantity;
      }
    }
  
    // 추가 옵션 가격
    let extraPrice = 0;
    (Object.values(extraProducts?.[selectedType] || {})).forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(opt => {
          if (extraOptionsSel.includes(opt.id)) extraPrice += Number(opt.price) || 0;
        });
      }
    });
  
    // 커스텀 자재 가격 (경량랙만)
    const customExtra = selectedType === "경량랙"
      ? customMaterials.reduce((s, m) => s + (Number(m.price) || 0), 0)
      : 0;
  
    const finalPrice = Math.round((basePrice + extraPrice + customExtra) * (applyRate / 100));
    
    console.log(`💵 최종 가격: ${finalPrice}원 (기본: ${basePrice}, 추가: ${extraPrice}, 커스텀: ${customExtra}, 적용률: ${applyRate}%)`);
    
    return finalPrice;
  }, [selectedType, selectedOptions, quantity, customPrice, applyRate, data, bomData, extraProducts, extraOptionsSel, customMaterials, calculateCurrentBOM]);
  // ================================================================

  const makeExtraOptionBOM=()=>{
    const result=[];
    const qty=Number(quantity)||0;
    (Object.values(extraProducts?.[selectedType]||{})).forEach(arr=>{
      if(Array.isArray(arr)){
        arr.forEach(opt=>{
          if(extraOptionsSel.includes(opt.id)){
            const unit=Number(opt.price)||0;
            result.push({
              rackType:selectedType,
              name:normalizePartName(opt.name),
              specification:opt.specification||"",
              quantity:qty,
              unitPrice:unit,
              totalPrice:unit*qty,
              note:"추가옵션",
            });
          }
        });
      }
    });
    if(selectedType==="경량랙"){
      customMaterials.forEach(m=>{
        const unit=Number(m.price)||0;
        result.push({
          rackType:selectedType,
          name:normalizePartName(m.name),
          specification:"",
          quantity:qty,
          unitPrice:unit,
          totalPrice:unit*qty,
          note:"추가옵션",
        });
      });
    }
    return result;
  };

  const makeLightRackH750BOM=()=>{
    const qty=Number(quantity)||1;
    const lvl=parseInt(String(selectedOptions.level||"").replace(/[^\d]/g,""),10)||5;
    const isConn=selectedOptions.formType==="연결형";
    const pillarQty=(isConn?2:4)*qty;
    const connectBarQty=4*qty;
    const shelfQty=lvl*qty;
    const padTopQty=2*qty;
    const padBottomQty=2*qty;
    const seatQty=(isConn?2:4)*qty;
    const pinQty=8*qty;
    const sizeStr=selectedOptions.size||"";
    const {w:W_num,d:D_num}=parseWD(sizeStr);
    const frontNumMatch=(sizeStr||"").match(/\d+/);
    const frontNum=frontNumMatch?frontNumMatch[0]:sizeStr;
    const list=[
      {rackType:selectedType,size:sizeStr,name:"기둥(750)",specification:"높이 H750",quantity:pillarQty,unitPrice:0,totalPrice:0},
      {rackType:selectedType,size:sizeStr,name:`연결대(${W_num||frontNum})`,specification:W_num?`W${W_num}`:"",quantity:connectBarQty,unitPrice:0,totalPrice:0},
      {rackType:selectedType,size:sizeStr,name:`선반(${frontNum})`,specification:`사이즈 ${sizeStr||""}`,quantity:shelfQty,unitPrice:0,totalPrice:0},
      {rackType:selectedType,size:sizeStr,name:`받침(상)(${D_num||""})`,specification:D_num?`D${D_num}`:"",quantity:padTopQty,unitPrice:0,totalPrice:0},
      {rackType:selectedType,size:sizeStr,name:`받침(하)(${D_num||""})`,specification:D_num?`D${D_num}`:"",quantity:padBottomQty,unitPrice:0,totalPrice:0},
      {rackType:selectedType,size:sizeStr,name:`안전좌(${selectedType})`,specification:selectedType,quantity:seatQty,unitPrice:0,totalPrice:0},
      {rackType:selectedType,size:sizeStr,name:`안전핀(${selectedType})`,specification:selectedType,quantity:pinQty,unitPrice:0,totalPrice:0},
      ...makeExtraOptionBOM(),
    ].map(r=>ensureSpecification(r,{size:selectedOptions.size}));
    const listWithAdminPrices = list.map(applyAdminEditPrice);
    return sortBOMByMaterialRule(listWithAdminPrices.filter(r=>!/베이스볼트/.test(r.name)));
  };

  const appendCommonHardwareIfMissing=(list,qty)=>{
    const names=new Set(list.map(x=>normalizePartName(x.name.replace(/경사브래싱/g,"경사브레싱"))));
    const pushIfAbsent=(name,quantity)=>{
      if(name.includes("베이스볼트")) return;
      const normalized=normalizePartName(name.replace(/경사브래싱/g,"경사브레싱"));
      if(!names.has(normalized)){
        list.push({
          rackType:selectedType,size:selectedOptions.size,name:normalized,
          specification:"",quantity,unitPrice:0,totalPrice:0
        });
        names.add(normalized);
      }
    };
    if(selectedType==="파렛트랙"||selectedType==="파렛트랙 철판형"){
      const isConn=selectedOptions.formType==="연결형";
      const h=selectedOptions.height;
      const qtyNum = Number(qty) || 1;
      const postQty = isConn ? 2 * qtyNum : 4 * qtyNum;
      const braceBolt = calcBracingBoltCount(h, isConn, qtyNum);
      const rubber = calcBrushingRubberCount(postQty);
      const heightMm=parseHeightMm(h);
      const baseHeight=1500;
      const heightStep=500;
      const baseDiagonal=isConn?2:4;
      const additionalSteps=Math.max(0,Math.floor((heightMm-baseHeight)/heightStep));
      const additionalDiagonal=(isConn?1:2)*additionalSteps;
      const diagonal=(baseDiagonal+additionalDiagonal)*qtyNum;
      const horizontal=(isConn?2:4)*qtyNum;
      const anchor=(isConn?2:4)*qtyNum;
      pushIfAbsent("수평브레싱",horizontal);
      pushIfAbsent("경사브레싱",diagonal);
      pushIfAbsent("앙카볼트",anchor);
      pushIfAbsent("브레싱볼트",braceBolt);
      pushIfAbsent("브러싱고무",rubber);
    }
  };

const getFallbackBOM = () => {
  if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
    const lvl = parseLevel(selectedOptions.level, selectedType);
    const sz = selectedOptions.size || "";
    const ht = selectedOptions.height || "";
    const form = selectedOptions.formType || "독립형";
    const qty = Number(quantity) || 1;
    const { w, d } = parseWD(sz);
    const tieSpec = d != null ? String(d) : `규격 ${sz}`;
    const loadSpec = w != null ? String(Math.floor(w / 100) * 100) : `규격 ${sz}`;
    const base = [
      { rackType: selectedType, size: sz, name: `기둥(${ht})`, specification: `높이 ${ht}`, quantity: (form === "연결형" ? 2 : 4) * qty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: sz, name: `로드빔(${loadSpec})`, specification: loadSpec, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
      ...(selectedType === "파렛트랙 철판형" ? [] : [
        { rackType: selectedType, size: sz, name: `타이빔(${tieSpec})`, specification: tieSpec, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
      ]),
      { rackType: selectedType, size: sz, name: "안전핀(파렛트랙)", specification: "안전핀", quantity: 2 * lvl * 2 * qty, unitPrice: 0, totalPrice: 0 },
    ];
    if (selectedType === "파렛트랙 철판형") {
      const shelfPerLevel = calcPalletIronShelfPerLevel(sz);
      const frontNum = (selectedOptions.size || "").match(/\d+/);
      const frontNumVal = frontNum ? frontNum[0] : selectedOptions.size;
      base.push({
        rackType: selectedType, size: sz, name: `선반(${frontNumVal.trim()})`,
        specification: `사이즈 ${sz}`, quantity: shelfPerLevel * lvl * qty, unitPrice: 0, totalPrice: 0
      });
    }
    let filteredBase = base.filter(i => !i.name.includes("철판"));
    appendCommonHardwareIfMissing(filteredBase, qty);
    const filtered = [...filteredBase, ...makeExtraOptionBOM()]
      .filter(r => !/베이스볼트/.test(r.name))
      .map(r => ensureSpecification(r, { size: sz, height: ht, ...parseWD(sz) }));
    const filteredWithAdminPrices = filtered.map(applyAdminEditPrice);
    return sortBOMByMaterialRule(filteredWithAdminPrices);
  }

  if (selectedType === "하이랙") {
    const qty = Number(quantity) || 1;
    const level = parseInt(selectedOptions.level) || 1;
    const size = selectedOptions.size || "";
    const color = selectedOptions.color || "";
    const heightValue = selectedOptions.height || "";
    const formType = selectedOptions.formType || "독립형";
    const shelfPerLevel = calcHighRackShelfPerLevel(size);
    const sizeMatch = String(size).replace(/\s+/g, "").match(/(\d+)[xX](\d+)/);
    const rodBeamNum = sizeMatch ? sizeMatch[2] : "";
    const shelfNum = sizeMatch ? sizeMatch[1] : "";
    const weightOnly = extractWeightOnly(color);

    const pillarQty = formType === "연결형" ? 2 * qty : 4 * qty;

    const list = [
      {
        rackType: selectedType,
        name: `기둥(${heightValue})`,
        specification: `높이 ${heightValue}${weightOnly ? ` ${weightOnly}` : ""}`,
        quantity: pillarQty,
        unitPrice: 0,
        totalPrice: 0
      },
      {
        rackType: selectedType,
        name: `로드빔(${rodBeamNum})`,
        specification: `${rodBeamNum}${weightOnly ? ` ${weightOnly}` : ""}`,
        quantity: 2 * level * qty,
        unitPrice: 0,
        totalPrice: 0
      },
      {
        rackType: selectedType,
        name: `선반(${shelfNum})`,
        specification: `사이즈 ${size}${weightOnly ? ` ${weightOnly}` : ""}`,
        quantity: shelfPerLevel * level * qty,
        unitPrice: 0,
        totalPrice: 0
      },
      ...makeExtraOptionBOM(),
    ].map(r => ensureSpecification(r, { size, height: heightValue, ...parseWD(size), weight: weightOnly }));
    const listWithAdminPrices = list.map(applyAdminEditPrice);
    return sortBOMByMaterialRule(listWithAdminPrices.filter(r => !/베이스볼트/.test(r.name)));
  }

  if (selectedType === "스텐랙") {
    const heightValue = selectedOptions.height || "";
    const q = Number(quantity) || 1;
    const sz = selectedOptions.size || "";
    const sizeFront = (sz.split("x")[0]) || sz;
    const list = [
      { rackType: selectedType, name: `기둥(${heightValue})`, specification: `높이 ${heightValue}`, quantity: 4 * q, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, name: `선반(${sizeFront})`, specification: `사이즈 ${sz}`, quantity: (parseInt((selectedOptions.level || "").replace(/[^\d]/g, "")) || 0) * q, unitPrice: 0, totalPrice: 0 },
      ...makeExtraOptionBOM(),
    ].map(r => ensureSpecification(r, { size: sz, height: heightValue, ...parseWD(sz) }));
    const listWithAdminPrices = list.map(applyAdminEditPrice);
    return sortBOMByMaterialRule(listWithAdminPrices.filter(r => !/베이스볼트/.test(r.name)));
  }

  const extraBOM = makeExtraOptionBOM()
    .filter(r => !/베이스볼트/.test(r.name))
    .map(r => ensureSpecification(r, { size: r.size }));
  return extraBOM.map(applyAdminEditPrice);
};
  
  const calculateCurrentBOM=useCallback(()=> {
    if(!selectedType||quantity<=0) return [];
    if(selectedType==="하이랙" && !selectedOptions.formType) return [];
    if(selectedType==="파렛트랙"||selectedType==="파렛트랙 철판형"){
      const rec=bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType];
      if(rec?.components){
        const q=Number(quantity)||1;
        const sz=selectedOptions.size||"";
        const ht=selectedOptions.height||"";
        const lvl=parseLevel(selectedOptions.level,selectedType);
        const {w,d}=parseWD(sz);
        const hardwareNames=new Set(["수평브레싱","수평브래싱","경사브레싱","경사브래싱","앙카볼트","브레싱볼트","브러싱고무","브레싱고무","안전핀","베이스(안전좌)"]);
        const base=rec.components
          .filter(c=>!hardwareNames.has(normalizePartName(c.name)))
          .filter(c=>!(selectedType==="파렛트랙 철판형"&&c.name.includes("철판")))
          .filter(c=>!(selectedType==="파렛트랙 철판형"&&c.name.includes("타이빔")))
          .map(c=>{
            let nm=normalizePartName(c.name);
            let spec="";
            if(nm.includes("기둥")){ nm=`기둥(${ht})`; spec=`높이 ${ht}`; }
            else if(nm.includes("로드빔")){ nm=`로드빔(${w})`; spec=String(w); }
            else if(nm.includes("타이빔")){ nm=`타이빔(${d})`; spec=String(d); }
            else if(nm.includes("선반")){ nm=`선판(${w})`; spec=`사이즈 W${w}xD${d}`; }
            else if(nm.includes("안전좌")) return null;
            else if(nm.includes("안전핀")){ nm="안전핀(파렛트랙)"; spec="안전핀"; }
            else if(nm.includes("받침")){
              nm=nm.includes("상")?`받침(상)(${d})`:`받침(하)(${d})`; spec=`D${d}`;
            } else spec=c.specification??"";
            return {
              rackType:selectedType,size:sz,name:nm,specification:spec,note:c.note??"",
              quantity:(Number(c.quantity)||0)*q,
              unitPrice:Number(c.unit_price)||0,
              totalPrice:Number(c.total_price)>0?Number(c.total_price)*q:(Number(c.unit_price)||0)*(Number(c.quantity)||0)*q
            };
          }).filter(Boolean);
        if(selectedType==="파렛트랙 철판형"){
          const frontNumMatch=(sz||"").match(/\d+/);
          const frontNum=frontNumMatch?frontNumMatch[0]:sz;
          if(!base.some(p=>p.name.includes("선반("))){
            const shelfPerLevel=calcPalletIronShelfPerLevel(sz);
            base.push({
              rackType:selectedType,size:sz,name:`선반(${frontNum.trim()})`,
              specification:`사이즈 ${sz}`,quantity:shelfPerLevel*lvl*q,
              unitPrice:0,totalPrice:0
            });
          }
        }
        if(!base.some(b=>b.name.startsWith("안전핀"))){
          base.push({
            rackType:selectedType,size:sz,name:"안전핀(파렛트랙)",specification:"안전핀",
            note:"",quantity:2*lvl*2*q,unitPrice:0,totalPrice:0
          });
        }
        appendCommonHardwareIfMissing(base,q);
        const finalized=[...base,...makeExtraOptionBOM()]
          .filter(r=>!/베이스볼트/.test(r.name))
          .map(r=>ensureSpecification(r,{size:sz,height:ht,...parseWD(sz)}));
        const finalizedWithAdminPrices = finalized.map(applyAdminEditPrice);
        return sortBOMByMaterialRule(finalizedWithAdminPrices);
      }
      return getFallbackBOM();
    }
    if(selectedType==="하이랙"||selectedType==="스텐랙"){
      return getFallbackBOM();
    }
    if(["경량랙","중량랙"].includes(selectedType)){
      if(selectedType==="경량랙"&&selectedOptions.height==="H750") return makeLightRackH750BOM();
      const rec=bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType];
      const q=Number(quantity)||1;
      const sz=selectedOptions.size||"";
      const ht=selectedOptions.height||"";
      const sizeMatch=sz.match(/W?(\d+)[xX]D?(\d+)/i)||[];
      const W_num=sizeMatch[1]||"";
      const D_num=sizeMatch[2]||"";
      const base=(rec?.components||[]).map(c=>{
        let name=normalizePartName(c.name);
        let specification=c.specification??"";
        if(name.includes("기둥")){ name=`기둥(${ht})`; specification=`높이 ${ht}`; }
        else if(name.includes("받침")){ name=name.includes("상")?`받침(상)(${D_num})`:`받침(하)(${D_num})`; specification=`D${D_num}`; }
        else if(name.includes("연결대")){ name=`연결대(${W_num})`; specification=`W${W_num}`; }
        else if(name.includes("선반")){ name=`선반(${W_num})`; specification=`사이즈 W${W_num}xD${D_num}`; }
        else if(name.includes("안전좌")){ name=`안전좌(${selectedType})`; specification=selectedType; }
        else if(name.includes("안전핀")){ name=`안전핀(${selectedType})`; specification=selectedType; }
        else if(!specification && /\d/.test(name)){ specification=`사이즈 ${sz}`; }
        const row={
          rackType:selectedType,size:sz,name,specification,note:c.note??"",
          quantity:(Number(c.quantity)||0)*q,
          unitPrice:Number(c.unit_price)||0,
          totalPrice:Number(c.total_price)>0?Number(c.total_price)*q:(Number(c.unit_price)||0)*(Number(c.quantity)||0)*q
        };
        return ensureSpecification(row,{size:sz,height:ht,...parseWD(sz)});
      });
      const baseWithAdminPrices = base.map(applyAdminEditPrice);
      return sortBOMByMaterialRule(
        [...baseWithAdminPrices,...makeExtraOptionBOM()].filter(r=>!/베이스볼트/.test(r.name))
      );
    }
    const extraBOM = makeExtraOptionBOM()
      .filter(r=>!/베이스볼트/.test(r.name))
      .map(r=>ensureSpecification(r,{size:r.size}));
    return extraBOM.map(applyAdminEditPrice);
  },[selectedType,selectedOptions,quantity,customPrice,bomData,extraOptionsSel,extraProducts,customMaterials]);

  const handleOptionChange=(k,v)=>{
    if(k==="type"){
      setSelectedType(v);
      setSelectedOptions({});
      setExtraOptionsSel([]);
      setQuantity("");
      setCustomPrice(0);
      clearCustomMaterials();
      return;
    }
    setSelectedOptions(prev=>({...prev,[k]:v}));
    if(["color","size","height","level","formType"].includes(k)) setCustomPrice(0);
  };
  const handleExtraOptionChange=(ids)=>{
    setExtraOptionsSel(Array.from(new Set(ids||[])).map(String));
  };

  const addToCart=()=>{
    if(!selectedType||quantity<=0) return;
    if(selectedType==="하이랙" && !selectedOptions.formType) return;
    setCart(prev=>[...prev,{
      id:`${Date.now()}`,
      type:selectedType,
      options:{...selectedOptions},
      extraOptions:[...extraOptionsSel],
      quantity,
      price:customPrice>0?customPrice:currentPrice,
      bom:calculateCurrentBOM(),
      displayName:[
        selectedType,
        selectedOptions.formType,
        selectedOptions.size,
        selectedOptions.height,
        selectedOptions.level,
        selectedOptions.color||""
      ].filter(Boolean).join(" "),
    }]);
  };
  const removeFromCart=id=>setCart(prev=>prev.filter(i=>i.id!==id));

  const updateCartItemQuantity=(id,nextQtyRaw)=>{
    setCart(prev=>prev.map(item=>{
      if(item.id!==id) return item;
      const oldQty=item.quantity>0?item.quantity:1;
      const nextQty=Math.max(0,Number(nextQtyRaw)||0);
      const unitPrice=(item.price||0)/oldQty;
      const newPrice=Math.round(unitPrice*nextQty);
      const newBOM=(item.bom||[]).map(c=>{
        const perUnitQty=(c.quantity||0)/oldQty;
        const q=perUnitQty*nextQty;
        const unit=c.unitPrice ?? c.unit_price ?? 0;
        return {
          ...c,
          quantity:q,
          totalPrice:unit?unit*q:(c.total_price?(c.total_price/oldQty)*nextQty:0)
        };
      });
      return {...item,quantity:nextQty,price:newPrice,bom:newBOM};
    }));
  };

  const setTotalBomQuantity = (key, newQuantity) => {
    const qty = Math.max(0, Number(newQuantity) || 0);
    setCart(prevCart => prevCart.map(item => {
      const updatedBOM = (item.bom || []).map(bomItem => {
        const bomKey = `${bomItem.rackType} ${bomItem.size || ''} ${bomItem.name}`;
        if (bomKey === key) {
          const effectiveUnitPrice = bomItem.hasAdminPrice ? bomItem.unitPrice : (Number(bomItem.unitPrice) || 0);
          return {
            ...bomItem,
            quantity: qty,
            totalPrice: effectiveUnitPrice * qty
          };
        }
        return bomItem;
      });
      const newItemTotal = updatedBOM.reduce((sum, bomItem) => {
        return sum + (Number(bomItem.totalPrice) || 0);
      }, 0);
      return {
        ...item,
        bom: updatedBOM,
        price: newItemTotal
      };
    }));
  };

  const cartBOMView = useMemo(() => {
    const bomMap = new Map();
    cart.forEach(item => {
      if (item.bom && Array.isArray(item.bom)) {
        item.bom.forEach(bomItem => {
          const key = `${bomItem.rackType} ${bomItem.size || ''} ${bomItem.name}`;
          if (bomMap.has(key)) {
            const existing = bomMap.get(key);
            bomMap.set(key, {
              ...existing,
              quantity: existing.quantity + (bomItem.quantity || 0),
              totalPrice: existing.totalPrice + (bomItem.totalPrice || 0)
            });
          } else {
            bomMap.set(key, {
              ...bomItem,
              quantity: bomItem.quantity || 0,
              totalPrice: bomItem.totalPrice || 0,
              unitPrice: bomItem.unitPrice || bomItem.unit_price || 0
            });
          }
        });
      }
    });

    const result = Array.from(bomMap.values());
    return sortBOMByMaterialRule(result);
  }, [cart]);

  // ========== 수정된 currentPrice 계산 - BOM 기반 가격 우선 사용 ==========
  useEffect(() => {
    const price = calculatePrice();
    setCurrentPrice(price);
  }, [calculatePrice]);

  // ========== 수정된 currentBOM 계산 - 관리자 단가 적용 ==========
  useEffect(() => {
    const bom = calculateCurrentBOM();
    setCurrentBOM(bom);
  }, [calculateCurrentBOM]);

  // ========== cartTotal 계산 - BOM 기반 가격 반영 ==========
  useEffect(() => {
    const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    setCartTotal(total);
  }, [cart]);


  // ✅ canAddItem 조건 수정 - BOM 가격이 있으면 추가 가능
  const canAddItem = useMemo(() => {
    if (!selectedType || !quantity || Number(quantity) <= 0) return false;
    if (selectedType === "하이랙" && !selectedOptions.formType) return false;
    
    // customPrice가 있으면 무조건 가능
    if (customPrice > 0) return true;
    
    // BOM 부품 단가 합산이 0보다 크면 가능 (기본가격이 없어도 됨)
    const bom = calculateCurrentBOM();
    const bomTotal = bom.reduce((sum, item) => {
      const effectivePrice = getEffectivePrice ? getEffectivePrice(item) : (Number(item.unitPrice) || 0);
      return sum + (effectivePrice * (Number(item.quantity) || 0));
    }, 0);
    
    if (bomTotal > 0) {
      console.log(`✅ BOM 총액으로 추가 가능: ${bomTotal}원`);
      return true;
    }
    
    // 기본가격이 있어도 가능
    const currentPrice = calculatePrice();
    if (currentPrice > 0) {
      console.log(`✅ 기본가격으로 추가 가능: ${currentPrice}원`);
      return true;
    }
    
    console.log(`❌ 추가 불가: BOM(${bomTotal}원), 기본가격(${currentPrice}원)`);
    return false;
  }, [selectedType, selectedOptions, quantity, customPrice, calculateCurrentBOM, calculatePrice]);
  
  // ✅ getEffectivePrice 함수 추가 (ProductContext 내에서 사용)
  const getEffectivePrice = useCallback((item) => {
    if (typeof window !== 'undefined' && window.getEffectivePrice) {
      return window.getEffectivePrice(item);
    }
    
    // fallback: 통합 유틸리티 임포트
    try {
      const { getEffectivePrice: utilGetEffectivePrice } = require('../utils/unifiedPriceManager');
      return utilGetEffectivePrice(item);
    } catch (error) {
      console.warn('unifiedPriceManager import 실패, 기본 단가 사용');
      return Number(item.unitPrice) || 0;
    }
  }, []);

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within ProductProvider');
  }
  return context;
};
