import React from 'react';
import { useProducts } from '../contexts/ProductContext';
const formTypeRacks = ['경량랙','중량랙','파렛트랙'];

export default function OptionSelector() {
  const { allOptions, availableOptions, colorLabelMap, selectedType, selectedOptions, handleOptionChange, quantity, setQuantity, applyRate, setApplyRate, customPrice, setCustomPrice, isCustomPrice, currentPrice, addToCart, loading } = useProducts();

  const renderOptionSelect = (name,label,enabled=true,map=null) => {
    const opts = availableOptions[name] || [];
    if (!opts.length) return null;
    return (
      <div style={{ minWidth:150 }}>
        <label>{label}</label>
        <select disabled={!enabled || loading} value={selectedOptions[name] || ''} onChange={e=>handleOptionChange(name,e.target.value)}>
          <option value="">{label} 선택</option>
          {opts.map(o=><option key={o} value={o}>{map && map[o] ? map[o] : o}</option>)}
        </select>
      </div>
    );
  };

  if (loading) return <div>로딩중...</div>;

  return (
    <div style={{ padding:'16px', background:'#f8fcff', borderRadius:12, marginBottom:20 }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'16px', marginBottom:12 }}>
        <div style={{ minWidth:150 }}>
          <label>제품 유형</label>
          <select value={selectedType} onChange={e=>handleOptionChange('type', e.target.value)}>
            <option value="">제품 유형 선택</option>
            {allOptions.types.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {formTypeRacks.includes(selectedType) && <>
          {renderOptionSelect('size','규격')}
          {renderOptionSelect('height','높이', !!selectedOptions.size)}
          {renderOptionSelect('level','단수', !!selectedOptions.size && !!selectedOptions.height)}
          {renderOptionSelect('formType','형식', !!selectedOptions.size && !!selectedOptions.height && !!selectedOptions.level)}
        </>}
        {selectedType==='하이랙' && <>
          {renderOptionSelect('color','색상',true,colorLabelMap)}
          {renderOptionSelect('size','규격',!!selectedOptions.color)}
          {renderOptionSelect('height','높이',!!selectedOptions.color && !!selectedOptions.size)}
          {renderOptionSelect('level','단수',!!selectedOptions.color && !!selectedOptions.size && !!selectedOptions.height)}
        </>}
        {selectedType==='스텐랙' && <>
          {renderOptionSelect('size','규격')}
          {renderOptionSelect('height','높이',!!selectedOptions.size)}
          {renderOptionSelect('level','단수',!!selectedOptions.size && !!selectedOptions.height)}
        </>}
        <div>
          <label>수량</label>
          <input type="number" value={quantity} onChange={e=>setQuantity(Number(e.target.value)||0)} />
        </div>
        <div>
          <label>적용률(%)</label>
          <input type="text" value={applyRate} onChange={e=>setApplyRate(Number(e.target.value)||0)} />
        </div>
        <div>
          <label>가격 직접입력</label>
          <input type="number" value={customPrice} onChange={e=>{ setCustomPrice(Number(e.target.value)||0); }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
        <div>계산 가격: {currentPrice ? currentPrice.toLocaleString()+'원' : '없음'}</div>
        {isCustomPrice && <span>* 수동 입력 가격</span>}
        <button onClick={addToCart} disabled={!selectedType}>목록 추가</button>
      </div>
    </div>
  );
}
