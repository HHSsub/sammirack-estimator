// src/components/OptionSelector.jsx
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

    // ▶ 추가옵션(체크박스용)
    extraProducts, extraOptionsSel, handleExtraOptionChange,

    // ▶ 경량랙 전용 사용자 정의 자재(여러 개)
    customMaterials, addCustomMaterial, removeCustomMaterial,

    quantity, setQuantity, applyRate, setApplyRate,
    customPrice, setCustomPrice, currentPrice, currentBOM,
    addToCart, loading, canAddItem
  } = useProducts();

  const [applyRateInput, setApplyRateInput] = useState(applyRate);
  const [extraOpen, setExtraOpen] = useState(false);
  const [adminPricesVersion, setAdminPricesVersion] = useState(0);

  // 사용자 정의 입력값(경량랙)
  const [cmName, setCmName] = useState('');
  const [cmPrice, setCmPrice] = useState('');

  useEffect(() => setApplyRateInput(applyRate), [applyRate]);
  
  // ✅ localStorage 변경 감지 (관리자 단가 수정 시 실시간 반영)
  useEffect(() => {
    const handleStorageChange = () => {
      setAdminPricesVersion(prev => prev + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('adminPriceUpdate', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('adminPriceUpdate', handleStorageChange);
    };
  }, []);

  // ✅ 관리자 단가가 반영된 최종 가격 계산 함수 - 기존 currentPrice fallback 추가
  const getFinalPrice = () => {
    if (!currentBOM || currentBOM.length === 0) {
      return currentPrice; // ✅ BOM이 없으면 기존 currentPrice 사용
    }
    
    let hasAdminPrice = false;
    let totalPrice = 0;
    
    currentBOM.forEach(item => {
      const adminPrice = localStorage.getItem(`adminPrice_${item.id}`);
      if (adminPrice !== null && !isNaN(parseInt(adminPrice))) {
        hasAdminPrice = true;
        totalPrice += parseInt(adminPrice) * item.quantity;
      } else {
        totalPrice += (item.price || 0) * (item.quantity || 0);
      }
    });
    
    // ✅ 관리자 단가가 하나도 없거나 계산 결과가 0이면 기존 currentPrice 사용
    return (hasAdminPrice && totalPrice > 0) ? totalPrice : currentPrice;
  };
  
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
      <div>
        <label>{label}</label>
        <select
          disabled={!enabled || loading}
          value={selectedOptions[name] || ''}
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

  const toggleExtra = id => {
    if (!id) return;
    if (extraOptionsSel.includes(id)) {
      handleExtraOptionChange(extraOptionsSel.filter(e => e !== id));
    } else {
      handleExtraOptionChange([...extraOptionsSel, id]);
    }
  };

  if (loading) return <div>데이터 로드 중...</div>;

  // 현재 타입의 extra 옵션 카테고리
  const extraCatList =
    extraProducts && selectedType && extraProducts[selectedType]
      ? Object.entries(extraProducts[selectedType])
      : [];

  // 가격 표시 여부 결정 - 필수 옵션이 모두 선택된 경우만 표시
  const showPrice = selectedType && (
    (formTypeRacks.includes(selectedType) && 
     selectedOptions.size && selectedOptions.height && 
     selectedOptions.level && selectedOptions.formType) ||
    (selectedType === '하이랙' && 
     selectedOptions.color && selectedOptions.size && 
     selectedOptions.height && selectedOptions.level && 
     selectedOptions.formType) ||
    (selectedType === '스텐랙' && 
     selectedOptions.size && selectedOptions.height && 
     selectedOptions.level)
  );

  // ✅ 최종 가격 (관리자 단가 우선 적용, 없으면 기존 currentPrice 사용)
  const finalPrice = getFinalPrice();
  const displayPrice = customPrice > 0 ? customPrice : finalPrice;

  return (
    <div style={{ padding: 20, background: '#f8fcff', borderRadius: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label>제품 유형</label>
            <select
              value={selectedType}
              onChange={e => {
                setExtraOpen(false);
                handleOptionChange('type', e.target.value);
              }}
            >
            <option value="">제품 유형 선택</option>
            {allOptions.types.map(t => (
              <option key={t} value={t}>
                {kgLabelFix(t)}
              </option>
            ))}
          </select>
        </div>

        {formTypeRacks.includes(selectedType) && (
          <>
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이', !!selectedOptions.size)}
            {renderOptionSelect(
              'level',
              '단수',
              !!selectedOptions.size && !!selectedOptions.height
            )}
            {renderOptionSelect(
              'formType',
              '형식',
              !!selectedOptions.size &&
              !!selectedOptions.height &&
              !!selectedOptions.level
            )}
          </>
        )}

        {selectedType === '하이랙' && (
          <>
            {renderOptionSelect('color', '색상', true, colorLabelMap)}
            {renderOptionSelect('size', '규격', !!selectedOptions.color)}
            {renderOptionSelect(
              'height',
              '높이',
              !!selectedOptions.color && !!selectedOptions.size
            )}
            {renderOptionSelect(
              'level',
              '단수',
              !!selectedOptions.color &&
              !!selectedOptions.size &&
              !!selectedOptions.height
            )}
            {/* 하이랙 형식: availableOptions에 없어도 Fallback 렌더 */}
            {availableOptions.formType?.length
              ? renderOptionSelect(
                'formType',
                '형식',
                !!selectedOptions.color &&
                !!selectedOptions.size &&
                !!selectedOptions.height &&
                !!selectedOptions.level
              )
              : (
                <div>
                  <label>형식</label>
                  <select
                    disabled={
                      !(
                        selectedOptions.color &&
                        selectedOptions.size &&
                        selectedOptions.height &&
                        selectedOptions.level
                      ) || loading
                    }
                    value={selectedOptions.formType || ''}
                    onChange={e => handleOptionChange('formType', e.target.value)}
                  >
                    <option value="">형식 선택</option>
                    <option value="독립형">독립형</option>
                    <option value="연결형">연결형</option>
                  </select>
                </div>
              )}
          </>
        )}

        {selectedType === '스텐랙' && (
          <>
            {renderOptionSelect('size', '규격')}
            {renderOptionSelect('height', '높이', !!selectedOptions.size)}
            {renderOptionSelect(
              'level',
              '단수',
              !!selectedOptions.size && !!selectedOptions.height
            )}
          </>
        )}

        <div>
          <label>수량</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
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

      <button
        onClick={() => setExtraOpen(o => !o)}
        style={{ margin: '10px 0' }}
        disabled={!selectedType}
      >
        {extraOpen ? '기타 추가 옵션 닫기' : '기타 추가 옵션 열기'}
      </button>

      {extraOpen && selectedType && (
        <>
          {selectedType === '경량랙' ? (
            <div
              style={{
                padding: '12px',
                border: '1px solid #e4eef8',
                borderRadius: 6,
                background: '#fff',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                사용자 정의 추가자재 (여러개)
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 80px',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
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

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f7fd' }}>
                    <th style={{ border: '1px solid #e1e8f5', padding: '6px' }}>
                      항목명
                    </th>
                    <th
                      style={{
                        border: '1px solid #e1e8f5',
                        padding: '6px',
                        width: 140,
                      }}
                    >
                      단가
                    </th>
                    <th
                      style={{
                        border: '1px solid #e1e8f5',
                        padding: '6px',
                        width: 80,
                      }}
                    >
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customMaterials.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          border: '1px solid #e1e8f5',
                          padding: '8px',
                          textAlign: 'center',
                          color: '#8aa1c4',
                        }}
                      >
                        추가된 자재가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    customMaterials.map(m => (
                      <tr key={m.id}>
                        <td style={{ border: '1px solid #e1e8f5', padding: '6px' }}>
                          {m.name}
                        </td>
                        <td style={{ border: '1px solid #e1e8f5', padding: '6px' }}>
                          {Number(m.price).toLocaleString()}원
                        </td>
                        <td style={{ border: '1px solid #e1e8f5', padding: '6px' }}>
                          <button
                            type="button"
                            onClick={() => removeCustomMaterial(m.id)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: '12px',
                border: '1px solid #e4eef8',
                borderRadius: 6,
                background: '#fff',
              }}
            >
              {extraCatList.length === 0 ? (
                <div style={{ color: '#8aa1c4' }}>추가 옵션이 없습니다.</div>
              ) : (
                extraCatList.map(([cat, arr]) => (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{cat}</div>
                    {arr.map(opt => {
                      const checked = extraOptionsSel.includes(opt.id);
                      return (
                        <label key={opt.id} style={{ display: 'block', margin: '4px 0' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleExtra(opt.id)}
                          />
                          <span style={{ marginLeft: 6 }}>
                            {kgLabelFix(opt.name)}{' '}
                            {opt.price ? `+${Number(opt.price).toLocaleString()}원` : ''}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {showPrice && (
        <div style={{ marginTop: 12 }}>
          {/* ✅ 관리자 단가가 반영된 최종 가격 표시, 없으면 기존 currentPrice 사용 */}
          <span>
            계산 가격: {(displayPrice > 0) ? displayPrice.toLocaleString() : '0'}원
          </span>
          {finalPrice !== currentPrice && finalPrice > 0 && (
            <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
              (관리자 수정 단가 반영됨)
            </span>
          )}
          <button onClick={addToCart} disabled={!canAddItem} style={{ marginLeft: 10 }}>
            목록 추가
          </button>
        </div>
      )}
    </div>
  );
}
