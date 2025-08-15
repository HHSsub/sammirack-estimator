// src/contexts/ProductContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

const ProductContext = createContext();

// ──────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────
const formTypeRacks = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형"];
const COMMON_LEVELS = ["2단", "3단", "4단", "5단", "6단"];
const colorLabelMap = { "200kg": "270kg", "350kg": "450kg", "700kg": "550kg" };

const parseSizeKey = (s = "") => {
  const m = String(s).replace(/\s+/g, "").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m ? { a: Number(m[1]), b: Number(m[2]) } : null;
};
const sortSizes = (arr = []) =>
  [...new Set(arr)].sort((A, B) => {
    const a = parseSizeKey(A),
      b = parseSizeKey(B);
    if (a && b) {
      if (a.a !== b.a) return a.a - b.a;
      if (a.b !== b.b) return a.b - b.b;
    }
    return String(A).localeCompare(String(B), "ko");
  });

const parseNumInString = (s = "") => {
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};
const sortHeights = (arr = []) =>
  [...new Set(arr)].sort((a, b) => parseNumInString(a) - parseNumInString(b));
const sortLevels = (arr = []) =>
  [...new Set(arr)].sort((a, b) => parseNumInString(a) - parseNumInString(b));

// 하이랙 550kg 데이터키<->보기 사이즈 별칭
const HIGHRACK_550_VIEW_FROM_DATA = { "80x146": "80x108", "80x206": "80x150" };
const HIGHRACK_550_DATA_FROM_VIEW = { "80x108": "80x146", "80x150": "80x206" };

// 파렛트랙 높이 확장(요구사항 고정 노출)
const PALETTE_EXTRA_HEIGHTS = ["1500", "2000", "2500", "3000", "3500", "4000", "4500", "5000", "5500", "6000"];

// ──────────────────────────────────────────────────────────────
// 추가 옵션(BOM 확장 규칙)
// extra_options.json 의 id 기준으로 패키지에 포함된 실제 부품을 명시.
// 가격은 옵션 price로 반영하고, 아래 BOM 항목들은 단가 0으로 넣어 표시만 한다.
// ──────────────────────────────────────────────────────────────
const EXTRA_BOM_EXPANSIONS = {
  // 파렛트랙
  "p1-loadbeam-1460": [
    { name: "로드빔1460", qty: 2 },
    { name: "타이빔", qty: 2 },
  ],
  "p2-loadbeam-2660": [
    { name: "로드빔2660", qty: 2 },
    { name: "타이빔", qty: 4 },
  ],
  "p3-steel-1460": [
    { name: "로드빔1460", qty: 2 },
    { name: "철판형 1460", qty: 2 },
  ],
  "p3-steel-2060": [
    { name: "로드빔2060", qty: 2 },
    { name: "철판형 2060", qty: 3 },
  ],
  "p3-steel-2660": [
    { name: "로드빔2660", qty: 2 },
    { name: "철판형 2660", qty: 3 },
  ],
  "p4-steel-1460": [
    { name: "로드빔1460", qty: 2 },
    { name: "철판형 1460", qty: 2 },
  ],
  "p4-steel-2060": [
    { name: "로드빔2060", qty: 2 },
    { name: "철판형 2060", qty: 3 },
  ],
  "p4-steel-2660": [
    { name: "로드빔2660", qty: 2 },
    { name: "철판형 2660", qty: 3 },
  ],
};

