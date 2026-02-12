import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo
} from "react";
import { sortBOMByMaterialRule } from "../utils/materialSort";
import { setBomDataForRegeneration } from "../utils/bomRegeneration";
import {
  loadAdminPrices,
  getEffectivePrice as utilGetEffectivePrice,
  generatePartId,
  generateInventoryPartId,
  loadExtraOptionsPrices,
  // ✅ Phase 2 추가
  mapExtraToBaseInventoryPart,
  mapExtraToBasePartId,
  EXTRA_TO_BASE_INVENTORY_MAPPING
} from '../utils/unifiedPriceManager';
import { inventoryService } from '../services/InventoryService';
import {
  generateBOMDisplayName,
  removeColorFromPartName,
  getExtraOptionDisplayInfo,
  generateHighRackDisplayName,
  generateHighRackDisplayNameFromBaseName,
  extractPartNameFromCleanName
} from '../utils/bomDisplayNameUtils';

const ProductContext = createContext();

const formTypeRacks = ["경량랙", "중량랙", "파렛트랙 철판형"]; // "파렛트랙", 은 이제 별도 분리임

// 하이랙 고정 높이
const HIGH_RACK_HEIGHTS = ["150", "200", "250"];

const EXTRA_OPTIONS = {
  파렛트랙: { height: ["H4500", "H5000", "H5500", "H6000"] },
  "파렛트랙 철판형": {
    height: ["1500", "2000", "2500", "3000", "3500", "4000", "H4500", "H5000", "H5500", "H6000"],
    size: ["2090x800", "2090x1000"]
  },
  하이랙: { size: ["45x150"], level: ["5단", "6단"] },
  스텐랙: { level: ["5단", "6단"], height: ["210"] },
  경량랙: { height: ["H750"] }
};

const COMMON_LEVELS = ["2단", "3단", "4단", "5단", "6단"];
export const colorLabelMap = { "200kg": "270kg", "350kg": "450kg", "700kg": "600kg" };

const parseSizeKey = (s = "") => {
  const m = String(s).replace(/\s+/g, "").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m ? { a: Number(m[1]), b: Number(m[2]) } : null;
};
const sortSizes = (arr = []) => [...new Set(arr)].sort((A, B) => {
  const a = parseSizeKey(A), b = parseSizeKey(B);
  if (a && b) { if (a.a !== b.a) return a.a - b.a; if (a.b !== b.b) return a.b - b.b; }
  return String(A).localeCompare(String(B), "ko");
});
const parseNum = (s = "") => {
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};
const sortHeights = (arr = []) => [...new Set(arr)].sort((a, b) => parseNum(a) - parseNum(b));
const sortLevels = (arr = []) => [...new Set(arr)].sort((a, b) => parseNum(a) - parseNum(b));

// const HIGHRACK_600_ALIAS_VIEW_FROM_DATA = { "80x146":"80x108", "80x206":"80x150" };
// const HIGHRACK_600_ALIAS_DATA_FROM_VIEW = { "80x108":"80x146", "80x150":"80x206" };

const parseHeightMm = (h) => Number(String(h || "").replace(/[^\d]/g, "")) || 0;
const parseLevel = (levelStr, rackType) => {
  if (!levelStr) return 1;
  if (rackType === "파렛트랙 철판형") {
    const m = String(levelStr).match(/L?(\d+)/); return m ? parseInt(m[1]) : 1;
  } else {
    const m = String(levelStr).match(/(\d+)/); return m ? parseInt(m[1]) : 1;
  }
};

const parseWD = (size = "") => {
  const m = String(size).replace(/\s+/g, "").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m ? { w: Number(m[1]), d: Number(m[2]) } : { w: null, d: null };
};

const calcPalletIronShelfPerLevel = (size) => {
  const { w } = parseWD(size);
  if (w === 1390) return 2;
  if (w === 2090) return 3;
  if (w === 2590) return 4;
  return 1;
};
const calcHighRackShelfPerLevel = (size) => {
  const { d } = parseWD(size);
  if (d === 108) return 1;
  if (d === 150 || d === 200) return 2;
  return 1;
};

// 브레싱볼트 규칙
function calcBracingBoltCount(heightRaw, isConn, qty) {
  let heightMm = parseHeightMm(heightRaw);
  const baseHeight = 1500;
  let perUnit = 10 + Math.max(0, Math.floor((heightMm - baseHeight) / 500)) * 2;
  if (isConn) perUnit = Math.floor(perUnit / 2);
  return perUnit * qty;
}

// 브러싱고무는 기둥 갯수와 동일
function calcBrushingRubberCount(postQty) {
  return postQty;
}

const extractWeightOnly = (color = "") => {
  const m = String(color).match(/(\d{2,4}kg)/);
  return m ? m[1] : "";
};

const normalizePartName = (name = "") => {
  return name.replace(/브레싱고무/g, "브러싱고무");
};

