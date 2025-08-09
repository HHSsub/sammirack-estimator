import React from 'react';
import { useProducts } from '../contexts/ProductContext';

export default function OptionSelector() {
  const { productsData, selections, updateSelection, loading } = useProducts();

  if (loading) return <p>로딩 중...</p>;
  if (!productsData) return <p>데이터 없음</p>;

  // 랙 종류 목록
  const rackTypes = Object.keys(productsData);

  // 선택된 랙 종류에 따른 옵션 목록
  const sizeOptions = selections.type ? Object.keys(productsData[selections.type] || {}) : [];
  const heightOptions = selections.size ? Object.keys(productsData[selections.type]?.[selections.size] || {}) : [];
  const levelOptions = selections.height ? Object.keys(productsData[selections.type]?.[selections.size]?.[selections.height] || {}) : [];

  // ExtraOptions 예시 (스텐랙/하이랙)
  const extraColors = selections.type === '하이랙' ? ['200kg 일반형', '350kg', '700kg'] : [];
  const extraSizesSten = selections.type === '스텐랙' ? ['50x210', '60x180'] : [];

  return (
    <div className="option-selector">
      <div>
        <label>랙 종류</label>
        <select value={selections.type} onChange={e => updateSelection('type', e.target.value)}>
          <option value="">선택</option>
          {rackTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      {sizeOptions.length > 0 && (
        <div>
          <label>사이즈</label>
          <select value={selections.size} onChange={e => updateSelection('size', e.target.value)}>
            <option value="">선택</option>
            {sizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
            {extraSizesSten.map(size => <option key={size} value={size}>{size} (추가)</option>)}
          </select>
        </div>
      )}

      {heightOptions.length > 0 && (
        <div>
          <label>높이</label>
          <select value={selections.height} onChange={e => updateSelection('height', e.target.value)}>
            <option value="">선택</option>
            {heightOptions.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      )}

      {levelOptions.length > 0 && (
        <div>
          <label>단 수</label>
          <select value={selections.level} onChange={e => updateSelection('level', e.target.value)}>
            <option value="">선택</option>
            {levelOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}

      {extraColors.length > 0 && (
        <div>
          <label>색상/하중</label>
          <select value={selections.color} onChange={e => updateSelection('color', e.target.value)}>
            <option value="">선택</option>
            {extraColors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      <div>
        <label>수량</label>
        <input
          type="number"
          min="1"
          value={selections.quantity}
          onChange={e => updateSelection('quantity', parseInt(e.target.value, 10) || 1)}
        />
      </div>

      <div>
        <label>적용율(%)</label>
        <input
          type="number"
          min="0"
          value={selections.applyRate}
          onChange={e => updateSelection('applyRate', parseInt(e.target.value, 10) || 0)}
        />
      </div>
    </div>
  );
}