// ──────────────────────────────────────────────────────────────
// 컨텍스트
// ──────────────────────────────────────────────────────────────
export const ProductProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [bomData, setBomData] = useState({});
  const [extraProducts, setExtraProducts] = useState({});
  const [loading, setLoading] = useState(true);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});

  const [selectedType, setSelectedType] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({}); // {color,size,height,level,formType}
  const [quantity, setQuantity] = useState("");

  const [customPrice, setCustomPrice] = useState(0);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);

  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  // 기타 추가 옵션(체크박스) 선택값
  const [extraOptionsSel, setExtraOptionsSel] = useState([]); // [id]

  // 경량랙 사용자 정의 자재(여러 개)
  const [customMaterials, setCustomMaterials] = useState([]); // [{id,name,price}]
  const addCustomMaterial = (name, price) => {
    if (!name || !Number(price)) return;
    setCustomMaterials((prev) => [
      ...prev,
      { id: `cm-${Date.now()}-${prev.length}`, name, price: Number(price) },
    ]);
  };
  const removeCustomMaterial = (id) =>
    setCustomMaterials((prev) => prev.filter((m) => m.id !== id));
  const clearCustomMaterials = () => setCustomMaterials([]);

  // BOM 오버라이드(견적 페이지에서 편집)
  const [bomOverrides, setBomOverrides] = useState({});
  const [bomSpecOverrides, setBomSpecOverrides] = useState({});
  const setTotalBomQuantity = (key, nextQtyRaw) => {
    const q = Math.max(0, Number(nextQtyRaw) || 0);
    setBomOverrides((prev) => ({ ...prev, [key]: q }));
  };
  const setTotalBomSpec = (key, nextSpec) => {
    setBomSpecOverrides((prev) => ({ ...prev, [key]: String(nextSpec ?? "") }));
  };

  // fetch
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const dj = await (await fetch("./data.json")).json();
        const bj = await (await fetch("./bom_data.json")).json();
        const ej = await (await fetch("./extra_options.json")).json();

        setData(dj);
        setBomData(bj);
        setExtraProducts(ej);

        const canonical = [
          "경량랙",
          "중량랙",
          "파렛트랙",
          "파렛트랙 철판형",
          "하이랙",
          "스텐랙",
        ];
        const fromData = Object.keys(dj || {});
        const types = canonical.filter((t) => fromData.includes(t));
        const leftovers = fromData.filter((t) => !types.includes(t));
        setAllOptions({ types: [...types, ...leftovers] });
      } catch (e) {
        console.error("데이터 로드 실패", e);
        setAllOptions({ types: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 하이랙 550kg 별칭 처리
  const resolveHighrackSizeKey = (color, viewSize) => {
    const is550 = /550kg|700kg/.test(String(color));
    if (is550 && HIGHRACK_550_DATA_FROM_VIEW[viewSize]) {
      return HIGHRACK_550_DATA_FROM_VIEW[viewSize];
    }
    return viewSize;
  };

  // 타입별 현재 선택한 추가옵션 카탈로그 가져오기
  const getExtraCatalogForType = (t) => {
    if (!t || !extraProducts[t]) return [];
    return Object.entries(extraProducts[t]); // [ [카테고리, [{id,name,price,bom[]},...]], ... ]
  };

  // 옵션 드롭다운 구성
  useEffect(() => {
    if (!selectedType) {
      setAvailableOptions({});
      return;
    }

    // 1) 폼타입 랙(경량/중량/파렛트랙/파렛트랙 철판형)
    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};
      const sizes = sortSizes(Object.keys(bd));

      const next = { size: sizes, height: [], level: [], formType: [] };

      // 규격 선택 후 높이
      if (selectedOptions.size) {
        const heightsFromData = Object.keys(bd[selectedOptions.size] || {});
        let heights = sortHeights(heightsFromData);

        // 파렛트랙·철판형은 4500~6000 강제 노출(합집합)
        if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
          heights = sortHeights([...heights, ...PALETTE_EXTRA_HEIGHTS]);
        }

        next.height = heights;
      }

      // 높이 선택 후 단수/형식
      if (selectedOptions.size && selectedOptions.height) {
        const lvls = Object.keys(
          bd[selectedOptions.size]?.[selectedOptions.height] || {}
        );
        next.level = sortLevels(lvls);
        if (selectedOptions.level) {
          const forms =
            bd[selectedOptions.size]?.[selectedOptions.height]?.[
              selectedOptions.level
            ] || {};
          next.formType = Object.keys(forms).length
            ? Object.keys(forms)
            : ["독립형", "연결형"];
        }
      }

      setAvailableOptions(next);
      return;
    }

    // 2) 하이랙 (색상 → 규격 → 높이 → 단수)
    if (selectedType === "하이랙" && data?.하이랙) {
      const rd = data["하이랙"];
      const opts = { color: rd["색상"] || [] };

      // 색상 선택 후 규격
      if (selectedOptions.color) {
        const color = selectedOptions.color;
        const is450 = /450kg/.test(color);
        const is550 = /550kg|700kg/.test(color);

        const rawSizes = Object.keys(rd["기본가격"]?.[color] || []);
        const viewSizes = rawSizes.map((s) =>
          is550 && HIGHRACK_550_VIEW_FROM_DATA[s]
            ? HIGHRACK_550_VIEW_FROM_DATA[s]
            : s
        );

        // 450kg은 45x150 숨김, 그 외는 그대로
        opts.size = sortSizes(
          is450 ? viewSizes.filter((s) => s !== "45x150") : viewSizes
        );

        // 규격 선택 후 높이
        if (selectedOptions.size) {
          const dataSizeKey = resolveHighrackSizeKey(color, selectedOptions.size);
          const heights = Object.keys(
            rd["기본가격"]?.[color]?.[dataSizeKey] || {}
          );

          // 요구: 450kg에도 150 노출(데이터에 없으면 추가)
          const extraH =
            is450 && !heights.includes("150") ? ["150"] : [];
          opts.height = sortHeights([...heights, ...extraH]);

          // 높이 선택 후 단수
          if (selectedOptions.height) {
            const lvls = Object.keys(
              rd["기본가격"]?.[color]?.[dataSizeKey]?.[
                selectedOptions.height
              ] || {}
            );
            opts.level = sortLevels(lvls.length ? lvls : COMMON_LEVELS);
          }
        }
      }

      setAvailableOptions(opts);
      return;
    }

    // 3) 스텐랙
    if (selectedType === "스텐랙" && data?.스텐랙) {
      const rd = data["스텐랙"];
      const opts = { size: sortSizes(Object.keys(rd["기본가격"] || {})) };
      if (selectedOptions.size) {
        const hs = Object.keys(rd["기본가격"][selectedOptions.size] || {});
        opts.height = sortHeights(hs);
      }
      if (selectedOptions.size && selectedOptions.height) {
        const lv = Object.keys(
          rd["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height] || {}
        );
        opts.level = sortLevels(lv.length ? lv : COMMON_LEVELS);
      }
      setAvailableOptions(opts);
      return;
    }

    setAvailableOptions({});
  }, [selectedType, selectedOptions, data, bomData]);

  // 가격 계산(옵션+추가옵션+사용자자재)
  const calculatePrice = useCallback(() => {
    const qty = Number(quantity) || 0;
    if (!selectedType || qty <= 0) return 0;
    if (customPrice > 0)
      return Math.round(customPrice * qty * (applyRate / 100));

    let base = 0;

    // 1) 폼타입 랙: bom_data 기준 가격
    if (formTypeRacks.includes(selectedType)) {
      // 레코드
      const rec =
        bomData[selectedType]?.[selectedOptions.size]?.[
          selectedOptions.height
        ]?.[selectedOptions.level]?.[selectedOptions.formType];

      if (rec && typeof rec.total_price === "number" && rec.total_price > 0) {
        base = rec.total_price * qty;
      } else if (rec?.components?.length) {
        // total_price가 없을 때 components 합으로 보정
        const perSet = rec.components.reduce((sum, c) => {
          const unit = Number(c.unit_price) || 0;
          const q = Number(c.quantity) || 0;
          const tot = Number(c.total_price) || 0;
          return sum + (tot > 0 ? tot : unit * q);
        }, 0);
        base = perSet * qty;
      } else {
        base = 0;
      }
    }

    // 2) 스텐랙
    if (selectedType === "스텐랙") {
      const p =
        data["스텐랙"]["기본가격"]?.[selectedOptions.size]?.[
          selectedOptions.height
        ]?.[selectedOptions.level];
      if (p) base = p * qty;
    }

    // 3) 하이랙
    if (selectedType === "하이랙") {
      const color = selectedOptions.color;
      const dataSizeKey = resolveHighrackSizeKey(color, selectedOptions.size);
      const p =
        data["하이랙"]["기본가격"]?.[color]?.[dataSizeKey]?.[
          selectedOptions.height
        ]?.[selectedOptions.level];
      if (p) base = p * qty;
    }

    // ▶ 기타 추가 옵션(체크박스): price 합
    const extraPrice = (() => {
      let sum = 0;
      const cats = getExtraCatalogForType(selectedType);
      if (!cats.length || !extraOptionsSel.length) return 0;
      const map = new Map();
      cats.forEach(([, arr]) => arr.forEach((o) => map.set(o.id, o)));
      extraOptionsSel.forEach((id) => {
        const item = map.get(id);
        if (item && Number(item.price)) sum += Number(item.price);
      });
      return sum * qty;
    })();

    // ▶ 경량랙 사용자 정의 자재(여러 개): 단가 합
    const customExtra = (customMaterials || []).reduce(
      (s, m) => s + (Number(m.price) || 0),
      0
    );

    return Math.round((base + extraPrice + customExtra) * (applyRate / 100));
  }, [
    selectedType,
    selectedOptions,
    quantity,
    customPrice,
    applyRate,
    data,
    bomData,
    extraProducts,
    extraOptionsSel,
    customMaterials,
  ]);

  // 추가옵션 BOM 변환
  const makeExtraOptionBOM = () => {
    const qty = Number(quantity) || 0;
    const result = [];

    // (A) 체크박스형 추가옵션
    const cats = getExtraCatalogForType(selectedType);
    if (cats.length && extraOptionsSel.length) {
      const map = new Map();
      cats.forEach(([, arr]) => arr.forEach((o) => map.set(o.id, o)));

      extraOptionsSel.forEach((id) => {
        const item = map.get(id);
        if (!item) return;

        // 기본 bom
        (item.bom || []).forEach((b) => {
          result.push({
            rackType: selectedType,
            size: selectedOptions.size || "",
            name: b.name,
            specification: "",
            quantity: (Number(b.qty) || 0) * qty,
            unitPrice: 0,
            totalPrice: 0,
            note: "추가옵션",
          });
        });

        // 패키지 확장(타이빔 포함 등)
        if (EXTRA_BOM_EXPANSIONS[id]) {
          EXTRA_BOM_EXPANSIONS[id].forEach((b) => {
            result.push({
              rackType: selectedType,
              size: selectedOptions.size || "",
              name: b.name,
              specification: "",
              quantity: (Number(b.qty) || 0) * qty,
              unitPrice: 0,
              totalPrice: 0,
              note: "추가옵션(패키지)",
            });
          });
        }
      });
    }

    // (B) 경량랙 사용자 정의 자재(여러 개)
    (customMaterials || []).forEach((m) => {
      const unit = Number(m.price) || 0;
      result.push({
        rackType: selectedType,
        size: selectedOptions.size || "",
        name: m.name,
        specification: "",
        quantity: qty,
        unitPrice: unit,
        totalPrice: unit * qty,
        note: "추가옵션(사용자자재)",
      });
    });

    return result;
  };

  // 펄백 BOM (가격계산용 아님, 표시에만 사용) — ⚠ 베이스(안전우) 절대 추가하지 않음
  const getFallbackBOM = () => {
    const qty = Number(quantity) || 1;

    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      const lvl = parseInt(selectedOptions.level || "") || 1;
      const sz = selectedOptions.size || "";
      const ht = selectedOptions.height || "";
      const form = selectedOptions.formType || "독립형";

      // 철판 수량 추정(표시용)
      const platePerLevel = sz.startsWith("1380x") ? 2 : sz.startsWith("2580x") ? 3 : 0;
      const isSteel = selectedType === "파렛트랙 철판형";

      const base = [
        { name: `기둥(${ht})`, specification: ht, quantity: (form === "연결형" ? 2 : 4) * qty },
        { name: "로드빔", specification: sz, quantity: 2 * lvl * qty },
        ...(isSteel
          ? [{ name: sz.startsWith("1380x") ? "1380철판" : sz.startsWith("2580x") ? "2580철판" : "철판", specification: sz, quantity: (platePerLevel || 0) * lvl * qty }]
          : [{ name: "타이빔", specification: sz, quantity: 2 * lvl * qty }]),
        { name: "베이스(안전좌)", specification: "", quantity: (form === "연결형" ? 2 : 4) * qty },
        { name: "안전핀", specification: "", quantity: 2 * lvl * qty },
        { name: "수평브레싱", specification: "", quantity: 1 * qty },
        { name: "경사브래싱", specification: "", quantity: 1 * qty },
        { name: "앙카볼트", specification: "", quantity: 4 * qty },
        { name: "베이스볼트", specification: "", quantity: 4 * qty },
        { name: "브레싱볼트", specification: "", quantity: 4 * qty },
      ];

      return [
        ...base.map((c) => ({
          rackType: selectedType,
          size: sz,
          name: c.name,
          specification: c.specification,
          quantity: c.quantity,
          unitPrice: 0,
          totalPrice: 0,
        })),
        ...makeExtraOptionBOM(),
      ];
    }

    // 하이랙/스텐랙 간단표시
    if (selectedType === "하이랙" || selectedType === "스텐랙") {
      const lvl = parseInt(selectedOptions.level || "") || 5;
      return [
        {
          rackType: selectedType,
          size: selectedOptions.size || "",
          name: "기둥",
          specification: `높이 ${selectedOptions.height || ""}`,
          quantity: 4 * (Number(quantity) || 1),
          unitPrice: 0,
          totalPrice: 0,
        },
        {
          rackType: selectedType,
          size: selectedOptions.size || "",
          name: "선반",
          specification: `사이즈 ${selectedOptions.size || ""}`,
          quantity: lvl * (Number(quantity) || 1),
          unitPrice: 0,
          totalPrice: 0,
        },
        ...makeExtraOptionBOM(),
      ];
    }

    // 경량/중량 등 기본
    return makeExtraOptionBOM();
  };

  // 현재 BOM 계산
  const calculateCurrentBOM = useCallback(() => {
    const qty = Number(quantity) || 0;
    if (customPrice > 0) return getFallbackBOM();
    if (!selectedType || qty <= 0) return [];

    // 폼타입 랙은 bom_data 우선
    if (formTypeRacks.includes(selectedType)) {
      const rec =
        bomData[selectedType]?.[selectedOptions.size]?.[
          selectedOptions.height
        ]?.[selectedOptions.level]?.[selectedOptions.formType];

      if (rec?.components?.length) {
        return [
          ...rec.components.map((c) => ({
            rackType: selectedType,
            size: selectedOptions.size,
            name: c.name,
            specification: c.specification ?? "",
            note: c.note ?? "",
            quantity: (Number(c.quantity) || 0) * qty,
            unitPrice: Number(c.unit_price) || 0,
            totalPrice:
              Number(c.total_price) > 0
                ? Number(c.total_price) * qty
                : (Number(c.unit_price) || 0) * (Number(c.quantity) || 0) * qty,
          })),
          ...makeExtraOptionBOM(),
        ];
      }
      // 레코드 없으면 펄백
      return getFallbackBOM();
    }

    // 하이랙/스텐랙은 간단표시 + 추가옵션
    return getFallbackBOM();
  }, [
    selectedType,
    selectedOptions,
    quantity,
    customPrice,
    bomData,
    customMaterials,
    extraOptionsSel,
    extraProducts,
  ]);

  // 선택 변경
  const handleOptionChange = (k, v) => {
    if (k === "type") {
      setSelectedType(v);
      setSelectedOptions({});
      setExtraOptionsSel([]);
      setQuantity(""); // 입력 초기화
      setCustomPrice(0);
      clearCustomMaterials();
      return;
    }
    setSelectedOptions((prev) => ({ ...prev, [k]: v }));
    if (["color", "size", "height", "level", "formType"].includes(k)) {
      setCustomPrice(0);
    }
  };

  // 장바구니
  const addToCart = () => {
    const qty = Number(quantity) || 0;
    if (!selectedType || qty <= 0) return;

    const price = customPrice > 0 ? customPrice : currentPrice;

    setCart((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        type: selectedType,
        options: { ...selectedOptions },
        extraOptions: [...extraOptionsSel], // 기록
        quantity: qty,
        price,
        bom: customPrice > 0 ? getFallbackBOM() : calculateCurrentBOM(),
        displayName: [
          selectedType,
          selectedOptions.formType,
          selectedOptions.size,
          selectedOptions.height,
          selectedOptions.level,
          selectedOptions.color ? selectedOptions.color : "",
        ]
          .filter(Boolean)
          .join(" "),
      },
    ]);

    // 초기화
    setSelectedType("");
    setSelectedOptions({});
    setExtraOptionsSel([]);
    setQuantity("");
    setCustomPrice(0);
    clearCustomMaterials();
  };
  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((i) => i.id !== id));

  // 장바구니 수량 변경(가격/BOM 동기화)
  const updateCartItemQuantity = (id, nextQtyRaw) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const oldQty = item.quantity > 0 ? item.quantity : 1;
        const nextQty = Math.max(0, Number(nextQtyRaw) || 0);

        const unitPrice = (item.price || 0) / oldQty;
        const newPrice = Math.round(unitPrice * nextQty);

        const newBOM = (item.bom || []).map((c) => {
          const perUnitQty = (c.quantity || 0) / oldQty;
          const q = perUnitQty * nextQty;
          const unit = c.unitPrice ?? c.unit_price ?? 0;
          return {
            ...c,
            quantity: q,
            totalPrice: unit ? unit * q : c.totalPrice || 0,
          };
        });

        return { ...item, quantity: nextQty, price: newPrice, bom: newBOM };
      })
    );
  };

  // 합산 BOM 뷰(오버라이드 반영)
  const cartBOMView = useMemo(() => {
    return (cartBOM || []).map((row) => {
      const key = `${row.rackType} ${row.size || ""} ${row.name}`;
      const qtyOverride = bomOverrides[key];
      const specOverride = bomSpecOverrides[key];
      return {
        ...row,
        quantity: qtyOverride === undefined ? row.quantity : qtyOverride,
        specification:
          specOverride === undefined ? row.specification : specOverride,
      };
    });
  }, [cartBOM, bomOverrides, bomSpecOverrides]);

  // 파생값 계산
  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(customPrice > 0 ? getFallbackBOM() : calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

  // 전체 BOM/합계
  useEffect(() => {
    const map = {};
    cart.forEach((item) => {
      item.bom?.forEach((c) => {
        const key = `${c.rackType} ${c.size || ""} ${c.name}`;
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
        // 데이터/상태
        allOptions,
        availableOptions,
        colorLabelMap,
        selectedType,
        selectedOptions,
        quantity,
        applyRate,
        customPrice,
        currentPrice,
        currentBOM,
        cart,
        cartTotal,
        cartBOM,
        loading,
        cartBOMView,
        bomSpecOverrides,

        // 조작
        handleOptionChange,
        setQuantity,
        setApplyRate,
        setCustomPrice,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,

        // 추가옵션
        extraProducts,
        extraOptionsSel,
        setExtraOptionsSel, // OptionSelector에서 토글
        // 경량 사용자 자재(여러 개)
        customMaterials,
        addCustomMaterial,
        removeCustomMaterial,
        clearCustomMaterials,

        // BOM 오버라이드
        setTotalBomQuantity,
        setTotalBomSpec,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