const applyAdminEditPrice = (item) => {
  try {
    const stored = localStorage.getItem('admin_edit_prices') || '{}';
    const priceData = JSON.parse(stored);
    // ✅ 단가 관리는 partId 사용 (색상 제거), 재고 관리는 inventoryPartId 사용
    // item.partId가 있으면 우선 사용 (경량랙 등에서 명시적으로 생성한 경우)
    const partId = item.partId || generatePartId(item);
    const adminPrice = priceData[partId];

    console.log(`🔍 부품 ${item.name} (ID: ${partId}) 관리자 단가 확인:`, adminPrice);

    if (adminPrice && adminPrice.price > 0) {
      console.log(`✅ 관리자 단가 적용: ${item.name} ${adminPrice.price}원`);
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

const ensureSpecification = (row, ctx = {}) => {
  if (!row) return row;
  const { size, height, weight } = ctx;
  row.name = normalizePartName(row.name || "");
  const weightOnly = weight ? extractWeightOnly(weight) : "";

  // ✅ 파렛트랙 3t 전용 플래그
  const isPalletRack3t = row.rackType === "파렛트랙" && String(weight).trim() === "3t";

  if (!row.specification || !row.specification.trim()) {
    const nm = row.name || "";

    // ✅ 하드웨어 (specification 빈 문자열)
    if (/브러싱고무|브레싱고무|브레싱볼트|앙카볼트/.test(nm)) {
      row.specification = "";
    }
    // ✅ 브레싱
    else if (/(수평|경사)브레?싱/.test(nm)) {
      const { d } = parseWD(size || "");
      row.specification = d ? `${d}` : "";
    }
    // ✅ 기둥
    else if (/^기둥$/.test(nm) && height) {
      // ⚠️ 하이랙만 사이즈 포함
      if (row.rackType === "하이랙" && size) {
        row.specification = `사이즈 ${size} 높이 ${height}${weightOnly ? ` ${weightOnly}` : ""}`;
      } else {
        row.specification = `${height}`;
      }
    }
    // ✅ 로드빔
    else if (/^로드빔$/.test(nm)) {
      const { w } = parseWD(size || "");
      row.specification = w ? `${w}` : "";
    }
    // ✅ 타이빔
    else if (/^타이빔$/.test(nm)) {
      const { d } = parseWD(size || "");
      row.specification = d ? `${d}` : "";
    }
    // ✅ 선반
    else if (/^선반$/.test(nm)) {
      const { w, d } = parseWD(size || "");
      if (row.rackType === "경량랙" || row.rackType === "중량랙") {
        row.specification = w && d ? `W${w}xD${d}` : "";
      } else {
        row.specification = `사이즈 ${size || ""}${weightOnly ? ` ${weightOnly}` : ""}`;
      }
    }
    // ✅ 받침
    else if (/받침\(상\)/.test(nm) || /받침\(하\)/.test(nm)) {
      const { d } = parseWD(size || "");
      row.specification = d ? `D${d}` : "";
    }
    // ✅ 연결대
    else if (/연결대/.test(nm)) {
      const { w } = parseWD(size || "");
      row.specification = w ? `W${w}` : "";
    }
    // ✅ 안전핀/안전좌
    else if (/^안전핀$/.test(nm) || /^안전좌$/.test(nm)) {
      row.specification = "";
    }
    // ✅ 하이랙
    else if (/기둥\(/.test(nm) && height && row.rackType === "하이랙") {
      if (size) {
        row.specification = `사이즈 ${size} 높이 ${height}${weightOnly ? ` ${weightOnly}` : ""}`;
      } else {
        row.specification = `높이 ${height}${weightOnly ? ` ${weightOnly}` : ""}`;
      }
    } else if (/로드빔\(/.test(nm) && row.rackType === "하이랙") {
      const m = nm.match(/\((\d+)\)/);
      if (m) row.specification = `${m[1]}${weightOnly ? ` ${weightOnly}` : ""}`;
    } else if (/선반\(/.test(nm) && row.rackType === "하이랙") {
      row.specification = `사이즈 ${size || ""}${weightOnly ? ` ${weightOnly}` : ""}`;
    }
    // ✅ 스텐랙
    else if (/기둥\(/.test(nm) && height && row.rackType === "스텐랙") {
      row.specification = `높이 ${height}`;
    } else if (/선반\(/.test(nm) && row.rackType === "스텐랙") {
      row.specification = `사이즈 ${size || ""}`;
    } else if (!row.specification && size) {
      row.specification = ``;
    }
  } else {
    // ✅ 기존 specification이 존재하는 경우 하이랙 무게 추가
    if (weightOnly && row.rackType === "하이랙" && !row.specification.includes(weightOnly)) {
      row.specification = `${row.specification} ${weightOnly}`;
    }
  }

  // ✅ 추가 규칙: 파렛트랙 & 3t일 경우 `_3t` suffix 부착
  // 단, 브레싱/브레싱볼트/브러싱고무는 제외
  if (isPalletRack3t && row.specification) {
    // ⚠️ 브레싱, 브레싱볼트, 브러싱고무 등등은 무게급 구분 없음
    const isHardware = /(수평|경사)브레?싱|브레싱볼트|브러싱고무|브레싱고무/.test(row.name);

    if (!isHardware && !/_3t$/i.test(row.specification)) {
      row.specification = `${row.specification}_3t`;
    }
  }

  return row;
};

export const ProductProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [bomData, setBomData] = useState({});
  const [extraProducts, setExtraProducts] = useState({});
  const [inventory, setInventory] = useState({}); // ✅ 서버 재고 상태
  const [loadingInventory, setLoadingInventory] = useState(false); // ✅ 재고 로딩 상태
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
  const [extraOptionsSel, setExtraOptionsSel] = useState([]);
  const [customMaterials, setCustomMaterials] = useState([]);

  // ✅ 관리자 단가 변경 감지를 위한 상태 추가
  const [adminPricesVersion, setAdminPricesVersion] = useState(0);

  // ✅ 관리자 단가 변경 이벤트 리스너 추가
  useEffect(() => {
    const handleAdminPriceChange = () => {
      console.log('ProductContext: 관리자 단가 변경 감지, 가격 재계산 트리거');
      setAdminPricesVersion(prev => prev + 1);
    };

    const handleSystemRestore = () => {
      console.log('ProductContext: 시스템 데이터 복원 감지, 가격 재계산 트리거');
      setAdminPricesVersion(prev => prev + 1);
    };

    // ✅ 추가: 추가옵션 가격 변경 이벤트 리스너
    const handleExtraOptionsPriceChange = () => {
      console.log('ProductContext: 추가옵션 가격 변경 감지, 가격 재계산 트리거');
      setAdminPricesVersion(prev => prev + 1);
    };

    window.addEventListener('adminPriceChanged', handleAdminPriceChange);
    window.addEventListener('systemDataRestored', handleSystemRestore);
    window.addEventListener('extraOptionsPriceChanged', handleExtraOptionsPriceChange); // ✅ 추가

    return () => {
      window.removeEventListener('adminPriceChanged', handleAdminPriceChange);
      window.removeEventListener('systemDataRestored', handleSystemRestore);
      window.removeEventListener('extraOptionsPriceChanged', handleExtraOptionsPriceChange); // ✅ 추가
    };
  }, []);

  // ✅ 서버에서 재고 데이터를 로드하는 함수
  const loadInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const inventoryData = await inventoryService.getInventory();
      setInventory(inventoryData);
      console.log('📦 서버 재고 데이터 로드 완료:', inventoryData);
    } catch (error) {
      console.error('서버 재고 데이터 로드 실패:', error);
      // 실패 시 로컬 스토리지 데이터 사용 등 대체 로직 고려 가능
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  // ✅ 서버의 재고 데이터를 업데이트하는 함수
  const updateInventory = useCallback(async (updates) => {
    setLoadingInventory(true);
    try {
      const newInventory = await inventoryService.updateInventory(updates);
      setInventory(newInventory);
      console.log('📦 서버 재고 데이터 업데이트 완료:', newInventory);
    } catch (error) {
      console.error('서버 재고 데이터 업데이트 실패:', error);
      throw error; // 에러를 호출자에게 전파
    } finally {
      setLoadingInventory(false);
    }
  }, []);


  // ✅ getEffectivePrice 함수를 먼저 정의하고 adminPricesVersion을 의존성에 추가
  const getEffectivePrice = useCallback((item) => {
    try {
      return utilGetEffectivePrice(item);
    } catch (error) {
      console.warn('unifiedPriceManager getEffectivePrice 호출 실패, 기본 단가 사용:', error);
      return Number(item.unitPrice) || 0;
    }
  }, [adminPricesVersion]); // ✅ adminPricesVersion 의존성 추가

  const addCustomMaterial = (name, price) => {
    if (!String(name).trim() || !(Number(price) > 0)) return;
    setCustomMaterials(prev => [...prev, { id: `cm-${Date.now()}-${prev.length}`, name: String(name), price: Number(price) }]);
  };
  const removeCustomMaterial = (id) => setCustomMaterials(prev => prev.filter(m => m.id !== id));
  const clearCustomMaterials = () => setCustomMaterials([]);

  // 초기 데이터 로드 및 옵션 설정
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1. Gist에서 BOM 데이터 로드 (기존 로직 유지)
        const dj = await (await fetch("./data.json")).json();
        const bj = await (await fetch("./bom_data_weight_added.json")).json(); // bom_data
        const ejRaw = await (await fetch("./extra_options.json")).json();

        // 2. ✅ 서버 재고 데이터 로드 (추가된 핵심 로직)
        await loadInventory();

        // 3. 데이터 및 BOM 설정 (기존 로직 유지)
        setData(dj);
        setBomData(bj);
        setBomDataForRegeneration(bj); // ✅ 추가: BOM 재생성 유틸에도 데이터 전달

        const canonical = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형", "하이랙", "스텐랙"];
        const fromData = Object.keys(dj || {});
        const types = canonical.filter(t => fromData.includes(t));
        const leftovers = fromData.filter(t => !types.includes(t));

        // 기존 로직: setAllOptions({types:[...types,...leftovers]});
        const allTypes = [...types, ...leftovers];
        const allOpts = { types: allTypes };

        allTypes.forEach(type => {
          allOpts[type] = {
            sizes: sortSizes([...new Set(dj[type]?.sizes || []), ...(EXTRA_OPTIONS[type]?.size || [])]),
            heights: sortHeights([...new Set(dj[type]?.heights || []), ...(EXTRA_OPTIONS[type]?.height || [])]),
            weights: [...new Set(dj[type]?.weights || [])],
            levels: sortLevels([...new Set(dj[type]?.levels || []), ...(EXTRA_OPTIONS[type]?.level || [])]),
          };
        });

        // 4. 추가 옵션 가격 로드 (기존 로직 유지)
        const ej = { ...(ejRaw || {}) };
        canonical.forEach(t => { if (!ej[t]) ej[t] = {}; });
        setExtraProducts(ej);  // ✅ 객체 그대로 설정

        setAllOptions(allOpts);
        setSelectedType(allTypes[0] || "");

        // 5. 로컬스토리지 복원 로직 (기존 로직 유지)
        const localSelectedType = localStorage.getItem("selectedType");
        const localSelectedOptions = localStorage.getItem("selectedOptions");
        if (localSelectedType && allTypes.includes(localSelectedType)) {
          setSelectedType(localSelectedType);
          if (localSelectedOptions) setSelectedOptions(JSON.parse(localSelectedOptions));
        }

        // 6. 로컬스토리지에서 장바구니 복원 (기존 로직 유지)
        const localCart = localStorage.getItem("cart");
        if (localCart) setCart(JSON.parse(localCart));

        // 7. 로컬스토리지에서 커스텀 자재 복원 (기존 로직 유지)
        const localCustomMaterials = localStorage.getItem("customMaterials");
        if (localCustomMaterials) setCustomMaterials(JSON.parse(localCustomMaterials));

        // 8. 로컬스토리지에서 적용 환율 복원 (기존 로직 유지)
        const localApplyRate = localStorage.getItem("applyRate");
        if (localApplyRate) setApplyRate(Number(localApplyRate));


      } catch (e) {
        console.error("데이터 로드 실패", e);
        setAllOptions({ types: [] });
      }
      finally { setLoading(false); }
    })();
  }, [loadInventory, getEffectivePrice]); // ✅ loadInventory와 getEffectivePrice를 의존성에 추가

  useEffect(() => {
    if (!selectedType) { setAvailableOptions({}); return; }

    // ======================
    // ✅ 파렛트랙만 version → weight → size → height → level → formType 순서로
    // ======================

    if (selectedType === "파렛트랙") {
      const bd = bomData["파렛트랙"] || {};
      const next = { version: [], weight: [], size: [], height: [], level: [], formType: [] };

      // 1️⃣ version 리스트 구성
      next.version = ["구형", "신형"];

      // 2️⃣ version 선택되면 weight 리스트 구성
      if (selectedOptions.version) {
        const version = selectedOptions.version;
        const versionBlock = bd[version] || {};
        const weightKeys = Object.keys(versionBlock || {}); // ['2t','3t']
        next.weight = weightKeys;

        // 3️⃣ weight 선택되면 size 리스트 구성
        if (selectedOptions.weight && versionBlock[selectedOptions.weight]) {
          const weightBlock = versionBlock[selectedOptions.weight] || {};
          const sizesFromData = Object.keys(weightBlock || {});
          const extraSizes = EXTRA_OPTIONS["파렛트랙"]?.size || [];
          next.size = sortSizes([...sizesFromData, ...extraSizes]);

          // 4️⃣ size 선택되면 height 구성
          if (selectedOptions.size && versionBlock[selectedOptions.weight]?.[selectedOptions.size]) {
            const heightsFromData = Object.keys(
              versionBlock[selectedOptions.weight]?.[selectedOptions.size] || {}
            );
            next.height = sortHeights([
              ...heightsFromData,
              ...(EXTRA_OPTIONS["파렛트랙"]?.height || [])
            ]);

            // 5️⃣ height 선택되면 level 구성
            if (selectedOptions.height && versionBlock[selectedOptions.weight]?.[selectedOptions.size]?.[selectedOptions.height]) {
              const levelsFromData = Object.keys(
                versionBlock[selectedOptions.weight]?.[selectedOptions.size]?.[selectedOptions.height] || {}
              );
              next.level = sortLevels(levelsFromData.length ? levelsFromData : ["L1", "L2", "L3", "L4", "L5", "L6"]);

              // 6️⃣ level 선택되면 formType 구성
              if (selectedOptions.level && versionBlock[selectedOptions.weight]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]) {
                const fm = versionBlock[selectedOptions.weight]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {};
                next.formType = Object.keys(fm).length ? Object.keys(fm) : ["독립형", "연결형"];
              }
            }
          }
        }
      } else {
        // version이 선택되지 않았으면 weight는 빈 배열
        next.weight = [];
      }

      setAvailableOptions(next);
      return;
    }

    // ======================
    // 기존 로직 (경량랙/중량랙/하이랙 등)
    // ======================
    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};
      const next = { size: [], height: [], level: [], formType: [] };
      // ✅ 경량랙일 때 color 옵션을 제품 유형 선택 후 바로 표시
      if (selectedType === "경량랙") {
        next.color = ["아이보리", "블랙", "실버"];
      }
      // ✅ 경량랙: color 선택 후 size 옵션 표시
      if (selectedType === "경량랙" && selectedOptions.color) {
        const sizesFromData = Object.keys(bd || {});
        const extraSizes = EXTRA_OPTIONS[selectedType]?.size || [];
        next.size = sortSizes([...sizesFromData, ...extraSizes]);
      } else if (selectedType !== "경량랙") {
        const sizesFromData = Object.keys(bd || {});
        const extraSizes = EXTRA_OPTIONS[selectedType]?.size || [];
        next.size = sortSizes([...sizesFromData, ...extraSizes]);
      }
      if (selectedOptions.size) {
        const heightsFromData = Object.keys(bd[selectedOptions.size] || {});
        next.height = sortHeights([...heightsFromData, ...(EXTRA_OPTIONS[selectedType]?.height || [])]);
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
          const levelKeys = Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {}) || [];
          next.level = levelKeys.length ? sortLevels(levelKeys) : ["L1", "L2", "L3", "L4", "L5", "L6"];
          if (selectedOptions.level) {
            const fm = bd[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level] || {};
            next.formType = Object.keys(fm).length ? Object.keys(fm) : ["독립형", "연결형"];
          }
        }
      }
      setAvailableOptions(next);
      return;
    }
    if (selectedType === "하이랙" && data?.하이랙) {
      const rd = data["하이랙"];
      const opts = { color: rd["색상"] || [] };
      if (selectedOptions.color) {
        const color = selectedOptions.color;
        const weightOnly = extractWeightOnly(color);
        const hide45 = ["450kg", "600kg", "700kg"].includes(weightOnly);
        const isHeaviest = /(600kg|700kg)$/.test(color);
        const rawSizes = Object.keys(rd["기본가격"]?.[color] || {});
        const sizeViewList = rawSizes; // ALIAS 매핑 제거
        // const sizeViewList=rawSizes.map(s=>
        //   isHeaviest && HIGHRACK_600_ALIAS_VIEW_FROM_DATA[s]
        //     ? HIGHRACK_600_ALIAS_VIEW_FROM_DATA[s]
        //     : s
        // );
        let baseSizes = hide45
          ? sizeViewList.filter(s => s !== "45x150")
          : sizeViewList;
        (EXTRA_OPTIONS["하이랙"]?.size || []).forEach(s => {
          if (hide45 && s === "45x150") return;
          if (!baseSizes.includes(s)) baseSizes.push(s);
        });
        if (isHeaviest && !baseSizes.includes("80x200")) baseSizes.push("80x200");
        opts.size = sortSizes(baseSizes);
        if (selectedOptions.size) {
          opts.height = [...HIGH_RACK_HEIGHTS];
          if (selectedOptions.height && !opts.height.includes(selectedOptions.height)) {
            setSelectedOptions(prev => ({ ...prev, height: "", level: "" }));
          }
          if (selectedOptions.height) {
            const sizeKey = selectedOptions.size; // ALIAS 매핑 제거
            // const sizeKey = isHeaviest
            //   ? HIGHRACK_600_ALIAS_DATA_FROM_VIEW[selectedOptions.size]||selectedOptions.size
            //   : selectedOptions.size;
            const levelKeys = Object.keys(
              rd["기본가격"]?.[color]?.[sizeKey]?.[selectedOptions.height] || {}
            );
            const full = ["1단", "2단", "3단", "4단", "5단", "6단"];
            let merged = levelKeys.length ? levelKeys : full;
            (EXTRA_OPTIONS["하이랙"]?.level || []).forEach(l => {
              if (!merged.includes(l)) merged.push(l);
            });
            if (isHeaviest) {
              full.forEach(l => { if (!merged.includes(l)) merged.push(l); });
            }
            opts.level = sortLevels(merged);
            if (selectedOptions.level && !opts.level.includes(selectedOptions.level)) {
              setSelectedOptions(prev => ({ ...prev, level: "" }));
            }
          }
        }
      }
      opts.formType = ["독립형", "연결형"];
      setAvailableOptions(opts);
      return;
    }
    if (selectedType === "스텐랙" && data?.스텐랙) {
      const rd = data["스텐랙"];
      const opts = { size: sortSizes(Object.keys(rd["기본가격"] || {})) };
      if (selectedOptions.size) {
        const heightsFromData = Object.keys(rd["기본가격"][selectedOptions.size] || {});
        opts.height = sortHeights([...heightsFromData, (EXTRA_OPTIONS["스텐랙"]?.height || [])]);
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

  const sumComponents = (arr = []) => arr.reduce((s, c) => {
    const tp = Number(c.total_price) || 0;
    const up = Number(c.unit_price) || 0;
    const q = Number(c.quantity) || 0;
    return s + (tp > 0 ? tp : up * q);
  }, 0);

  // ✅ 수정된 calculatePrice 함수
  const calculatePrice = useCallback(() => {
    console.log('🔄 calculatePrice 함수 호출됨');
    if (!selectedType || quantity <= 0) return 0;
    if (selectedType === "하이랙" && !selectedOptions.formType) return 0;

    if (customPrice > 0) return Math.round(customPrice * quantity * (applyRate / 100));

    let basePrice = 0;
    let bomPrice = 0;
    let basicPrice = 0;

    if (formTypeRacks.includes(selectedType)) {
      const { size, height: heightRaw, level: levelRaw, formType } = selectedOptions;
      const height = selectedType === "경량랙" && heightRaw === "H750" ? "H900" : heightRaw;

      // ✅ BOM 부품 단가 합산 가격 계산 (추가옵션 포함)
      const bom = calculateCurrentBOM();
      console.log('🔍 calculatePrice: BOM 데이터 확인', bom);

      if (bom && bom.length > 0) {
        bomPrice = bom.reduce((sum, item) => {
          const effectivePrice = getEffectivePrice(item);
          const quantity = Number(item.quantity) || 0;
          const itemTotal = effectivePrice * quantity;

          console.log(`  📦 ${item.name}: ${effectivePrice}원 × ${quantity}개 = ${itemTotal}원`);

          return sum + itemTotal;
        }, 0);
        console.log(`💰 BOM 총 가격 계산 (추가옵션 포함): ${bomPrice}원 (${bom.length}개 부품)`);
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

      // ✅ 수정: BOM 가격은 이미 수량이 적용되어 있으므로 그대로 사용
      if (bomPrice > 0) {
        basePrice = bomPrice; // ← 수량 곱하지 않음!
        console.log(`✅ BOM 가격 사용 (추가옵션 포함): ${basePrice}원`);
      } else if (basicPrice > 0) {
        basePrice = basicPrice * (Number(quantity) || 0); // 기본가격만 수량 곱하기
        console.log(`📋 기본가격 사용: ${basePrice}원`);
      }

    } else if (selectedType === "파렛트랙") {
      // ✅ 파렛트랙은 BOM 합산 기준으로 가격 계산
      const bom = calculateCurrentBOM();
      if (bom && bom.length > 0) {
        const bomPrice = bom.reduce((sum, item) => {
          const effectivePrice = getEffectivePrice(item);
          const quantity = Number(item.quantity) || 0;
          return sum + (effectivePrice * quantity);
        }, 0);
        basePrice = bomPrice;  // ← 수량 중복 곱하지 않음
      } else {
        // (선택) 기본가격 백업 경로가 필요하면 여기서 data["파렛트랙"]["기본가격"] 구조 맞춰 보조처리
        basePrice = 0;
      }
    } else if (selectedType === "스텐랙") {
      const bom = calculateCurrentBOM();

      if (bom && bom.length > 0) {
        bomPrice = bom.reduce((sum, item) => {
          const effectivePrice = getEffectivePrice(item);
          const quantity = Number(item.quantity) || 0;
          return sum + (effectivePrice * quantity);
        }, 0);
      }

      // ✅ 수정: BOM 가격은 이미 수량이 적용되어 있으므로 그대로 사용
      if (bomPrice > 0) {
        basePrice = bomPrice; // ← 수량 곱하지 않음!
      } else {
        const p = data["스텐랙"]["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level];
        if (p) basePrice = p * quantity; // 기본가격만 수량 곱하기
      }
    } else if (selectedType === "하이랙") {
      const bom = calculateCurrentBOM();

      if (bom && bom.length > 0) {
        bomPrice = bom.reduce((sum, item) => {
          const effectivePrice = getEffectivePrice(item);
          const quantity = Number(item.quantity) || 0;
          return sum + (effectivePrice * quantity);
        }, 0);
      }

      // ✅ 수정: BOM 가격은 이미 수량이 적용되어 있으므로 그대로 사용
      if (bomPrice > 0) {
        basePrice = bomPrice; // ← 수량 곱하지 않음!
      } else {
        const { size, color, height, level, formType } = selectedOptions;
        if (size && color && height && level && formType) {
          const isHeaviest = /600kg$/.test(color) || /700kg$/.test(color);
          const dataSizeKey = size; // ALIAS 매핑 제거
          // const dataSizeKey = isHeaviest
          //   ? HIGHRACK_600_ALIAS_DATA_FROM_VIEW[size] || size
          //   : size;
          const p = data["하이랙"]["기본가격"]?.[color]?.[dataSizeKey]?.[height]?.[level];
          if (p) basePrice = p * quantity; // 기본가격만 수량 곱하기
        }
      }
    }

    // ✅ 최종 가격: basePrice (BOM에 이미 사용자 정의 자재 포함됨)
    const finalPrice = Math.round(basePrice * (applyRate / 100));

    console.log(`💵 최종 가격: ${finalPrice}원 (BOM기반: ${basePrice}, 적용률: ${applyRate}%)`);

    return finalPrice;
  }, [selectedType, selectedOptions, quantity, customPrice, applyRate, data, bomData, extraProducts, extraOptionsSel, customMaterials, getEffectivePrice, adminPricesVersion]);

  const makeLightRackH750BOM = () => {
    const q = Number(quantity) || 1;
    const sz = selectedOptions.size || "";
    const ht = "H750";
    const form = selectedOptions.formType || "독립형";
    const level = parseInt((selectedOptions.level || "").replace(/[^\d]/g, "")) || 0;
    // const sizeMatch = sz.match(/W?(\d+)[xX]D?(\d+)/i) || [];
    // const W_num = sizeMatch[1] || "";
    // const D_num = sizeMatch[2] || "";

    // ✅ 경량랙: 안전핀, 안전좌가 아닌 경우에만 color 포함
    const color = selectedOptions.color || '';

    // ⚠️ 초기엔 spec 비워두고 -> 나중에 ensureSpecification으로 통일 포맷 적용
    const base = [
      { rackType: selectedType, size: sz, name: "기둥", specification: ``, quantity: (form === "연결형" ? 2 : 4) * q, unitPrice: 0, totalPrice: 0, color: color },
      { rackType: selectedType, size: sz, name: "받침(상)", specification: ``, quantity: (form === "연결형" ? 2 : 4) * q, unitPrice: 0, totalPrice: 0, color: color },
      { rackType: selectedType, size: sz, name: "받침(하)", specification: ``, quantity: (form === "연결형" ? 2 : 4) * q, unitPrice: 0, totalPrice: 0, color: color },
      { rackType: selectedType, size: sz, name: "연결대", specification: ``, quantity: level * q, unitPrice: 0, totalPrice: 0, color: color },
      // { rackType: selectedType, size: sz, name: "선반", specification: `${W_num}${D_num}`, quantity: level * q, unitPrice: 0, totalPrice: 0 },
      { rackType: selectedType, size: sz, name: "선반", specification: "", quantity: level * q, unitPrice: 0, totalPrice: 0, color: color },
      { rackType: selectedType, size: sz, name: "안전좌", specification: ``, quantity: level * q, unitPrice: 0, totalPrice: 0, color: '' }, // 안전좌는 색상 없음
      { rackType: selectedType, size: sz, name: "안전핀", specification: ``, quantity: level * q, unitPrice: 0, totalPrice: 0, color: '' }, // 안전핀은 색상 없음
    ];

    // const baseWithAdminPrices = base.map(applyAdminEditPrice);
    // return sortBOMByMaterialRule([...baseWithAdminPrices, ...makeExtraOptionBOM()]);

    // ✅ 항상 정규화 → 그 다음 관리자 단가 적용 (순서 보장)
    const normalized = base.map(r => {
      const specRow = ensureSpecification(r, { size: sz, height: ht, ...parseWD(sz) });
      // ✅ 경량랙: partId와 inventoryPartId 명시적 생성
      if (selectedType === "경량랙") {
        // 단가 관리용 partId (색상 제거)
        const partId = generatePartId({
          rackType: selectedType,
          name: specRow.name,
          specification: specRow.specification || ''
        });
        // 재고 관리용 inventoryPartId (색상 포함)
        const inventoryPartId = generateInventoryPartId({
          rackType: selectedType,
          name: specRow.name,
          specification: specRow.specification || '',
          color: specRow.color || ''
        });
        return {
          ...specRow,
          partId: partId,
          inventoryPartId: inventoryPartId
        };
      }
      return specRow;
    });
    const withAdmin = normalized.map(applyAdminEditPrice);

    // ✅ 사용자 정의 자재 추가 (경량랙 전용)
    const customBOM = customMaterials.map(cm => ({
      rackType: selectedType,
      size: sz,
      name: cm.name,
      specification: '',
      note: '추가 옵션',
      quantity: q,  // 사용자 입력 수량 적용
      unitPrice: Number(cm.price) || 0,
      totalPrice: (Number(cm.price) || 0) * q
    }));

    return sortBOMByMaterialRule([...withAdmin, ...makeExtraOptionBOM(), ...customBOM]);
  };

  // ✅ Phase 2 수정: makeExtraOptionBOM() 함수 완전 재작성
  // 핵심: 카테고리명에서 무게 정보 추출, 매핑 테이블 우선 확인, 추가상품4/5 색상 구분 처리
  // ⚠️ 중요: inventoryPartId는 반드시 Gist 서버의 inventory.json에 존재하는 ID만 사용
  const makeExtraOptionBOM = () => {
    const extraBOM = [];
    const extraOptionsPrices = loadExtraOptionsPrices();
    const q = Number(quantity) || 1;

    // ✅ 파렛트랙만 version 정보 추출
    const version = selectedType === "파렛트랙" ? (selectedOptions.version || "구형") : undefined;

    if (!extraOptionsSel || extraOptionsSel.length === 0) {
      return extraBOM;
    }

    // ✅ 카테고리명에서 무게 정보 추출 함수
    const extractWeightFromCategory = (categoryName) => {
      if (!categoryName) return null;
      const match = categoryName.match(/(\d+)kg/);
      return match ? match[1] + 'kg' : null;
    };

    // ✅ 중량랙 사이즈 변환 함수 (45x155 → w1500xd450)
    const convertWeightRackSize = (sizeStr) => {
      if (!sizeStr || selectedType !== '중량랙') return null;
      const match = sizeStr.match(/(\d+)x(\d+)/);
      if (!match) return null;
      const width = parseInt(match[1]); // cm
      const depth = parseInt(match[2]); // cm
      // 폭(cm)×깊이(cm) → D(mm)×W(mm)
      const w = width * 10; // cm to mm
      const d = depth * 10; // cm to mm
      return `w${w}xd${d}`;
    };

    // ✅ 하이랙 색상 추출 함수 (일반화)
    const extractColorFromName = (name, categoryName) => {
      if (selectedType !== '하이랙') return null;

      // 카테고리명에서 색상 확인
      if (categoryName?.includes('매트그레이') || categoryName?.includes('메트그레이')) return '메트그레이(볼트식)';
      if (categoryName?.includes('블루+오렌지') || categoryName?.includes('블루') || categoryName?.includes('오렌지')) {
        // 추가상품6의 경우 로드빔은 다른 형식
        if (categoryName?.includes('추가상품6') && (name?.includes('빔') || name?.includes('로드빔'))) {
          return '블루(기둥.선반)+오렌지(빔)';
        }
        return '블루(기둥)+오렌지(가로대)(볼트식)';
      }

      // 이름에서 색상 확인
      if (name?.includes('매트그레이') || name?.includes('메트그레이')) return '메트그레이(볼트식)';
      if (name?.includes('블루') || name?.includes('오렌지')) {
        if (name?.includes('빔') || name?.includes('로드빔')) {
          return '블루(기둥.선반)+오렌지(빔)';
        }
        return '블루(기둥)+오렌지(가로대)(볼트식)';
      }

      return null;
    };

    // ✅ 하이랙 추가상품 직접 처리 함수 (일반화)
    const handleHighRackDirectExtraOption = (opt, categoryName, cleanName, weight) => {
      // 추가상품4, 5만 직접 처리 (매핑 테이블에 없는 특수 케이스)
      if (!categoryName?.includes('추가상품4') && !categoryName?.includes('추가상품5')) {
        return null;
      }

      const sizeMatch = cleanName.match(/(\d+)x(\d+)/) || opt.name.match(/(\d+)x(\d+)/);
      if (!sizeMatch) return null;

      // 부품명 추출 (선반 또는 기둥)
      const isShelf = opt.name.includes('선반') || cleanName.includes('선반');
      const isPillar = opt.name.includes('기둥') || cleanName.includes('기둥');

      if (!isShelf && !isPillar) return null;

      const partName = isShelf ? '선반' : '기둥';
      const color = extractColorFromName(opt.name, categoryName);
      if (!color) return null;

      // specification 생성
      let specification;
      if (isShelf) {
        specification = `사이즈${sizeMatch[1]}x${sizeMatch[2]}${weight}`;
      } else {
        // ✅ 기둥: 사이즈(폭x깊이) + 높이 + 무게 모두 포함
        // 예: "사이즈60x200높이200270kg"
        specification = `사이즈${sizeMatch[1]}x${sizeMatch[2]}높이${sizeMatch[2]}${weight}`;
      }

      // colorWeight 생성
      const colorWeight = `${color}${weight}`;

      // inventoryPartId 직접 생성 (서버 형식)
      const inventoryPartId = `하이랙-${partName}${colorWeight}-${specification}`;

      // partId 생성 (색상 제거)
      const partId = generatePartId({
        rackType: selectedType,
        version: version,
        name: partName,
        specification: specification
      });

      // 가격 계산
      const adminPrices = loadAdminPrices();
      const adminPriceEntry = adminPrices[partId];
      const effectivePrice = adminPriceEntry && adminPriceEntry.price > 0
        ? adminPriceEntry.price
        : (extraOptionsPrices[opt.id]?.price || Number(opt.price) || 0);

      const optionQty = Number(opt.quantity) || 1;
      const totalQty = optionQty * q;

      // ✅ 부품명 생성 (원자재명세서 표시용) - 유틸 함수 사용
      const bomDisplayName = selectedType === '하이랙'
        ? generateHighRackDisplayName(partName, colorWeight)
        : opt.name;

      return {
        rackType: selectedType,
        version: version,
        size: selectedOptions.size || "",
        name: bomDisplayName, // ✅ 부품명 (하이랙: "메트그레이 기둥" 등)
        partId: partId,
        inventoryPartId: inventoryPartId,
        specification: specification,
        colorWeight: colorWeight,
        note: '기타추가옵션',
        quantity: totalQty,
        unitPrice: effectivePrice,
        totalPrice: effectivePrice * totalQty
      };
    };

    // ✅ 하이랙 사이즈 및 높이 추출 함수
    const extractHighRackSpec = (name) => {
      if (selectedType !== '하이랙') return null;
      const match = name.match(/(\d+)x(\d+)/);
      if (match) {
        return `사이즈${match[1]}x${match[2]}`;
      }
      const heightMatch = name.match(/(\d+)/);
      if (heightMatch) {
        return `높이${heightMatch[1]}`;
      }
      return null;
    };

    // ✅ Object.entries로 카테고리명도 함께 가져오기
    (Object.entries(extraProducts?.[selectedType] || {})).forEach(([categoryName, arr]) => {
      if (Array.isArray(arr)) {
        arr.forEach(opt => {
          // ✅ "기타자재" 제외
          if (opt.name && opt.name.includes('기타자재')) {
            return;
          }

          if (extraOptionsSel.includes(opt.id)) {
            console.log(`\n📌 기타 추가 옵션 BOM 처리: ${opt.name} (카테고리: ${categoryName})`);

            // ✅ 추가상품6 및 파렛트랙/파렛트랙신형/파렛트랙 철판형 추가상품1, 2, 3, 4의 경우 extra_options.json의 BOM을 직접 사용
            const isSeparatedBOM = (categoryName?.includes('추가상품6') ||
              ((selectedType === '파렛트랙' || selectedType === '파렛트랙신형' || selectedType === '파렛트랙 철판형') &&
                (categoryName?.includes('추가상품1') ||
                  categoryName?.includes('추가상품2') ||
                  categoryName?.includes('추가상품3') ||
                  categoryName?.includes('추가상품4')))) &&
              opt.bom && Array.isArray(opt.bom) && opt.bom.length >= 1;

            if (isSeparatedBOM) {
              // BOM이 이미 분리되어 있음 (선반+빔 또는 로드빔+타이빔 또는 철판형로드빔)
              console.log(`  🔀 ${categoryName} BOM 분리 처리: ${opt.bom.length}개 부품`);

              opt.bom.forEach((bomItem, bomIndex) => {
                let bomName = bomItem.name || '';
                const bomQty = Number(bomItem.qty) || 1;
                const bomRackType = bomItem.rackType || selectedType;
                let bomSpec = bomItem.specification || '';
                let bomColorWeight = bomItem.colorWeight || '';

                // ✅ 하이랙 추가상품6의 경우: bomName에서 기본 부품명 추출
                // 예: "80x108 블루선반" → "오렌지 선반", "80x108 오렌지빔" → "오렌지 로드빔"
                if (selectedType === '하이랙' && categoryName?.includes('추가상품6')) {
                  // specification에서 사이즈 추출
                  const sizeMatch = bomSpec.match(/사이즈\s*(\d+x\d+)\s*(\d+kg)/i);
                  if (sizeMatch) {
                    bomSpec = `사이즈${sizeMatch[1]}${sizeMatch[2]}`;
                  }

                  // name에서 기본 부품명 추출 및 색상 정보 포함
                  if (bomName.includes('선반')) {
                    bomName = '오렌지 선반'; // ✅ 색상 정보 포함
                    // ⚠️ 중요: 추가상품6은 블루+오렌지 색상이므로 올바른 colorWeight 설정
                    // extra_options.json의 colorWeight가 "블루(볼트식) 600kg" 형식이지만,
                    // 실제 서버 ID는 "블루(기둥)+오렌지(가로대)(볼트식)600kg" 형식이어야 함
                    bomColorWeight = '블루(기둥)+오렌지(가로대)(볼트식)600kg';
                  } else if (bomName.includes('빔') || bomName.includes('로드빔')) {
                    bomName = '오렌지 로드빔'; // ✅ 색상 정보 포함
                    // specification에서 깊이(depth)와 무게 추출 (예: "사이즈 80x108 600kg" → "108600kg")
                    // ⚠️ 중요: 로드빔은 깊이(depth, 두 번째 숫자)를 사용해야 함
                    const rodBeamMatch = bomSpec.match(/사이즈\s*\d+x(\d+)\s*(\d+kg)/i);
                    if (rodBeamMatch) {
                      bomSpec = `${rodBeamMatch[1]}${rodBeamMatch[2]}`; // 깊이 + 무게
                    }
                    // ⚠️ 중요: 추가상품6 로드빔은 블루+오렌지 색상
                    bomColorWeight = '블루(기둥.선반)+오렌지(빔)600kg';
                  }
                } else if (selectedType === '하이랙') {
                  // ✅ 하이랙 일반: bomName에 색상 정보 포함 - 유틸 함수 사용
                  bomName = generateHighRackDisplayName(bomName, bomColorWeight);
                }

                // BOM 항목의 inventoryPartId 생성
                // ⚠️ 중요: 하이랙 재고는 색상 정보가 핵심이므로 색상을 제거하지 않음!
                const bomNameForInventory = bomRackType === '하이랙' ? bomName : removeColorFromPartName(bomName);

                const bomInventoryPartId = generateInventoryPartId({
                  rackType: bomRackType,
                  version: (bomRackType === "파렛트랙" || bomRackType === "파렛트랙신형") ? version : undefined, // ✅ 파렛트랙/파렛트랙신형만 version 정보 포함
                  name: bomNameForInventory,
                  specification: bomSpec,
                  colorWeight: bomColorWeight
                });

                // 단가관리용 partId 생성 (색상 제거된 부품명 사용)
                // ⚠️ 중요: bomName은 이미 색상 정보가 포함된 표시용 이름이므로,
                // partId 생성 시에는 색상을 제거한 기본 부품명만 사용
                const bomNameForPartId = removeColorFromPartName(bomName);

                const bomPartId = generatePartId({
                  rackType: bomRackType,
                  version: (bomRackType === "파렛트랙" || bomRackType === "파렛트랙신형") ? version : undefined, // ✅ 파렛트랙/파렛트랙신형만 version 정보 포함
                  name: bomNameForPartId,
                  specification: bomSpec
                });

                // 관리자 수정 단가 우선 사용
                const adminPrices = loadAdminPrices();
                const adminPriceEntry = adminPrices[bomPartId];

                // 가격 계산: 관리자 단가 > 추가옵션 단가 / 부품 수
                const effectivePrice = adminPriceEntry && adminPriceEntry.price > 0
                  ? adminPriceEntry.price
                  : (extraOptionsPrices[opt.id]?.price || Number(opt.price) || 0) / opt.bom.length;

                const optionQty = Number(opt.quantity) || 1;
                const totalQty = bomQty * optionQty * q;

                extraBOM.push({
                  rackType: bomRackType,
                  version: (bomRackType === "파렛트랙" || bomRackType === "파렛트랙신형") ? version : undefined, // ✅ 파렛트랙/파렛트랙신형만 version 정보 포함
                  size: selectedOptions.size || "",
                  name: bomName,
                  partId: bomPartId, // 단가관리용
                  inventoryPartId: bomInventoryPartId, // 재고관리용
                  specification: bomSpec,
                  colorWeight: bomColorWeight,
                  note: '기타추가옵션', // ✅ 추가옵션 표시용
                  quantity: totalQty,
                  unitPrice: effectivePrice,
                  totalPrice: effectivePrice * totalQty
                });

                console.log(`    ✅ 부품 ${bomIndex + 1} 추가: partId="${bomPartId}", inventoryPartId="${bomInventoryPartId}" (${effectivePrice}원)`);
              });

              return; // 분리된 BOM은 여기서 종료
            }

            // ✅ 1. cleanName 먼저 생성 (specification 생성에 필요)
            // ⚠️ 중요: 하이랙의 경우 "45x108오렌지선반" → "45x108선반"으로 변환 (색상 제거)
            // 중량랙의 경우 "45x95"만 남기기
            // ⚠️ 추가상품3의 경우 "(블루기둥)" 또는 "(메트그레이기둥)" 형식이므로 괄호 제거 전에 정보 추출 필요
            let cleanName = (opt.name || '').replace(/\s*\(.*\)\s*/g, '').trim();

            // ✅ 추가상품3: 괄호 제거 전에 opt.name에서 기둥 정보 확인
            const isPillarFromName = opt.name?.includes('기둥') || false;
            const isMetallicPillar = opt.name?.includes('(메트그레이기둥)') || opt.name?.includes('메트그레이기둥') || opt.name?.includes('매트그레이기둥') || false;
            const isBluePillar = opt.name?.includes('(블루기둥)') || opt.name?.includes('블루기둥') || false;

            // 하이랙: 색상 관련 텍스트 제거
            if (selectedType === '하이랙') {
              cleanName = cleanName
                .replace(/오렌지/g, '')
                .replace(/매트그레이/g, '')
                .replace(/메트그레이/g, '')
                .replace(/블루/g, '')
                .trim();

              // ✅ 추가상품3: cleanName에 기둥 정보가 없으면 opt.name에서 확인한 정보 추가
              if (isPillarFromName && !cleanName.includes('기둥')) {
                cleanName = cleanName + '기둥';
              }
            }

            // ✅ 2. 카테고리명에서 무게 정보 추출
            const weight = extractWeightFromCategory(categoryName);
            const color = extractColorFromName(opt.name, categoryName);

            // ✅ 3. specification 초기화 (매핑 테이블에서 추출할 예정)
            let finalSpecification = opt.specification || '';
            let finalColorWeight = opt.colorWeight || '';

            // ⚠️ 중요: 중량랙의 경우 매핑 테이블에서 가져온 partId에서 specification을 추출해야 함
            // 예: "중량랙-선반-w900xd450" → "w900xd450"
            // 따라서 여기서는 일단 설정하지 않고, 매핑 테이블 확인 후에 설정

            if (selectedType === '하이랙') {
              // 하이랙: 색상과 무게 정보 설정
              // ⚠️ 중요: specification에는 무게를 한 번만 포함해야 함
              // ✅ 추가상품3: opt.name에서 직접 색상 추출 (괄호 형식 지원)
              let extractedColor = color;
              if (!extractedColor && (isMetallicPillar || isBluePillar)) {
                if (isMetallicPillar) {
                  extractedColor = '메트그레이(볼트식)';
                } else if (isBluePillar) {
                  extractedColor = '블루(기둥)+오렌지(가로대)(볼트식)';
                }
              }

              if (extractedColor) {
                finalColorWeight = weight ? `${extractedColor}${weight}` : extractedColor;
              }

              // ⚠️ 중요: 기둥과 선반을 구분하여 specification 생성
              if (cleanName.includes('기둥') || isPillarFromName) {
                // 기둥: 사이즈(폭x깊이) + 높이 + 무게 정보 모두 포함
                // 예: "60x150 200" → "사이즈60x150높이200270kg"
                // 정규식 개선: WxDxH 또는 WxD H 패턴 처리
                const wdhMatch = cleanName.match(/(\d+)x(\d+)[\sx]+(\d+)/);

                if (wdhMatch) {
                  const width = wdhMatch[1];
                  const depth = wdhMatch[2];
                  const height = wdhMatch[3];
                  // ✅ DB 형식: "사이즈{폭}x{깊이}높이{높이}{무게}"
                  finalSpecification = weight ? `사이즈${width}x${depth}높이${height}${weight}` : `사이즈${width}x${depth}높이${height}`;
                } else {
                  // 기존 로직 Fallback (2개만 있는 경우) -> 깊이/높이 불확실하므로 selectedOptions 참조 시도
                  const heightMatch = cleanName.match(/(\d+)x(\d+)/);
                  if (heightMatch) {
                    const width = heightMatch[1];
                    const val2 = heightMatch[2];
                    // val2가 높이인지 깊이인지 모호함. selectedOptions가 있다면 참조
                    const heightFromOption = (typeof selectedOptions !== 'undefined' && selectedOptions.height) ? selectedOptions.height : val2;
                    const depthFromOption = (typeof selectedOptions !== 'undefined' && selectedOptions.size) ? parseWD(selectedOptions.size).d : val2;

                    // 60x150 처럼 깊이가 2번째 값일 가능성이 높음
                    const depth = val2;
                    const height = heightFromOption;

                    finalSpecification = weight ? `사이즈${width}x${depth}높이${height}${weight}` : `사이즈${width}x${depth}높이${height}`;
                  } else {
                    const spec = extractHighRackSpec(opt.name);
                    if (spec) {
                      finalSpecification = weight ? `${spec}${weight}` : spec;
                    }
                  }
                }
              } else if (cleanName.includes('선반')) {
                // 선반: 사이즈 정보 추출 (예: "45x108" → "사이즈45x108")
                const spec = extractHighRackSpec(opt.name);
                if (spec) {
                  // specification에 이미 무게가 포함되어 있는지 확인
                  if (spec.includes('270kg') || spec.includes('450kg') || spec.includes('600kg')) {
                    finalSpecification = spec;
                  } else if (weight) {
                    finalSpecification = `${spec}${weight}`;
                  } else {
                    finalSpecification = spec;
                  }
                }
              } else {
                // 기타: 기존 로직 사용
                const spec = extractHighRackSpec(opt.name);
                if (spec) {
                  if (spec.includes('270kg') || spec.includes('450kg') || spec.includes('600kg')) {
                    finalSpecification = spec;
                  } else if (weight) {
                    finalSpecification = `${spec}${weight}`;
                  } else {
                    finalSpecification = spec;
                  }
                }
              }
            }

            // ✅ 4. extra option용 ID 생성 (매핑 테이블 키로 사용)
            // 중요: all_materials_list_v2.csv의 부품ID 형식과 정확히 일치해야 함
            let extraOptionId;

            if (selectedType === '중량랙') {
              // 중량랙: 중량랙-45x155선반- 형식
              const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
              if (sizeMatch) {
                extraOptionId = `${selectedType}-${sizeMatch[0]}선반-`;
              } else {
                extraOptionId = `${selectedType}-${cleanName}-`;
              }
            } else if (selectedType === '하이랙') {
              // 하이랙: 카테고리명과 이름을 조합하여 정확한 ID 생성
              if (categoryName?.includes('추가상품1')) {
                // 추가상품1 (270kg 매트그레이 선반추가): 하이랙-45x108매트그레이선반-
                const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
                if (sizeMatch) {
                  extraOptionId = `${selectedType}-${sizeMatch[0]}매트그레이선반-`;
                } else {
                  extraOptionId = `${selectedType}-${cleanName}-`;
                }
              } else if (categoryName?.includes('추가상품2')) {
                // 추가상품2 (270kg 오렌지 선반추가): 하이랙-45x108선반-
                const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
                if (sizeMatch) {
                  extraOptionId = `${selectedType}-${sizeMatch[0]}선반-`;
                } else {
                  extraOptionId = `${selectedType}-${cleanName}-`;
                }
              } else if (categoryName?.includes('추가상품3')) {
                // 추가상품3 (270kg 기둥추가): name에 "(블루기둥)" 또는 "(메트그레이기둥)" 명시
                // extra_options.json 형식: "45x150(블루기둥)" 또는 "45x150(메트그레이기둥)"
                const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
                if (sizeMatch) {
                  // "(블루기둥)" 또는 "(메트그레이기둥)" 명시적으로 파싱
                  if (cleanName.includes('(메트그레이기둥)') || cleanName.includes('메트그레이기둥') || cleanName.includes('매트그레이기둥')) {
                    extraOptionId = `${selectedType}-${sizeMatch[0]}메트그레이기둥-`;
                  } else if (cleanName.includes('(블루기둥)') || cleanName.includes('블루기둥')) {
                    extraOptionId = `${selectedType}-${sizeMatch[0]}기둥-`;
                  } else {
                    // 기존 로직 (하위 호환성)
                    if (cleanName.includes('메트그레이') || cleanName.includes('매트그레이')) {
                      extraOptionId = `${selectedType}-${sizeMatch[0]}메트그레이기둥-`;
                    } else {
                      extraOptionId = `${selectedType}-${sizeMatch[0]}기둥-`;
                    }
                  }
                } else {
                  extraOptionId = `${selectedType}-${cleanName}-`;
                }
              } else if (categoryName?.includes('추가상품4') || categoryName?.includes('추가상품5')) {
                // 추가상품4, 5: 일반화된 직접 처리 함수 사용
                const directResult = handleHighRackDirectExtraOption(opt, categoryName, cleanName, weight);
                if (directResult) {
                  extraBOM.push(directResult);
                  console.log(`    ✅ ${categoryName} 직접 처리: partId="${directResult.partId}", inventoryPartId="${directResult.inventoryPartId}"`);
                  return; // 여기서 종료
                }
                // 매칭되지 않은 경우 기본 처리
                extraOptionId = `${selectedType}-${cleanName}-`;
              } else if (categoryName?.includes('추가상품6')) {
                // 추가상품6 (600kg 블루+오렌지 단추가): 하이랙-80x108선반+빔-
                const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
                if (sizeMatch) {
                  extraOptionId = `${selectedType}-${sizeMatch[0]}선반+빔-`;
                } else {
                  extraOptionId = `${selectedType}-${cleanName}-`;
                }
              } else {
                // 기타
                extraOptionId = `${selectedType}-${cleanName}-`;
              }
            } else if (selectedType === '스텐랙') {
              // 스텐랙: 스텐랙-50x75선반- 또는 스텐랙-75기둥- 형식
              const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
              const heightMatch = cleanName.match(/^(\d+)/);
              if (sizeMatch) {
                extraOptionId = `${selectedType}-${sizeMatch[0]}선반-`;
              } else if (heightMatch) {
                extraOptionId = `${selectedType}-${heightMatch[1]}기둥-`;
              } else {
                extraOptionId = `${selectedType}-${cleanName}-`;
              }
            } else {
              // 기타 랙 타입
              extraOptionId = `${selectedType}-${cleanName}-`;
            }

            console.log(`  🔑 extra option ID: "${extraOptionId}"`);

            // ✅ 4. 매핑 테이블 확인 (재고관리용)
            const mappedInventoryPartIds = mapExtraToBaseInventoryPart(extraOptionId);
            console.log(`  🔍 매핑 테이블 확인 결과: "${extraOptionId}" → "${mappedInventoryPartIds}" (타입: ${Array.isArray(mappedInventoryPartIds) ? '배열' : typeof mappedInventoryPartIds})`);

            // ⚠️ 중요: mapExtraToBaseInventoryPart가 매핑이 없으면 extraOptionId를 그대로 반환하므로
            // 매핑이 성공했는지 확인하려면 EXTRA_TO_BASE_INVENTORY_MAPPING에서 직접 확인해야 함
            const isMapped = EXTRA_TO_BASE_INVENTORY_MAPPING[extraOptionId] !== undefined;
            console.log(`  🔍 매핑 테이블 존재 여부: "${extraOptionId}" → ${isMapped ? '매핑 있음' : '매핑 없음'}`);

            if (Array.isArray(mappedInventoryPartIds)) {
              // ✅ 병합 옵션 - 각각 추가
              console.log(`  🔀 병합 옵션 분리: ${mappedInventoryPartIds.length}개 부품`);

              mappedInventoryPartIds.forEach((mappedInventoryPartId, index) => {
                // ⚠️ 중요: 가격용 ID와 재고용 ID 구분
                // - 가격 정보 불러오기, cart BOM, 문서 표시 → 가격용 ID (partId)
                // - 재고 감소 → 재고용 ID (inventoryPartId)
                // 스텐랙/중량랙: mappedInventoryPartIds가 이미 가격용 ID 형식
                // 하이랙: mapExtraToBasePartId로 가격용 ID 생성 (색상 제거)
                let partIdForPrice;

                // ✅ 부품명 생성 (원자재명세서 표시용) - 유틸 함수 사용
                const bomDisplayName = generateBOMDisplayName(selectedType, opt, cleanName, finalColorWeight);

                if (selectedType === '하이랙') {
                  // 하이랙: mapExtraToBasePartId 사용
                  const mappedPartIdForPrice = mapExtraToBasePartId(extraOptionId);
                  if (mappedPartIdForPrice && Array.isArray(mappedPartIdForPrice)) {
                    partIdForPrice = mappedPartIdForPrice[index] || mappedPartIdForPrice[0];
                  } else if (mappedPartIdForPrice) {
                    partIdForPrice = mappedPartIdForPrice;
                  } else {
                    // 매핑 없으면 매핑된 inventoryPartId에서 색상 제거하여 partId 생성
                    // 예: "하이랙-기둥메트그레이(볼트식)270kg-높이150270kg" → "하이랙-기둥-높이150270kg"
                    const parts = mappedInventoryPartId.split('-');
                    if (parts.length >= 3) {
                      let partName = parts[1];
                      partName = partName
                        .replace(/메트그레이\(볼트식\)\d+kg/g, '')
                        .replace(/매트그레이\(볼트식\)\d+kg/g, '')
                        .replace(/블루\(기둥\)\+오렌지\(가로대\)\(볼트식\)\d+kg/g, '')
                        .replace(/블루\(기둥\.선반\)\+오렌지\(빔\)\d+kg/g, '')
                        .trim();
                      partIdForPrice = `${parts[0]}-${partName}-${parts[2]}`;
                    } else {
                      // ⚠️ 중요: generatePartId를 호출할 때 name은 "기둥" 또는 "선반"만 사용
                      // cleanName이 "45x150메트그레이기둥"이면 "기둥"으로 변환
                      let partNameForPrice = cleanName;
                      if (cleanName.includes('기둥')) {
                        partNameForPrice = '기둥';
                      } else if (cleanName.includes('선반')) {
                        partNameForPrice = '선반';
                      } else if (cleanName.includes('로드빔') || cleanName.includes('빔')) {
                        partNameForPrice = '로드빔';
                      }

                      partIdForPrice = generatePartId({
                        rackType: selectedType,
                        version: version, // ✅ 파렛트랙만 version 정보 포함
                        name: partNameForPrice,
                        specification: finalSpecification || ''
                      });
                    }
                  }
                } else {
                  // 스텐랙/중량랙: 재고관리용 ID와 가격관리용 ID 구분 필요
                  if (selectedType === '스텐랙') {
                    // ✅ 스텐랙 선반: 재고관리용과 가격관리용 모두 WxD 구분 (변경됨)
                    // 재고관리용: mappedInventoryPartId = "스텐랙-선반-사이즈50x75" (WxD 모두)
                    // 가격관리용: partIdForPrice = "스텐랙-선반-사이즈50x75" (WxD 모두)
                    const parts = mappedInventoryPartId.split('-');
                    if (parts.length >= 3 && parts[1] === '선반') {
                      // 매핑 테이블에서 이미 WxD 모두 포함된 ID를 받아오므로 그대로 사용
                      partIdForPrice = mappedInventoryPartId;
                      // specification 추출 (예: "스텐랙-선반-사이즈50x75" → "사이즈50x75")
                      finalSpecification = parts[2] || '';
                      console.log(`    ✅ 스텐랙 선반 재고/가격용 ID 동일: "${partIdForPrice}"`);
                    } else {
                      // 기둥 등은 재고용 ID를 그대로 사용
                      partIdForPrice = mappedInventoryPartId;
                      finalSpecification = parts[2] || '';
                    }
                  } else if (selectedType === '중량랙') {
                    // 중량랙: mappedInventoryPartIds가 이미 가격용 ID 형식 (WxD 모두 포함)
                    partIdForPrice = mappedInventoryPartId;
                    const parts = mappedInventoryPartId.split('-');
                    if (parts.length >= 3) {
                      finalSpecification = parts[2]; // "w900xd450"
                      console.log(`    ✅ 매핑 테이블에서 specification 추출: "${finalSpecification}"`);
                    }
                  } else {
                    partIdForPrice = mappedInventoryPartId;
                  }
                }

                // ⚠️ 중요: 매핑 테이블에서 찾은 ID는 이미 서버(Gist)에 존재하는 ID입니다
                // generateInventoryPartId로 새로 만들지 말고 매핑 테이블 결과를 그대로 사용
                let finalInventoryPartId = mappedInventoryPartId;

                // 관리자 수정 단가 우선 사용
                const adminPrices = loadAdminPrices();
                const adminPriceEntry = adminPrices[partIdForPrice];

                // 가격 계산: 관리자 단가 > 추가옵션 단가 / 부품 수 > 기본 가격 / 부품 수
                const effectivePrice = adminPriceEntry && adminPriceEntry.price > 0
                  ? adminPriceEntry.price
                  : (extraOptionsPrices[opt.id]?.price || Number(opt.price) || 0) / mappedInventoryPartIds.length;

                const optionQty = Number(opt.quantity) || 1;
                const totalQty = optionQty * q;

                extraBOM.push({
                  rackType: selectedType,
                  version: version, // ✅ 파렛트랙만 version 정보 포함
                  size: selectedOptions.size || "",
                  name: bomDisplayName, // ✅ 부품명 (스텐랙: "50x90 선반", 하이랙: "메트그레이 기둥" 등)
                  partId: partIdForPrice, // 단가관리용 (색상 제거, 동일 가격)
                  inventoryPartId: finalInventoryPartId, // 재고관리용 (색상 포함, 서버에 있는 ID)
                  specification: finalSpecification, // ⚠️ 중요: 매핑 테이블에서 추출한 specification 사용
                  colorWeight: finalColorWeight,
                  note: '기타추가옵션', // ✅ 추가옵션 표시용
                  quantity: totalQty,
                  unitPrice: effectivePrice,
                  totalPrice: effectivePrice * totalQty
                });

                console.log(`    ✅ 부품 ${index + 1} 추가: name="${bomDisplayName}", partId="${partIdForPrice}", inventoryPartId="${finalInventoryPartId}" (${effectivePrice}원)`);
              });
            } else if (isMapped && mappedInventoryPartIds !== extraOptionId) {
              // ✅ 단일 매핑 - 기본 원자재로 교체
              console.log(`  🔗 매핑됨: "${extraOptionId}" → "${mappedInventoryPartIds}"`);

              // ⚠️ 중요: 가격용 ID와 재고용 ID 구분
              // - 가격 정보 불러오기, cart BOM, 문서 표시 → 가격용 ID (partId)
              // - 재고 감소 → 재고용 ID (inventoryPartId)
              // 스텐랙/중량랙: mappedInventoryPartIds가 이미 가격용 ID 형식
              // 하이랙: mapExtraToBasePartId로 가격용 ID 생성 (색상 제거)
              let partIdForPrice;

              if (selectedType === '하이랙') {
                // 하이랙: mapExtraToBasePartId 사용
                console.log(`  💰 가격용 ID 매핑 시도: extraOptionId="${extraOptionId}"`);
                const mappedPartIdForPrice = mapExtraToBasePartId(extraOptionId);
                console.log(`  💰 매핑 결과: "${mappedPartIdForPrice}"`);
                if (mappedPartIdForPrice) {
                  partIdForPrice = mappedPartIdForPrice;
                  console.log(`  ✅ 가격용 ID 사용: "${partIdForPrice}"`);
                } else {
                  // 매핑 없으면 매핑된 inventoryPartId에서 색상 제거하여 partId 생성
                  // 예: "하이랙-기둥메트그레이(볼트식)270kg-높이150270kg" → "하이랙-기둥-높이150270kg"
                  console.log(`  ⚠️ 매핑 실패 - inventoryPartId에서 색상 제거 시도: "${mappedInventoryPartIds}"`);
                  const parts = mappedInventoryPartIds.split('-');
                  if (parts.length >= 3) {
                    let partName = parts[1];
                    partName = partName
                      .replace(/메트그레이\(볼트식\)\d+kg/g, '')
                      .replace(/매트그레이\(볼트식\)\d+kg/g, '')
                      .replace(/블루\(기둥\)\+오렌지\(가로대\)\(볼트식\)\d+kg/g, '')
                      .replace(/블루\(기둥\.선반\)\+오렌지\(빔\)\d+kg/g, '')
                      .trim();
                    partIdForPrice = `${parts[0]}-${partName}-${parts[2]}`;
                    console.log(`  ✅ 색상 제거 후 partId: "${partIdForPrice}"`);
                  } else {
                    // ⚠️ 중요: generatePartId를 호출할 때 name은 "기둥" 또는 "선반"만 사용
                    // cleanName이 "45x150메트그레이기둥"이면 "기둥"으로 변환
                    // finalSpecification이 이미 올바르게 설정되어 있어야 함 (높이150270kg 또는 사이즈45x108270kg)
                    let partNameForPrice = cleanName;
                    if (cleanName.includes('기둥')) {
                      partNameForPrice = '기둥';
                    } else if (cleanName.includes('선반')) {
                      partNameForPrice = '선반';
                    } else if (cleanName.includes('로드빔') || cleanName.includes('빔')) {
                      partNameForPrice = '로드빔';
                    }

                    console.log(`  ⚠️ generatePartId 호출: name="${partNameForPrice}", spec="${finalSpecification}"`);
                    partIdForPrice = generatePartId({
                      rackType: selectedType,
                      version: version, // ✅ 파렛트랙만 version 정보 포함
                      name: partNameForPrice,
                      specification: finalSpecification || ''
                    });
                    console.log(`  ⚠️ 생성된 partId: "${partIdForPrice}"`);
                  }
                }
              } else {
                // 스텐랙/중량랙: 재고관리용 ID와 가격관리용 ID 구분 필요
                if (selectedType === '스텐랙') {
                  // ✅ 스텐랙 선반: 재고관리용과 가격관리용 모두 WxD 구분 (변경됨)
                  // 재고관리용: mappedInventoryPartIds = "스텐랙-선반-사이즈50x75" (WxD 모두)
                  // 가격관리용: partIdForPrice = "스텐랙-선반-사이즈50x75" (WxD 모두)
                  const parts = mappedInventoryPartIds.split('-');
                  if (parts.length >= 3 && parts[1] === '선반') {
                    // 매핑 테이블에서 이미 WxD 모두 포함된 ID를 받아오므로 그대로 사용
                    partIdForPrice = mappedInventoryPartIds;
                    // specification 추출 (예: "스텐랙-선반-사이즈50x75" → "사이즈50x75")
                    finalSpecification = parts[2] || '';
                    console.log(`    ✅ 스텐랙 선반 재고/가격용 ID 동일: "${partIdForPrice}"`);
                  } else {
                    // 기둥 등은 재고용 ID를 그대로 사용
                    partIdForPrice = mappedInventoryPartIds;
                    finalSpecification = parts[2] || '';
                  }
                } else if (selectedType === '중량랙') {
                  // 중량랙: mappedInventoryPartIds가 이미 가격용 ID 형식 (WxD 모두 포함)
                  partIdForPrice = mappedInventoryPartIds;
                  const parts = mappedInventoryPartIds.split('-');
                  if (parts.length >= 3) {
                    finalSpecification = parts[2]; // "w900xd450"
                    console.log(`    ✅ 매핑 테이블에서 specification 추출: "${finalSpecification}"`);
                  }
                } else {
                  partIdForPrice = mappedInventoryPartIds;
                }
              }

              // ⚠️ 중요: 매핑 테이블에서 찾은 ID는 이미 서버(Gist)에 존재하는 ID입니다
              // generateInventoryPartId로 새로 만들지 말고 매핑 테이블 결과를 그대로 사용
              // 하이랙의 경우 매핑 테이블에 색상별로 이미 정확한 ID가 정의되어 있음
              let finalInventoryPartId = mappedInventoryPartIds;

              // 관리자 수정 단가 우선 사용
              const adminPrices = loadAdminPrices();
              const adminPriceEntry = adminPrices[partIdForPrice];

              const effectivePrice = adminPriceEntry && adminPriceEntry.price > 0
                ? adminPriceEntry.price
                : (extraOptionsPrices[opt.id]?.price || Number(opt.price) || 0);

              const optionQty = Number(opt.quantity) || 1;
              const totalQty = optionQty * q;

              // ✅ 부품명 생성 (원자재명세서 표시용) - 유틸 함수 사용
              const bomDisplayName = generateBOMDisplayName(selectedType, opt, cleanName, finalColorWeight);

              extraBOM.push({
                rackType: selectedType,
                version: version, // ✅ 파렛트랙만 version 정보 포함
                size: selectedOptions.size || "",
                name: bomDisplayName, // ✅ 부품명 (스텐랙: "50x90 선반", 하이랙: "메트그레이 기둥" 등)
                partId: partIdForPrice, // 단가관리용 (색상 제거, 동일 가격)
                inventoryPartId: finalInventoryPartId, // 재고관리용 (색상 포함, 서버에 있는 ID)
                specification: finalSpecification, // ⚠️ 중요: 매핑 테이블에서 추출한 specification 사용
                colorWeight: finalColorWeight,
                note: '기타추가옵션', // ✅ 추가옵션 표시용
                quantity: totalQty,
                unitPrice: effectivePrice,
                totalPrice: effectivePrice * totalQty
              });

              console.log(`    ✅ 기본 원자재로 추가: name="${bomDisplayName}", partId="${partIdForPrice}", inventoryPartId="${finalInventoryPartId}" (${effectivePrice}원)`);
            } else {
              // ✅ 매핑 없음 - 별도 부품 (중량바퀴, 합판 등) 또는 매핑 테이블에 없는 하이랙 추가 옵션
              // ⚠️ 중요: 매핑 테이블에 없는 경우는 매우 드뭅니다. 대부분의 추가 옵션은 매핑 테이블에 있습니다.
              // 매핑 테이블에 없다는 것은:
              // 1. 중량바퀴, 합판 등 별도 재고 관리 부품
              // 2. 매핑 테이블에 추가해야 하는 항목 (이 경우 매핑 테이블에 추가하는 것이 우선)
              console.log(`  ➡️ 매핑 없음: extraOptionId="${extraOptionId}"`);
              console.log(`  ⚠️ 주의: 이 항목이 매핑 테이블에 추가되어야 하는지 확인 필요`);

              // ⚠️ 중요: 하이랙의 경우 name에서 색상과 사이즈를 제거하고 기본 부품명만 사용
              // 예: "45x150메트그레이기둥" → "기둥"
              let baseName = cleanName;
              if (selectedType === '하이랙') {
                if (baseName.includes('기둥')) {
                  baseName = '기둥';
                } else if (baseName.includes('선반')) {
                  baseName = '선반';
                } else if (baseName.includes('로드빔') || baseName.includes('빔')) {
                  baseName = '로드빔';
                }
              } else if (selectedType === '중량랙') {
                // 중량랙: "45x155" → "선반" (선반 추가 옵션인 경우)
                // ⚠️ 중요: 중량랙은 매핑 테이블에 있어야 하므로 여기 도달하면 안 됨
                if (cleanName.match(/^\d+x\d+$/)) {
                  baseName = '선반';
                  console.log(`  ⚠️ 경고: 중량랙 추가 옵션이 매핑 테이블에 없습니다. 매핑 테이블 확인 필요: "${extraOptionId}"`);
                }
              }

              // ⚠️ 중요: specification이 올바르게 설정되어 있는지 확인
              let correctSpecification = finalSpecification;
              if (selectedType === '하이랙') {
                if (baseName === '기둥') {
                  // 기둥: "45x150메트그레이기둥" → "높이150270kg"
                  const heightMatch = cleanName.match(/(\d+)x(\d+)/);
                  if (heightMatch) {
                    const height = heightMatch[2];
                    correctSpecification = weight ? `높이${height}${weight}` : `높이${height}`;
                    console.log(`  ✅ 기둥 specification 재설정: "${correctSpecification}"`);
                  }
                } else if (baseName === '선반') {
                  // 선반: "45x108매트그레이선반" → "사이즈45x108270kg"
                  const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
                  if (sizeMatch) {
                    const size = sizeMatch[0];
                    correctSpecification = weight ? `사이즈${size}${weight}` : `사이즈${size}`;
                    console.log(`  ✅ 선반 specification 재설정: "${correctSpecification}"`);
                  }
                } else if (baseName === '로드빔') {
                  // 로드빔: "108" → "108270kg"
                  const rodBeamMatch = cleanName.match(/(\d+)/);
                  if (rodBeamMatch) {
                    const rodBeamNum = rodBeamMatch[1];
                    correctSpecification = weight ? `${rodBeamNum}${weight}` : rodBeamNum;
                    console.log(`  ✅ 로드빔 specification 재설정: "${correctSpecification}"`);
                  }
                }
              } else if (selectedType === '중량랙' && baseName === '선반') {
                // 중량랙 선반: "45x155" → "w1500xd450"
                // ⚠️ 중요: 중량랙은 매핑 테이블에 있어야 하므로 여기 도달하면 안 됨
                // 하지만 매핑이 실패한 경우를 대비해 specification 변환 시도
                const sizeMatch = cleanName.match(/(\d+)x(\d+)/);
                if (sizeMatch) {
                  const convertedSize = convertWeightRackSize(sizeMatch[0]);
                  if (convertedSize) {
                    correctSpecification = convertedSize;
                    console.log(`  ✅ 중량랙 선반 specification 변환: "${sizeMatch[0]}" → "${correctSpecification}"`);
                  } else {
                    console.log(`  ⚠️ 경고: 중량랙 사이즈 변환 실패: "${sizeMatch[0]}"`);
                  }
                }
                // ⚠️ 중요: baseName을 "선반"으로 확실히 설정
                baseName = '선반';
              }

              // ⚠️ 중요: 하이랙의 경우 colorWeight가 올바르게 설정되어 있어야 함
              // generateInventoryPartId는 colorWeight를 받아서 "기둥메트그레이(볼트식)270kg" 형식으로 생성
              // 예: name="기둥", colorWeight="메트그레이(볼트식)270kg" → "기둥메트그레이(볼트식)270kg"
              if (selectedType === '하이랙') {
                // ⚠️ 중요: colorWeight가 없으면 카테고리명과 이름에서 다시 추출
                if (!finalColorWeight) {
                  const reExtractedColor = extractColorFromName(opt.name, categoryName);
                  const reExtractedWeight = extractWeightFromCategory(categoryName);
                  if (reExtractedColor) {
                    finalColorWeight = reExtractedWeight ? `${reExtractedColor}${reExtractedWeight}` : reExtractedColor;
                    console.log(`  ✅ colorWeight 재추출: "${finalColorWeight}"`);
                  } else {
                    console.log(`  ⚠️ 경고: 하이랙인데 colorWeight를 추출하지 못했습니다.`);
                  }
                }
              }

              // 가격용 ID 생성 (색상 제거)
              const partIdForPrice = generatePartId({
                rackType: selectedType,
                version: version, // ✅ 파렛트랙만 version 정보 포함
                name: baseName,
                specification: correctSpecification || finalSpecification || ''
              });

              // 재고용 ID 생성 (색상 포함)
              // ⚠️ 중요: 하이랙의 경우 generateInventoryPartId가 colorWeight를 받아서 정확한 형식으로 생성
              // 예: name="기둥", specification="높이150270kg", colorWeight="메트그레이(볼트식)270kg"
              // → "하이랙-기둥메트그레이(볼트식)270kg-높이150270kg"
              // ⚠️ 중요: 중량랙의 경우 baseName이 "45x95" 같은 형식일 수 있으므로 "선반"으로 변환
              let finalBaseName = baseName;
              if (selectedType === '중량랙' && baseName.match(/^\d+x\d+$/)) {
                finalBaseName = '선반';
                console.log(`  ✅ 중량랙 baseName 변환: "${baseName}" → "${finalBaseName}"`);
              }

              const originalInventoryPartId = generateInventoryPartId({
                rackType: selectedType,
                version: version, // ✅ 파렛트랙만 version 정보 포함
                name: finalBaseName, // ⚠️ 중요: 기본 부품명만 사용 ("기둥", "선반", "로드빔")
                specification: correctSpecification || finalSpecification || '',
                colorWeight: finalColorWeight || '' // ⚠️ 중요: 색상 정보 포함 (하이랙만)
              });

              console.log(`  ✅ 생성된 partId: "${partIdForPrice}"`);
              console.log(`  ✅ 생성된 inventoryPartId: "${originalInventoryPartId}"`);
              console.log(`  ✅ 사용된 baseName: "${baseName}", specification: "${correctSpecification || finalSpecification}", colorWeight: "${finalColorWeight}"`);

              const adminPrices = loadAdminPrices();
              const adminPriceEntry = adminPrices[partIdForPrice];

              const effectivePrice = adminPriceEntry && adminPriceEntry.price > 0
                ? adminPriceEntry.price
                : (extraOptionsPrices[opt.id]?.price || Number(opt.price) || 0);

              const optionQty = Number(opt.quantity) || 1;
              const totalQty = optionQty * q;

              // ✅ 부품명 생성 (원자재명세서 표시용)
              let bomDisplayName = opt.name;
              if (selectedType === '스텐랙') {
                // 스텐랙: opt.name이 "50x90"만 있을 때 "50x90 선반" 형식으로 생성
                if (opt.bom && opt.bom.length > 0 && opt.bom[0].name) {
                  // bom에 정확한 이름이 있으면 사용
                  bomDisplayName = opt.bom[0].name;
                } else if (opt.name && !opt.name.includes('선반') && !opt.name.includes('기둥')) {
                  // opt.name이 숫자만 있으면 부품 종류 추가
                  if (opt.name.match(/\d+x\d+/)) {
                    bomDisplayName = `${opt.name} 선반`;
                  } else if (opt.name.match(/^\d+$/)) {
                    bomDisplayName = `${opt.name} 기둥`;
                  }
                }
              } else if (selectedType === '하이랙') {
                // 하이랙: 색상 정보를 포함하여 "메트그레이 기둥", "블루 기둥", "오렌지 선반" 형식으로 생성
                bomDisplayName = generateHighRackDisplayNameFromBaseName(baseName, finalColorWeight);
              }

              extraBOM.push({
                rackType: selectedType,
                version: version, // ✅ 파렛트랙만 version 정보 포함
                size: selectedOptions.size || "",
                name: bomDisplayName, // ✅ 부품명 (스텐랙: "50x90 선반", 하이랙: "메트그레이 기둥" 등)
                partId: partIdForPrice, // 단가관리용
                inventoryPartId: originalInventoryPartId, // 재고관리용
                specification: correctSpecification || finalSpecification,
                colorWeight: finalColorWeight,
                note: '기타추가옵션', // ✅ 추가옵션 표시용
                quantity: totalQty,
                unitPrice: effectivePrice,
                totalPrice: effectivePrice * totalQty
              });

              console.log(`    ✅ 별도 부품으로 추가: name="${bomDisplayName}", partId="${partIdForPrice}", inventoryPartId="${originalInventoryPartId}" (${effectivePrice}원)`);
            }
          }
        });
      }
    });

    return extraBOM;
  };

  const appendCommonHardwareIfMissing = (base, qty) => {
    const names = new Set(base.map(b => normalizePartName(b.name)));

    // ✅ 파렛트랙만 version 정보 추출
    const version = selectedType === "파렛트랙" ? (selectedOptions.version || "구형") : undefined;

    const pushIfAbsent = (name, quantity, specification = '') => {
      const normalized = normalizePartName(name);
      if (!names.has(normalized)) {
        base.push({
          rackType: selectedType,
          version: version, // ✅ 파렛트랙만 version 정보 포함
          size: selectedOptions.size || "",
          name,
          specification: specification, // ✅ 여기가 핵심!
          note: "",
          quantity,
          unitPrice: 0,
          totalPrice: 0
        });
        names.add(normalized);

        // ✅ 디버깅 로그 추가
        console.log(`➕ 하드웨어 추가: ${name}, spec="${specification}", partId=${generateInventoryPartId({ rackType: selectedType, version: version, name, specification })}`);
      }
    };

    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      const isConn = selectedOptions.formType === "연결형";
      const h = selectedOptions.height;
      const qtyNum = Number(qty) || 1;
      const postQty = isConn ? 2 * qtyNum : 4 * qtyNum;
      const braceBolt = calcBracingBoltCount(h, isConn, qtyNum);
      const rubber = calcBrushingRubberCount(postQty);
      const heightMm = parseHeightMm(h);
      const baseHeight = 1500;
      const heightStep = 500;
      const baseDiagonal = isConn ? 2 : 4;
      const additionalSteps = Math.max(0, Math.floor((heightMm - baseHeight) / heightStep));
      const additionalDiagonal = (isConn ? 1 : 2) * additionalSteps;
      const diagonal = (baseDiagonal + additionalDiagonal) * qtyNum;
      const horizontal = (isConn ? 2 : 4) * qtyNum;
      const anchor = (isConn ? 2 : 4) * qtyNum;

      // ✅ specification 정확히 계산
      const { d } = parseWD(selectedOptions.size || '');
      const bracingSpec = d ? String(d) : '';

      console.log(`🔧 하드웨어 생성 준비: size=${selectedOptions.size}, d=${d}, bracingSpec="${bracingSpec}"`);

      // ✅ specification을 명시적으로 전달
      pushIfAbsent("수평브레싱", horizontal, bracingSpec);
      pushIfAbsent("경사브레싱", diagonal, bracingSpec);
      pushIfAbsent("앙카볼트", anchor, '');
      pushIfAbsent("브레싱볼트", braceBolt, '');
      pushIfAbsent("브러싱고무", rubber, '');
    }
  };

  const getFallbackBOM = () => {
    // ========================================
    // 파렛트랙 / 파렛트랙 철판형
    // ========================================
    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      const lvl = parseLevel(selectedOptions.level, selectedType);
      const sz = selectedOptions.size || "";
      const ht = selectedOptions.height || "";
      const form = selectedOptions.formType || "독립형";
      const qty = Number(quantity) || 1;
      const { w, d } = parseWD(sz);
      const tieSpec = d != null ? String(d) : "";
      const loadSpec = w != null ? String(w) : "";

      // ✅ 파렛트랙만 version 정보 추출
      const version = selectedType === "파렛트랙" ? (selectedOptions.version || "구형") : undefined;

      const base = [
        { rackType: selectedType, version: version, size: sz, name: "기둥", specification: `${ht}`, quantity: (form === "연결형" ? 2 : 4) * qty, unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, version: version, size: sz, name: "로드빔", specification: loadSpec, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
        ...(selectedType === "파렛트랙 철판형" ? [] : [
          {
            rackType: selectedType,
            version: version, // ✅ 파렛트랙만 version 정보 포함
            size: sz,
            name: "타이빔",
            specification: tieSpec,
            // ✅ 타이빔 계산 규칙: 1390→2개/단, 2590/2790→4개/단
            quantity: (() => {
              const tieBeamPerLevel = (w === 1390) ? 2 : (w === 2590 || w === 2790) ? 4 : 2;
              return tieBeamPerLevel * lvl * qty;
            })(),
            unitPrice: 0,
            totalPrice: 0
          },
        ]),
        { rackType: selectedType, version: version, size: sz, name: "안전핀", specification: "", quantity: 2 * lvl * 2 * qty, unitPrice: 0, totalPrice: 0 },
      ];

      if (selectedType === "파렛트랙 철판형") {
        const shelfPerLevel = calcPalletIronShelfPerLevel(sz);
        base.push({
          rackType: selectedType,
          version: undefined, // 파렛트랙 철판형은 version 없음
          size: sz,
          name: "선반",
          specification: `사이즈 ${sz}`,
          quantity: shelfPerLevel * lvl * qty,
          unitPrice: 0,
          totalPrice: 0
        });
      }

      let filteredBase = base.filter(i => !i.name.includes("철판"));
      appendCommonHardwareIfMissing(filteredBase, qty);

      // ✅ 파렛트랙만 weight 추가 (브레싱류는 weight 영향 받지 않도록)
      const filtered = [...filteredBase, ...makeExtraOptionBOM()]
        .filter(r => !/베이스볼트/.test(r.name))
        .map(r => {
          // ⚠️ 브레싱, 브레싱볼트, 브러싱고무는 weight 제외
          const isHardware = /(수평|경사)브레?싱|브레싱볼트|브러싱고무|브레싱고무/.test(r.name);

          return ensureSpecification(r, {
            size: sz,
            height: ht,
            ...parseWD(sz),
            ...(selectedType === "파렛트랙" && !isHardware ? { weight: selectedOptions.weight || "" } : {})
          });
        });
      const filteredWithAdminPrices = filtered.map(applyAdminEditPrice);
      return sortBOMByMaterialRule(filteredWithAdminPrices);
    }

    // ========================================
    // 하이랙
    // ========================================
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
          name: "기둥",
          specification: "", // ✅ 빈 문자열로 초기화 - ensureSpecification에서 처리
          colorWeight: color, // ✅ 핵심: 원본 색상 저장
          quantity: pillarQty,
          unitPrice: 0,
          totalPrice: 0
        },
        {
          rackType: selectedType,
          name: "로드빔",
          specification: `${rodBeamNum}${weightOnly ? ` ${weightOnly}` : ""}`,
          colorWeight: color, // ✅ 핵심: 원본 색상 저장
          quantity: 2 * level * qty,
          unitPrice: 0,
          totalPrice: 0
        },
        {
          rackType: selectedType,
          name: "선반",
          specification: `사이즈 ${size}${weightOnly ? ` ${weightOnly}` : ""}`,
          colorWeight: color, // ✅ 핵심: 원본 색상 저장
          quantity: shelfPerLevel * level * qty,
          unitPrice: 0,
          totalPrice: 0
        },
        ...makeExtraOptionBOM(),
      ].map(r => {
        const specRow = ensureSpecification(r, { size, height: heightValue, ...parseWD(size), weight: weightOnly });
        // ✅ 하이랙 부품의 경우 name에 색상 정보 포함
        if (specRow.rackType === '하이랙' && specRow.colorWeight) {
          const partName = specRow.name;
          specRow.name = generateHighRackDisplayName(partName, specRow.colorWeight);
        }
        return specRow;
      });
      const listWithAdminPrices = list.map(applyAdminEditPrice);
      return sortBOMByMaterialRule(listWithAdminPrices.filter(r => !/베이스볼트/.test(r.name)));
    }

    // ========================================
    // 스텐랙
    // ========================================
    if (selectedType === "스텐랙") {
      const heightValue = selectedOptions.height || "";
      const q = Number(quantity) || 1;
      const sz = selectedOptions.size || "";

      const list = [
        { rackType: selectedType, name: "기둥", specification: `높이 ${heightValue}`, quantity: 4 * q, unitPrice: 0, totalPrice: 0 },
        { rackType: selectedType, size: sz, name: "선반", specification: `사이즈 ${sz}`, quantity: (parseInt((selectedOptions.level || "").replace(/[^\d]/g, "")) || 0) * q, unitPrice: 0, totalPrice: 0 },
        ...makeExtraOptionBOM(),
      ].map(r => {
        const specRow = ensureSpecification(r, { size: sz, height: heightValue, ...parseWD(sz) });
        // ⚠️ 중요: 스텐랙 선반은 가격/표시용 partId를 명시적으로 생성 (WxD 모두 포함)
        if (specRow.rackType === '스텐랙' && specRow.name === '선반') {
          // size 속성 보장 (cartBOMView에서 키 생성 시 필요)
          const partId = generatePartId({
            rackType: specRow.rackType,
            name: specRow.name,
            specification: specRow.specification || ''
          });
          return {
            ...specRow,
            size: specRow.size || sz, // size 속성 보장
            partId: partId
          };
        }
        return specRow;
      });
      const listWithAdminPrices = list.map(applyAdminEditPrice);
      return sortBOMByMaterialRule(listWithAdminPrices.filter(r => !/베이스볼트/.test(r.name)));
    }

    const extraBOM = makeExtraOptionBOM()
      .filter(r => !/베이스볼트/.test(r.name))
      .map(r => ensureSpecification(r, { size: r.size }));
    return extraBOM.map(applyAdminEditPrice);
  };

  const calculateCurrentBOM = useCallback(() => {
    if (!selectedType || quantity <= 0) return [];
    if (selectedType === "하이랙" && !selectedOptions.formType) return [];

    // ========================================
    // 파렛트랙 / 파렛트랙 철판형
    // ========================================
    if (selectedType === "파렛트랙" || selectedType === "파렛트랙 철판형") {
      // ✅ 파렛트랙만 version 처리 (파렛트랙 철판형은 version 없음)
      const version = selectedType === "파렛트랙" ? (selectedOptions.version || "구형") : undefined;
      const rec = selectedType === "파렛트랙"
        ? bomData[selectedType]?.[version]?.[selectedOptions.weight]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType]
        : bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType];
      if (rec?.components) {
        const q = Number(quantity) || 1;
        const sz = selectedOptions.size || "";
        const ht = selectedOptions.height || "";
        const lvl = parseLevel(selectedOptions.level, selectedType);
        const { w, d } = parseWD(sz);
        const hardwareNames = new Set(["수평브레싱", "수평브래싱", "경사브레싱", "경사브래싱", "앙카볼트", "브레싱볼트", "브러싱고무", "브레싱고무", "안전핀", "베이스(안전좌)"]);
        const base = rec.components
          .filter(c => !hardwareNames.has(normalizePartName(c.name)))
          .filter(c => !(selectedType === "파렛트랙 철판형" && c.name.includes("철판")))
          .filter(c => !(selectedType === "파렛트랙 철판형" && c.name.includes("타이빔")))
          .map(c => {
            let nm = normalizePartName(c.name);
            let spec = "";
            let calculatedQuantity = (Number(c.quantity) || 0) * q; // 기본 수량

            // ✅ 부품명에서 모든 괄호와 내용 제거
            if (nm.includes("기둥")) { nm = "기둥"; spec = `${ht}`; }
            else if (nm.includes("로드빔")) { nm = "로드빔"; spec = String(w); }
            else if (nm.includes("타이빔")) {
              nm = "타이빔";
              spec = String(d);
              // ✅ 타이빔 계산 규칙: 1390→2개/단, 2590/2790→4개/단
              const tieBeamPerLevel = (w === 1390) ? 2 : (w === 2590 || w === 2790) ? 4 : 2;
              calculatedQuantity = tieBeamPerLevel * lvl * q;
            }
            else if (nm.includes("선반")) { nm = "선반"; spec = `사이즈 W${w}xD${d}`; }
            else if (nm.includes("안전좌")) return null;
            else if (nm.includes("안전핀")) { nm = "안전핀"; spec = ""; }
            else if (nm.includes("받침")) {
              nm = nm.includes("상") ? "받침(상)" : "받침(하)"; spec = `D${d}`;
            } else spec = c.specification ?? "";

            return {
              rackType: selectedType,
              version: version, // ✅ 파렛트랙만 version 정보 포함
              size: sz,
              name: nm,
              specification: spec,
              note: c.note ?? "",
              quantity: calculatedQuantity,  // ✅ 재계산된 수량 사용
              unitPrice: Number(c.unit_price) || 0,
              totalPrice: Number(c.total_price) > 0 ? Number(c.total_price) * q : (Number(c.unit_price) || 0) * calculatedQuantity
            };
          }).filter(Boolean);
        if (selectedType === "파렛트랙 철판형") {
          if (!base.some(p => p.name === "선반")) {
            const shelfPerLevel = calcPalletIronShelfPerLevel(sz);
            base.push({
              rackType: selectedType,
              version: undefined, // 파렛트랙 철판형은 version 없음
              size: sz,
              name: "선반",
              specification: `사이즈 ${sz}`,
              quantity: shelfPerLevel * lvl * q,
              unitPrice: 0,
              totalPrice: 0
            });
          }
        }
        if (!base.some(b => b.name === "안전핀")) {
          base.push({
            rackType: selectedType,
            version: version, // ✅ 파렛트랙만 version 정보 포함
            size: sz,
            name: "안전핀",
            specification: "",
            note: "",
            quantity: 2 * lvl * 2 * q,
            unitPrice: 0,
            totalPrice: 0
          });
        }
        appendCommonHardwareIfMissing(base, q);
        const finalized = [...base, ...makeExtraOptionBOM()]
          .filter(r => !/베이스볼트/.test(r.name))
          .map(r => {
            // ⚠️ 브레싱, 브레싱볼트, 브러싱고무는 weight 제외
            const isHardware = /(수평|경사)브레?싱|브레싱볼트|브러싱고무|브레싱고무/.test(r.name);

            // ✅ 파렛트랙 3t인 경우에도 하드웨어는 weight 전달 안 함
            const isPalletRack3t = selectedType === "파렛트랙" && String(selectedOptions.weight).trim() === "3t";

            return ensureSpecification(r, {
              size: sz,
              height: ht,
              ...parseWD(sz),
              ...(isPalletRack3t && !isHardware ? { weight: selectedOptions.weight } : {})
            });
          });
        const finalizedWithAdminPrices = finalized.map(applyAdminEditPrice);
        return sortBOMByMaterialRule(finalizedWithAdminPrices);
      }
      return getFallbackBOM();
    }

    // ========================================
    // 하이랙 / 스텐랙
    // ========================================
    if (selectedType === "하이랙" || selectedType === "스텐랙") {
      return getFallbackBOM();
    }

    // ========================================
    // 경량랙 / 중량랙
    // ========================================
    if (["경량랙", "중량랙"].includes(selectedType)) {
      if (selectedType === "경량랙" && selectedOptions.height === "H750") return makeLightRackH750BOM();

      const rec = bomData[selectedType]?.[selectedOptions.size]?.[selectedOptions.height]?.[selectedOptions.level]?.[selectedOptions.formType];
      const q = Number(quantity) || 1;
      const sz = selectedOptions.size || "";
      const ht = selectedOptions.height || "";
      const sizeMatch = sz.match(/W?(\d+)[xX]D?(\d+)/i) || [];
      const W_num = sizeMatch[1] || "";
      const D_num = sizeMatch[2] || "";

      const base = (rec?.components || []).map(c => {
        let name = normalizePartName(c.name);
        let specification = c.specification ?? "";

        // ✅ 모든 부품명에서 괄호 제거
        if (name.includes("기둥")) { name = "기둥"; specification = ``; }
        else if (name.includes("받침")) {
          name = name.includes("상") ? "받침(상)" : "받침(하)";
          specification = ``;
        }
        else if (name.includes("연결대")) { name = "연결대"; specification = ``; }
        else if (name.includes("선반")) {
          name = "선반";
          // 수정: W와 D를 포함하여 specification을 "W900xD300" 형태로 만듭니다.
          // specification=`W${W_num}xD${D_num}`; 
          specification = "";
        }
        else if (name.includes("안전좌")) { name = "안전좌"; specification = ``; }
        else if (name.includes("안전핀")) { name = "안전핀"; specification = ``; }
        else if (!specification && /\d/.test(name)) { specification = ``; }

        // ✅ 경량랙: 안전핀, 안전좌가 아닌 경우에만 color 포함
        const shouldIncludeColor = selectedType === "경량랙" &&
          !name.includes("안전핀") && !name.includes("안전좌");
        const color = shouldIncludeColor ? (selectedOptions.color || '') : '';

        const row = {
          rackType: selectedType, size: sz, name, specification, note: c.note ?? "",
          quantity: (Number(c.quantity) || 0) * q,
          unitPrice: Number(c.unit_price) || 0,
          totalPrice: Number(c.total_price) > 0 ? Number(c.total_price) * q : (Number(c.unit_price) || 0) * (Number(c.quantity) || 0) * q,
          color: color // ✅ 경량랙 color 정보 추가
        };

        // ✅ 경량랙: partId와 inventoryPartId 명시적 생성
        if (selectedType === "경량랙") {
          const specRow = ensureSpecification(row, { size: sz, height: ht, ...parseWD(sz) });
          // 단가 관리용 partId (색상 제거)
          const partId = generatePartId({
            rackType: selectedType,
            name: specRow.name,
            specification: specRow.specification || ''
          });
          // 재고 관리용 inventoryPartId (색상 포함)
          const inventoryPartId = generateInventoryPartId({
            rackType: selectedType,
            name: specRow.name,
            specification: specRow.specification || '',
            color: color
          });
          return {
            ...specRow,
            partId: partId,
            inventoryPartId: inventoryPartId
          };
        }

        return ensureSpecification(row, { size: sz, height: ht, ...parseWD(sz) });
      });

      const baseWithAdminPrices = base.map(applyAdminEditPrice);
      return sortBOMByMaterialRule(
        [...baseWithAdminPrices, ...makeExtraOptionBOM()].filter(r => !/베이스볼트/.test(r.name))
      );
    }

    const extraBOM = makeExtraOptionBOM()
      .filter(r => !/베이스볼트/.test(r.name))
      .map(r => ensureSpecification(r, { size: r.size }));
    return extraBOM.map(applyAdminEditPrice);
  }, [selectedType, selectedOptions, quantity, customPrice, bomData, extraOptionsSel, extraProducts, customMaterials, adminPricesVersion]);

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
    setSelectedOptions(prev => ({ ...prev, [k]: v }));
    if (["color", "size", "height", "level", "formType"].includes(k)) setCustomPrice(0);
  };
  const handleExtraOptionChange = (ids) => {
    setExtraOptionsSel(Array.from(new Set(ids || [])).map(String));
  };

  const addToCart = () => {
    if (!selectedType || quantity <= 0) return;
    if (selectedType === "하이랙" && !selectedOptions.formType) return;
    setCart(prev => [...prev, {
      id: `${Date.now()}`,
      type: selectedType,
      options: { ...selectedOptions },
      extraOptions: [...extraOptionsSel],
      quantity,
      price: customPrice > 0 ? customPrice : currentPrice,
      customPrice: customPrice > 0 ? customPrice : 0,  // 이 줄 추가
      bom: calculateCurrentBOM(),
      displayName: [
        selectedType,
        selectedType === "파렛트랙" ? selectedOptions.version || "구형" : "", // ✅ 파렛트랙만 version 포함
        selectedOptions.formType,
        selectedOptions.size,
        selectedOptions.height,
        selectedOptions.level,
        // ✅ 하이랙과 경량랙 모두 color 포함 (하이랙은 첫 번째, 경량랙은 마지막)
        (selectedType === "하이랙" || selectedType === "경량랙") ? (selectedOptions.color || "") : "",
        selectedType === "파렛트랙" ? selectedOptions.weight || "" : "",
      ].filter(Boolean).join(" "),
    }]);
  };
  const removeFromCart = id => setCart(prev => prev.filter(i => i.id !== id));

  const updateCartItemQuantity = (id, nextQtyRaw) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;

      const oldQty = Number(item.quantity) || 1;
      const nextQty = Math.max(1, parseInt(nextQtyRaw) || 1);

      // ✅ 수량 변경 비율 계산
      const ratio = nextQty / oldQty;

      // ✅ BOM 수량도 비례하여 조정
      const newBom = item.bom && Array.isArray(item.bom)
        ? item.bom.map(bomItem => ({
          ...bomItem,
          quantity: Math.round((Number(bomItem.quantity) || 0) * ratio),
          totalPrice: Math.round((Number(bomItem.totalPrice) || 0) * ratio)
        }))
        : item.bom;

      // ✅ price는 항상 단가를 저장
      const newUnitPrice = item.customPrice && item.customPrice > 0
        ? item.customPrice
        : (Number(item.unitPrice) || Math.round((Number(item.price) || 0) / oldQty));

      return {
        ...item,
        quantity: nextQty,
        bom: newBom,
        unitPrice: newUnitPrice,
        price: newUnitPrice,
        totalPrice: newUnitPrice * nextQty
      };
    }));
  };
  const updateCartItemPriceDirect = (id, newPrice) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const numPrice = Number(newPrice) || 0;
      return {
        ...item,
        price: numPrice,
        customPrice: numPrice
      };
    }));
  };

  // ✅ BOM 병합 유틸 (같은 inventoryPartId 자동 합산 - 색상별 분리)
  // ✅ 수정: inventoryPartId로 그룹핑 (색상별 분리 표시)
  function mergeDuplicateParts(bomArray) {
    const merged = {};

    for (const item of bomArray) {
      // ✅ 재고관리용 inventoryPartId로 그룹핑 (색상별 분리 표시)
      const inventoryKey = generateInventoryPartId(item);
      const displayKey = inventoryKey;

      if (!merged[displayKey]) {
        merged[displayKey] = {
          ...item,
          partId: displayKey,
          quantity: Number(item.quantity) || 0,
          totalPrice: (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
          // ✅ 재고 감소용 inventoryPartId 보존
          _inventoryPartId: item.inventoryPartId || inventoryKey,
          // ✅ 여러 색상이 합쳐진 경우를 대비한 배열
          _inventoryList: [{
            inventoryPartId: item.inventoryPartId || inventoryKey,
            quantity: Number(item.quantity) || 0,
            colorWeight: item.colorWeight || '',
            color: item.color || '',
            version: item.version || ''
          }]
        };
      } else {
        merged[displayKey].quantity += Number(item.quantity) || 0;
        const unit = Number(item.unitPrice) || 0;
        merged[displayKey].totalPrice = (Number(merged[displayKey].totalPrice) || 0) + unit * (Number(item.quantity) || 0);

        // ✅ 재고 정보 추가
        merged[displayKey]._inventoryList.push({
          inventoryPartId: item.inventoryPartId || inventoryKey,
          quantity: Number(item.quantity) || 0,
          colorWeight: item.colorWeight || '',
          color: item.color || '',
          version: item.version || ''
        });
      }
    }

    return Object.values(merged);
  }


  // ✅ 수정된 cartBOMView - inventoryPartId로 그룹핑 (색상별 분리 표시)
  const cartBOMView = useMemo(() => {
    const bomMap = new Map();

    cart.forEach(item => {
      if (item.bom && Array.isArray(item.bom)) {
        item.bom.forEach(bomItem => {
          // ✅ 재고관리용 inventoryPartId로 그룹핑 (색상별 분리 표시)
          const inventoryKey = generateInventoryPartId(bomItem);
          const displayKey = inventoryKey;

          if (bomMap.has(displayKey)) {
            const existing = bomMap.get(displayKey);
            bomMap.set(displayKey, {
              ...existing,
              quantity: existing.quantity + (bomItem.quantity || 0),
              totalPrice: existing.totalPrice + (bomItem.totalPrice || 0),
              // ✅ 재고 정보 추가
              _inventoryList: [
                ...existing._inventoryList,
                {
                  inventoryPartId: bomItem.inventoryPartId || inventoryKey,
                  quantity: bomItem.quantity || 0,
                  colorWeight: bomItem.colorWeight || '',
                  color: bomItem.color || '',
                  specification: bomItem.specification || '',
                  rackType: bomItem.rackType,
                  name: bomItem.name,
                  version: bomItem.version || ''
                }
              ]
            });
          } else {
            bomMap.set(displayKey, {
              ...bomItem,
              partId: displayKey,
              quantity: bomItem.quantity || 0,
              totalPrice: bomItem.totalPrice || 0,
              unitPrice: bomItem.unitPrice || bomItem.unit_price || 0,
              // ✅ 재고 감소용 inventoryPartId 보존
              _inventoryPartId: bomItem.inventoryPartId || inventoryKey,
              // ✅ 재고 정보 배열
              _inventoryList: [{
                inventoryPartId: bomItem.inventoryPartId || inventoryKey,
                quantity: bomItem.quantity || 0,
                colorWeight: bomItem.colorWeight || '',
                color: bomItem.color || '',
                specification: bomItem.specification || '',
                rackType: bomItem.rackType,
                name: bomItem.name,
                version: bomItem.version || ''
              }]
            });
          }
        });
      }
    });

    const result = Array.from(bomMap.values());
    return sortBOMByMaterialRule(result);
  }, [cart]);


  const cartTotalCalc = useMemo(() => {
    return cart.reduce((sum, item) => {
      const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
      return sum + itemTotal;
    }, 0);
  }, [cart]);

  const cartBOMTotalCalc = useMemo(() => {
    return cartBOMView.reduce((sum, bomItem) => {
      // ✅ 효과적인 단가를 사용하여 BOM 총액 계산
      const effectivePrice = getEffectivePrice(bomItem);
      return sum + (effectivePrice * (Number(bomItem.quantity) || 0));
    }, 0);
  }, [cartBOMView, getEffectivePrice]);

  const [totalBomQuantity, setTotalBomQuantity] = useState(0);

  // ✅ calculateCurrentBOM이 변경될 때마다 BOM 업데이트
  useEffect(() => {
    const bom = calculateCurrentBOM();
    // setCurrentBOM(bom);
    setCurrentBOM(mergeDuplicateParts(bom))
    setTotalBomQuantity(bom.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0));

    // ✅ 추가: BOM이 바뀌면 가격도 즉시 재계산
    const newPrice = calculatePrice();
    console.log(`💰 BOM 변경 감지 - 가격 재계산: ${newPrice}원`);
    setCurrentPrice(newPrice);
  }, [calculateCurrentBOM]);

  // ✅ calculatePrice가 변경될 때마다 가격 업데이트 + 강제 재계산
  useEffect(() => {
    const newPrice = calculatePrice();
    console.log(`🔄 가격 재계산: ${newPrice}원`);
    setCurrentPrice(newPrice);
  }, [calculatePrice]);

  // ✅ 추가: 관리자 단가 변경 시 강제로 currentPrice 재계산
  useEffect(() => {
    const handlePriceChange = () => {
      console.log('🔥 관리자 단가 변경 감지 - 강제 가격 재계산');
      const newPrice = calculatePrice();
      console.log(`💰 새로 계산된 가격: ${newPrice}원`);
      setCurrentPrice(newPrice);
    };

    // ✅ 추가: 추가옵션 가격 변경 이벤트 리스너
    const handleExtraOptionsChange = () => {
      console.log('🔥 추가옵션 가격 변경 감지 - 강제 가격 재계산');
      const newPrice = calculatePrice();
      console.log(`💰 새로 계산된 가격: ${newPrice}원`);
      setCurrentPrice(newPrice);
    };

    const handleSystemRestore = () => {
      console.log('🔥 시스템 데이터 복원 감지 - 강제 가격 재계산');
      const newPrice = calculatePrice();
      console.log(`💰 새로 계산된 가격: ${newPrice}원`);
      setCurrentPrice(newPrice);
    };

    window.addEventListener('adminPriceChanged', handlePriceChange);
    window.addEventListener('systemDataRestored', handleSystemRestore);
    window.addEventListener('extraOptionsPriceChanged', handleExtraOptionsChange); // ✅ 추가

    return () => {
      window.removeEventListener('adminPriceChanged', handlePriceChange);
      window.removeEventListener('systemDataRestored', handleSystemRestore);
      window.removeEventListener('extraOptionsPriceChanged', handleExtraOptionsChange); // ✅ 추가
    };
  }, [calculatePrice]); // calculatePrice를 의존성에 추가

  useEffect(() => {
    setCartBOM(cartBOMView);
    setCartTotal(cartTotalCalc);
  }, [cartBOMView, cartTotalCalc]);

  const contextValue = {
    // 데이터
    loading,
    data,
    bomData,
    extraProducts,
    // 옵션 관련
    allOptions,
    availableOptions,
    selectedType,
    selectedOptions,
    quantity,
    customPrice,
    applyRate,
    // 계산된 값들
    currentPrice,
    currentBOM,
    totalBomQuantity,
    // 장바구니
    cart,
    cartBOM,
    cartBOMView,
    cartTotal,
    cartBOMTotalCalc,
    inventory, // ✅ 서버 재고 상태 노출
    loadingInventory, // ✅ 재고 로딩 상태 노출
    // 추가 옵션 & 커스텀 자재
    extraOptionsSel,
    customMaterials,
    // 기존에 있던 항목들 (누락된 것들)
    canAddItem: selectedType && quantity > 0 &&
      (selectedType !== "경량랙" || (selectedOptions.color && selectedOptions.color.trim() !== "")),
    colorLabelMap,
    // 핸들러들
    setSelectedType,
    setSelectedOptions,
    handleOptionChange,
    handleExtraOptionChange,
    setQuantity,
    setCustomPrice,
    setApplyRate,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    updateCartItemPriceDirect,
    addCustomMaterial,
    removeCustomMaterial,
    clearCustomMaterials,
    setTotalBomQuantity,
    // ✅ getEffectivePrice 함수 노출
    getEffectivePrice,
    // ✅ 재고 관리 함수 노출
    loadInventory,
    updateInventory,
    setCart,  // ✅ 추가
  };

  return (
    <ProductContext.Provider value={contextValue}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
