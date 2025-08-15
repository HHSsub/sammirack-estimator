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
    // 경량랙 전용 사용자 정의 자재
    customMaterials, addCustomMaterial, removeCustomMaterial,
    quantity, setQuantity, applyRate, setApplyRate,
    customPrice, setCustomPrice, currentPrice,
    addToCart, loading
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);
  const [extraOpen, setExtraOpen] = useState(false);

  // 사용자 정의 입력값(경량랙)
  const [cmName, setCmName] = useState('');
  const [cmPrice, setCmPrice] = useState('');

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

  if (loading) return <div>데이터 로드 중...</div>;
  const canAddItem = customPrice > 0 || currentPrice > 0;

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
          <input type="number" min={0} value={quantity} onChange={e => setQuantity(Math.max(0, Number(e.target.value)))} />
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

      {/* 추가 옵션 토글 */}
      <button onClick={() => setExtraOpen(o => !o)} style={{ margin: '10px 0' }}>
        {extraOpen ? '기타 추가 옵션 닫기' : '기타 추가 옵션 열기'}
      </button>

      {/* 경량랙: 사용자 정의 추가자재 테이블만 표시 (토글 열렸을 때) */}
      {extraOpen && selectedType === '경량랙' && (
        <div style={{ padding: '12px', border: '1px solid #e4eef8', borderRadius: 6, background: '#fff' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>사용자 정의 추가자재 (여러개)</div>

          {/* 입력 행 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              placeholder="항목명 (예: 연결대)"
              value={cmName}
              onChange={e => setCmName(e.target.value)}
            />
            <input
              type="number"
              placeholder="단가"
              value={cmPrice}
              onChange={e => setCmPrice(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                if (!cmName || !Number(cmPrice)) return;
                addCustomMaterial(cmName, Number(cmPrice));
                setCmName('');
                setCmPrice('');
              }}
            >
              추가
            </button>
          </div>

          {/* 목록 테이블 */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f7fd' }}>
                <th style={{ border: '1px solid #e1e8f5', padding: '6px' }}>항목명</th>
                <th style={{ border: '1px solid #e1e8f5', padding: '6px', width: 140 }}>단가</th>
                <th style={{ border: '1px solid #e1e8f5', padding: '6px', width: 80 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {customMaterials.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ border: '1px solid #e1e8f5', padding: '8px', textAlign: 'center', color: '#8aa1c4' }}>
                    추가된 자재가 없습니다.
                  </td>
                </tr>
              ) : customMaterials.map(m => (
                <tr key={m.id}>
                  <td style={{ border: '1px solid #e1e8f5', padding: '6px' }}>{m.name}</td>
                  <td style={{ border: '1px solid #e1e8f5', padding: '6px' }}>{Number(m.price).toLocaleString()}원</td>
                  <td style={{ border: '1px solid #e1e8f5', padding: '6px' }}>
                    <button type="button" onClick={() => removeCustomMaterial(m.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 다른 제품군의 추가옵션은 기존처럼 카테고리 체크박스 유지 (경량랙 제외) */}
      {/* 필요 시 여기서 extra_options 기반 체크박스 블록을 추가로 렌더링할 수 있음 */}

      <div style={{ marginTop: 12 }}>
        <span>계산 가격: { (customPrice > 0 ? customPrice : currentPrice).toLocaleString() }원</span>
        <button onClick={addToCart} disabled={!canAddItem} style={{ marginLeft: 10 }}>목록 추가</button>
      </div>
    </div>
  );
}
