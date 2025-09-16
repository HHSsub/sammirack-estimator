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

const parseHeightMm = (h)=>{
  // H4500, H5000 등도 지원
  const m=String(h||"").replace(/[^\d]/g,"");
  return m?parseInt(m,10):0;
};
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

// 브레싱볼트 정확 규칙 적용
function calcBracingBoltCount(heightRaw, isConn, qty) {
  let heightMm = parseHeightMm(heightRaw);
  const baseHeight = 1500;
  let perUnit = 10 + Math.max(0, Math.floor((heightMm-baseHeight)/500))*2;
  if(isConn) perUnit = Math.floor(perUnit/2);
  return perUnit * qty;
}

// 브러싱고무는 기둥갯수와 항상 같게
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

  const calculatePrice=useCallback(()=>{
    if(!selectedType||quantity<=0) return 0;
    if(selectedType==="하이랙" && !selectedOptions.formType) return 0;
    if(customPrice>0) return Math.round(customPrice*quantity*(applyRate/100));
    let basePrice=0;
    if(formTypeRacks.includes(selectedType)){
      const {size,height:heightRaw,level:levelRaw,formType}=selectedOptions;
      const height=selectedType==="경량랙"&&heightRaw==="H750"?"H900":heightRaw;
      let pData;
      if(selectedType==="파렛트랙 철판형"){
        const hKey=String(height||"").replace(/^H/i,"");
        const lKey=(String(levelRaw||"").replace(/^L/i,"").replace(/^\s*$/,"0"))+"단";
        pData=data?.[selectedType]?.["기본가격"]?.[formType]?.[size]?.[hKey]?.[lKey];
      } else {
        pData=data?.[selectedType]?.["기본가격"]?.[size]?.[height]?.[levelRaw]?.[formType];
      }
      if(pData) basePrice=Number(pData)*(Number(quantity)||0);
      else {
        const rec=bomData?.[selectedType]?.[size]?.[height]?.[levelRaw]?.[formType];
        if(rec){
          const componentsWithAdminPrice = (rec.components || []).map(applyAdminEditPrice);
          const labelled=Number(rec.total_price)||0;
          const calculatedFromComponents = sumComponents(componentsWithAdminPrice);
            basePrice=(labelled>0&&!componentsWithAdminPrice.some(c=>c.hasAdminPrice)
            ? labelled 
            : calculatedFromComponents)*(Number(quantity)||0);
        }
      }
    } else if(selectedType==="스텐랙"){
      const p=data["스텐랙"]["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if(p) basePrice=p*quantity;
    } else if(selectedType==="하이랙"){
      const { size, color, height, level, formType } = selectedOptions;
      if(size && color && height && level && formType){
        const isHeaviest=/550kg$/.test(color)||/700kg$/.test(color);
        const dataSizeKey=isHeaviest
          ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[size]||size
          : size;
        const p=data["하이랙"]["기본가격"]?.[color]?.[dataSizeKey]?.[height]?.[level];
        if(p) basePrice=p*quantity;
      }
    }
    let extraPrice=0;
    (Object.values(extraProducts?.[selectedType]||{})).forEach(arr=>{
      if(Array.isArray(arr)){
        arr.forEach(opt=>{
          if(extraOptionsSel.includes(opt.id)) extraPrice+=Number(opt.price)||0;
        });
      }
    });
    const customExtra=selectedType==="경량랙"
      ? customMaterials.reduce((s,m)=>s+(Number(m.price)||0),0)
      : 0;
    return Math.round((basePrice+extraPrice+customExtra)*(applyRate/100));
  },[selectedType,selectedOptions,quantity,customPrice,applyRate,data,bomData,extraProducts,extraOptionsSel,customMaterials]);

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

  const getFallbackBOM=()=>{
    return [];
  };

  const calculateCurrentBOM=useCallback(()=> {
    return [];
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

  useEffect(()=>{
    const map={};
    cart.forEach(item=>{
      item.bom?.forEach(c=>{
        if(/베이스볼트/.test(c.name)) return;
        const key = (c.rackType==="파렛트랙" || c.rackType==="파렛트랙 철판형")
          ? `${normalizePartName(c.name)}__${c.specification||""}`
          : `${c.rackType}__${normalizePartName(c.name)}__${c.specification||""}`;
        if(map[key]){
          map[key].quantity+=c.quantity;
          map[key].totalPrice+=c.totalPrice||0;
        } else {
          map[key]={...c,name:normalizePartName(c.name)};
        }
      });
    });
    const merged=Object.values(map)
      .map(r=>ensureSpecification(r,{size:r.size}))
      .filter(r=>!/베이스볼트/.test(r.name));
    setCartBOM(sortBOMByMaterialRule(merged));
    setCartTotal(cart.reduce((s,i)=>s+(i.price||0),0));
  },[cart]);

  useEffect(()=>{
    const raw=customPrice>0?getFallbackBOM():calculateCurrentBOM();
    const processed=sortBOMByMaterialRule(
      raw.filter(r=>!/베이스볼트/.test(r.name))
         .map(r=>ensureSpecification(r,{size:r.size}))
    );
    setCurrentBOM(processed);
    setCurrentPrice(calculatePrice());
  },[calculatePrice,calculateCurrentBOM]);

  const cartBOMView=useMemo(()=>cartBOM,[cartBOM]);

  return (
    <ProductContext.Provider value={{
      allOptions,availableOptions,colorLabelMap,
      selectedType,selectedOptions,quantity,setQuantity,
      applyRate,setApplyRate,customPrice,setCustomPrice,
      handleOptionChange,addToCart,removeFromCart,updateCartItemQuantity,
      currentPrice,currentBOM,cart,cartTotal,cartBOM,cartBOMView,loading,
      extraProducts,extraOptionsSel,handleExtraOptionChange,
      customMaterials,addCustomMaterial,removeCustomMaterial,clearCustomMaterials,
      setTotalBomQuantity,
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts=()=>useContext(ProductContext);
