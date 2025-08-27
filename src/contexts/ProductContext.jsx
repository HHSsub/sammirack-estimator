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

// 폼타입 랙(계단식 옵션 구조) 목록
const formTypeRacks = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형"];

// ▸ 타입별 보조 노출(데이터에 없더라도 보여줄 값)
const EXTRA_OPTIONS = {
  파렛트랙: { height: ["H4500", "H5000", "H5500", "H6000"] },
  "파렛트랙 철판형": { height: ["H4500", "H5000", "H5500", "H6000"] },
  하이랙: { size: ["45x150"], height: ["150", "200", "250"], level: ["5단", "6단"] },
  스텐랙: { level: ["5단", "6단"], height: ["210"] },
  경량랙: { height: ["H750"] },
};

const COMMON_LEVELS = ["2단", "3단", "4단", "5단", "6단"];
export const colorLabelMap = { "200kg": "270kg", "350kg": "450kg", "700kg": "550kg" };

// ---- 정렬/파싱 유틸 ----
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

const parseNum = (s = "") => {
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};
const sortHeights = (arr = []) =>
  [...new Set(arr)].sort((a, b) => parseNum(a) - parseNum(b));
const sortLevels = (arr = []) =>
  [...new Set(arr)].sort((a, b) => parseNum(a) - parseNum(b));

// 하이랙(구 700kg=신 550kg) 사이즈 별칭 처리(데이터 키 ↔ 표시값)
const HIGHRACK_550_ALIAS_VIEW_FROM_DATA = { "80x146": "80x108", "80x206": "80x150" };
const HIGHRACK_550_ALIAS_DATA_FROM_VIEW = { "80x108": "80x146", "80x150": "80x206" };

// ── 추가 유틸: 높이/규격 파싱과 파렛트 하드웨어 계산 ──
const parseHeightMm = (h) => Number(String(h || "").replace(/[^\d]/g, "")) || 0;

// "2780x1000" → {w:2780, d:1000}
const parseWD = (size = "") => {
  const m = String(size).replace(/\s+/g, "").match(/(\d+)\s*[xX]\s*(\d+)/);
  return m ? { w: Number(m[1]), d: Number(m[2]) } : { w: null, d: null };
};

