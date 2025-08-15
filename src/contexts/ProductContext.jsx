// src/contexts/ProductContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ProductContext = createContext();

// 폼타입 랙(계단식 옵션 구조) 목록
const formTypeRacks = ['경량랙', '중량랙', '파렛트랙', '파렛트랙 철판형'];

// 타입별 허용 규격(참고용: 실제 노출은 bom_data 기준, 정렬만 적용)
const PREFERRED_SIZES = {
  '파렛트랙': ['W1380xD1000','W2580xD1000','W2780xD1000'],
  '파렛트랙 철판형': ['W1380xD1000','W2580xD1000','W1380xD800','W2580xD800']
};

// 데이터 비존재 항목 보조 노출(가격미포함 추가옵션)
const EXTRA_OPTIONS = {
  '파렛트랙': { height: ['H4500', 'H5000', 'H5500', 'H6000'] },
  '파렛트랙 철판형': { height: ['H4500', 'H5000', 'H5500', 'H6000'] },
  // 하이랙: 108은 제외, 150/200/250만
  '하이랙': { size: ['45x150'], height: ['150','200','250'], level: ['5단','6단'] },
  '스텐랙': { level: ['5단','6단'], height: ['210'] },
  // 경량랙 H750 (데이터엔 없음)
  '경량랙': { height: ['H750'] }
};

const COMMON_LEVELS = ['2단','3단','4단','5단','6단'];

const colorLabelMap = { '200kg': '270kg', '350kg': '450kg', '700kg': '550kg' };

// 사이즈 파서
const parseSize = (sizeStr='') => {
  const m = sizeStr.match(/W?(\d+)[xX]D?(\d+)/);
  return m ? { w: m[1], d: m[2] } : { w: '', d: '' };
};

// ---- 정렬 유틸 ----
const parseSizeKey = (s='') => {
  const m = String(s).replace(/\s+/g,'').match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m ? { a: Number(m[1]), b: Number(m[2]) } : null;
};
const sortSizes = (arr=[]) =>
  [...new Set(arr)].sort((A, B) => {
    const a = parseSizeKey(A), b = parseSizeKey(B);
    if (a && b) {
      if (a.a !== b.a) return a.a - b.a;   // 폭 오름차순
      if (a.b !== b.b) return a.b - b.b;   // 길이/깊이 오름차순
    }
    return String(A).localeCompare(String(B), 'ko');
  });

const parseHeightKey = (s='') => {
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};
const sortHeights = (arr=[]) => [...new Set(arr)].sort((a,b) => parseHeightKey(a) - parseHeightKey(b));

const parseLevelKey = (s='') => {
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};
const sortLevels = (arr=[]) => [...new Set(arr)].sort((a,b) => parseLevelKey(a) - parseLevelKey(b));

// 타입 키 정규화(공백/제로폭공백/전각공백 차이 무시)
const normType = s =>
  String(s || '')
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, '') // zero-width 제거
    .replace(/\s+/g, ' ')
    .trim();

const getExtraForType = (t, store) => {
  const keys = Object.keys(store || {});
  const n = normType(t);
  let hit = keys.find(k => k === t);
  if (hit) return store[hit];
  hit = keys.find(k => normType(k) === n);
  return hit ? store[hit] : undefined;
};

