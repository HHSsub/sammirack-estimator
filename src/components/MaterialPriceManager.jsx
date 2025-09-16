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
  const [materialList, setMaterialList] = useState([]);

  useEffect(() => {
    loadAdminPrices();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

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
    opts.type = allTypes;
    if (!selections.type) {
      setAvailableOptions(opts);
      setCurrentStep('type');
      return;
    }
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
    if (!selections.size) {
      const allSizes = new Set();
      Object.keys(bd).forEach(size => allSizes.add(size));
      const extraSizes = getExtraOptions(selections.type, 'size');
      extraSizes.forEach(size => allSizes.add(size));
      opts.size = sortSizes(Array.from(allSizes));
      setCurrentStep('size');
      return;
    }
    if (!selections.height) {
      const allHeights = new Set();
      if (bd[selections.size]) {
        Object.keys(bd[selections.size]).forEach(height => allHeights.add(height));
      }
      Object.values(bd).forEach(sizeData => {
        Object.keys(sizeData).forEach(height => allHeights.add(height));
      });
      const extraHeights = getExtraOptions(selections.type, 'height');
      extraHeights.forEach(height => allHeights.add(height));
      opts.height = sortHeights(Array.from(allHeights));
      setCurrentStep('height');
      return;
    }
    if (!selections.level) {
      let levelsFromBom;
      if (selections.type === "경량랙" && selections.height === "H750") {
        levelsFromBom = Object.keys(bd[selections.size]?.["H900"] || {});
      } else {
        levelsFromBom = Object.keys(bd[selections.size]?.[selections.height] || {});
      }
      let levels;
      if (selections.type === "파렛트랙" || selections.type === "파렛트랙 철판형") {
        levels = levelsFromBom.filter(l => ["L1", "L2", "L3", "L4", "L5", "L6"].includes(l));
      } else {
        const allLevels = new Set();
        levelsFromBom.forEach(level => allLevels.add(level));
        Object.values(bd).forEach(sizeData => {
          Object.values(sizeData).forEach(heightData => {
            Object.keys(heightData).forEach(level => allLevels.add(level));
          });
        });
        for (let i = 2; i <= 9; i++) {
          allLevels.add(`L${i}`);
        }
        levels = Array.from(allLevels);
      }
      opts.level = sortLevels(levels);
      setCurrentStep('level');
      return;
    }
    if (!selections.formType) {
      const allFormTypes = new Set(["독립형", "연결형"]);
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
    if (!selections.color) {
      const allColors = new Set();
      if (rd["색상"]) {
        rd["색상"].forEach(color => allColors.add(color));
      }
      opts.color = Array.from(allColors);
      setCurrentStep('color');
      return;
    }
    if (!selections.size) {
      const allSizes = new Set();
      const color = selections.color;
      const weightOnly = extractWeightOnly(color);
      const hide45 = ["450kg", "550kg", "700kg"].includes(weightOnly);
      const isHeaviest = /(550kg|700kg)$/.test(color);
      const rawSizes = Object.keys(rd["기본가격"]?.[color] || {});
      rawSizes.forEach(s => {
        const displaySize = isHeaviest && HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s] 
          ? HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s] 
          : s;
        if (!hide45 || displaySize !== "45x150") {
          allSizes.add(displaySize);
        }
      });
      if (isHeaviest) {
        allSizes.add("80x200");
      }
      opts.size = sortSizes(Array.from(allSizes));
      setCurrentStep('size');
      return;
    }
    if (!selections.height) {
      opts.height = [...HIGH_RACK_HEIGHTS];
      setCurrentStep('height');
      return;
    }
    if (!selections.level) {
      const allLevels = new Set();
      const color = selections.color;
      const isHeaviest = /(550kg|700kg)$/.test(color);
      const sizeKey = isHeaviest
        ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[selections.size] || selections.size
        : selections.size;
      const levelKeys = Object.keys(rd["기본가격"]?.[color]?.[sizeKey]?.[selections.height] || {});
      levelKeys.forEach(level => allLevels.add(level));
      ["1단", "2단", "3단", "4단", "5단", "6단"].forEach(level => allLevels.add(level));
      opts.level = sortLevels(Array.from(allLevels));
      setCurrentStep('level');
      return;
    }
    if (!selections.formType) {
      opts.formType = ["독립형", "연결형"];
      setCurrentStep('formType');
      return;
    }
    setCurrentStep('complete');
  };

  const calculateSteelRackOptions = (opts) => {
    const rd = allData["스텐랙"] || {};
    if (!selections.size) {
      const allSizes = new Set();
      Object.keys(rd["기본가격"] || {}).forEach(size => allSizes.add(size));
      ["50x75", "50x90", "50x120", "50x150", "50x180"].forEach(size => allSizes.add(size));
      opts.size = sortSizes(Array.from(allSizes));
      setCurrentStep('size');
      return;
    }
    if (!selections.height) {
      const allHeights = new Set();
      const heightsFromData = Object.keys(rd["기본가격"]?.[selections.size] || {});
      heightsFromData.forEach(height => allHeights.add(height));
      Object.values(rd["기본가격"] || {}).forEach(sizeData => {
        Object.keys(sizeData).forEach(height => allHeights.add(height));
      });
      ["75", "90", "120", "150", "180", "210"].forEach(height => allHeights.add(height));
      opts.height = sortHeights(Array.from(allHeights));
      setCurrentStep('height');
      return;
    }
    if (!selections.level) {
      const allLevels = new Set();
      const levelsFromData = Object.keys(rd["기본가격"]?.[selections.size]?.[selections.height] || {});
      levelsFromData.forEach(level => allLevels.add(level));
      Object.values(rd["기본가격"] || {}).forEach(sizeData => {
        Object.values(sizeData).forEach(heightData => {
          Object.keys(heightData).forEach(level => allLevels.add(level));
        });
      });
      ["2단", "3단", "4단", "5단", "6단"].forEach(level => allLevels.add(level));
      opts.level = sortLevels(Array.from(allLevels));
      setCurrentStep('level');
      return;
    }
    setCurrentStep('complete');
  };

  const getExtraOptions = (rackType, optionType) => {
    const extraOptions = {
      "경량랙": {
        size: [],
        height: ["H750", "H900", "H1200", "H1500", "H1800", "H2100"]
      },
      "중량랙": {
        size: [],
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
    const newSelections = { ...selections };
    newSelections[step] = value;
    const getStepsForType = (type) => {
      if (["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형"].includes(type)) {
        return ['type', 'size', 'height', 'level', 'formType'];
      } else if (type === '하이랙') {
        return ['type', 'color', 'size', 'height', 'level', 'formType'];
      } else if (type === '스텐랙') {
        return ['type', 'size', 'height', 'level'];
      }
      return ['type'];
    };
    const steps = getStepsForType(newSelections.type);
    const currentStepIndex = steps.indexOf(step);
    for (let i = currentStepIndex + 1; i < steps.length; i++) {
      newSelections[steps[i]] = '';
    }
    setSelections(newSelections);
    setMaterialList([]);
  };

  const calculateBOM = () => {
    if (!selections.type) {
      setMaterialList([]);
      return;
    }
    const components = generateBOM(selections.type, selections);
    const componentsWithAdminPrice = components.map(applyAdminEditPrice);
    setMaterialList(sortBOMByMaterialRule(componentsWithAdminPrice));
  };

  const generateBOM = (rackType, options) => {
    let components = [];
    try {
      if (formTypeRacks.includes(rackType) && options.size && options.height && options.level && options.formType) {
        const dataHeight = rackType === "경량랙" && options.height === "H750" ? "H900" : options.height;
        const rec = bomData?.[rackType]?.[options.size]?.[dataHeight]?.[options.level]?.[options.formType];
        if (rec?.components) {
          components = rec.components.map(c => {
            let spec = c.specification || '';
            let name = c.name;
            if (name.includes('기둥')) {
              spec = `높이 ${options.height}`;
              name = `기둥(${options.height.replace(/[A-Za-z]/g, '')})`;
            } else if (name.includes('선반')) {
              spec = `사이즈 ${options.size}`;
              name = `선반(${options.size})`;
            }
            return {
              rackType,
              name,
              specification: spec,
              quantity: Number(c.quantity) || 0,
              unitPrice: Number(c.unit_price) || 0,
              totalPrice: Number(c.total_price) || (Number(c.unit_price) || 0) * (Number(c.quantity) || 0),
              note: c.note || ''
            };
          });
        }
      } else if (rackType === "하이랙" && options.size && options.height && options.level && options.formType && options.color) {
        const rec = bomData?.[rackType]?.[options.size]?.[options.height]?.[options.level]?.[options.formType]?.[options.color];
        if (rec?.components) {
          components = rec.components.map(c => ({
            rackType,
            name: c.name,
            specification: c.specification,
            quantity: Number(c.quantity) || 0,
            unitPrice: Number(c.unit_price) || 0,
            totalPrice: Number(c.total_price) || (Number(c.unit_price) || 0) * (Number(c.quantity) || 0),
            note: c.note || ''
          }));
        }
      } else if (rackType === "스텐랙" && options.size && options.height && options.level) {
        const rec = bomData?.[rackType]?.[options.size]?.[options.height]?.[options.level];
        if (rec?.components) {
          components = rec.components.map(c => ({
            rackType,
            name: c.name,
            specification: c.specification,
            quantity: Number(c.quantity) || 0,
            unitPrice: Number(c.unit_price) || 0,
            totalPrice: Number(c.total_price) || (Number(c.unit_price) || 0) * (Number(c.quantity) || 0),
            note: c.note || ''
          }));
        }
      }
    } catch (error) {
      console.error('BOM 생성 실패:', error);
    }
    if (components.length === 0) {
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
      const level = parseInt((options.level || "L3").replace(/[^\d]/g, "")) || 3;
      const formType = options.formType || "독립형";
      const isConn = formType === "연결형";
      const pillarQty = isConn ? 2 * qty : 4 * qty;
      components.push(
        { rackType, name: `기둥(${height.replace(/[A-Za-z]/g, '')})`, specification: `높이 ${height}`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
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
      const level = parseInt((options.level || "L3").replace(/[^\d]/g, "")) || 3;
      const formType = options.formType || "독립형";
      const isConn = formType === "연결형";
      const pillarQty = isConn ? 2 * qty : 4 * qty;
      components.push(
        { rackType, name: `기둥(${height.replace(/[A-Za-z]/g, '')})`, specification: `높이 ${height}`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
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
        { rackType, name: `기둥(${height.replace(/[A-Za-z]/g, '')})`, specification: `높이 ${height}`, quantity: (formType === "연결형" ? 2 : 4) * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `로드빔`, specification: `로드빔`, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `안전핀`, specification: `안전핀`, quantity: 4 * lvl * qty, unitPrice: 0, totalPrice: 0 }
      );
      if (rackType === "파렛트랙") {
        components.push({ rackType, name: `타이빔`, specification: `타이빔`, quantity: 2 * lvl * qty, unitPrice: 0, totalPrice: 0 });
      } else {
        components.push({ rackType, name: `선반(철판형)`, specification: `사이즈 ${size}`, quantity: lvl * qty, unitPrice: 0, totalPrice: 0 });
      }
    } else if (rackType === "하이랙") {
      const size = options.size || "80x108";
      const height = options.height || "150";
      const level = parseInt((options.level || "3단").replace(/[^\d]/g, "")) || 3;
      const color = options.color || "550kg 블루";
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height} ${color}`, quantity: 4 * qty, unitPrice: 0, totalPrice: 0 },
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

  const generatePartId = (item) => {
    const { rackType, name, specification } = item;
    const cleanName = (name || '').replace(/[^가-힣0-9a-zA-Z]/g, '');
    const cleanSpec = (specification || '').replace(/[^가-힣0-9a-zA-Z]/g, '');
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
    try {
      const itemWithRackInfo = {
        ...item,
        displayName: `${item.rackType} - ${item.name} ${item.specification || ''}`.trim()
      };
      setEditingPart(itemWithRackInfo);
    } catch (error) {
      console.error('단가 수정 모달 열기 실패:', error);
      alert('단가 수정 기능에 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handlePriceSaved = (partId, newPrice, oldPrice) => {
    try {
      loadAdminPrices();
      calculateBOM();
      window.dispatchEvent(new CustomEvent('adminPriceChanged', { 
        detail: { partId, newPrice, oldPrice } 
      }));
    } catch (error) {
      console.error('단가 저장 후 처리 실패:', error);
    }
  };

  const getStepsForType = (type) => {
    if (["경량랙", "중량랙", "파렛트랙", "파렛트랙 철판형"].includes(type)) {
      return ['type', 'size', 'height', 'level', 'formType'];
    } else if (type === '하이랙') {
      return ['type', 'color', 'size', 'height', 'level', 'formType'];
    } else if (type === '스텐랙') {
      return ['type', 'size', 'height', 'level'];
    }
    return ['type'];
  };

  const handleGoBack = () => {
    if (!selections.type) return;
    
    const steps = getStepsForType(selections.type);
    let targetStepIndex = -1;
    
    // 현재 어느 단계까지 선택되었는지 확인
    for (let i = 0; i < steps.length; i++) {
      if (selections[steps[i]]) {
        targetStepIndex = i;
      } else {
        break;
      }
    }
    
    // 한 단계 뒤로
    if (targetStepIndex > 0) {
      const prevStep = steps[targetStepIndex - 1];
      const newSelections = { ...selections };
      
      // 현재 단계와 이후 단계 모두 초기화
      for (let i = targetStepIndex; i < steps.length; i++) {
        newSelections[steps[i]] = '';
      }
      
      setSelections(newSelections);
      setCurrentStep(prevStep);
      setMaterialList([]);
    } else if (targetStepIndex === 0) {
      // type도 초기화
      handleReset();
    }
  };

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

  const renderCurrentStepOptions = () => {
    const options = availableOptions[currentStep] || [];
    if (options.length === 0 && currentStep !== 'type') return null;

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
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                이전 단계
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
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              선택 초기화
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: '1 1 auto', overflowY: 'auto', paddingBottom: '10px' }}>
        {renderCurrentStepOptions()}
      </div>

      {currentStep === 'complete' && materialList.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          borderTop: '1px solid #dee2e6', 
          paddingTop: '20px', 
          flex: '0 0 auto' 
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#495057' }}>
            BOM 원자재 목록
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e9ecef' }}>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>품목</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>규격</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>수량</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>단가</th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>총액</th>
                {isAdmin && <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {materialList.map((item, index) => (
                <tr key={index} style={{ backgroundColor: item.hasAdminPrice ? '#fff3cd' : 'white' }}>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{item.name}</td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{item.specification}</td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>{item.quantity.toLocaleString()}</td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                    {getEffectiveUnitPrice(item).toLocaleString()}원
                    {item.hasAdminPrice && <span style={{ fontSize: '11px', color: '#6c757d' }}> (수정됨)</span>}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                    {(getEffectiveUnitPrice(item) * item.quantity).toLocaleString()}원
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                      <button
                        onClick={() => handleEditPrice(item)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #007bff',
                          borderRadius: '4px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        단가 수정
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr style={{ backgroundColor: '#e9ecef', fontWeight: '600' }}>
                <td colSpan={isAdmin ? 4 : 3} style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>총 합계</td>
                <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                  {materialList.reduce((sum, item) => sum + (getEffectiveUnitPrice(item) * item.quantity), 0).toLocaleString()}원
                </td>
                {isAdmin && <td style={{ padding: '8px', border: '1px solid #dee2e6' }}></td>}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {editingPart && (
        <AdminPriceEditor
          item={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={handlePriceSaved}
          currentAdminPrices={adminPrices}
        />
      )}
    </div>
  );
}
