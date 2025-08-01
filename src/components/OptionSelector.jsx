import React from 'react';
import { useProducts } from '../contexts/ProductContext';
import { validateRate } from '../utils/priceUtils';

// 스텐랙 전용 옵션
const STAINLESS_VERSIONS = ['기본형 V1', '기본형 V2', '기본형 V3'];
const STAINLESS_SIZES = ['50x75', '50x90', '50x120', '50x150', '50x180'];
const STAINLESS_HEIGHTS = ['75', '90', '120', '150', '180', '200', '210'];
const STAINLESS_LEVELS = ['1단', '2단', '3단', '4단', '5단', '6단'];

// 하이랙 전용 옵션
const HIGHRACK_COLORS = [
  "메트그레이(볼트식)200kg",
  "메트그레이(볼트식)350kg",
  "블루(기둥)+오렌지(가로대)(볼트식)200kg",
  "블루(기둥)+오렌지(가로대)(볼트식)350kg",
  "블루(기둥.선반)+오렌지(빔)700kg"
];
const HIGHRACK_SIZES = ['45x108', '45x150', '60x108', '60x150', '80x146', '80x210'];
const HIGHRACK_HEIGHTS = ['150', '200', '250'];
const HIGHRACK_LEVELS = ['5단', '6단', '7단'];

function OptionSelector() {
  const { loading, selections, setSelections, isCustomPriceMode } = useProducts();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelections(prev => {
      let newSelections = { ...prev, [name]: value };

      if (name === 'type') {
        newSelections = {
          ...newSelections,
          version: '',
          color: '',
          size: '',
          height: '',
          level: '',
          customPrice: null
        };
      }
      if (['color', 'size', 'height'].includes(name)) {
        newSelections = { ...newSelections, level: '', customPrice: null };
      }
      if (name === 'level') {
        newSelections = { ...newSelections, customPrice: null };
      }
      if (name === 'quantity') {
        newSelections.quantity = parseInt(value, 10) || 1;
      }
      if (name === 'applyRate') {
        newSelections.applyRate = validateRate(value);
      }
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
          <option value="스텐랙">스텐랙</option>
          <option value="하이랙">하이랙</option>
        </select>
      </div>

      {/* 스텐랙일 때 버전, 하이랙일 때 색상 */}
      {selections.type === '스텐랙' && (
        <div className="form-group">
          <label>버전:</label>
          <select name="version" value={selections.version} onChange={handleChange}>
            <option value="">선택하세요</option>
            {STAINLESS_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}
      {selections.type === '하이랙' && (
        <div className="form-group">
          <label>색상/타입:</label>
          <select name="color" value={selections.color} onChange={handleChange}>
            <option value="">선택하세요</option>
            {HIGHRACK_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* 규격 (size) */}
      <div className="form-group">
        <label>규격:</label>
        <select
          name="size"
          value={selections.size}
          onChange={handleChange}
          disabled={!selections.type}
        >
          <option value="">선택하세요</option>
          {selections.type === '스텐랙' &&
            STAINLESS_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          {selections.type === '하이랙' &&
            HIGHRACK_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* 높이 */}
      <div className="form-group">
        <label>높이:</label>
        <select
          name="height"
          value={selections.height}
          onChange={handleChange}
          disabled={!selections.size}
        >
          <option value="">선택하세요</option>
          {selections.type === '스텐랙' &&
            STAINLESS_HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
          {selections.type === '하이랙' &&
            HIGHRACK_HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      {/* 단수 */}
      <div className="form-group">
        <label>단수:</label>
        <select
          name="level"
          value={selections.level}
          onChange={handleChange}
          disabled={!selections.height}
        >
          <option value="">선택하세요</option>
          {selections.type === '스텐랙' &&
            STAINLESS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          {selections.type === '하이랙' &&
            HIGHRACK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* 수량 */}
      <div className="form-group">
        <label>수량:</label>
        <input
          type="number"
          min="1"
          name="quantity"
          value={selections.quantity || 1}
          onChange={handleChange}
        />
      </div>

      {/* 적용률 */}
      <div className="form-group">
        <label>적용률 (%):</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          name="applyRate"
          value={selections.applyRate ?? 100}
          onChange={handleChange}
          placeholder="100"
        />
      </div>

      {/* JSON에 없는 옵션 선택 시 직접 가격 입력 */}
      {isCustomPriceMode && (
        <div className="form-group">
          <label>직접 입력 가격 (원):</label>
          <input
            type="number"
            min="0"
            name="customPrice"
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