// 파렛트랙(철판형 포함) 브레싱/볼트 수량 규칙
// 독립형: 수평=4, 경사=2*(h/500-1), 앙카=4, 베이스볼트=4, 브레싱볼트=2*(h/500)+4
// 연결형: 수평=2, 경사=(h/500-1),   앙카=2, 베이스볼트=4, 브레싱볼트=(h/500)+2
const calcPalletHardwareCounts = (heightMm, isConn, qty) => {
  const step = heightMm / 500;
  const horizontal = (isConn ? 2 : 4) * qty;
  const diagonal = Math.max(0, (isConn ? (step - 1) : 2 * (step - 1))) * qty;
  const anchor = (isConn ? 2 : 4) * qty;
  const baseBolt = 4 * qty;
  const braceBolt = (isConn ? (step + 2) : (2 * step + 4)) * qty;
  const rubber = 4 * qty; // 브레싱고무는 항상 4개 × 수량
  return { horizontal, diagonal, anchor, baseBolt, braceBolt, rubber };
};

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [bomData, setBomData] = useState({});
  const [extraProducts, setExtraProducts] = useState({});
  const [loading, setLoading] = useState(true);

  // 화면 옵션 상태
  const [allOptions, setAllOptions] = useState({ types: [] });
  const [availableOptions, setAvailableOptions] = useState({});
  const [selectedType, setSelectedType] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(""); // 빈칸=미입력

  // 가격/할인
  const [customPrice, setCustomPrice] = useState(0);
  const [applyRate, setApplyRate] = useState(100);

  // 현재 항목, 장바구니, 전체 BOM
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBOM, setCurrentBOM] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartBOM, setCartBOM] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);

  // 추가 옵션 선택 상태
  const [extraOptionsSel, setExtraOptionsSel] = useState([]);

  // ▶ 경량랙 사용자 정의 기타자재(“기타 추가 옵션”)
  const [customMaterials, setCustomMaterials] = useState([]); // [{id,name,price}]
  const addCustomMaterial = (name, price) => {
    if (!String(name).trim() || !(Number(price) > 0)) return;
    setCustomMaterials((prev) => [
      ...prev,
      { id: `cm-${Date.now()}-${prev.length}`, name: String(name), price: Number(price) },
    ]);
  };
  const removeCustomMaterial = (id) => {
    setCustomMaterials((prev) => prev.filter((m) => m.id !== id));
  };
  const clearCustomMaterials = () => setCustomMaterials([]);

  // ───────────────────────────────
  // 데이터 로드 (+ extra 옵션 정규화)
  // ───────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const dj = await (await fetch("./data.json")).json();
        const bj = await (await fetch("./bom_data.json")).json();
        const ejRaw = await (await fetch("./extra_options.json")).json();

        setData(dj);
        setBomData(bj);

        // ⚠️ extra 옵션: 모든 타입 키가 반드시 존재하도록 보정
        const KNOWN_TYPES = [
          "경량랙",
          "중량랙",
          "파렛트랙",
          "파렛트랙 철판형",
          "하이랙",
          "스텐랙",
        ];
        const ej = { ...(ejRaw || {}) };
        KNOWN_TYPES.forEach((t) => {
          if (!ej[t] || typeof ej[t] !== "object") ej[t] = {};
        });
        setExtraProducts(ej);

        const canonical = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형", "하이랙", "스텐랙"];
        const fromData = Object.keys(dj || {});
        the_types: {
          const types = canonical.filter((t) => fromData.includes(t));
          const leftovers = fromData.filter((t) => !types.includes(t));
          setAllOptions({ types: [...types, ...leftovers] });
        }
      } catch (e) {
        console.error("데이터 로드 실패", e);
        setAllOptions({ types: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ───────────────────────────────
  // 옵션 빌드
  // ───────────────────────────────
  useEffect(() => {
    if (!selectedType) {
      setAvailableOptions({});
      return;
    }

    // 1) 경량/중량/파렛트랙/파렛트랙 철판형
    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};
      const next = { size: [], height: [], level: [], formType: [] };

      next.size = sortSizes(Object.keys(bd || {}));

      if (selectedOptions.size) {
        const heightsFromData = Object.keys(bd[selectedOptions.size] || {});
        next.height = sortHeights([
          ...heightsFromData,
          ...(EXTRA_OPTIONS[selectedType]?.height || []),
        ]);
      } else {
        next.height = sortHeights([...(EXTRA_OPTIONS[selectedType]?.height || [])]);
      }

      if (selectedOptions.size && selectedOptions.height) {
        if (selectedType === "경량랙" && selectedOptions.height === "H750") {
          const lk = Object.keys(bd[selectedOptions.size]?.["H900"] || {});
          next.level = lk.length ? lk : [];
          if (selectedOptions.level) {
            const fm = bd[selectedOptions.size]?.["H900"]?.[selectedOptions.level] || {};
            next.formType = Object.keys(fm).length ? Object.keys(fm) : ["독립형", "연결형"];
          }
        } else {
          const levelKeys =
            Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {}) || [];
          next.level = levelKeys.length ? sortLevels(levelKeys) : ["L1", "L2", "L3", "L4", "L5", "L6"];

          if (selectedOptions.level) {
            const fm =
              bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {};
            next.formType = Object.keys(fm).length ? Object.keys(fm) : ["독립형", "연결형"];
          }
        }
      }

      setAvailableOptions(next);
      return;
    }

    // 2) 하이랙 (색상→규격→높이→단수)
    if (selectedType === "하이랙" && data?.하이랙) {
      const rd = data["하이랙"];
      const opts = { color: rd["색상"] || [] };

      if (selectedOptions.color) {
        const color = selectedOptions.color;

        // 550/700kg 은 데이터 키 ↔ 표시값 별칭 필요
        const isHeaviest = /(550kg|700kg)$/.test(color);
        // 450/550/700kg 은 45x150 숨김
        const hide45x150 = /(450kg|550kg|700kg)$/.test(color);

        // 규격
        const rawSizes = Object.keys(rd["기본가격"]?.[color] || []);
        const sizeViewList = rawSizes.map((s) =>
          isHeaviest && HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s]
            ? HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s]
            : s
        );
        const baseSizes = hide45x150
          ? sizeViewList.filter((s) => s !== "45x150")
          : Array.from(new Set([...sizeViewList, ...(EXTRA_OPTIONS["하이랙"]?.size || [])]));
        const sizeSet = new Set(baseSizes);
        if (isHeaviest) sizeSet.add("80x200"); // 80x200 강제 노출
        opts.size = sortSizes([...sizeSet]);

        // 높이
        if (selectedOptions.size) {
          const sizeKey = isHeaviest
            ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[selectedOptions.size] || selectedOptions.size
            : selectedOptions.size;

          const heightsFromData = Object.keys(rd["기본가격"]?.[color]?.[sizeKey] || []);
          opts.height = sortHeights([
            ...heightsFromData,
            ...(EXTRA_OPTIONS["하이랙"]?.height || []),
          ]);

          // 단수: 550/700kg은 1~6단 항상 가능(데이터와 합집합)
          if (selectedOptions.height) {
            const levelsFromData = Object.keys(
              rd["기본가격"]?.[color]?.[sizeKey]?.[selectedOptions.height] || {}
            );
            const full16 = ["1단", "2단", "3단", "4단", "5단", "6단"];
            opts.level = isHeaviest
              ? sortLevels([...new Set([...(levelsFromData || []), ...full16])])
              : sortLevels([
                  ...levelsFromData,
                  ...(EXTRA_OPTIONS["하이랙"]?.level || []),
                  ...COMMON_LEVELS,
                ]);
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
        const heightsFromData = Object.keys(rd["기본가격"][selectedOptions.size] || {});
        opts.height = sortHeights([
          ...heightsFromData,
          ...(EXTRA_OPTIONS["스텐랙"]?.height || []),
        ]);
      }
      if (selectedOptions.size && selectedOptions.height) {
        const levelsFromData = Object.keys(
          rd["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height] || {}
        );
        opts.level = sortLevels([
          ...levelsFromData,
          ...(EXTRA_OPTIONS["스텐랙"]?.level || []),
          ...COMMON_LEVELS,
        ]);
      }
      opts.version = ["V1"];
      setAvailableOptions(opts);
      return;
    }

    setAvailableOptions({});
  }, [selectedType, selectedOptions, data, bomData]);

  // ───────────────────────────────
  // 가격 계산
  // ───────────────────────────────
  const sumComponents = (compArr = []) =>
    compArr.reduce((sum, c) => {
      const tp = Number(c.total_price) || 0;
      const up = Number(c.unit_price) || 0;
      const q = Number(c.quantity) || 0;
      return sum + (tp > 0 ? tp : up * q);
    }, 0);

  const calculatePrice = useCallback(() => {
    if (!selectedType || quantity <= 0) return 0;
    if (customPrice > 0) return Math.round(customPrice * quantity * (applyRate / 100));

    let basePrice = 0;

    if (formTypeRacks.includes(selectedType)) {
      const size = selectedOptions.size;
      const heightRaw = selectedOptions.height;
      const levelRaw = selectedOptions.level;
      const formType = selectedOptions.formType;

      const height = selectedType === "경량랙" && heightRaw === "H750" ? "H900" : heightRaw;

      let pData;
      if (selectedType === "파렛트랙 철판형") {
        const hKey = String(height || "").replace(/^H/i, "");
        const lKey =
          String(levelRaw || "")
            .replace(/^L/i, "")
            .replace(/^\s*$/, "0") + "단";
        pData = data?.[selectedType]?.["기본가격"]?.[formType]?.[size]?.[hKey]?.[lKey];
      } else {
        pData = data?.[selectedType]?.["기본가격"]?.[size]?.[height]?.[levelRaw]?.[formType];
      }

      if (pData) {
        basePrice = Number(pData) * (Number(quantity) || 0);
      } else {
        const rec =
          bomData?.[selectedType]?.[size]?.[height]?.[levelRaw]?.[formType];
        if (rec) {
          const labelled = Number(rec.total_price) || 0;
          basePrice =
            (labelled > 0 ? labelled : sumComponents(rec.components || [])) *
            (Number(quantity) || 0);
        }
      }
    } else if (selectedType === "스텐랙") {
      const p =
        data["스텐랙"]["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height]?.[
          selectedOptions.level
        ];
      if (p) basePrice = p * quantity;
    } else if (selectedType === "하이랙") {
      const color = selectedOptions.color;
      const isHeaviest = /550kg$/.test(color) || /700kg$/.test(color);
      const dataSizeKey = isHeaviest
        ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[selectedOptions.size] || selectedOptions.size
        : selectedOptions.size;
      const p =
        data["하이랙"]["기본가격"]?.[color]?.[dataSizeKey]?.[selectedOptions.height]?.[
          selectedOptions.level
        ];
      if (p) basePrice = p * quantity;
    }

    // 추가옵션(체크박스)
    let extraPrice = 0;
    const catmap = extraProducts?.[selectedType] || {};
    Object.values(catmap).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((opt) => {
          if (extraOptionsSel.includes(opt.id)) extraPrice += Number(opt.price) || 0;
        });
      }
    });

    // 경량랙 사용자 정의 기타자재
    const customExtra =
      selectedType === "경량랙"
        ? customMaterials.reduce((s, m) => s + (Number(m.price) || 0), 0)
        : 0;

    return Math.round((basePrice + extraPrice + customExtra) * (applyRate / 100));
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

  // ───────────────────────────────
  // Extra 옵션 → BOM 한 줄씩 그대로 추가
  // ───────────────────────────────
  const makeExtraOptionBOM = () => {
    const result = [];
    const qty = Number(quantity) || 0;
    const catmap = extraProducts?.[selectedType] || {};
    Object.values(catmap).forEach((arr) => {
      if (Array.isArray(arr)) {
        arr.forEach((opt) => {
          if (extraOptionsSel.includes(opt.id)) {
            const unit = Number(opt.price) || 0;
            result.push({
              rackType: selectedType,
              name: opt.name,
              specification: opt.specification || "",
              quantity: qty,
              unitPrice: unit,
              totalPrice: unit * qty,
              note: "추가옵션",
            });
          }
        });
      }
    });

    if (selectedType === "경량랙") {
      customMaterials.forEach((m) => {
        const unit = Number(m.price) || 0;
        result.push({
          rackType: selectedType,
          name: m.name,
          specification: "",
          quantity: qty,
          unitPrice: unit,
          totalPrice: unit * qty,
          note: "추가옵션",
        });
      });
    }

    return result;
  };

  // 경량랙 H750 전용 BOM(H900 기반 수량/라벨만)
  const makeLightRackH750BOM = () => {
    const qty = Number(quantity) || 1;
    const lvl = parseInt(String(selectedOptions.level || "").replace(/[^\d]/g, ""), 10) || 5;
    const isConn = selectedOptions.formType === "연결형";

    const pillarQty = (isConn ? 2 : 4) * qty;
    const connectBarQty = 4 * qty;
    const shelfQty = lvl * qty;
    const padTopQty = 2 * qty;
    const padBottomQty = (isConn ? 8 : 10) * qty;
    const seatQty = (isConn ? 2 : 4) * qty;
    const pinQty = 8 * qty;

    return [
      { rackType: selectedType, size: selectedOptions.size, name: "기둥(750)", specification: "높이 H750", quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: "연결대", specification: "", quantity: connectBarQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: "선반", specification: `사이즈 ${selectedOptions.size || ""}`, quantity: shelfQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: "받침(상)", specification: "", quantity: padTopQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: "받침(하)", specification: "", quantity: padBottomQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: "안전좌", specification: "", quantity: seatQty, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: selectedOptions.size, name: "안전핀", specification: "", quantity: pinQty, unitPrice: 0, totalPrice: 0 },
      ...makeExtraOptionBOM(),
    ];
  };

  // 기본 하드웨어(브레싱/볼트/고무) 강제 보강
  const appendCommonHardwareIfMissing = (list, qty) => {
    const names = new Set(list.map((x) => x.name));
    const pushIfAbsent = (name, quantity) => {
      if (!names.has(name)) {
        list.push({
          rackType: selectedType,
          size: selectedOptions.size,
          name,
          specification: "",
          quantity,
          unitPrice: 0,
          totalPrice: 0,
        });
        names.add(name);
      }
    };

    // 파렛트랙(철판형 포함) → 표 규칙
    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      const isConn = selectedOptions.formType === "연결형";
      const h = parseHeightMm(selectedOptions.height);
      const { horizontal, diagonal, anchor, baseBolt, braceBolt, rubber } =
        calcPalletHardwareCounts(h, isConn, qty);

      pushIfAbsent("수평브레싱", horizontal);
      pushIfAbsent("경사브레싱", diagonal);
      pushIfAbsent("앙카볼트", anchor);
      pushIfAbsent("베이스볼트", baseBolt);
      pushIfAbsent("브레싱볼트", braceBolt);
      pushIfAbsent("브레싱고무", rubber);
      return;
    }

    // 그 외 타입 기본 규칙
    pushIfAbsent("수평브레싱", 2 * qty);
    pushIfAbsent("경사브레싱", 3 * qty);
    pushIfAbsent("앙카볼트", 4 * qty);
    pushIfAbsent("베이스볼트", 4 * qty);
    pushIfAbsent("브레싱볼트", 4 * qty);
    pushIfAbsent("브레싱고무", 4 * qty);
  };

  // Fallback BOM : 안전우 제외
  const getFallbackBOM = () => {
    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      const lvl = parseInt(selectedOptions.level || "") || 1;
      const sz = selectedOptions.size || "";
      const ht = selectedOptions.height || "";
      const form = selectedOptions.formType || "독립형";
      const qty = Number(quantity) || 1;

      // 로드빔/타이빔 표시용 규격 가공
      const { w, d } = parseWD(sz);
      const tieSpec = d != null ? String(d) : `규격 ${sz}`;
      const loadSpec =
        w != null ? String(Math.floor(w / 100) * 100) : `규격 ${sz}`;

      const base = [
        { rackType: selectedType, size: sz, name: `기둥(${ht})`, specification: `높이 ${ht}`, quantity: (form === "연결형" ? 2 : 4) * qty, unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, size: sz, name: "로드빔", specification: loadSpec, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, size: sz, name: "타이빔", specification: tieSpec, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, size: sz, name: "베이스(안전좌)", specification: "", quantity: 2 * qty, unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, size: sz, name: "안전핀", specification: "", quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
      ];
      appendCommonHardwareIfMissing(base, qty);
      return [...base, ...makeExtraOptionBOM()];
    }

    if (selectedType === "하이랙") {
      return [
        { rackType: selectedType, name: "기둥", specification: `높이 ${selectedOptions.height || ""}`, quantity: 4 * (Number(quantity) || 1), unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, name: "선반", specification: `사이즈 ${selectedOptions.size || ""}`, quantity: (parseInt(selectedOptions.level) || 5) * (Number(quantity) || 1), unitPrice: 0, totalPrice: 0 },
        ...makeExtraOptionBOM(),
      ];
    }

    if (selectedType === "스텐랙") {
      return [
        { rackType: selectedType, name: "기둥", specification: `높이 ${selectedOptions.height || ""}`, quantity: 4 * (Number(quantity) || 1), unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, name: "선반", specification: `사이즈 ${selectedOptions.size || ""}`, quantity: (parseInt(selectedOptions.level) || 5) * (Number(quantity) || 1), unitPrice: 0, totalPrice: 0 },
        ...makeExtraOptionBOM(),
      ];
    }

    return makeExtraOptionBOM();
  };

  // 현재 BOM
  const calculateCurrentBOM = useCallback(() => {
    if (customPrice > 0) return getFallbackBOM();
    if (!selectedType || quantity <= 0) return [];

    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      const rec =
        bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[
          selectedOptions.level
        ]?.[selectedOptions.formType];

      if (rec?.components) {
        const q = Number(quantity) || 1;
        const sz = selectedOptions.size || "";
        const { w, d } = parseWD(sz);
        const loadSpec = w != null ? String(Math.floor(w / 100) * 100) : `규격 ${sz}`;
        const tieSpec = d != null ? String(d) : `규격 ${sz}`;

        const base = rec.components.map((c) => {
          let spec = c.specification ?? "";
          // 로드빔/타이빔은 표시 규칙 강제 적용(선택한 규격 기반)
          if (String(c.name).includes("로드빔")) spec = loadSpec;
          if (String(c.name).includes("타이빔")) spec = tieSpec;

          return {
            rackType: selectedType,
            size: sz,
            name: c.name,
            specification: spec,
            note: c.note ?? "",
            quantity: (Number(c.quantity) || 0) * q,
            unitPrice: Number(c.unit_price) || 0,
            totalPrice:
              Number(c.total_price) > 0
                ? Number(c.total_price) * q
                : (Number(c.unit_price) || 0) * (Number(c.quantity) || 0) * q,
          };
        });

        appendCommonHardwareIfMissing(base, q);
        return [...base, ...makeExtraOptionBOM()];
      }
      return getFallbackBOM();
    }

    if (["하이랙", "스텐랙"].includes(selectedType)) {
      return getFallbackBOM();
    }

    if (["경량랙", "중량랙"].includes(selectedType)) {
      if (selectedType === "경량랙" && selectedOptions.height === "H750") {
        return makeLightRackH750BOM();
      }
      const rec =
        bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[
          selectedOptions.level
        ]?.[selectedOptions.formType];
      const q = Number(quantity) || 1;
      const base = (rec?.components || []).map((c) => ({
        rackType: selectedType,
        size: selectedOptions.size,
        name: c.name,
        specification: c.specification ?? "",
        note: c.note ?? "",
        quantity: (Number(c.quantity) || 0) * q,
        unitPrice: Number(c.unit_price) || 0,
        totalPrice:
          Number(c.total_price) > 0
            ? Number(c.total_price) * q
            : (Number(c.unit_price) || 0) * (Number(c.quantity) || 0) * q,
      }));
      return [...base, ...makeExtraOptionBOM()];
    }

    return makeExtraOptionBOM();
  }, [selectedType, selectedOptions, quantity, customPrice, bomData, extraOptionsSel, extraProducts]);

  // 옵션 변경
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

  // extra 체크박스 토글
  const handleExtraOptionChange = (nextIds) => {
    const ids = Array.from(new Set(nextIds || [])).map(String);
    setExtraOptionsSel(ids);
  };

  // 장바구니
  const addToCart = () => {
    if (!selectedType || quantity <= 0) return;
    setCart((prev) => [
      ...prev,
      {
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
          selectedOptions.color ? selectedOptions.color : "",
        ]
          .filter(Boolean)
          .join(" "),
      },
    ]);
  };
  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));

  // 장바구니 수량 변경 시 가격/BOM 동기화
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
            totalPrice: unit
              ? unit * q
              : c.total_price
              ? (c.total_price / oldQty) * nextQty
              : 0,
          };
        });

        return { ...item, quantity: nextQty, price: newPrice, bom: newBOM };
      })
    );
  };

  // 전체 BOM(집계)
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

  // 현재 항목 가격/BOM 동기 계산
  useEffect(() => {
    setCurrentPrice(calculatePrice());
    setCurrentBOM(customPrice > 0 ? getFallbackBOM() : calculateCurrentBOM());
  }, [calculatePrice, calculateCurrentBOM]);

  // 전체 BOM 뷰
  const cartBOMView = useMemo(() => cartBOM, [cartBOM]);

  return (
    <ProductContext.Provider
      value={{
        // 옵션/상태
        allOptions,
        availableOptions,
        colorLabelMap,
        selectedType,
        selectedOptions,
        quantity,
        setQuantity,
        applyRate,
        setApplyRate,
        customPrice,
        setCustomPrice,

        // 동작
        handleOptionChange,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,

        // 가격/BOM
        currentPrice,
        currentBOM,
        cart,
        cartTotal,
        cartBOM,
        cartBOMView,
        loading,

        // 추가 옵션
        extraProducts,
        extraOptionsSel,
        handleExtraOptionChange,

        // 경량랙 사용자 정의 자재
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
