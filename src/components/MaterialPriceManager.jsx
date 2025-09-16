import React, { useState, useEffect, useMemo } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { sortBOMByMaterialRule } from '../utils/materialSort';
import AdminPriceEditor from './AdminPriceEditor';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

// formType이 필요한 랙 타입들
const formTypeRacks = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형"];

// 하이랙 고정 높이
const HIGH_RACK_HEIGHTS = ["150", "200", "250"];

// 색상 라벨 매핑
const colorLabelMap = { "200kg": "270kg", "350kg": "450kg", "700kg": "550kg" };

// 하이랙 별칭 매핑
const HIGHRACK_550_ALIAS_VIEW_FROM_DATA = { "80x146": "80x108", "80x206": "80x150" };
const HIGHRACK_550_ALIAS_DATA_FROM_VIEW = { "80x108": "80x146", "80x150": "80x206" };

// 크기 파싱 및 정렬
const parseSizeKey = (s = "") => {
  const m = String(s).replace(/\s+/g, "").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
  return m ? { a: Number(m[1]), b: Number(m[2]) } : null;
};

const sortSizes = (arr = []) => [...new Set(arr)].sort((A, B) => {
  const a = parseSizeKey(A), b = parseSizeKey(B);
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

const sortHeights = (arr = []) => [...new Set(arr)].sort((a, b) => parseNum(a) - parseNum(b));
const sortLevels = (arr = []) => [...new Set(arr)].sort((a, b) => parseNum(a) - parseNum(b));

export default function MaterialPriceManager({ currentUser }) {
  const [editingPart, setEditingPart] = useState(null);
  const [adminPrices, setAdminPrices] = useState({});
  const [bomData, setBomData] = useState({});
  const [allData, setAllData] = useState({});

  // 단계별 선택 상태
  const [currentStep, setCurrentStep] = useState('type');
  const [selections, setSelections] = useState({
    type: '',
    size: '',
    height: '',
    level: '',
    formType: '',
    color: ''
  });
  const [availableOptions, setAvailableOptions] = useState({});
  const [allTypes, setAllTypes] = useState([]);

  // 계산된 BOM 원자재
  const [materialList, setMaterialList] = useState([]);

  // 관리자 수정 단가 로드
  useEffect(() => {
    loadAdminPrices();
  }, []);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  // 선택 변경시 다음 단계 옵션 계산
  useEffect(() => {
    calculateAvailableOptions();
    calculateBOM();
  }, [selections, bomData, allData]);

  const loadAdminPrices = () => {
    try {
      const stored = localStorage.getItem('admin_edit_prices') || '{}';
      const priceData = JSON.parse(stored);
      setAdminPrices(priceData);
    } catch (error) {
      console.error('관리자 단가 로드 실패:', error);
      setAdminPrices({});
    }
  };

  const loadData = async () => {
    try {
      const [bomResponse, dataResponse] = await Promise.all([
        fetch('./bom_data.json'),
        fetch('./data.json')
      ]);
      
      const bomDataResult = await bomResponse.json();
      const dataResult = await dataResponse.json();
      
      setBomData(bomDataResult);
      setAllData(dataResult);
      
      // 타입 목록 설정 (순서 고정)
      const canonical = ["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형", "하이랙", "스텐랙"];
      const fromBom = Object.keys(bomDataResult || {});
      const fromData = Object.keys(dataResult || {});
      const types = canonical.filter(t => fromBom.includes(t) || fromData.includes(t));
      const leftovers = [...fromBom, ...fromData].filter(t => !types.includes(t));
      setAllTypes([...types, ...leftovers]);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setAllTypes([]);
    }
  };

  const calculateAvailableOptions = () => {
    const opts = { type: [], size: [], height: [], level: [], formType: [], color: [] };
    
    // 1단계: 타입 선택
    opts.type = allTypes;
    
    if (!selections.type) {
      setAvailableOptions(opts);
      setCurrentStep('type');
      return;
    }

    // 2단계부터는 타입별로 분기
    if (formTypeRacks.includes(selections.type)) {
      calculateFormTypeRackOptions(opts);
    } else if (selections.type === '하이랙') {
      calculateHighRackOptions(opts);
    } else if (selections.type === '스텐랙') {
      calculateSteelRackOptions(opts);
    }

    setAvailableOptions(opts);
  };

  const calculateFormTypeRackOptions = (opts) => {
    const bd = bomData[selections.type] || {};
    
    // 2단계: 사이즈 선택
    if (!selections.size) {
      // BOM 데이터에서 모든 사이즈 수집
      const allSizes = new Set();
      Object.keys(bd).forEach(size => allSizes.add(size));
      
      // 추가 옵션들 포함
      const extraSizes = getExtraOptions(selections.type, 'size');
      extraSizes.forEach(size => allSizes.add(size));
      
      opts.size = sortSizes(Array.from(allSizes));
      setCurrentStep('size');
      return;
    }

    // 3단계: 높이 선택
    if (!selections.height) {
      const allHeights = new Set();
      
      // 선택된 사이즈의 높이들
      if (bd[selections.size]) {
        Object.keys(bd[selections.size]).forEach(height => allHeights.add(height));
      }
      
      // 다른 사이즈들의 높이들도 포함 (전체 옵션 제공)
      Object.values(bd).forEach(sizeData => {
        Object.keys(sizeData).forEach(height => allHeights.add(height));
      });
      
      // 추가 옵션들 포함
      const extraHeights = getExtraOptions(selections.type, 'height');
      extraHeights.forEach(height => allHeights.add(height));
      
      opts.height = sortHeights(Array.from(allHeights));
      setCurrentStep('height');
      return;
    }

    // 4단계: 단수 선택
    if (!selections.level) {
      const allLevels = new Set();
      
      // 현재 선택에 맞는 단수들
      if (selections.type === "경량랙" && selections.height === "H750") {
        const levelsFromBom = Object.keys(bd[selections.size]?.["H900"] || {});
        levelsFromBom.forEach(level => allLevels.add(level));
      } else {
        const levelsFromBom = Object.keys(bd[selections.size]?.[selections.height] || {});
        levelsFromBom.forEach(level => allLevels.add(level));
      }
      
      // 전체 BOM 데이터에서 모든 단수 수집
      Object.values(bd).forEach(sizeData => {
        Object.values(sizeData).forEach(heightData => {
          Object.keys(heightData).forEach(level => allLevels.add(level));
        });
      });
      
      // 기본 단수들 추가
      ["2단", "3단", "4단", "5단", "6단"].forEach(level => allLevels.add(level));
      
      opts.level = sortLevels(Array.from(allLevels));
      setCurrentStep('level');
      return;
    }

    // 5단계: 형식 선택
    if (!selections.formType) {
      const allFormTypes = new Set(["독립형", "연결형"]);
      
      // BOM 데이터에서 형식들 수집
      const height = selections.type === "경량랙" && selections.height === "H750" ? "H900" : selections.height;
      const formTypes = Object.keys(bd[selections.size]?.[height]?.[selections.level] || {});
      formTypes.forEach(ft => allFormTypes.add(ft));
      
      opts.formType = Array.from(allFormTypes);
      setCurrentStep('formType');
      return;
    }

    setCurrentStep('complete');
  };

  const calculateHighRackOptions = (opts) => {
    const rd = allData["하이랙"] || {};
    
    // 2단계: 색상 선택
    if (!selections.color) {
      const allColors = new Set();
      
      // 데이터에서 색상 수집
      if (rd["색상"]) {
        rd["색상"].forEach(color => allColors.add(color));
      }
      
      // 기본 색상들 추가
      ["270kg 매트그레이", "270kg 오렌지", "270kg 블루", "450kg 매트그레이", "450kg 오렌지", "450kg 블루", "550kg 블루+오렌지", "700kg 블루+오렌지"]
        .forEach(color => allColors.add(color));
      
      opts.color = Array.from(allColors);
      setCurrentStep('color');
      return;
    }

    // 3단계: 사이즈 선택
    if (!selections.size) {
      const allSizes = new Set();
      const color = selections.color;
      const weightOnly = extractWeightOnly(color);
      const hide45 = ["450kg", "550kg", "700kg"].includes(weightOnly);
      const isHeaviest = /(550kg|700kg)$/.test(color);
      
      // 선택된 색상의 사이즈들
      const rawSizes = Object.keys(rd["기본가격"]?.[color] || {});
      rawSizes.forEach(s => {
        const displaySize = isHeaviest && HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s] 
          ? HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s] 
          : s;
        if (!hide45 || displaySize !== "45x150") {
          allSizes.add(displaySize);
        }
      });
      
      // 모든 색상의 사이즈들도 포함
      Object.values(rd["기본가격"] || {}).forEach(colorData => {
        Object.keys(colorData).forEach(size => {
          if (!hide45 || size !== "45x150") {
            allSizes.add(size);
          }
        });
      });
      
      // 추가 기본 사이즈들
      ["45x108", "45x150", "60x108", "60x150", "60x200", "80x108", "80x150", "80x200"]
        .forEach(size => {
          if (!hide45 || size !== "45x150") {
            allSizes.add(size);
          }
        });
      
      opts.size = sortSizes(Array.from(allSizes));
      setCurrentStep('size');
      return;
    }

    // 4단계: 높이 선택
    if (!selections.height) {
      opts.height = [...HIGH_RACK_HEIGHTS];
      setCurrentStep('height');
      return;
    }

    // 5단계: 단수 선택
    if (!selections.level) {
      const allLevels = new Set();
      const color = selections.color;
      const isHeaviest = /(550kg|700kg)$/.test(color);
      const sizeKey = isHeaviest
        ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[selections.size] || selections.size
        : selections.size;
      
      // 현재 선택에 맞는 단수들
      const levelKeys = Object.keys(rd["기본가격"]?.[color]?.[sizeKey]?.[selections.height] || {});
      levelKeys.forEach(level => allLevels.add(level));
      
      // 기본 단수들 추가
      ["1단", "2단", "3단", "4단", "5단", "6단"].forEach(level => allLevels.add(level));
      
      opts.level = sortLevels(Array.from(allLevels));
      setCurrentStep('level');
      return;
    }

    // 6단계: 형식 선택
    if (!selections.formType) {
      opts.formType = ["독립형", "연결형"];
      setCurrentStep('formType');
      return;
    }

    setCurrentStep('complete');
  };

  const calculateSteelRackOptions = (opts) => {
    const rd = allData["스텐랙"] || {};
    
    // 2단계: 사이즈 선택
    if (!selections.size) {
      const allSizes = new Set();
      
      // 데이터에서 사이즈 수집
      Object.keys(rd["기본가격"] || {}).forEach(size => allSizes.add(size));
      
      // 기본 사이즈들 추가
      ["50x75", "50x90", "50x120", "50x150", "50x180"].forEach(size => allSizes.add(size));
      
      opts.size = sortSizes(Array.from(allSizes));
      setCurrentStep('size');
      return;
    }

    // 3단계: 높이 선택
    if (!selections.height) {
      const allHeights = new Set();
      
      // 선택된 사이즈의 높이들
      const heightsFromData = Object.keys(rd["기본가격"]?.[selections.size] || {});
      heightsFromData.forEach(height => allHeights.add(height));
      
      // 모든 사이즈의 높이들도 포함
      Object.values(rd["기본가격"] || {}).forEach(sizeData => {
        Object.keys(sizeData).forEach(height => allHeights.add(height));
      });
      
      // 기본 높이들 추가
      ["75", "90", "120", "150", "180", "210"].forEach(height => allHeights.add(height));
      
      opts.height = sortHeights(Array.from(allHeights));
      setCurrentStep('height');
      return;
    }

    // 4단계: 단수 선택
    if (!selections.level) {
      const allLevels = new Set();
      
      // 현재 선택에 맞는 단수들
      const levelsFromData = Object.keys(rd["기본가격"]?.[selections.size]?.[selections.height] || {});
      levelsFromData.forEach(level => allLevels.add(level));
      
      // 모든 데이터에서 단수 수집
      Object.values(rd["기본가격"] || {}).forEach(sizeData => {
        Object.values(sizeData).forEach(heightData => {
          Object.keys(heightData).forEach(level => allLevels.add(level));
        });
      });
      
      // 기본 단수들 추가
      ["2단", "3단", "4단", "5단", "6단"].forEach(level => allLevels.add(level));
      
      opts.level = sortLevels(Array.from(allLevels));
      setCurrentStep('level');
      return;
    }

    setCurrentStep('complete');
  };

  // 추가 옵션 가져오기 (확장성을 위한 함수)
  const getExtraOptions = (rackType, optionType) => {
    const extraOptions = {
      "경량랙": {
        size: ["30x60", "40x60", "45x60", "50x60", "60x60", "40x75", "45x75", "50x75", "60x75", "40x90", "45x90", "50x90", "60x90", "45x120", "50x120", "60x120"],
        height: ["H750", "H900", "H1200", "H1500", "H1800", "H2100"]
      },
      "중량랙": {
        size: ["45x95", "45x125", "45x155", "45x185", "60x95", "60x125", "60x155", "60x185", "90x95", "90x125", "90x155", "90x185"],
        height: ["H900", "H1200", "H1500", "H1800", "H2100", "H2400"]
      },
      "파렛트랙": {
        height: ["H4500", "H5000", "H5500", "H6000"]
      },
      "파렛트랙 철판형": {
        size: ["1380x800", "1380x1000", "2080x800", "2080x1000", "2580x800", "2580x1000"],
        height: ["1500", "2000", "2500", "3000", "3500", "4000", "H4500", "H5000", "H5500", "H6000"]
      }
    };

    return extraOptions[rackType]?.[optionType] || [];
  };

  const extractWeightOnly = (color = "") => {
    const m = String(color).match(/(\d{2,4}kg)/);
    return m ? m[1] : "";
  };

  const handleOptionSelect = (step, value) => {
    // 선택한 단계 이후의 모든 선택 초기화
    const newSelections = { ...selections };
    newSelections[step] = value;
    
    const steps = ['type', 'color', 'size', 'height', 'level', 'formType'];
    const currentStepIndex = steps.indexOf(step);
    
    // 현재 단계 이후의 모든 선택 초기화
    for (let i = currentStepIndex + 1; i < steps.length; i++) {
      newSelections[steps[i]] = '';
    }
    
    setSelections(newSelections);
    setMaterialList([]); // BOM 목록 초기화
  };

  const calculateBOM = () => {
    if (!selections.type) {
      setMaterialList([]);
      return;
    }

    // 완전한 선택이 없어도 기본 BOM 생성
    const components = generateBOM(selections.type, selections);
    const componentsWithAdminPrice = components.map(applyAdminEditPrice);
    setMaterialList(sortBOMByMaterialRule(componentsWithAdminPrice));
  };

  const generateBOM = (rackType, options) => {
    let components = [];
    
    try {
      if (formTypeRacks.includes(rackType) && options.size && options.height && options.level && options.formType) {
        // 완전한 BOM 데이터 로드 시도
        const height = rackType === "경량랙" && options.height === "H750" ? "H900" : options.height;
        const rec = bomData?.[rackType]?.[options.size]?.[height]?.[options.level]?.[options.formType];
        
        if (rec?.components) {
          components = rec.components.map(c => ({
            rackType,
            name: c.name,
            specification: c.specification || '',
            quantity: Number(c.quantity) || 0,
            unitPrice: Number(c.unit_price) || 0,
            totalPrice: Number(c.total_price) || (Number(c.unit_price) || 0) * (Number(c.quantity) || 0),
            note: c.note || ''
          }));
        }
      }
      
      // BOM 데이터가 없거나 부분 선택인 경우 fallback 생성
      if (components.length === 0) {
        components = generateFallbackBOM(rackType, options);
      }
    } catch (error) {
      console.error('BOM 생성 실패:', error);
      components = generateFallbackBOM(rackType, options);
    }
    
    return components;
  };

  const generateFallbackBOM = (rackType, options) => {
    const components = [];
    const qty = 1;
    
    if (rackType === "경량랙") {
      const size = options.size || "50x90";
      const height = options.height || "H900";
      const level = parseInt((options.level || "3단").replace(/[^\d]/g, "")) || 3;
      const formType = options.formType || "독립형";
      
      const isConn = formType === "연결형";
      const pillarQty = isConn ? 2 * qty : 4 * qty;
      
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height}`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `선반(${size})`, specification: `사이즈 ${size}`, quantity: level * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `연결대`, specification: `연결대`, quantity: 4 * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `받침(상)`, specification: `받침`, quantity: 2 * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `받침(하)`, specification: `받침`, quantity: 2 * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `안전좌`, specification: `안전좌`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `안전핀`, specification: `안전핀`, quantity: 8 * qty, unitPrice: 0, totalPrice: 0 }
      );
    } else if (rackType === "중량랙") {
      const size = options.size || "60x125";
      const height = options.height || "H1200";
      const level = parseInt((options.level || "3단").replace(/[^\d]/g, "")) || 3;
      const formType = options.formType || "독립형";
      
      const isConn = formType === "연결형";
      const pillarQty = isConn ? 2 * qty : 4 * qty;
      
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height}`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `선반(${size})`, specification: `사이즈 ${size}`, quantity: level * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `받침(상)`, specification: `받침`, quantity: 2 * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `받침(하)`, specification: `받침`, quantity: 2 * qty, unitPrice: 0, totalPrice: 0 }
      );
    } else if (rackType === "파렛트랙" || rackType === "파렛트랙 철판형") {
      const size = options.size || "1380x800";
      const height = options.height || "H4500";
      const level = options.level || "L3";
      const formType = options.formType || "독립형";
      
      const lvl = parseInt(level.replace(/[^\d]/g, "")) || 3;
      
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height}`, quantity: (formType === "연결형" ? 2 : 4) * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `로드빔`, specification: `로드빔`, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `안전핀`, specification: `안전핀`, quantity: 4 * lvl * qty, unitPrice: 0, totalPrice: 0 }
      );
      
      if (rackType === "파렛트랙") {
        components.push({ rackType, name: `타이빔`, specification: `타이빔`, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 });
      } else {
        components.push({ rackType, name: `선반(철판형)`, specification: `사이즈 ${size}`, quantity: lvl * qty, unitPrice: 0, totalPrice: 0 });
      }
    } else if (rackType === "하이랙") {
      const size = options.size || "60x150";
      const height = options.height || "200";
      const level = parseInt((options.level || "3단").replace(/[^\d]/g, "")) || 3;
      const color = options.color || "270kg 매트그레이";
      const formType = options.formType || "독립형";
      
      const pillarQty = formType === "연결형" ? 2 * qty : 4 * qty;
      
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height} ${color}`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `선반(${size})`, specification: `사이즈 ${size} ${color}`, quantity: level * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `로드빔`, specification: `로드빔 ${color}`, quantity: 2 * level * qty, unitPrice: 0, totalPrice: 0 }
      );
    } else if (rackType === "스텐랙") {
      const size = options.size || "50x120";
      const height = options.height || "150";
      const level = parseInt((options.level || "4단").replace(/[^\d]/g, "")) || 4;
      
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height}`, quantity: 4 * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `선반(${size})`, specification: `사이즈 ${size}`, quantity: level * qty, unitPrice: 0, totalPrice: 0 }
      );
    }
    
    return components;
  };

  // 부품 고유 ID 생성
  const generatePartId = (item) => {
    const { rackType, name, specification } = item;
    const cleanName = (name || '').replace(/[^\w가-힣]/g, '');
    const cleanSpec = (specification || '').replace(/[^\w가-힣]/g, '');
    return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
  };

  const applyAdminEditPrice = (item) => {
    try {
      const partId = generatePartId(item);
      const adminPrice = adminPrices[partId];
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

  const getEffectiveUnitPrice = (item) => {
    const partId = generatePartId(item);
    const adminPrice = adminPrices[partId];
    
    if (adminPrice && adminPrice.price > 0) {
      return adminPrice.price;
    }
    
    return Number(item.unitPrice) || 0;
  };

  const handleEditPrice = (item) => {
    const itemWithRackInfo = {
      ...item,
      displayName: `${item.rackType} - ${item.name} ${item.specification || ''}`.trim()
    };
    setEditingPart(itemWithRackInfo);
  };

  const handlePriceSaved = (partId, newPrice, oldPrice) => {
    loadAdminPrices();
    calculateBOM();
    window.dispatchEvent(new CustomEvent('adminPriceChanged', { 
      detail: { partId, newPrice, oldPrice } 
    }));
  };

  // 뒤로가기 버튼 핸들러
  const handleGoBack = () => {
    const steps = ['type', 'color', 'size', 'height', 'level', 'formType'];
    let currentStepIndex = steps.indexOf(currentStep);
    
    // 이전 단계로 이동
    if (currentStepIndex > 0) {
      const prevStep = steps[currentStepIndex - 1];
      const newSelections = { ...selections };
      
      // 현재 단계 이후의 모든 선택 초기화
      for (let i = currentStepIndex; i < steps.length; i++) {
        newSelections[steps[i]] = '';
      }
      
      setSelections(newSelections);
      setCurrentStep(prevStep);
    }
  };

  // 선택 초기화
  const handleReset = () => {
    setSelections({
      type: '',
      size: '',
      height: '',
      level: '',
      formType: '',
      color: ''
    });
    setCurrentStep('type');
    setMaterialList([]);
  };

  // 현재 단계의 옵션들을 버튼으로 렌더링
  const renderCurrentStepOptions = () => {
    const options = availableOptions[currentStep] || [];
    if (options.length === 0) return null;

    const getStepTitle = (step) => {
      switch (step) {
        case 'type': return '제품 유형';
        case 'color': return '색상';
        case 'size': return '규격';
        case 'height': return '높이';
        case 'level': return '단수';
        case 'formType': return '형식';
        default: return step;
      }
    };

    return (
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          marginBottom: '12px', 
          color: '#495057' 
        }}>
          {getStepTitle(currentStep)} 선택
        </h4>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          maxHeight: '300px',
          overflowY: 'auto',
          padding: '10px',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          backgroundColor: 'white'
        }}>
          {options.map((option, index) => (
            <button
              key={`${currentStep}-${option}-${index}`}
              onClick={() => handleOptionSelect(currentStep, option)}
              style={{
                padding: '12px 16px',
                border: '2px solid #007bff',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#007bff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s',
                textAlign: 'center',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={e => {
                e.target.style.backgroundColor = '#007bff';
                e.target.style.color = 'white';
              }}
              onMouseOut={e => {
                e.target.style.backgroundColor = 'white';
                e.target.style.color = '#007bff';
              }}
            >
              {currentStep === 'color' && colorLabelMap[option] 
                ? colorLabelMap[option] 
                : kgLabelFix(option)
              }
            </button>
          ))}
        </div>
      </div>
    );
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="material-price-manager-container" style={{ 
      marginTop: '20px',
      padding: '16px', 
      background: '#f8f9fa', 
      borderRadius: '8px',
      border: '1px solid #dee2e6',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#495057', flex: '0 0 auto' }}>
        원자재 단가 관리
      </h3>
      
      {/* 선택 진행 상황 표시 */}
      {selections.type && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px', 
          backgroundColor: '#e7f3ff', 
          borderRadius: '6px',
          fontSize: '14px',
          color: '#0c5aa6',
          flex: '0 0 auto'
        }}>
          <strong>선택된 옵션:</strong> {[
            selections.type,
            selections.color,
            selections.size,
            selections.height,
            selections.level,
            selections.formType
          ].filter(Boolean).join(' → ')}
          
          <div style={{ marginTop: '8px' }}>
            {currentStep !== 'type' && (
              <button
                onClick={handleGoBack}
                style={{
                  padding: '6px 12px',
                  marginRight: '8px',
                  border: '1px solid #6c757d',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#6c757d',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ← 이전 단계
              </button>
            )}
            <button
              onClick={handleReset}
              style={{
                padding: '6px 12px',
                border: '1px solid #dc3545',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#dc3545',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              선택 초기화
            </button>
          </div>
        </div>
      )}

      {/* 단계별 옵션 선택 영역 */}
      <div style={{
        flex: '0 0 auto',
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '6px',
        border: '1px solid #dee2e6'
      }}>
        {renderCurrentStepOptions()}
      </div>

      {/* 원자재 테이블 */}
      <div style={{ flex: '1', minHeight: '0', overflow: 'hidden' }}>
        {materialList.length > 0 ? (
          <div className="material-table-container" style={{ 
            height: '100%',
            overflowY: 'auto',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            backgroundColor: 'white'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '13px', 
              minWidth: '700px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'left', 
                    minWidth: '80px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    랙타입
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'left', 
                    minWidth: '80px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    부품명
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'left', 
                    minWidth: '80px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    규격
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'center', 
                    minWidth: '60px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    수량
                  </th>
                  <th style={{ 
                    borderBottom: '2px solid #dee2e6', 
                    padding: '7px 6px', 
                    textAlign: 'right', 
                    minWidth: '80px',
                    fontWeight: '600',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#e9ecef'
                  }}>
                    단가
                  </th>
                  {isAdmin && (
                    <th style={{ 
                      borderBottom: '2px solid #dee2e6', 
                      padding: '7px 6px', 
                      textAlign: 'center', 
                      minWidth: '80px',
                      fontWeight: '600',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#e9ecef'
                    }}>
                      관리
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {materialList.map((material, index) => {
                  const effectiveUnitPrice = getEffectiveUnitPrice(material);
                  const partId = generatePartId(material);
                  const hasAdminPrice = adminPrices[partId] && adminPrices[partId].price > 0;

                  return (
                    <tr key={partId || index} style={{ 
                      borderBottom: '1px solid #dee2e6',
                      height: '28px'
                    }}>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        fontSize: '13px',
                        color: '#495057',
                        verticalAlign: 'middle'
                      }}>
                        {material.rackType}
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        wordBreak: 'break-word',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{kgLabelFix(material.name)}</span>
                          {hasAdminPrice && (
                            <span style={{
                              padding: '2px 6px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              fontSize: '10px',
                              borderRadius: '3px',
                              flexShrink: 0
                            }}>
                              수정됨
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        fontSize: '13px',
                        verticalAlign: 'middle'
                      }}>
                        {kgLabelFix(material.specification || '-')}
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontSize: '13px'
                      }}>
                        {material.quantity || 0}개
                      </td>
                      <td style={{ 
                        padding: '7px 6px', 
                        borderRight: '1px solid #dee2e6',
                        textAlign: 'right',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <div style={{ 
                            color: effectiveUnitPrice ? 'inherit' : '#6c757d',
                            fontWeight: hasAdminPrice ? '600' : 'normal'
                          }}>
                            {effectiveUnitPrice ? effectiveUnitPrice.toLocaleString() : '-'}원
                          </div>
                          {hasAdminPrice && Number(material.unitPrice) > 0 && Number(material.unitPrice) !== effectiveUnitPrice && (
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#6c757d', 
                              textDecoration: 'line-through' 
                            }}>
                              원가: {Number(material.unitPrice).toLocaleString()}원
                            </div>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td style={{ 
                          padding: '7px 6px', 
                          textAlign: 'center',
                          verticalAlign: 'middle'
                        }}>
                          <button
                            onClick={() => handleEditPrice(material)}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #007bff',
                              borderRadius: '4px',
                              backgroundColor: 'white',
                              color: '#007bff',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={e => {
                              e.target.style.backgroundColor = '#007bff';
                              e.target.style.color = 'white';
                            }}
                            onMouseOut={e => {
                              e.target.style.backgroundColor = 'white';
                              e.target.style.color = '#007bff';
                            }}
                          >
                            단가수정
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ 
            padding: '40px 20px', 
            textAlign: 'center', 
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            color: '#6c757d',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {!selections.type ? (
              <>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>📦</div>
                <div>제품 유형을 선택하세요.</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  랙 타입을 선택하면 해당 원자재 목록이 표시됩니다.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>📋</div>
                <div>원자재 목록을 로딩 중입니다...</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  선택한 {selections.type}의 원자재 정보를 가져오고 있습니다.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 관리자 안내 정보 */}
      {isAdmin && materialList.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          backgroundColor: '#e7f3ff', 
          borderRadius: '6px',
          fontSize: '13px',
          color: '#0c5aa6',
          border: '1px solid #b8daff',
          flex: '0 0 auto'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            💡 원자재 단가 관리 안내
          </div>
          <div>• 이곳에서 수정한 단가는 전체 시스템에 적용됩니다.</div>
          <div>• "수정됨" 표시가 있는 부품은 관리자가 단가를 수정한 부품입니다.</div>
          <div>• 옵션을 변경하여 다른 랙 타입의 원자재 단가도 관리할 수 있습니다.</div>
        </div>
      )}

      {/* 단가 수정 모달 */}
      {editingPart && (
        <AdminPriceEditor
          item={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={handlePriceSaved}
        />
      )}
    </div>
  );
}