// 하이랙 550kg 사이즈 별칭(표기는 새 이름, 데이터 키는 구 키)
const HIGHRACK_550_ALIASES_VIEW_FROM_DATA = {
  '80x146': '80x108',
  '80x206': '80x150'
};
const HIGHRACK_550_ALIASES_DATA_FROM_VIEW = {
  '80x108': '80x146',
  '80x150': '80x206'
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
  const [quantity, setQuantity] = useState(''); // 미입력 상태

  const [customPrice, setCustomPrice] = useState(0);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  const [extraOptionsSel, setExtraOptionsSel] = useState([]);

  // ▶ 사용자 정의 기타자재(여러 개)
  const [customMaterials, setCustomMaterials] = useState([]); // [{id,name,price}]
  const addCustomMaterial = (name, price) => {
    if (!name || !Number(price)) return;
    setCustomMaterials(prev => [
      ...prev,
      { id: `cm-${Date.now()}-${prev.length}`, name, price: Number(price) }
    ]);
  };
  const removeCustomMaterial = (id) => {
    setCustomMaterials(prev => prev.filter(m => m.id !== id));
  };
  const clearCustomMaterials = () => setCustomMaterials([]);

  // BOM 수량/규격 오버라이드
  const [bomOverrides, setBomOverrides] = useState({});
  const [bomSpecOverrides, setBomSpecOverrides] = useState({});
  const setTotalBomQuantity = (key, nextQtyRaw) => {
    const q = Math.max(0, Number(nextQtyRaw) || 0);
    setBomOverrides(prev => ({ ...prev, [key]: q }));
  };
  const setTotalBomSpec = (key, nextSpec) => {
    setBomSpecOverrides(prev => ({ ...prev, [key]: String(nextSpec ?? '') }));
  };

  // extra 옵션 선택 배열을 안전하게 세팅(중복 제거 + 유효 id만)
  const handleExtraOptionChange = (nextIds = []) => {
    const ex = getExtraForType(selectedType, extraProducts);
    const valid = new Set(
      Object.values(ex || {}).flat().map(o => o.id)
    );
    const uniq = Array.from(new Set(nextIds)).filter(id => valid.has(id));
    setExtraOptionsSel(uniq);
  };

  // fetch (캐시 이슈 있으면 ?v= 붙여도 됨)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const dj = await (await fetch('./data.json')).json();
        const bj = await (await fetch('./bom_data.json')).json();
        const ej = await (await fetch('./extra_options.json')).json();

        setData(dj);
        setBomData(bj);
        setExtraProducts(ej);

        const canonical = ['경량랙','중량랙','파렛트랙','파렛트랙 철판형','하이랙','스텐랙'];
        const fromData = Object.keys(dj || {});
        const types = canonical.filter(t => fromData.includes(t));
        const leftovers = fromData.filter(t => !types.includes(t));
        setAllOptions({ types: [...types, ...leftovers] });
      } catch (e) {
        console.error('데이터 로드 실패', e);
        setAllOptions({ types: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 하이랙 사이즈 alias → 데이터 키로 해석
  const resolveHighrackSizeKey = (color, viewSize) => {
    const is550 = /550kg/.test(String(color)) || /700kg/.test(String(color));
    if (is550 && HIGHRACK_550_ALIASES_DATA_FROM_VIEW[viewSize]) {
      return HIGHRACK_550_ALIASES_DATA_FROM_VIEW[viewSize];
    }
    return viewSize;
  };

  // 옵션 빌드
  useEffect(() => {
    if (!selectedType) { setAvailableOptions({}); return; }

    const extra =
      EXTRA_OPTIONS[selectedType]
      || (['파렛트랙','파렛트랙 철판형'].includes(selectedType) ? (EXTRA_OPTIONS['파렛트랙'] || {}) : {})
      || {};

    // 1) 폼타입 랙
    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};

      const dataSizes = Object.keys(bd || {});
      const next = { size: sortSizes(dataSizes), height: [], level: [], formType: [] };

      if (selectedOptions.size) {
        const heightsFromData = Object.keys(bd[selectedOptions.size] || {});
        next.height = sortHeights([...heightsFromData, ...(extra.height || [])]);
      } else {
        next.height = sortHeights([...(extra.height || [])]);
      }

      if (selectedOptions.size && selectedOptions.height) {
        // ✅ 경량랙 H750: H900의 L* 키 사용
        if (selectedType === '경량랙' && selectedOptions.height === 'H750') {
          const lKeys = Object.keys(bd[selectedOptions.size]?.['H900'] || {});
          next.level = lKeys; // (정렬 유지: L2, L3, ...)
          if (selectedOptions.level) {
            const forms = bd[selectedOptions.size]?.['H900']?.[selectedOptions.level] || {};
            next.formType = Object.keys(forms).length ? Object.keys(forms) : ['독립형','연결형'];
          }
        } else {
          next.level = sortLevels(Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {}));
          if (selectedOptions.level) {
            const forms = bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {};
            next.formType = Object.keys(forms);
            if (next.formType.length === 0) next.formType = ['독립형', '연결형'];
          }
        }
      }

      setAvailableOptions(next);
      return;
    }

    // 2) 하이랙 (색상→사이즈→높이→단수)
    if (selectedType === '하이랙' && data?.하이랙) {
      const rd = data['하이랙'];
      const opts = { color: rd['색상'] || [] };

      if (selectedOptions.color) {
        const color = selectedOptions.color;
        const is450 = /450kg/.test(String(color));
        const is550 = /550kg/.test(String(color)) || /700kg/.test(String(color));

        const sizeListSafeRaw = Object.keys(rd['기본가격']?.[color] || {});

        // 550kg: 표기 치환(80x146→80x108, 80x206→80x150)
        const sizeViewList = sizeListSafeRaw.map(s => {
          if (is550 && HIGHRACK_550_ALIASES_VIEW_FROM_DATA[s]) return HIGHRACK_550_ALIASES_VIEW_FROM_DATA[s];
          return s;
        });

        // 1차: 데이터 기반 사이즈 (450kg이면 45x150 제거)
        let sizeView = is450 ? sizeViewList.filter(s => s !== '45x150') : sizeViewList;

        // 2차: (비-최대하중일 때만) Extra 사이즈 병합
        const extraSizes = EXTRA_OPTIONS['하이랙']?.size || [];
        const isHeaviest = is550;
        if (!isHeaviest) sizeView = Array.from(new Set([...sizeView, ...extraSizes]));

        // 3차: 450kg 재확인(Extra로 다시 들어온 45x150 최종 제거)
        if (is450) sizeView = sizeView.filter(s => s !== '45x150');

        // 4차: 550kg이면 80x200 강제 추가
        if (isHeaviest && !sizeView.includes('80x200')) sizeView.push('80x200');

        opts.size = sortSizes(sizeView);

        if (selectedOptions.size) {
          const dataSizeKey = resolveHighrackSizeKey(color, selectedOptions.size);
          let heights = Object.keys(rd['기본가격']?.[color]?.[dataSizeKey] || []);

          // ✅ 450kg: 150/200/250을 항상 포함
          if (is450) {
            heights = Array.from(new Set([...heights, ...EXTRA_OPTIONS['하이랙'].height]));
          }
          // ✅ 550kg 80x200: 데이터 없더라도 150/200/250 노출
          if (is550 && selectedOptions.size === '80x200') {
            heights = Array.from(new Set([...heights, ...EXTRA_OPTIONS['하이랙'].height]));
          }

          opts.height = sortHeights(heights);

          if (selectedOptions.height) {
            const levelsFromData = Object.keys(
              rd['기본가격']?.[color]?.[dataSizeKey]?.[selectedOptions.height] || {}
            );

            // 550kg: 데이터 있는 그대로, 단 80x200에서 데이터가 비면 공통 레벨 노출
            // 그 외(270/450): 데이터 + 보조레벨 병합
            let lv = levelsFromData;
            if (is550) {
              if (selectedOptions.size === '80x200' && lv.length === 0) lv = COMMON_LEVELS;
              lv = sortLevels(lv);
            } else {
              lv = sortLevels(Array.from(new Set([...levelsFromData, ...(EXTRA_OPTIONS['하이랙'].level || []), ...COMMON_LEVELS])));
            }
            opts.level = lv;
          }
        }
      }
      setAvailableOptions(opts);
      return;
    }

    // 3) 스텐랙
    if (selectedType === '스텐랙' && data?.스텐랙) {
      const rd = data['스텐랙'];
      const opts = { size: sortSizes(Object.keys(rd['기본가격'] || {})) };
      if (selectedOptions.size) {
        const heightsFromData  = Object.keys(rd['기본가격'][selectedOptions.size] || {});
        const heightsFromExtra = EXTRA_OPTIONS['스텐랙']?.height || [];
        opts.height = sortHeights(Array.from(new Set([...heightsFromData, ...heightsFromExtra])));
      }
      if (selectedOptions.size && selectedOptions.height) {
        const levelsFromData = Object.keys(
          rd['기본가격']?.[selectedOptions.size]?.[selectedOptions.height] || {}
        );
        const levelsFromExtra = EXTRA_OPTIONS['스텐랙']?.level || [];
        opts.level = sortLevels([
          ...levelsFromData,
          ...levelsFromExtra,
          ...COMMON_LEVELS
        ]);
      }
      opts.version = ['V1'];
      setAvailableOptions(opts);
      return;
    }

    setAvailableOptions({});
  }, [selectedType, selectedOptions, data, bomData]);

  // 가격 계산
  const calculatePrice = useCallback(() => {
    if (!selectedType || quantity <= 0) return 0;
    if (customPrice > 0) return Math.round(customPrice * quantity * (applyRate / 100));

    let basePrice = 0;

    if (formTypeRacks.includes(selectedType)) {
      // ✅ 경량랙 H750 -> H900 가격 사용 (level/formType 키 그대로 사용)
      if (selectedType === '경량랙' && selectedOptions.height === 'H750') {
        const recH900 = bomData['경량랙']?.[selectedOptions.size]?.['H900']
          ?. [selectedOptions.level]?.[selectedOptions.formType];
        if (recH900?.total_price) basePrice = recH900.total_price * quantity;
      } else {
        const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]
          ?. [selectedOptions.level]?.[selectedOptions.formType];
        if (rec?.total_price) basePrice = rec.total_price * quantity;
      }
    } else if (selectedType === '스텐랙') {
      const p = data['스텐랙']['기본가격']?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
      if (p) basePrice = p * quantity;
    } else if (selectedType === '하이랙') {
      const color = selectedOptions.color;
      const dataSizeKey = resolveHighrackSizeKey(color, selectedOptions.size);
      const p = data['하이랙']['기본가격']?.[color]?.[dataSizeKey]
        ?. [selectedOptions.height]?.[selectedOptions.level];
      if (p) basePrice = p * quantity;
    }

    // ▸ 기타 옵션 가격 (경량랙: 사용자 정의 여러개 / 그 외: extra_options 체크박스)
    let extraPrice = 0;
    if (selectedType === '경량랙') {
      extraPrice += (customMaterials || []).reduce((sum, m) => sum + (Number(m.price) || 0), 0);
    } else {
      const exBlock = getExtraForType(selectedType, extraProducts);
      if (exBlock) {
        Object.values(exBlock).forEach(arr => {
          arr.forEach(opt => {
            if (extraOptionsSel.includes(opt.id)) extraPrice += Number(opt.price) || 0;
          });
        });
      }
    }

    return Math.round((basePrice + extraPrice) * (applyRate / 100));
  }, [
    selectedType, selectedOptions, quantity, customPrice, applyRate,
    data, bomData, extraProducts, extraOptionsSel, customMaterials
  ]);

  // ▶ 장바구니 아이템 수량 변경 (가격·BOM 동기화)
  const updateCartItemQuantity = (id, nextQtyRaw) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const oldQty = item.quantity > 0 ? item.quantity : 1;
        const nextQty = Math.max(0, Number(nextQtyRaw) || 0);

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

  // 🔹 전체 BOM 뷰 (수량/규격 오버라이드 반영)
  const cartBOMView = useMemo(() => {
    return (cartBOM || []).map(row => {
      const key = `${row.rackType} ${row.size || ''} ${row.name}`;
      const qtyOverride = bomOverrides[key];
      const specOverride = bomSpecOverrides[key];

      return {
        ...row,
        quantity: qtyOverride === undefined ? row.quantity : qtyOverride,
        specification: specOverride === undefined ? row.specification : specOverride,
      };
    });
  }, [cartBOM, bomOverrides, bomSpecOverrides]);

  // 사용자 정의 기타자재 → BOM 행
  const makeExtraOptionBOM = () => {
    const qty = Number(quantity) || 0;
    const result = [];

    (customMaterials || []).forEach(m => {
      const unit = Number(m.price) || 0;
      result.push({
        rackType: selectedType,
        name: m.name,
        specification: '',
        quantity: qty,
        unitPrice: unit,
        totalPrice: unit * qty,
        note: '추가옵션'
      });
    });

    return result;
  };

  // ✅ 경량랙 H750 전용 BOM(구성품 라벨만 750로)
  const makeLightRackH750BOM = () => {
    const { w, d } = parseSize(selectedOptions.size || '');
    const lvl = parseInt(String(selectedOptions.level || '').replace(/[^\d]/g, ''), 10) || 5;
    const isConn = selectedOptions.formType === '연결형';
    const qty = Number(quantity) || 1;

    const pillarQty = (isConn ? 2 : 4) * qty;
    const connectBarQty = 4 * qty;
    const shelfQty = lvl * qty;
    const padTopQty = 2 * qty;
    const padBottomQty = (isConn ? 8 : 10) * qty;
    const seatQty = (isConn ? 2 : 4) * qty;
    const pinQty = 8 * qty;

    return [
      { rackType: selectedType, size: selectedOptions.size, name: `기둥(750)`, specification: `높이 H750`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: '연결대', specification: '', quantity: connectBarQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: '선반', specification: (w && d) ? `사이즈 ${w}*${d}` : `사이즈 ${selectedOptions.size||''}`, quantity: shelfQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: '받침(상)', specification: d ? `(${d})` : '', quantity: padTopQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: '받침(하)', specification: d ? `(${d})` : '', quantity: padBottomQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: '안전좌', specification: '', quantity: seatQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: '안전핀', specification: '', quantity: pinQty, unitPrice: 0, totalPrice: 0 },
      ...makeExtraOptionBOM()
    ];
  };

  const getFallbackBOM = () => {
    // 팔레트랙류(일반/철판형)
    if (selectedType === '파렛트랙' || selectedType === '파렛트랙 철판형') {
      const lvl = parseInt(selectedOptions.level || '') || 1;
      const sz = selectedOptions.size || '';
      const ht = selectedOptions.height || '';
      const form = selectedOptions.formType || '독립형';
      const qty = Number(quantity) || 1;
      const baseSafetyLeftQty = 2 * qty;
      const baseSafetyRightQty = form === '연결형' ? 0 : 2 * qty;

      const isSteelPlate = (selectedType === '파렛트랙 철판형');
      const platePerLevel = sz.startsWith('W1380') ? 2 : (sz.startsWith('W2580') ? 3 : 0);

      const base = [
        { rackType:selectedType, size:sz, name:`기둥(${ht})`, specification: ht, quantity:(form==='연결형'? 2 : 4)*qty, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'로드빔', specification: sz, quantity:2*lvl*qty, unitPrice:0, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'베이스(안전좌)', specification:'', quantity:baseSafetyLeftQty, unitPrice:2500, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'안전핀', specification:'', quantity:2*lvl*qty, unitPrice:100, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'수평브레싱', specification:'', quantity:1*qty, unitPrice:750, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'경사브레싱', specification:'', quantity:1*qty, unitPrice:3000, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'앙카볼트', specification:'', quantity:4*qty, unitPrice:500, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'베이스볼트', specification:'', quantity:4*qty, unitPrice:100, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'브레싱볼트', specification:'', quantity:4*qty, unitPrice:150, totalPrice:0 },
        { rackType:selectedType, size:sz, name:'브레싱보조고무', specification:'', quantity:4*qty, unitPrice:0, totalPrice:0 },
      ];

      const middle = isSteelPlate
        ? [{ rackType:selectedType, size:sz, name: sz.startsWith('W1380') ? '1380철판' : (sz.startsWith('W2580') ? '2580철판' : '철판'), specification: sz, quantity: (platePerLevel || 0) * lvl * qty, unitPrice:0, totalPrice:0 }]
        : [{ rackType:selectedType, size:sz, name:'타이빔', specification: sz, quantity:2*lvl*qty, unitPrice:0, totalPrice:0 }];

      return [
        ...base.slice(0, 2),
        ...middle,
        ...base.slice(2),
        ...makeExtraOptionBOM()
      ];
    }

    if (selectedType === '하이랙') {
      return [
        { rackType:selectedType, name:'기둥', specification:`높이 ${selectedOptions.height||''}`, quantity:4*(Number(quantity)||1), unitPrice:0, totalPrice:0 },
        { rackType:selectedType, name:'선반', specification:`사이즈 ${selectedOptions.size||''}`, quantity:(parseInt(selectedOptions.level)||5)*(Number(quantity)||1), unitPrice:0, totalPrice:0 },
        ...makeExtraOptionBOM()
      ];
    }
    if (selectedType === '스텐랙') {
      return [
        { rackType:selectedType, name:'기둥', specification:`높이 ${selectedOptions.height||''}`, quantity:4*(Number(quantity)||1), unitPrice:0, totalPrice:0 },
        { rackType:selectedType, name:'선반', specification:`사이즈 ${selectedOptions.size||''}`, quantity:(parseInt(selectedOptions.level)||5)*(Number(quantity)||1), unitPrice:0, totalPrice:0 },
        ...makeExtraOptionBOM()
      ];
    }
    return makeExtraOptionBOM();
  };

  const calculateCurrentBOM = useCallback(() => {
    if (customPrice > 0) return getFallbackBOM();
    if (!selectedType || quantity <= 0) return [];

    if (selectedType === '파렛트랙' || selectedType === '파렛트랙 철판형') {
      const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]
        ?. [selectedOptions.level]?.[selectedOptions.formType];
      if (rec?.components) {
        return [
          ...rec.components.map(c => ({
            rackType: selectedType,
            size: selectedOptions.size,
            name: c.name,
            specification: c.specification ?? '',
            note: c.note ?? '',
            quantity: c.quantity * (Number(quantity) || 1),
            unitPrice: c.unit_price ?? 0,
            totalPrice: c.total_price ? (c.total_price * (Number(quantity)||1)) : (c.unit_price ? (c.unit_price * c.quantity * (Number(quantity)||1)) : 0)
          })),
          ...makeExtraOptionBOM()
        ];
      }
      return getFallbackBOM();
    }

    if (['하이랙','스텐랙'].includes(selectedType)) {
      return getFallbackBOM();
    }

    if (['경량랙','중량랙'].includes(selectedType)) {
      if (selectedType === '경량랙' && selectedOptions.height === 'H750') {
        return makeLightRackH750BOM();
      }
      const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]
        ?. [selectedOptions.level]?.[selectedOptions.formType];
      return [
        ...(rec?.components ? rec.components.map(c => ({
          ...c,
          name: c.name,
          specification: c.specification ?? '',
          note: c.note ?? '',
          quantity: c.quantity * (Number(quantity) || 1),
          unitPrice: c.unit_price ?? 0,
          totalPrice: c.total_price ? (c.total_price * (Number(quantity)||1)) : (c.unit_price ? (c.unit_price * c.quantity * (Number(quantity)||1)) : 0)
        })) : []),
        ...makeExtraOptionBOM()
      ];
    }
    return makeExtraOptionBOM();
  }, [selectedType, selectedOptions, quantity, customPrice, bomData, customMaterials]);

  const handleOptionChange = (k, v) => {
    if (k === 'type') {
      setSelectedType(v);
      setSelectedOptions({});
      setExtraOptionsSel([]);
      setQuantity();
      setCustomPrice(0);      // 수동가격 초기화
      clearCustomMaterials(); // 커스텀 자재 초기화
      return;
    }
    setSelectedOptions(prev => ({ ...prev, [k]: v }));

    // 핵심 옵션 변경 시 수동가격 초기화
    if (['color','size','height','level','formType'].includes(k)) {
      setCustomPrice(0);
    }
  };

  const addToCart = () => {
    if (!selectedType || quantity <= 0) return;
    setCart(prev => [...prev, {
      id: `${Date.now()}`,
      type: selectedType,
      options: { ...selectedOptions },
      extraOptions: [...extraOptionsSel],
      quantity,
      price: customPrice > 0 ? customPrice : currentPrice,
      bom: customPrice > 0 ? getFallbackBOM() : calculateCurrentBOM(),
      displayName: [
        selectedType,
        selectedOptions.formType,
        selectedOptions.size,
        selectedOptions.height,
        selectedOptions.level,
        selectedOptions.color ? selectedOptions.color : ''
      ].filter(Boolean).join(' ')
    }]);
    // 초기화
    setSelectedType('');
    setSelectedOptions({});
    setExtraOptionsSel([]);
    setQuantity('');
    setCustomPrice(0);
    clearCustomMaterials();
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
        const key = `${c.rackType} ${c.size || ''} ${c.name}`;
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
      selectedType, selectedOptions,
      handleOptionChange,

      // extra 옵션(체크박스) 관련
      extraProducts,
      extraOptionsSel,
      handleExtraOptionChange,

      quantity, setQuantity, applyRate, setApplyRate,
      customPrice, setCustomPrice,
      currentPrice, currentBOM, cart, cartTotal, cartBOM, loading,
      cartBOMView, setTotalBomQuantity, setTotalBomSpec,
      addToCart, removeFromCart,
      updateCartItemQuantity,

      // 경량랙 사용자정의 자재
      customMaterials, addCustomMaterial, removeCustomMaterial, clearCustomMaterials,

      bomSpecOverrides
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
