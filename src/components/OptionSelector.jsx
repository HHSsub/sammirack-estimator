import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
const formTypeRacks = ['경량랙','중량랙','파렛트랙'];

export default function OptionSelector() {
  const {
    allOptions, availableOptions, colorLabelMap,
    selectedType, selectedOptions, handleOptionChange,
    quantity, setQuantity, applyRate, setApplyRate,
    customPrice, setCustomPrice, isCustomPrice,
    currentPrice, addToCart, loading
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);
  useEffect(() => { setApplyRateInput(applyRate); }, [applyRate]);

  const onApplyRateChange = e => {
    const v = e.target.value;
    if (v === '' || /^[0-9]{1,3}$/.test(v)) {
      setApplyRateInput(v);
      const num = Number(v);
      if (!isNaN(num) && num >= 0 && num <= 200) setApplyRate(num);
    }
  };

  // ★ 옵션박스 크게 키워주는 공통 스타일
  const optionBoxStyle = {
    minWidth: 180,
    marginBottom: 18,
    display: 'flex',
    flexDirection: 'column'
  };
  const labelStyle = {
    fontSize: 17,
    fontWeight: 600,
    marginBottom: 7
  };
  const selectStyle = {
    minWidth: 180,
    height: 48,
    fontSize: 18,
    padding: '10px 14px',
    borderRadius: 7,
    border: '1.5px solid #dbe8fa',
    marginTop: 2,
    background: '#f7fafe',
    boxSizing: 'border-box'
  };

  const inputStyle = {
    height: 44,
    fontSize: 18,
    padding: '8px 12px',
    borderRadius: 7,
    border: '1.5px solid #dbe8fa',
    background: '#f7fafe'
  };

  const renderOptionSelect = (name,label,enabled=true,map=null) => {
    const opts = availableOptions[name] || [];
    if (!opts.length) return null;
    return (
      <div style={optionBoxStyle}>
        <label style={labelStyle}>{label}</label>
        <select
          style={selectStyle}
          disabled={!enabled || loading}
          value={selectedOptions[name] || ''}
          onChange={e => handleOptionChange(name, e.target.value)}
        >
          <option value="">{label} 선택</option>
          {opts.map(o=>(
            <option key={o} value={o} style={{fontSize:18}}>{map && map[o] ? map[o] : o}</option>
          ))}
        </select>
      </div>
    );
  };

  if (loading) return <div style={{ padding: 40, fontSize: 20, textAlign: 'center' }}>데이터 로드 중...</div>;

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '30px 28px 20px 28px',
        background: '#f5fafd',
        borderRadius: 19,
        boxShadow: '0 1px 8px #dde1ee',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '30px',
          alignItems: 'flex-end',
          marginBottom: '20px',
        }}
      >
        {/* 제품 유형: 항상 표시, 크기 키움 */}
        <div style={optionBoxStyle}>
          <label style={labelStyle}>제품 유형</label>
          <select value={selectedType} onChange={e=>handleOptionChange('type',e.target.value)} style={selectStyle}>
            <option value="">제품 유형 선택</option>
            {allOptions.types.map(t=> <option key={t} value={t} style={{fontSize:18}}>{t}</option>)}
          </select>
        </div>

        {formTypeRacks.includes(selectedType) && (
          <>
            {renderOptionSelect('size','규격')}
            {renderOptionSelect('height','높이',!!selectedOptions.size)}
            {renderOptionSelect('level','단수',!!selectedOptions.size && !!selectedOptions.height)}
            {renderOptionSelect('formType','형식',!!selectedOptions.size && !!selectedOptions.height && !!selectedOptions.level)}
          </>
        )}
        {selectedType==='하이랙' && (
          <>
            {renderOptionSelect('color','색상',true,colorLabelMap)}
            {renderOptionSelect('size','규격',!!selectedOptions.color)}
            {renderOptionSelect('height','높이',!!selectedOptions.color && !!selectedOptions.size)}
            {renderOptionSelect('level','단수',!!selectedOptions.color && !!selectedOptions.size && !!selectedOptions.height)}
          </>
        )}
        {selectedType==='스텐랙' && (
          <>
            {renderOptionSelect('size','규격')}
            {renderOptionSelect('height','높이',!!selectedOptions.size)}
            {renderOptionSelect('level','단수',!!selectedOptions.size && !!selectedOptions.height)}
          </>
        )}
        <div style={optionBoxStyle}>
          <label style={labelStyle}>수량</label>
          <input type="number" min={0} value={quantity}
            onChange={e=>setQuantity(Math.max(0,Number(e.target.value)))}
            style={{...inputStyle, width:90}}
          />
        </div>
        <div style={optionBoxStyle}>
          <label style={labelStyle}>적용률(%)</label>
          <input type="text" value={applyRateInput}
            onChange={onApplyRateChange}
            maxLength={3}
            style={{...inputStyle, width:80}}
          />
        </div>
        <div style={optionBoxStyle}>
          <label style={labelStyle}>가격 직접입력</label>
          <input type="number" min={0} value={customPrice}
            onChange={e=>{ setCustomPrice(Number(e.target.value)||0); setIsCustomPrice(!!e.target.value); }}
            style={{...inputStyle, width:120}}
          />
        </div>
      </div>
      <div style={{
        display:'flex', gap:'24px', alignItems:'center', marginBottom:'20px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '24px', letterSpacing:'-1px'}}>
            계산 가격: {currentPrice ? currentPrice.toLocaleString()+'원':'없음'}
          </h3>
          {isCustomPrice && (
            <p style={{ color: '#406dc1', fontWeight: 500, fontSize:15, margin: 0 }}>
              * 수동 입력 가격 적용
            </p>
          )}
        </div>
        <button
          onClick={addToCart}
          disabled={!selectedType}
          style={{
            padding:'12px 36px',
            background:'#2556a0',
            color:'#fff',
            fontWeight:700,
            fontSize:20,
            border:'none',
            borderRadius:8,
            cursor:'pointer'
          }}>
          목록 추가
        </button>
      </div>
    </div>
  );
}
