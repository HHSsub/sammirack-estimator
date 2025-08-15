import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import CustomMaterialsBox from './CustomMaterialsBox'; // ✅ 추가

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
    // 레거시 단건 입력은 컨텍스트엔 남아 있지만, UI는 CustomMaterialsBox로 대체
    customMaterialName, setCustomMaterialName,
    customMaterialPrice, setCustomMaterialPrice,
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

  let extraCatList = [];
  if (extraProducts && extraProducts[selectedType]) {
    extraCatList = Object.entries(extraProducts[selectedType]);
  }

  const toggleExtra = id => {
    if (extraOptionsSel.includes(id)) handleExtraOptionChange(extraOptionsSel.filter(e => e !== id));
    else handleExtraOptionChange([...extraOptionsSel, id]);
  };

  if (loading) return <div>데이터 로드 중...</div>;
  const canAddItem = (customPrice > 0 || currentPrice > 0);

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
          <input type="number" value={customPrice} onChange={e => setCustomPrice(Number(e.target.value) || 0)} />
        </div>
      </div>

      {extraCatList.length > 0 && (
        <>
          <button onClick={() => setExtraOpen(o => !o)} style={{ margin: '10px 0' }}>
            {extraOpen ? '기타 추가 옵션 닫기' : '기타 추가 옵션 열기'}
          </button>

          {extraOpen && (
            <div style={{display:'grid', gap:12}}>
              {/* ✅ 사용자 정의 기타자재 입력 박스 (경량랙 전용 노출) */}
              <CustomMaterialsBox />

              {/* ✅ 레거시 l1-custom 항목은 경량랙에서 숨김 */}
              {extraCatList.map(([cat, arr]) => {
                const shownArr = (selectedType === '경량랙')
                  ? arr.filter(opt => opt.id !== 'l1-custom')
                  : arr;

                if (!shownArr.length) return null;

                return (
                  <div key={cat}>
                    <div style={{ fontWeight: 600 }}>{cat}</div>
                    {shownArr.map(opt => {
                      const checked = extraOptionsSel.includes(opt.id);
                      return (
                        <div key={opt.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleExtra(opt.id)}
                            />
                            {kgLabelFix(opt.name)} {opt.price ? `+${opt.price}원` : ''}
                          </label>

                          {/* ⚠️ 레거시 단건 입력 UI는 제거—이제 CustomMaterialsBox가 담당 */}
                          {false && selectedType === '경량랙' && opt.id === 'l1-custom' && checked && (
                            <div>
                              <input
                                placeholder="부품명"
                                value={customMaterialName}
                                onChange={e => setCustomMaterialName(e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="금액"
                                value={customMaterialPrice}
                                onChange={e => setCustomMaterialPrice(Number(e.target.value) || 0)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 12 }}>
        <span>계산 가격: {(customPrice > 0 ? customPrice : currentPrice).toLocaleString()}원</span>
        <button onClick={addToCart} disabled={!canAddItem} style={{ marginLeft: 10 }}>
          목록 추가
        </button>
      </div>
    </div>
  );
}
