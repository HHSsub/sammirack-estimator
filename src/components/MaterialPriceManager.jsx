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

// 추가 옵션들 (모든 가능한 옵션 포함)
const EXTRA_OPTIONS = {
  파렛트랙: { height: ["H4500", "H5000", "H5500", "H6000"] },
  "파렛트랙 철판형": {
    height: ["1500", "2000", "2500", "3000", "3500", "4000", "H4500", "H5000", "H5500", "H6000"],
    size: ["1380x800", "1380x1000", "2080x800", "2080x1000", "2580x800", "2580x1000"]
  },
  하이랙: { 
    size: ["45x108", "45x150", "60x108", "60x150", "60x200", "80x108", "80x150", "80x200"], 
    level: ["1단", "2단", "3단", "4단", "5단", "6단"] 
  },
  스텐랙: { 
    size: ["50x75", "50x90", "50x120", "50x150", "50x180"],
    level: ["2단", "3단", "4단", "5단", "6단"], 
    height: ["75", "90", "120", "150", "180", "210"] 
  },
  경량랙: { 
    size: ["30x60", "40x60", "45x60", "50x60", "60x60", "40x75", "45x75", "50x75", "60x75", "40x90", "45x90", "50x90", "60x90", "45x120", "50x120", "60x120"],
    height: ["H750", "H900", "H1200", "H1500", "H1800", "H2100"],
    level: ["2단", "3단", "4단", "5단", "6단"]
  },
  중량랙: {
    size: ["45x95", "45x125", "45x155", "45x185", "60x95", "60x125", "60x155", "60x185", "90x95", "90x125", "90x155", "90x185"],
    height: ["H900", "H1200", "H1500", "H1800", "H2100", "H2400"],
    level: ["2단", "3단", "4단", "5단", "6단"]
  }
};

// 색상 라벨 매핑
const colorLabelMap = { "200kg": "270kg", "350kg": "450kg", "700kg": "550kg" };

