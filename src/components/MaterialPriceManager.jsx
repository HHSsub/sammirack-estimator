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

// 추가 옵션들
const EXTRA_OPTIONS = {
  파렛트랙: { height: ["H4500", "H5000", "H5500", "H6000"] },
  "파렛트랙 철판형": {
    height: ["1500", "2000", "2500", "3000", "3500", "4000", "H4500", "H5000", "H5500", "H6000"],
    size: ["2080x800", "2080x1000"]
  },
  하이랙: { size: ["45x150"], level: ["5단", "6단"] },
  스텐랙: { level: ["5단", "6단"], height: ["210"] },
  경량랙: { height: ["H750"] }
};

// 색상 라벨 매핑
const colorLabelMap = { "200kg": "270kg", "350kg": "450kg", "700kg": "550kg" };

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
    if (selectedType && hasRequiredSelections()) {
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

    if (formTypeRacks.includes(selectedType)) {
      const bd = bomData[selectedType] || {};
      const next = { size: [], height: [], level: [], formType: [] };
      
      const sizesFromData = Object.keys(bd || {});
      const extraSizes = EXTRA_OPTIONS[selectedType]?.size || [];
      next.size = sortSizes([...sizesFromData, ...extraSizes]);
      
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

    if (selectedType === "하이랙" && allData?.하이랙) {
      const rd = allData["하이랙"];
      const opts = { color: rd["색상"] || [] };
      
      if (selectedOptions.color) {
        const color = selectedOptions.color;
        const weightOnly = extractWeightOnly(color);
        const hide45 = ["450kg", "550kg", "700kg"].includes(weightOnly);
        const isHeaviest = /(550kg|700kg)$/.test(color);
        
        const rawSizes = Object.keys(rd["기본가격"]?.[color] || {});
        const sizeViewList = rawSizes.map(s =>
          isHeaviest && HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s]
            ? HIGHRACK_550_ALIAS_VIEW_FROM_DATA[s]
            : s
        );
        
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
            const sizeKey = isHeaviest
              ? HIGHRACK_550_ALIAS_DATA_FROM_VIEW[selectedOptions.size] || selectedOptions.size
              : selectedOptions.size;
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

    if (selectedType === "스텐랙" && allData?.스텐랙) {
      const rd = allData["스텐랙"];
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
          ...["2단", "3단", "4단", "5단", "6단"],
        ]);
      }
      opts.version = ["V1"];
      setAvailableOptions(opts);
      return;
    }

    setAvailableOptions({});
  };

  // 추가 하이랙 관련 유틸
  const HIGHRACK_550_ALIAS_VIEW_FROM_DATA = { "80x146": "80x108", "80x206": "80x150" };
  const HIGHRACK_550_ALIAS_DATA_FROM_VIEW = { "80x108": "80x146", "80x150": "80x206" };

  const extractWeightOnly = (color = "") => {
    const m = String(color).match(/(\d{2,4}kg)/);
    return m ? m[1] : "";
  };

  const hasRequiredSelections = () => {
    if (!selectedType) return false;
    
    if (formTypeRacks.includes(selectedType)) {
      return !!(selectedOptions.size &&
        selectedOptions.height &&
        selectedOptions.level &&
        selectedOptions.formType);
    }
    
    if (selectedType === '하이랙') {
      return !!(selectedOptions.color &&
        selectedOptions.size &&
        selectedOptions.height &&
        selectedOptions.level &&
        selectedOptions.formType);
    }
    
    if (selectedType === '스텐랙') {
      return !!(selectedOptions.size &&
        selectedOptions.height &&
        selectedOptions.level);
    }
    
    return false;
  };

  const calculateBOM = () => {
    if (!hasRequiredSelections()) {
      setMaterialList([]);
      return;
    }

    try {
      let components = [];
      
      if (formTypeRacks.includes(selectedType)) {
        const { size, height: heightRaw, level: levelRaw, formType } = selectedOptions;
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
      } else if (selectedType === "하이랙") {
        // 하이랙은 fallback BOM 생성
        const qty = 1; // 1개 기준
        const level = parseInt(selectedOptions.level) || 5;
        const size = selectedOptions.size || "";
        const color = selectedOptions.color || "";
        const heightValue = selectedOptions.height || "";
        const formType = selectedOptions.formType || "독립형";
        
        const shelfPerLevel = calcHighRackShelfPerLevel(size);
        const sizeMatch = String(size).replace(/\s+/g, "").match(/(\d+)[xX](\d+)/);
        const rodBeamNum = sizeMatch ? sizeMatch[2] : "";
        const shelfNum = sizeMatch ? sizeMatch[1] : "";
        const weightOnly = extractWeightOnly(color);
        const pillarQty = formType === "연결형" ? 2 * level * qty : 4 * qty;
        
        components = [
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
        ];
      } else if (selectedType === "스텐랙") {
        // 스텐랙 fallback BOM 생성
        const heightValue = selectedOptions.height || "";
        const q = 1;
        const sz = selectedOptions.size || "";
        const sizeFront = (sz.split("x")[0]) || sz;
        
        components = [
          {
            rackType: selectedType,
            name: `기둥(${heightValue})`,
            specification: `높이 ${heightValue}`,
            quantity: 4 * q,
            unitPrice: 0,
            totalPrice: 0
          },
          {
            rackType: selectedType,
            name: `선반(${sizeFront})`,
            specification: `사이즈 ${sz}`,
            quantity: (parseInt((selectedOptions.level || "").replace(/[^\d]/g, "")) || 0) * q,
            unitPrice: 0,
            totalPrice: 0
          },
        ];
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

  const calcHighRackShelfPerLevel = (size) => {
    const { d } = parseWD(size);
    if (d === 108) return 1;
    if (d === 150 || d === 200) return 2;
    return 1;
  };

  const parseWD = (size = "") => {
    const m = String(size).replace(/\s+/g, "").match(/W?(\d+)\s*[xX]\s*D?(\d+)/);
    return m ? { w: Number(m[1]), d: Number(m[2]) } : { w: null, d: null };
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
              {renderOptionSelect('height', '높이', !!selectedOptions.size)}
              {renderOptionSelect(
                'level',
                '단수',
                !!selectedOptions.size && !!selectedOptions.height
              )}
              {renderOptionSelect(
                'formType',
                '형식',
                !!selectedOptions.size &&
                !!selectedOptions.height &&
                !!selectedOptions.level
              )}
            </>
          )}

          {/* 하이랙 */}
          {selectedType === '하이랙' && (
            <>
              {renderOptionSelect('color', '색상', true, colorLabelMap)}
              {renderOptionSelect('size', '규격', !!selectedOptions.color)}
              {renderOptionSelect(
                'height',
                '높이',
                !!selectedOptions.color && !!selectedOptions.size
              )}
              {renderOptionSelect(
                'level',
                '단수',
                !!selectedOptions.color &&
                !!selectedOptions.size &&
                !!selectedOptions.height
              )}
              {availableOptions.formType?.length
                ? renderOptionSelect(
                  'formType',
                  '형식',
                  !!selectedOptions.color &&
                  !!selectedOptions.size &&
                  !!selectedOptions.height &&
                  !!selectedOptions.level
                )
                : (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#555', fontSize: '14px' }}>
                      형식
                    </label>
                    <select
                      disabled={
                        !(
                          selectedOptions.color &&
                          selectedOptions.size &&
                          selectedOptions.height &&
                          selectedOptions.level
                        )
                      }
                      value={selectedOptions.formType || ''}
                      onChange={e => handleOptionChange('formType', e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '250px',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">형식 선택</option>
                      <option value="독립형">독립형</option>
                      <option value="연결형">연결형</option>
                    </select>
                  </div>
                )}
            </>
          )}

          {/* 스텐랙 */}
          {selectedType === '스텐랙' && (
            <>
              {renderOptionSelect('size', '규격')}
              {renderOptionSelect('height', '높이', !!selectedOptions.size)}
              {renderOptionSelect(
                'level',
                '단수',
                !!selectedOptions.size && !!selectedOptions.height
              )}
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
            ].filter(Boolean).join(' ')}
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
                  랙 타입을 선택하고 필요한 옵션을 설정하면 해당 원자재 목록이 표시됩니다.
                </div>
              </>
            ) : !hasRequiredSelections() ? (
              <>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>⚙️</div>
                <div>필요한 옵션을 모두 선택해주세요.</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  {selectedType}의 모든 옵션을 설정해야 원자재 목록을 볼 수 있습니다.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>📋</div>
                <div>선택한 옵션에 대한 원자재 데이터가 없습니다.</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  다른 옵션 조합을 시도해보세요.
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
