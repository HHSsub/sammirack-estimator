import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';

const formTypeRacks = ['경량랙', '중량랙', '파렛트랙', '파렛트랙 철판형'];

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

export default function OptionSelector() {
  const {
    allOptions, availableOptions, colorLabelMap,
    selectedType, selectedOptions,
    handleOptionChange,
    extraOptionsSel, handleExtraOptionChange,
    extraProducts,
    // ▼ 사용자 자재(여러 개) 관련
    customMaterials, addCustomMaterial, removeCustomMaterial,
    customMaterialName, setCustomMaterialName,
    customMaterialPrice, setCustomMaterialPrice,
    // ▼ 공통 입력들
    quantity, setQuantity, applyRate, setApplyRate,
    customPrice, setCustomPrice, currentPrice,
    addToCart, loading
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);
  const [extraOpen, setExtraOpen] = useState(false);

  useEffect(() => setApplyRateInput(applyRate), [applyRate]);
  const onApplyRateChange = e => {
    const v = e.target.value;
    if (v === '' || /^[0-9]{1,3}$/.test(v)) {
      setApplyRateInput(v);
      const num = Number(v);
      if (!isNaN(num) && num >= 0 && num <= 200) setApplyRate(num);
    }
  };

  const renderOptionSelect = (name, label, enabled = true, map = null) => {
    const opts = availableOptions[name] || [];
    if (!opts.length) return null;
    return (
      <div style={{ minWidth: 160 }}>
        <label>{label}</label>
        <select
          disabled={!enabled || loading}
          value={selectedOptions[name] || ''}
          onChange={e => handleOptionChange(name, e.target.value)}
        >
          <option value="">{label} 선택</option>
          {opts.map(o => <option key={o} value={o}>{map && map[o] ? map[o] : kgLabelFix(o)}</option>)}
        </select>
      </div>
    );
  };

  // 기타 옵션 카테고리 (경량랙의 l1-custom은 체크박스에서 숨김)
  let extraCatList = [];
  if (extraProducts && extraProducts[selectedType]) {
    extraCatList = Object.entries(extraProducts[selectedType]).map(([cat, arr]) => ([
      cat,
      (arr || []).filter(opt => opt.id !== 'l1-custom') // 사용자 입력 전용은 아래 별도 UI
    ]));
  }

  const toggleExtra = id => {
    if (extraOptionsSel.includes(id)) handleExtraOptionChange(extraOptionsSel.filter(e => e !== id));
    else handleExtraOptionChange([...extraOptionsSel, id]);
  };

  const canAddItem = (customPrice > 0 || currentPrice > 0);

  // ▷ 사용자 자재(여러 개) 입력 박스 (경량랙에서만 노출)
  const renderCustomMaterialsBox = () => {
    if (selectedType !== '경량랙') return null;
    return (
      <div style={{ marginTop: 12, padding: '10px 12px', border: '1px dashed #cbd5e1', borderRadius: 8, background: '#fafcff' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>사용자 자재 (여러 개 추가 가능)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ minWidth: 160 }}
            placeholder="항목명 (예: 연결대)"
            value={customMaterialName}
            onChange={e => setCustomMaterialName(e.target.value)}
          />
          <input
            type="number"
            style={{ width: 120 }}
            placeholder="단가"
            value={customMaterialPrice}
            onChange={e => setCustomMaterialPrice(Number(e.target.value) || 0)}
          />
          <button
            type="button"
            onClick={() => {
              if (!customMaterialName || !Number(customMaterialPrice)) return;
              addCustomMaterial(customMaterialName, Number(customMaterialPrice));
              setCustomMaterialName('');
              setCustomMaterialPrice(0);
            }}
          >
            추가
          </button>
        </div>

        {customMaterials.length > 0 && (
          <ul style={{ marginTop: 10 }}>
            {customMaterials.map(m => (
              <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ minWidth: 160 }}>{m.name}</span>
                <span>{m.price.toLocaleString()}원</span>
                <button type="button" onClick={() => removeCustomMaterial(m.id)} style={{ marginLeft: 8 }}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
          * 단가는 1세트 기준이며, 상단의 수량과 곱해 합계에 반영됩니다.
        </div>
      </div>
    );
  };

  if (loading) return <div>데이터 로드 중...</div>;

  return (
    <div style={{ padding: 20, background: '#f8fcff', borderRadius: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <label>제품 유형</label>
          <select value={selectedType} onChange={e => handleOptionChange('type', e.target.value)}>
            <option value="">제품 유형 선택</option>
            {allOptions.types.map(t => <option key={t} value={t}>{kgLabelFix(t)}</option>)}
          </select>
        </div>

        {formTypeRacks.includes(selectedType) && <>
          {renderOptionSelect('size', '규격')}
          {renderOptionSelect('height', '높이', !!selectedOptions.size)}
          {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
          {renderOptionSelect('formType', '형식', !!selectedOptions.size && !!selectedOptions.height && !!selectedOptions.level)}
        </>}

        {selectedType === '하이랙' && <>
          {renderOptionSelect('color', '색상', true, colorLabelMap)}
          {renderOptionSelect('size', '규격', !!selectedOptions.color)}
          {renderOptionSelect('height', '높이', !!selectedOptions.color && !!selectedOptions.size)}
          {renderOptionSelect('level', '단수', !!selectedOptions.color && !!selectedOptions.size && !!selectedOptions.height)}
        </>}

        {selectedType === '스텐랙' && <>
          {renderOptionSelect('size', '규격')}
          {renderOptionSelect('height', '높이', !!selectedOptions.size)}
          {renderOptionSelect('level', '단수', !!selectedOptions.size && !!selectedOptions.height)}
        </>}

        <div>
          <label>수량</label>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={e => setQuantity(Math.max(0, Number(e.target.value)))}
          />
        </div>

        <div>
          <label>적용률(%)</label>
          <input value={applyRateInput} onChange={onApplyRateChange} maxLength={3} />
        </div>

        <div>
          <label>가격 직접입력</label>
          <input
            type="number"
            value={customPrice}
            onChange={e => setCustomPrice(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* 기타 추가 옵션 (체크박스 목록) */}
      {extraCatList.some(([_, arr]) => arr.length > 0) && (
        <>
          <button onClick={() => setExtraOpen(o => !o)} style={{ margin: '10px 0' }}>
            {extraOpen ? '기타 추가 옵션 닫기' : '기타 추가 옵션 열기'}
          </button>
          {extraOpen && extraCatList.map(([cat, arr]) => (
            arr.length > 0 && (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{cat}</div>
                {arr.map(opt => {
                  const checked = extraOptionsSel.includes(opt.id);
                  return (
                    <div key={opt.id}>
                      <label>
                        <input type="checkbox" checked={checked} onChange={() => toggleExtra(opt.id)} />
                        {kgLabelFix(opt.name)} {opt.price ? `+${opt.price}원` : ''}
                      </label>
                    </div>
                  );
                })}
              </div>
            )
          ))}
        </>
      )}

      {/* 경량랙 전용: 사용자 자재(여러 개) 입력 영역 */}
      {renderCustomMaterialsBox()}

      <div style={{ marginTop: 12 }}>
        <span>계산 가격: {(customPrice > 0 ? customPrice : currentPrice).toLocaleString()}원</span>
        <button onClick={addToCart} disabled={!canAddItem} style={{ marginLeft: 10 }}>
          목록 추가
        </button>
      </div>
    </div>
  );
}