// 모든 가능한 하이랙 색상
const HIGH_RACK_COLORS = [
  "270kg 매트그레이", "270kg 오렌지", "270kg 블루",
  "450kg 매트그레이", "450kg 오렌지", "450kg 블루", 
  "550kg 블루+오렌지", "700kg 블루+오렌지"
];

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

  // 독립적인 옵션 선택 상태
  const [selectedType, setSelectedType] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});
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

  // 타입 변경시 옵션 초기화 및 가능한 옵션 계산
  useEffect(() => {
    if (!selectedType) {
      setAvailableOptions({});
      setSelectedOptions({});
      return;
    }

    calculateAvailableOptions();
    setSelectedOptions({});
  }, [selectedType, bomData, allData]);

  // 옵션 변경시 BOM 계산
  useEffect(() => {
    if (selectedType) {
      calculateBOM();
    } else {
      setMaterialList([]);
    }
  }, [selectedType, selectedOptions, bomData]);

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
    if (!selectedType) return;

    // 모든 옵션을 EXTRA_OPTIONS와 데이터 파일에서 합쳐서 제공
    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};
      const opts = { size: [], height: [], level: [], formType: ["독립형", "연결형"] };
      
      // 사이즈: BOM 데이터 + EXTRA_OPTIONS 합치기
      const sizesFromBom = Object.keys(bd || {});
      const sizesFromExtra = EXTRA_OPTIONS[selectedType]?.size || [];
      opts.size = sortSizes([...sizesFromBom, ...sizesFromExtra]);
      
      // 높이: 선택된 사이즈 기준으로 BOM 데이터 + EXTRA_OPTIONS
      if (selectedOptions.size && bd[selectedOptions.size]) {
        const heightsFromBom = Object.keys(bd[selectedOptions.size] || {});
        const heightsFromExtra = EXTRA_OPTIONS[selectedType]?.height || [];
        opts.height = sortHeights([...heightsFromBom, ...heightsFromExtra]);
      } else {
        // 사이즈 미선택시 모든 가능한 높이 표시
        const allHeights = new Set();
        Object.values(bd).forEach(sizeData => {
          Object.keys(sizeData).forEach(h => allHeights.add(h));
        });
        const heightsFromExtra = EXTRA_OPTIONS[selectedType]?.height || [];
        opts.height = sortHeights([...Array.from(allHeights), ...heightsFromExtra]);
      }
      
      // 단수: 선택된 사이즈, 높이 기준으로 BOM 데이터 + 기본값
      if (selectedOptions.size && selectedOptions.height) {
        if (selectedType === "경량랙" && selectedOptions.height === "H750") {
          const levelsFromBom = Object.keys(bd[selectedOptions.size]?.["H900"] || {});
          opts.level = levelsFromBom.length ? levelsFromBom : ["2단", "3단", "4단", "5단", "6단"];
        } else {
          const levelsFromBom = Object.keys(bd[selectedOptions.size]?.[selectedOptions.height] || {});
          const levelsFromExtra = EXTRA_OPTIONS[selectedType]?.level || ["2단", "3단", "4단", "5단", "6단"];
          opts.level = sortLevels([...levelsFromBom, ...levelsFromExtra]);
        }
      } else {
        // 사이즈/높이 미선택시 모든 가능한 단수 표시
        const allLevels = new Set(["2단", "3단", "4단", "5단", "6단"]);
        Object.values(bd).forEach(sizeData => {
          Object.values(sizeData).forEach(heightData => {
            Object.keys(heightData).forEach(l => allLevels.add(l));
          });
        });
        opts.level = sortLevels(Array.from(allLevels));
      }
      
      setAvailableOptions(opts);
      return;
    }

    if (selectedType === "하이랙") {
      const rd = allData["하이랙"] || {};
      const opts = { 
        color: HIGH_RACK_COLORS, // 모든 하이랙 색상 표시
        size: [],
        height: [...HIGH_RACK_HEIGHTS],
        level: ["1단", "2단", "3단", "4단", "5단", "6단"],
        formType: ["독립형", "연결형"]
      };
      
      // 색상 선택시 사이즈 옵션 계산
      if (selectedOptions.color) {
        const sizesFromData = Object.keys(rd["기본가격"]?.[selectedOptions.color] || {});
        const sizesFromExtra = EXTRA_OPTIONS["하이랙"]?.size || [];
        opts.size = sortSizes([...sizesFromData, ...sizesFromExtra]);
      } else {
        // 모든 가능한 사이즈 표시
        const allSizes = new Set();
        Object.values(rd["기본가격"] || {}).forEach(colorData => {
          Object.keys(colorData).forEach(s => allSizes.add(s));
        });
        const sizesFromExtra = EXTRA_OPTIONS["하이랙"]?.size || [];
        opts.size = sortSizes([...Array.from(allSizes), ...sizesFromExtra]);
      }
      
      setAvailableOptions(opts);
      return;
    }

    if (selectedType === "스텐랙") {
      const rd = allData["스텐랙"] || {};
      const opts = { 
        size: [],
        height: [],
        level: [],
        version: ["V1"]
      };
      
      // 사이즈: 데이터 + EXTRA_OPTIONS
      const sizesFromData = Object.keys(rd["기본가격"] || {});
      const sizesFromExtra = EXTRA_OPTIONS["스텐랙"]?.size || [];
      opts.size = sortSizes([...sizesFromData, ...sizesFromExtra]);
      
      // 높이: 선택된 사이즈 기준 또는 모든 높이
      if (selectedOptions.size && rd["기본가격"]?.[selectedOptions.size]) {
        const heightsFromData = Object.keys(rd["기본가격"][selectedOptions.size] || {});
        const heightsFromExtra = EXTRA_OPTIONS["스텐랙"]?.height || [];
        opts.height = sortHeights([...heightsFromData, ...heightsFromExtra]);
      } else {
        // 모든 가능한 높이 표시
        const allHeights = new Set();
        Object.values(rd["기본가격"] || {}).forEach(sizeData => {
          Object.keys(sizeData).forEach(h => allHeights.add(h));
        });
        const heightsFromExtra = EXTRA_OPTIONS["스텐랙"]?.height || [];
        opts.height = sortHeights([...Array.from(allHeights), ...heightsFromExtra]);
      }
      
      // 단수: 선택된 사이즈, 높이 기준 또는 모든 단수
      if (selectedOptions.size && selectedOptions.height && rd["기본가격"]?.[selectedOptions.size]?.[selectedOptions.height]) {
        const levelsFromData = Object.keys(rd["기본가격"][selectedOptions.size][selectedOptions.height] || {});
        const levelsFromExtra = EXTRA_OPTIONS["스텐랙"]?.level || [];
        opts.level = sortLevels([...levelsFromData, ...levelsFromExtra]);
      } else {
        // 모든 가능한 단수 표시
        const allLevels = new Set();
        Object.values(rd["기본가격"] || {}).forEach(sizeData => {
          Object.values(sizeData).forEach(heightData => {
            Object.keys(heightData).forEach(l => allLevels.add(l));
          });
        });
        const levelsFromExtra = EXTRA_OPTIONS["스텐랙"]?.level || [];
        opts.level = sortLevels([...Array.from(allLevels), ...levelsFromExtra]);
      }
      
      setAvailableOptions(opts);
      return;
    }

    setAvailableOptions({});
  };

  const hasAnySelections = () => {
    return selectedType && Object.keys(selectedOptions).length > 0;
  };

  const calculateBOM = () => {
    if (!selectedType) {
      setMaterialList([]);
      return;
    }

    try {
      let components = [];
      
      // 선택된 옵션이 부족해도 기본 BOM이라도 보여주기
      if (formTypeRacks.includes(selectedType)) {
        const { size, height: heightRaw, level: levelRaw, formType } = selectedOptions;
        
        if (size && heightRaw && levelRaw && formType) {
          // 완전한 선택이 있을 때
          const height = selectedType === "경량랙" && heightRaw === "H750" ? "H900" : heightRaw;
          const rec = bomData?.[selectedType]?.[size]?.[height]?.[levelRaw]?.[formType];
          
          if (rec?.components) {
            components = rec.components.map(c => ({
              rackType: selectedType,
              name: c.name,
              specification: c.specification || '',
              quantity: Number(c.quantity) || 0,
              unitPrice: Number(c.unit_price) || 0,
              totalPrice: Number(c.total_price) || (Number(c.unit_price) || 0) * (Number(c.quantity) || 0),
              note: c.note || ''
            }));
          }
        } else {
          // 부분 선택이라도 fallback BOM 생성
          components = generateFallbackBOM(selectedType, selectedOptions);
        }
      } else if (selectedType === "하이랙") {
        components = generateFallbackBOM(selectedType, selectedOptions);
      } else if (selectedType === "스텐랙") {
        components = generateFallbackBOM(selectedType, selectedOptions);
      }

      // 관리자 단가 적용
      const componentsWithAdminPrice = components.map(applyAdminEditPrice);
      
      // 정렬 및 설정
      setMaterialList(sortBOMByMaterialRule(componentsWithAdminPrice));
    } catch (error) {
      console.error('BOM 계산 실패:', error);
      setMaterialList([]);
    }
  };

  const generateFallbackBOM = (rackType, options) => {
    const components = [];
    
    if (rackType === "경량랙") {
      const size = options.size || "50x90";
      const height = options.height || "H900";
      const level = parseInt((options.level || "3단").replace(/[^\d]/g, "")) || 3;
      const formType = options.formType || "독립형";
      
      const qty = 1;
      const isConn = formType === "연결형";
      const pillarQty = isConn ? 2 * qty : 4 * qty;
      const shelfQty = level * qty;
      
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height}`, quantity: pillarQty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `선반(${size})`, specification: `사이즈 ${size}`, quantity: shelfQty, unitPrice: 0, totalPrice: 0 },
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
      
      const qty = 1;
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
      
      const qty = 1;
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
      
      const qty = 1;
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
      
      const qty = 1;
      
      components.push(
        { rackType, name: `기둥(${height})`, specification: `높이 ${height}`, quantity: 4 * qty, unitPrice: 0, totalPrice: 0 },
        { rackType, name: `선반(${size})`, specification: `사이즈 ${size}`, quantity: level * qty, unitPrice: 0, totalPrice: 0 }
      );
    }
    
    return components;
  };

  // 부품 고유 ID 생성 (AdminPriceEditor와 동일한 로직)
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

  // 실제 사용할 단가 계산 (우선순위: 관리자 수정 > 기존 단가)
  const getEffectiveUnitPrice = (item) => {
    const partId = generatePartId(item);
    const adminPrice = adminPrices[partId];
    
    if (adminPrice && adminPrice.price > 0) {
      return adminPrice.price;
    }
    
    return Number(item.unitPrice) || 0;
  };

  // 단가 수정 버튼 클릭 핸들러
  const handleEditPrice = (item) => {
    const itemWithRackInfo = {
      ...item,
      displayName: `${item.rackType} - ${item.name} ${item.specification || ''}`.trim()
    };
    setEditingPart(itemWithRackInfo);
  };

  // 단가 수정 완료 핸들러
  const handlePriceSaved = (partId, newPrice, oldPrice) => {
    loadAdminPrices();
    // BOM 재계산 (관리자 단가 반영)
    calculateBOM();
    window.dispatchEvent(new CustomEvent('adminPriceChanged', { 
      detail: { partId, newPrice, oldPrice } 
    }));
  };

  const handleOptionChange = (key, value) => {
    if (key === 'type') {
      setSelectedType(value);
      return;
    }
    setSelectedOptions(prev => ({ ...prev, [key]: value }));
  };

  const renderOptionSelect = (name, label, enabled = true, map = null) => {
    const opts = availableOptions[name] || [];
    if (!opts.length) return null;
    
    return (
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#555', fontSize: '14px' }}>
          {label}
        </label>
        <select
          disabled={!enabled}
          value={selectedOptions[name] || ''}
          onChange={e => handleOptionChange(name, e.target.value)}
          style={{
            width: '100%',
            maxWidth: '250px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="">{label} 선택</option>
          {opts.map(o => (
            <option key={o} value={o}>
              {map && map[o] ? map[o] : kgLabelFix(o)}
            </option>
          ))}
        </select>
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
      
      {/* 옵션 선택 영역 */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '16px', 
        backgroundColor: 'white', 
        borderRadius: '6px',
        border: '1px solid #dee2e6',
        flex: '0 0 auto'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#495057' }}>
          랙 옵션 선택
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* 제품 유형 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#555', fontSize: '14px' }}>
              제품 유형
            </label>
            <select
              value={selectedType}
              onChange={e => handleOptionChange('type', e.target.value)}
              style={{
                width: '100%',
                maxWidth: '250px',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">제품 유형 선택</option>
              {allTypes.map(t => (
                <option key={t} value={t}>
                  {kgLabelFix(t)}
                </option>
              ))}
            </select>
          </div>

          {/* formType이 필요한 랙들 */}
          {formTypeRacks.includes(selectedType) && (
            <>
              {renderOptionSelect('size', '규격')}
              {renderOptionSelect('height', '높이')}
              {renderOptionSelect('level', '단수')}
              {renderOptionSelect('formType', '형식')}
            </>
          )}

          {/* 하이랙 */}
          {selectedType === '하이랙' && (
            <>
              {renderOptionSelect('color', '색상', true, colorLabelMap)}
              {renderOptionSelect('size', '규격')}
              {renderOptionSelect('height', '높이')}
              {renderOptionSelect('level', '단수')}
              {renderOptionSelect('formType', '형식')}
            </>
          )}

          {/* 스텐랙 */}
          {selectedType === '스텐랙' && (
            <>
              {renderOptionSelect('size', '규격')}
              {renderOptionSelect('height', '높이')}
              {renderOptionSelect('level', '단수')}
            </>
          )}
        </div>

        {/* 선택된 옵션 요약 */}
        {selectedType && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px 12px', 
            backgroundColor: '#e7f3ff', 
            borderRadius: '4px',
            fontSize: '13px',
            color: '#0c5aa6'
          }}>
            <strong>선택된 옵션:</strong> {[
              selectedType,
              selectedOptions.formType,
              selectedOptions.size,
              selectedOptions.height,
              selectedOptions.level,
              selectedOptions.color
            ].filter(Boolean).join(' ') || '(옵션을 선택하세요)'}
          </div>
        )}
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
            {!selectedType ? (
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
                  선택한 {selectedType}의 원자재 정보를 가져오고 있습니다.
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
