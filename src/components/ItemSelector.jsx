// src/components/ItemSelector.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useProducts } from '../contexts/ProductContext';
import './ItemSelector.css';

const formTypeRacks = ['경량랙', '중량랙', '파렛트랙 철판형'];

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

// 정렬 함수들 (OptionSelector와 동일)
const sortSizes = (arr) => {
  return arr.sort((a, b) => {
    const aMatch = String(a).match(/(\d+)/);
    const bMatch = String(b).match(/(\d+)/);
    if (!aMatch || !bMatch) return 0;
    return Number(aMatch[1]) - Number(bMatch[1]);
  });
};

const sortHeights = (arr) => {
  return arr.sort((a, b) => {
    const aNum = Number(String(a).replace(/[^\d]/g, ''));
    const bNum = Number(String(b).replace(/[^\d]/g, ''));
    return aNum - bNum;
  });
};

const sortLevels = (arr) => {
  return arr.sort((a, b) => {
    const aNum = Number(String(a).replace(/[^\d]/g, ''));
    const bNum = Number(String(b).replace(/[^\d]/g, ''));
    return aNum - bNum;
  });
};

const ItemSelector = ({ isOpen, onClose, onAdd }) => {
  const { 
    allOptions, 
    bomData,
    data,
    extraProducts,
    colorLabelMap,
    loading 
  } = useProducts();

  // 임시 선택 상태
  const [tempType, setTempType] = useState('');
  const [tempOptions, setTempOptions] = useState({});
  const [availOpts, setAvailOpts] = useState({});
  const [tempQuantity, setTempQuantity] = useState(1);
  const [customMode, setCustomMode] = useState(false);
  const [customData, setCustomData] = useState({
    name: '', unit: '개', quantity: 1, unitPrice: 0
  });

  // 추가 옵션 (필요하면 여기서 추가하면 됨)
  const EXTRA_OPTIONS = {
    '경량랙': { size: [], height: [], level: [] },
    '중량랙': { size: [], height: [], level: [] },
    '파렛트랙 철판형': { size: ["2090x800","2090x1000"], height: ["H4500","H5000","H5500","H6000"], level: [] },
    '파렛트랙': { size: [], height: ["H4500","H5000","H5500","H6000"], level: [] },
    '하이랙': { size: ["45x150"], height: ["150","250"], level: ["1단","2단","3단","4단","5단","6단"] },
    '스텐랙': { size: [], height: [], level: [] }
  };

  // availableOptions 동적 계산 (ProductContext 로직과 동일)
  useEffect(() => {
    if (!tempType) {
      setAvailOpts({});
      return;
    }

    // 파렛트랙
    if (tempType === "파렛트랙") {
      const bd = bomData["파렛트랙"] || {};
      const next = { version: [], weight: [], size: [], height: [], level: [], formType: [] };
      
      next.version = ["구형", "신형"];
      
      if (tempOptions.version) {
        const versionBlock = bd[tempOptions.version] || {};
        const weightKeys = Object.keys(versionBlock || {});
        next.weight = weightKeys;
        
        if (tempOptions.weight) {
          const weightBlock = versionBlock[tempOptions.weight] || {};
          const sizesFromData = Object.keys(weightBlock || {});
          const extraSizes = EXTRA_OPTIONS["파렛트랙"]?.size || [];
          next.size = sortSizes([...new Set([...sizesFromData, ...extraSizes])]);
          
          if (tempOptions.size) {
            const heightsFromData = Object.keys(weightBlock[tempOptions.size] || {});
            const extraHeights = EXTRA_OPTIONS["파렛트랙"]?.height || [];
            next.height = sortHeights([...new Set([...heightsFromData, ...extraHeights])]);
            
            if (tempOptions.height) {
              const levelsFromData = Object.keys(weightBlock[tempOptions.size]?.[tempOptions.height] || {});
              const extraLevels = EXTRA_OPTIONS["파렛트랙"]?.level || [];
              const allLevels = levelsFromData.length ? [...new Set([...levelsFromData, ...extraLevels])] : (extraLevels.length ? extraLevels : ["L1","L2","L3","L4","L5","L6"]);
              next.level = sortLevels(allLevels);
              
              if (tempOptions.level) {
                const fm = weightBlock[tempOptions.size]?.[tempOptions.height]?.[tempOptions.level] || {};
                next.formType = Object.keys(fm).length ? Object.keys(fm) : ["독립형", "연결형"];
              }
            }
          }
        }
      }
      
      setAvailOpts(next);
      return;
    }

    // formTypeRacks (경량랙, 중량랙, 파렛트랙 철판형)
    if (formTypeRacks.includes(tempType)) {
      const bd = bomData[tempType] || {};
      const next = { size: [], height: [], level: [], formType: [] };
      
      if (tempType === "경량랙") {
        next.color = ["아이보리", "블랙", "실버"];
      }
      
      if (tempType === "경량랙" && tempOptions.color) {
        const sizesFromData = Object.keys(bd || {});
        const extraSizes = EXTRA_OPTIONS[tempType]?.size || [];
        next.size = sortSizes([...new Set([...sizesFromData, ...extraSizes])]);
      } else if (tempType !== "경량랙") {
        const sizesFromData = Object.keys(bd || {});
        const extraSizes = EXTRA_OPTIONS[tempType]?.size || [];
        next.size = sortSizes([...new Set([...sizesFromData, ...extraSizes])]);
      }
      
      if (tempOptions.size) {
        const heightsFromData = Object.keys(bd[tempOptions.size] || {});
        const extraHeights = EXTRA_OPTIONS[tempType]?.height || [];
        next.height = sortHeights([...new Set([...heightsFromData, ...extraHeights])]);
        
        if (tempOptions.height) {
          const heightKey = tempType === "경량랙" && tempOptions.height === "H750" ? "H900" : tempOptions.height;
          const levelKeys = Object.keys(bd[tempOptions.size]?.[heightKey] || {});
          const extraLevels = EXTRA_OPTIONS[tempType]?.level || [];
          const allLevels = levelKeys.length ? [...new Set([...levelKeys, ...extraLevels])] : (extraLevels.length ? extraLevels : ["L1", "L2", "L3", "L4", "L5", "L6"]);
          next.level = sortLevels(allLevels);
          
          if (tempOptions.level) {
            const fm = bd[tempOptions.size]?.[heightKey]?.[tempOptions.level] || {};
            next.formType = Object.keys(fm).length ? Object.keys(fm) : ["독립형", "연결형"];
          }
        }
      }
      
      setAvailOpts(next);
      return;
    }

    // 하이랙
    if (tempType === "하이랙") {
      const colorKeys = data?.["하이랙"]?.["기본가격"] ? Object.keys(data["하이랙"]["기본가격"]) : [];
      const next = { 
        color: colorKeys.length ? colorKeys : [], 
        size: [], 
        height: [], 
        level: [], 
        formType: [] 
      };
      
      if (tempOptions.color) {
        const colorBlock = data?.["하이랙"]?.["기본가격"]?.[tempOptions.color] || {};
        const sizesFromData = Object.keys(colorBlock);
        const extraSizes = EXTRA_OPTIONS["하이랙"]?.size || [];
        next.size = sortSizes([...new Set([...sizesFromData, ...extraSizes])]);
        
        if (tempOptions.size) {
          const heightsFromData = Object.keys(colorBlock[tempOptions.size] || {});
          const extraHeights = EXTRA_OPTIONS["하이랙"]?.height || [];
          next.height = sortHeights([...new Set([...heightsFromData, ...extraHeights])]);
          
          if (tempOptions.height) {
            const levelsFromData = Object.keys(colorBlock[tempOptions.size]?.[tempOptions.height] || {});
            const extraLevels = EXTRA_OPTIONS["하이랙"]?.level || [];
            next.level = sortLevels([...new Set([...levelsFromData, ...extraLevels])]);
            
            if (tempOptions.level) {
              next.formType = ["독립형", "연결형"];
            }
          }
        }
      }
      
      setAvailOpts(next);
      return;
    }

    // 스텐랙
    if (tempType === "스텐랙") {
      const bd = data?.["스텐랙"]?.["기본가격"] || {};
      const next = { size: [], height: [], level: [] };
      
      const sizesFromData = Object.keys(bd);
      const extraSizes = EXTRA_OPTIONS["스텐랙"]?.size || [];
      next.size = sortSizes([...new Set([...sizesFromData, ...extraSizes])]);
      
      if (tempOptions.size) {
        const heightsFromData = Object.keys(bd[tempOptions.size] || {});
        const extraHeights = EXTRA_OPTIONS["스텐랙"]?.height || [];
        next.height = sortHeights([...new Set([...heightsFromData, ...extraHeights])]);
        
        if (tempOptions.height) {
          const levelsFromData = Object.keys(bd[tempOptions.size]?.[tempOptions.height] || {});
          const extraLevels = EXTRA_OPTIONS["스텐랙"]?.level || [];
          next.level = sortLevels([...new Set([...levelsFromData, ...extraLevels])]);
        }
      }
      
      setAvailOpts(next);
      return;
    }

    setAvailOpts({});
  }, [tempType, tempOptions, bomData, data]);

  // 옵션 변경 핸들러
  const handleOptionChange = (key, value) => {
    if (key === "type") {
      setTempType(value);
      setTempOptions({});
      return;
    }
    setTempOptions(prev => ({ ...prev, [key]: value }));
  };

  // 드롭다운 렌더링
  const renderOptionSelect = (name, label, enabled = true, map = null) => {
    const opts = availOpts[name] || [];
    if (!opts.length) return null;
    
    return (
      <div className="selector-field">
        <label>{label}</label>
        <select
          disabled={!enabled || loading}
          value={tempOptions[name] || ''}
          onChange={e => handleOptionChange(name, e.target.value)}
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

  // 간단한 가격 계산 (실제로는 ProductContext의 calculatePrice 로직 사용)
  const calculateItemPrice = useCallback(() => {
    if (!tempType) return 0;
    if (tempType !== "스텐랙" && !tempOptions.formType) return 0;
    
    // 기본가격 조회
    try {
      if (tempType === "파렛트랙 철판형") {
        const hKey = String(tempOptions.height || "").replace(/^H/i, "");
        const lKey = (String(tempOptions.level || "").replace(/^L/i, "").replace(/^\s*$/, "0")) + "단";
        const price = data?.[tempType]?.["기본가격"]?.[tempOptions.formType]?.[tempOptions.size]?.[hKey]?.[lKey];
        return Number(price) || 0;
      } else if (tempType === "스텐랙") {
        const levelRaw = tempOptions.level || "";
        const price = data?.["스텐랙"]?.["기본가격"]?.[tempOptions.size]?.[tempOptions.height]?.[levelRaw];
        return Number(price) || 0;
      } else if (tempType === "하이랙") {
        const price = data?.["하이랙"]?.["기본가격"]?.[tempOptions.color]?.[tempOptions.size]?.[tempOptions.height]?.[tempOptions.level];
        return Number(price) || 0;
      } else if (tempType === "파렛트랙") {
        const price = data?.["파렛트랙"]?.["기본가격"]?.[tempOptions.version]?.[tempOptions.weight]?.[tempOptions.size]?.[tempOptions.height]?.[tempOptions.level]?.[tempOptions.formType];
        return Number(price) || 0;
      } else {
        const heightRaw = tempType === "경량랙" && tempOptions.height === "H750" ? "H900" : tempOptions.height;
        const price = data?.[tempType]?.["기본가격"]?.[tempOptions.size]?.[heightRaw]?.[tempOptions.level]?.[tempOptions.formType];
        return Number(price) || 0;
      }
    } catch (e) {
      return 0;
    }
  }, [tempType, tempOptions, data]);

  // 추가 버튼 핸들러
  const handleAdd = () => {
    if (customMode) {
      // 기타 옵션
      if (!customData.name.trim()) {
        alert('품명을 입력하세요.');
        return;
      }
      onAdd(customData);
      // 초기화
      setCustomData({ name: '', unit: '개', quantity: 1, unitPrice: 0 });
    } else {
      // 시스템 품목
      if (!tempType) {
        alert('랙 타입을 선택하세요.');
        return;
      }
      
      // ✅ 랙 타입별 필수 옵션 체크
      let isComplete = false;
      
      if (tempType === '파렛트랙') {
        isComplete = tempOptions.version && tempOptions.weight && tempOptions.size && tempOptions.height && tempOptions.level && tempOptions.formType;
      } else if (tempType === '스텐랙') {
        isComplete = tempOptions.size && tempOptions.height && tempOptions.level;
      } else if (tempType === '경량랙') {
        isComplete = tempOptions.color && tempOptions.size && tempOptions.height && tempOptions.level && tempOptions.formType;
      } else if (tempType === '하이랙') {
        isComplete = tempOptions.color && tempOptions.size && tempOptions.height && tempOptions.level && tempOptions.formType;
      } else {
        // 중량랙, 파렛트랙 철판형
        isComplete = tempOptions.size && tempOptions.height && tempOptions.level && tempOptions.formType;
      }
      
      if (!isComplete) {
        alert('모든 옵션을 선택하세요.');
        return;
      }
      
      // displayName 생성
      let displayName = tempType;
      if (tempType === "파렛트랙") {
        displayName += ` ${tempOptions.version || ''} ${tempOptions.weight || ''}`;
      }
      if (tempType === "하이랙") {
        const colorLabel = colorLabelMap[tempOptions.color] || tempOptions.color;
        displayName += ` ${colorLabel}`;
      }
      if (tempType === "경량랙" && tempOptions.color) {
        displayName += ` ${tempOptions.color}`;
      }
      
      // ✅ 스텐랙은 formType 제외
      if (tempType === "스텐랙") {
        displayName += ` ${tempOptions.size || ''} ${tempOptions.height || ''} ${tempOptions.level || ''}`;
      } else {
        displayName += ` ${tempOptions.formType || ''} ${tempOptions.size || ''} ${tempOptions.height || ''} ${tempOptions.level || ''}`;
      }
      displayName = displayName.replace(/\s+/g, ' ').trim();
      
      const unitPrice = calculateItemPrice();
      const totalPrice = unitPrice * tempQuantity;
      
      onAdd({
        name: displayName,
        unit: '개',
        quantity: tempQuantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        note: ''
      });
      
      // 수량만 초기화 (옵션은 유지)
      setTempQuantity(1);
    }
  };

  // 닫기 핸들러
  const handleClose = () => {
    setTempType('');
    setTempOptions({});
    setTempQuantity(1);
    setCustomMode(false);
    setCustomData({ name: '', unit: '개', quantity: 1, unitPrice: 0 });
    onClose();
  };

  // ESC 키 핸들러
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="item-selector-panel">
      <div className="panel-header">
        <h4>품목 선택</h4>
        <button className="close-btn" onClick={handleClose}>✕</button>
      </div>
      
      {!customMode ? (
        <>
          <div className="selector-row">
            {/* 랙 타입 */}
            <div className="selector-field">
              <label>랙 타입</label>
              <select
                value={tempType}
                onChange={e => handleOptionChange('type', e.target.value)}
              >
                <option value="">랙 타입 선택</option>
                {(allOptions.types || []).map(t => (
                  <option key={t} value={t}>
                    {kgLabelFix(t)}
                  </option>
                ))}
              </select>
            </div>

            {/* 파렛트랙 */}
            {tempType === '파렛트랙' && (
              <>
                {renderOptionSelect('version', '버전', true)}
                {renderOptionSelect('weight', '무게', !!tempOptions.version)}
                {renderOptionSelect('size', '규격', !!tempOptions.version && !!tempOptions.weight)}
                {renderOptionSelect('height', '높이', !!tempOptions.version && !!tempOptions.weight && !!tempOptions.size)}
                {renderOptionSelect('level', '단수', !!tempOptions.version && !!tempOptions.weight && !!tempOptions.size && !!tempOptions.height)}
                {availOpts.formType?.length > 0 && renderOptionSelect('formType', '형식', !!tempOptions.version && !!tempOptions.weight && !!tempOptions.size && !!tempOptions.height && !!tempOptions.level)}
              </>
            )}

            {/* formTypeRacks */}
            {formTypeRacks.includes(tempType) && (
              <>
                {tempType === '경량랙' && renderOptionSelect('color', '색상', true)}
                {tempType === '경량랙' 
                  ? renderOptionSelect('size', '규격', !!tempOptions.color)
                  : renderOptionSelect('size', '규격')
                }
                {renderOptionSelect('height', '높이', !!tempOptions.size)}
                {renderOptionSelect('level', '단수', !!tempOptions.size && !!tempOptions.height)}
                {renderOptionSelect('formType', '형식', !!tempOptions.size && !!tempOptions.height && !!tempOptions.level)}
              </>
            )}

            {/* 하이랙 */}
            {tempType === '하이랙' && (
              <>
                {renderOptionSelect('color', '색상', true, colorLabelMap)}
                {renderOptionSelect('size', '규격', !!tempOptions.color)}
                {renderOptionSelect('height', '높이', !!tempOptions.color && !!tempOptions.size)}
                {renderOptionSelect('level', '단수', !!tempOptions.color && !!tempOptions.size && !!tempOptions.height)}
                {availOpts.formType?.length > 0 && renderOptionSelect('formType', '형식', !!tempOptions.color && !!tempOptions.size && !!tempOptions.height && !!tempOptions.level)}
              </>
            )}

            {/* 스텐랙 */}
            {tempType === '스텐랙' && (
              <>
                {renderOptionSelect('size', '규격')}
                {renderOptionSelect('height', '높이', !!tempOptions.size)}
                {renderOptionSelect('level', '단수', !!tempOptions.size && !!tempOptions.height)}
              </>
            )}

            {/* 수량 */}
            <div className="selector-field">
              <label>수량</label>
              <input
                type="number"
                min="1"
                value={tempQuantity}
                onChange={e => setTempQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="custom-input-section">
          <h5>직접 입력</h5>
          <div className="custom-row">
            <input
              type="text"
              placeholder="품명"
              value={customData.name}
              onChange={e => setCustomData({ ...customData, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="단위"
              value={customData.unit}
              onChange={e => setCustomData({ ...customData, unit: e.target.value })}
            />
            <input
              type="number"
              placeholder="수량"
              min="1"
              value={customData.quantity}
              onChange={e => setCustomData({ ...customData, quantity: Math.max(1, Number(e.target.value) || 1) })}
            />
            <input
              type="number"
              placeholder="단가"
              min="0"
              value={customData.unitPrice}
              onChange={e => setCustomData({ ...customData, unitPrice: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        </div>
      )}

      <div className="action-row">
        <button className="add-btn" onClick={handleAdd}>
          추가
        </button>
        <button 
          className="custom-btn" 
          onClick={() => setCustomMode(!customMode)}
        >
          {customMode ? '시스템 품목' : '기타 입력'}
        </button>
        <button className="cancel-btn" onClick={handleClose}>
          닫기
        </button>
      </div>
    </div>
  );
};

export default ItemSelector;
