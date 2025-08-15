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

// ──────────────────────────────────────────────────────────
// 상수/유틸
// ──────────────────────────────────────────────────────────
const formTypeRacks = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형"];
const COMMON_LEVELS = ["2단", "3단", "4단", "5단", "6단"];
export const colorLabelMap = { "200kg": "270kg", "350kg": "450kg", "700kg": "550kg" };

// 파렛트랙·철판형에서 항상 노출할 높이(데이터 합집합)
const PALETTE_EXTRA_HEIGHTS = ["4500", "5000", "5500", "6000"];

// 스텐랙에서 데이터에 없더라도 보여줄 높이
const STAINLESS_EXTRA_HEIGHTS = ["210"];

// 하이랙 550kg(=700키) 별칭
const H550_VIEW_FROM_DATA = { "80x146": "80x108", "80x206": "80x150" };
const H550_DATA_FROM_VIEW = { "80x108": "80x146", "80x150": "80x206" };

const parseSizeKey = (s = "") => {
  const m = String(s).replace(/\s+/g, "").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m ? { w: Number(m[1]), d: Number(m[2]) } : null;
};
const sortSizes = (arr = []) =>
  [...new Set(arr)].sort((A, B) => {
    const a = parseSizeKey(A),
      b = parseSizeKey(B);
    if (a && b) {
      if (a.w !== b.w) return a.w - b.w;
      if (a.d !== b.d) return a.d - b.d;
    }
    return String(A).localeCompare(String(B), "ko");
  });

const numKey = (s = "") => {
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};
const sortHeights = (arr = []) =>
  [...new Set(arr)].sort((a, b) => numKey(a) - numKey(b));
const sortLevels = (arr = []) =>
  [...new Set(arr)].sort((a, b) => numKey(a) - numKey(b));

const resolveHighrackSizeKey = (color, viewSize) => {
  const is550 = /550kg|700kg/.test(String(color));
  return is550 && H550_DATA_FROM_VIEW[viewSize]
    ? H550_DATA_FROM_VIEW[viewSize]
    : viewSize;
};

