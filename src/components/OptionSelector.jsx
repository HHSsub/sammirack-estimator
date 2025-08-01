import React from 'react';
import { useProducts } from '../contexts/ProductContext';
import { validateRate } from '../utils/priceUtils';

// 실제 rackData.json과 맞춘 옵션 목록입니다. 필요 시 확장/변경하세요.
const ALL_TYPES = ['스텐랙', '하이랙'];
const ALL_VERSIONS = ['기본형 V1', '기본형 V2', '기본형 V3'];
const ALL_COLORS = [
  "메트그레이(볼트식)200kg",
  "메트그레이(볼트식)350kg",
  "블루(기둥)+오렌지(가로대)(볼트식)200kg",
  "블루(기둥)+오렌지(가로대)(볼트식)350kg",
  "블루(기둥.선반)+오렌지(빔)700kg"
];
const ALL_SIZES = ['50x75', '50x90', '50x120', '50x150', '50x180', '45x108', '45x200', '60x108', '60x150', '60x200', '80x146', '80x206'];
const ALL_HEIGHTS = ['75', '90', '120', '150', '180', '200', '250'];
const ALL_LEVELS = ['1단', '2단', '3단', '4단', '5단', '6단'];

function OptionSelector() {
  const { loading, selections, setSelections, isCustomPriceMode } = useProducts();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelections(prev => {
      let newSelections = { ...prev, [name]: value };

      // type 변경 시 버전/색상/size/height/level/customPrice 초기화
      if (name === 'type') {
        newSelections = { ...newSelections, version: '', color: '', size: '', height: '', level: '', customPrice: null };
      }
      // 컬러, 사이즈, 높이 변경 시 level/customPrice 초기화
      if (['color', 'size', 'height'].includes(name)) {
        newSelections = { ...newSelections, level: '', customPrice: null };
      }
      // level 변경 시 customPrice 초기화
      if (name === 'level') {
        newSelections = { ...newSelections, customPrice: null };
      }
      // 수량은 숫자 변환
      if (name === 'quantity') {
        newSelections.quantity = parseInt(value, 10) || 1;
      }
      // 적용률 검증
      if (name === 'applyRate') {
        newSelections.applyRate = validateRate(value);
      }
      // customPrice 숫자 변환, null 가능
      if (name === 'customPrice') {
        newSelections.customPrice = value === '' ? null : Number(value);
      }

      return newSelections;
    });
  };

  if (loading) return <p>데이터를 불러오는 중...</p>;

  return (
    <div className="product-selection grid grid-cols-2 gap-4">
      {/* 제품 유형 */}
      <div className="form-group">
        <label>제품 유형:</label>
        <select name="type" value={selections.type} onChange={handleChange}>
          <option value="">선택하세요</option>
          {ALL_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
        </select>
      </div>

      {/* 버전 (스텐랙) */}
      {selections.type === '스텐랙' && (
        <div className="form-group">
          <label>버전:</label>
          <select name="version" value={selections.version} onChange={handleChange}>
            <option value="">선택하세요</option>
            {ALL_VERSIONS.map(v => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>
      )}

      {/* 색상 (하이랙) */}
      {selections.type === '하이랙' && (
        <div className="form-group">
          <label>색상/타입:</label>
          <select name="color" value={selections.color} onChange={handleChange}>
            <option value="">선택하세요</option>
            {ALL_COLORS.map(c => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
      )}

      {/* 규격(사이즈) */}
      <div className="form-group">
        <label>규격:</label>
        <select name="size" value={selections.size} onChange={handleChange}>
          <option value="">선택하세요</option>
          {ALL_SIZES.map(s => (<option key={s} value={s}>{s}</option>))}
        </select>
      </div>

      {/* 높이 */}
      <div className="form-group">
        <label>높이:</label>
        <select name="height" value={selections.height} onChange={handleChange}>
          <option value="">선택하세요</option>
          {ALL_HEIGHTS.map(h => (<option key={h} value={h}>{h}</option>))}
        </select>
      </div>

      {/* 단수 */}
      <div className="form-group">
        <label>단수:</label>
        <select name="level" value={selections.level} onChange={handleChange}>
          <option value="">선택하세요</option>
          {ALL_LEVELS.map(l => (<option key={l} value={l}>{l}</option>))}
        </select>
      </div>

      {/* 수량 */}
      <div className="form-group">
        <label>수량:</label>
        <input type="number" name="quantity" min="1" value={selections.quantity} onChange={handleChange} />
      </div>

      {/* 적용률 */}
      <div className="form-group">
        <label>적용률 (%):</label>
        <input
          type="number"
          name="applyRate"
          min="0"
          max="100"
          step="0.1"
          value={selections.applyRate ?? 100}
          onChange={handleChange}
          placeholder="100"
        />
      </div>

      {/* JSON에 없는 옵션 선택시 직접 가격 입력 */}
      {isCustomPriceMode && (
        <div className="form-group">
          <label>직접 입력 가격 (원):</label>
          <input
            type="number"
            name="customPrice"
            min="0"
            value={selections.customPrice ?? ''}
            onChange={handleChange}
            placeholder="가격을 입력하세요"
          />
        </div>
      )}
    </div>
  );
}

export default OptionSelector;
