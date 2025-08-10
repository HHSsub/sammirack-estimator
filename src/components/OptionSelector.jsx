import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
const formTypeRacks = ['경량랙','중량랙','파렛트랙'];

export default function OptionSelector() {
  const {
    allOptions, availableOptions, colorLabelMap,
    selectedType, selectedOptions, handleOptionChange,
    extraOptions, handleExtraOptionChange,
    extraProducts,
    quantity, setQuantity, applyRate, setApplyRate,
    customPrice, setCustomPrice, isCustomPrice,
    currentPrice, addToCart, loading
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);
  useEffect(()=>setApplyRateInput(applyRate),[applyRate]);

  const onApplyRateChange = e => {
    const v=e.target.value;
    if(v===''||/^[0-9]{1,3}$/.test(v)){
      setApplyRateInput(v);
      const num=Number(v);
      if(!isNaN(num)&&num>=0&&num<=200) setApplyRate(num);
    }
  };

  const renderOptionSelect = (name,label,enabled=true,map=null) => {
    const opts=availableOptions[name]||[];
    if(!opts.length) return null;
    return (
      <div style={{minWidth:160}}>
        <label style={{fontWeight:600,fontSize:15,display:'block',marginBottom:4}}>{label}</label>
        <select
          disabled={!enabled||loading}
          value={selectedOptions[name]||''}
          onChange={e=>handleOptionChange(name,e.target.value)}
          style={{width:'100%',height:40,padding:'4px 8px',fontSize:15}}
        >
          <option value="">{label} 선택</option>
          {opts.map(o=><option key={o} value={o}>{map&&map[o]?map[o]:o}</option>)}
        </select>
      </div>
    );
  };

  // 기타 추가 옵션 UI
  let extraCatList=[], extraOptMap={};
  if(extraProducts[selectedType]){
    extraCatList=Object.entries(extraProducts[selectedType]);
    extraOptMap={};
    extraCatList.forEach(([cat, arr])=>{
      arr.forEach(opt=>{
        extraOptMap[opt.id]=opt;
      });
    });
  }

  const toggleExtra = id => {
    if(extraOptions.includes(id)){
      handleExtraOptionChange(extraOptions.filter(e=>e!==id));
    }else{
      handleExtraOptionChange([...extraOptions,id]);
    }
  };

  if(loading) return <div>데이터 로드 중...</div>;

  return (
    <div style={{padding:20,background:'#f8fcff',borderRadius:8,marginBottom:20}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:16,marginBottom:12}}>
        {renderOptionSelect('type','제품 유형',true)}
        {formTypeRacks.includes(selectedType) && (
          <>
            {renderOptionSelect('size','규격')}
            {renderOptionSelect('height','높이',!!selectedOptions.size)}
            {renderOptionSelect('level','단수',!!selectedOptions.size && !!selectedOptions.height)}
            {renderOptionSelect('formType','형식',!!selectedOptions.size&&!!selectedOptions.height&&!!selectedOptions.level)}
          </>
        )}
        {selectedType==='하이랙' && (
          <>
            {renderOptionSelect('color','색상',true,colorLabelMap)}
            {renderOptionSelect('size','규격',!!selectedOptions.color)}
            {renderOptionSelect('height','높이',!!selectedOptions.color&&!!selectedOptions.size)}
            {renderOptionSelect('level','단수',!!selectedOptions.color&&!!selectedOptions.size&&!!selectedOptions.height)}
          </>
        )}
        {selectedType==='스텐랙' && (
          <>
            {renderOptionSelect('size','규격')}
            {renderOptionSelect('height','높이',!!selectedOptions.size)}
            {renderOptionSelect('level','단수',!!selectedOptions.size&&!!selectedOptions.height)}
          </>
        )}
        <div>
          <label>수량</label>
          <input type="number" min={0} value={quantity}
            onChange={e=>setQuantity(Math.max(0,Number(e.target.value)))}
            style={{width:60,marginLeft:4}}/>
        </div>
        <div>
          <label>적용률(%)</label>
          <input type="text" value={applyRateInput} maxLength={3}
            onChange={onApplyRateChange}
            style={{width:50,marginLeft:4}}/>
        </div>
        <div>
          <label>가격 직접입력</label>
          <input type="number" min={0} value={customPrice}
            onChange={e=>{ setCustomPrice(Number(e.target.value)||0); }}
            style={{width:90,marginLeft:4}}/>
        </div>
      </div>

      {extraCatList.length>0 &&
        <div style={{marginTop:8}}>
          <h4 style={{marginBottom:8}}>기타 추가 옵션</h4>
          {extraCatList.map(([cat,arr])=>(
            <div key={cat} style={{marginBottom:6}}>
              <div style={{fontWeight:600,fontSize:15,marginBottom:2}}>{cat}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                {arr.map(opt=>{
                  const checked=extraOptions.includes(opt.id);
                  return (
                    <label key={opt.id} style={{border:'1px solid #ccc',padding:'4px 8px',borderRadius:6,background:checked?'#def':'white',cursor:'pointer'}}>
                      <input type="checkbox" checked={checked} onChange={()=>toggleExtra(opt.id)} style={{marginRight:4}} />
                      {opt.name} {opt.price ? `+${opt.price.toLocaleString()}원` : ''}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      }

      <div style={{marginTop:12,display:'flex',alignItems:'center',gap:16}}>
        <div style={{fontWeight:600}}>계산 가격: {currentPrice.toLocaleString()}원</div>
        {isCustomPrice && <span style={{color:'#406dc1'}}>* 수동 입력 적용</span>}
        <button onClick={addToCart} disabled={!selectedType} style={{padding:'4px 12px',background:'#2556a0',color:'#fff',border:'none',borderRadius:4}}>목록 추가</button>
      </div>
    </div>
  );
}