// ──────────────────────────────────────────────────────────
// 컨텍스트
// ──────────────────────────────────────────────────────────
export const ProductProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [bomData, setBomData] = useState({});
  const [extraProducts, setExtraProducts] = useState({});
  const [loading, setLoading] = useState(true);

  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});

  const [selectedType, setSelectedType] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState("");

  const [customPrice, setCustomPrice] = useState(0);
  const [applyRate, setApplyRate] = useState(100);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);

  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  // 추가옵션(체크박스) 선택 id 들
  const [extraOptionsSel, setExtraOptionsSel] = useState([]);

  // 경량랙: 사용자 정의 추가자재(여러 개)
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

  // ── fetch
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

  // ── 추가옵션 토글(OptionSelector와 호환되는 함수로 제공)
  const handleExtraOptionChange = (nextIds) => {
    // 현재 타입의 유효 id만 허용 + 중복 제거
    const valid = new Set(
      Object.values(extraProducts[selectedType] || {}).flat().map((o) => o.id)
    );
    const uniq = Array.from(new Set(nextIds || [])).filter((id) =>
      valid.has(id)
    );
    setExtraOptionsSel(uniq);
  };

  // ── 옵션 드롭다운 구성
  useEffect(() => {
    if (!selectedType) {
      setAvailableOptions({});
      return;
    }

    // 1) 경량/중량/파렛트랙/파렛트랙 철판형(계단식)
    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};
      const sizes = sortSizes(Object.keys(bd || {}));
      const next = { size: sizes, height: [], level: [], formType: [] };

      if (selectedOptions.size) {
        const heights = Object.keys(bd[selectedOptions.size] || {});
        let merged = sortHeights(heights);
        if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
          merged = sortHeights([...merged, ...PALETTE_EXTRA_HEIGHTS]);
        }
        next.height = merged;
      }
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

    // 2) 하이랙(색상→규격→높이→단수)
    if (selectedType === "하이랙" && data?.하이랙) {
      const rd = data["하이랙"];
      const opts = { color: rd["색상"] || [] };

      if (selectedOptions.color) {
        const color = selectedOptions.color;
        const is550 = /550kg|700kg/.test(color);

        const rawSizes = Object.keys(rd["기본가격"]?.[color] || {});
        const viewSizes = rawSizes.map((s) =>
          is550 && H550_VIEW_FROM_DATA[s] ? H550_VIEW_FROM_DATA[s] : s
        );
        // ❗️요청: 비표준도 숨기지 않음(450kg에서 45x150 포함)
        opts.size = sortSizes(viewSizes);

        if (selectedOptions.size) {
          const dKey = resolveHighrackSizeKey(color, selectedOptions.size);
          const heights = Object.keys(rd["기본가격"]?.[color]?.[dKey] || {});
          // ❗️요청: 필요 시 150도 합집합으로 노출
          const mergedH = sortHeights([...heights, "150"]);
          opts.height = mergedH;

          if (selectedOptions.height) {
            const lvls = Object.keys(
              rd["기본가격"]?.[color]?.[dKey]?.[selectedOptions.height] || {}
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
        const fromData = Object.keys(rd["기본가격"][selectedOptions.size] || {});
        // ❗️요청: 210 고정 노출
        opts.height = sortHeights([...fromData, ...STAINLESS_EXTRA_HEIGHTS]);
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
  }, [selectedType, selectedOptions, bomData, data, extraProducts]);

  // ── 가격 계산
  const calculatePrice = useCallback(() => {
    const qty = Number(quantity) || 0;
    if (!selectedType || qty <= 0) return 0;
    if (customPrice > 0)
      return Math.round(customPrice * qty * (applyRate / 100));

    let base = 0;

    // 폼타입 랙: bom_data 우선
    if (formTypeRacks.includes(selectedType)) {
      const rec =
        bomData[selectedType]?.[selectedOptions.size]?.[
          selectedOptions.height
        ]?.[selectedOptions.level]?.[selectedOptions.formType];

      if (rec && Number(rec.total_price) > 0) {
        base = Number(rec.total_price) * qty;
      } else if (rec?.components?.length) {
        // total_price가 0/누락이면 components 합으로 보정
        const perSet = rec.components.reduce((sum, c) => {
          const tot = Number(c.total_price) || 0;
          const unit = Number(c.unit_price) || 0;
          const q = Number(c.quantity) || 0;
          return sum + (tot > 0 ? tot : unit * q);
        }, 0);
        base = perSet * qty;
      }
    }

    if (selectedType === "스텐랙") {
      const p =
        data["스텐랙"]["기본가격"]?.[selectedOptions.size]?.[
          selectedOptions.height
        ]?.[selectedOptions.level];
      if (p) base = p * qty;
    }

    if (selectedType === "하이랙") {
      const color = selectedOptions.color;
      const dKey = resolveHighrackSizeKey(color, selectedOptions.size);
      const p =
        data["하이랙"]["기본가격"]?.[color]?.[dKey]?.[selectedOptions.height]?.[
          selectedOptions.level
        ];
      if (p) base = p * qty;
    }

    // 추가옵션(체크박스) 가격 합
    const extraPrice = (() => {
      const cats = extraProducts[selectedType] || {};
      if (!Object.keys(cats).length || !extraOptionsSel.length) return 0;
      const map = new Map();
      Object.values(cats).forEach((arr) => arr.forEach((o) => map.set(o.id, o)));
      return (
        extraOptionsSel.reduce(
          (s, id) => s + (Number(map.get(id)?.price) || 0),
          0
        ) * qty
      );
    })();

    // 경량 사용자자재(여러 개)
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

  // ── 추가옵션 BOM (요청: “그 이름 그대로 한 줄”)
  const makeExtraOptionBOM = () => {
    const qty = Number(quantity) || 0;
    const result = [];

    // 체크박스형
    const cats = extraProducts[selectedType] || {};
    const map = new Map();
    Object.values(cats).forEach((arr) => arr.forEach((o) => map.set(o.id, o)));
    extraOptionsSel.forEach((id) => {
      const item = map.get(id);
      if (!item) return;
      result.push({
        rackType: selectedType,
        size: selectedOptions.size || "",
        name: item.name, // 그대로
        specification: "",
        quantity: qty,
        unitPrice: Number(item.price) || 0,
        totalPrice: (Number(item.price) || 0) * qty,
        note: "추가옵션",
      });
    });

    // 경량 사용자 정의 자재(여러 개)
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
        note: "추가옵션",
      });
    });

    return result;
  };

  // ── 펄백 BOM (표시용) — “베이스(안전우)” 절대 생성하지 않음
  const getFallbackBOM = () => {
    const qty = Number(quantity) || 1;

    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      const lvl = parseInt(selectedOptions.level || "") || 1;
      const sz = selectedOptions.size || "";
      const ht = selectedOptions.height || "";
      const form = selectedOptions.formType || "독립형";
      const isSteel = selectedType === "파렛트랙 철판형";

      const platePerLevel = sz.startsWith("1380x") ? 2 : sz.startsWith("2580x") ? 3 : 0;

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

    return makeExtraOptionBOM();
  };

  // ── 현재 BOM
  const calculateCurrentBOM = useCallback(() => {
    const qty = Number(quantity) || 0;
    if (customPrice > 0) return getFallbackBOM();
    if (!selectedType || qty <= 0) return [];

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
      return getFallbackBOM();
    }

    return getFallbackBOM();
  }, [
    selectedType,
    selectedOptions,
    quantity,
    customPrice,
    bomData,
    extraOptionsSel,
    extraProducts,
    customMaterials,
  ]);

  // ── 옵션 변경
  const handleOptionChange = (k, v) => {
    if (k === "type") {
      setSelectedType(v);
      setSelectedOptions({});
      setExtraOptionsSel([]);
      setQuantity("");
      setCustomPrice(0);
      clearCustomMaterials();
      return;
    }
    setSelectedOptions((prev) => ({ ...prev, [k]: v }));
    if (["color", "size", "height", "level", "formType"].includes(k)) {
      setCustomPrice(0);
    }
  };

  // ── 장바구니
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
        extraOptions: [...extraOptionsSel],
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

    setSelectedType("");
    setSelectedOptions({});
    setExtraOptionsSel([]);
    setQuantity("");
    setCustomPrice(0);
    clearCustomMaterials();
  };
  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((i) => i.id !== id));

  // ── 합산 BOM/합계
  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(customPrice > 0 ? getFallbackBOM() : calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

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
    setCartTotal(cart.reduce((s, i) => s + (i.price || 0), 0));
  }, [cart]);

  // ── export
  return (
    <ProductContext.Provider
      value={{
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

        // 조작
        handleOptionChange,
        setQuantity,
        setApplyRate,
        setCustomPrice,
        addToCart,
        removeFromCart,

        // 장바구니 편집
        updateCartItemQuantity: (id, nextQtyRaw) =>
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
          ),

        // 추가옵션
        extraProducts,
        extraOptionsSel,
        setExtraOptionsSel,
        handleExtraOptionChange,

        // 경량 사용자자재
        customMaterials,
        addCustomMaterial,
        removeCustomMaterial,
        clearCustomMaterials,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
