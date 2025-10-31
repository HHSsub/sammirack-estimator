// src/components/OptionSelector.jsx
import React, { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductContext';
import { loadExtraOptionsPrices } from '../utils/unifiedPriceManager'; 

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
  const [extraOptionsPrices, setExtraOptionsPrices] = useState({});
  const [realTimePrice, setRealTimePrice] = useState(currentPrice);

  // 사용자 정의 입력값(경량랙)
  const [cmName, setCmName] = useState('');
  const [cmPrice, setCmPrice] = useState('');

  useEffect(() => setApplyRateInput(applyRate), [applyRate]);

  // 추가옵션 가격 로드
  useEffect(() => {
    loadExtraOptionsData();
  }, []);
  
  // 추가옵션 가격 변경 이벤트 리스너 추가
  useEffect(() => {
    const handleExtraOptionsChange = () => {
      console.log('OptionSelector: 추가옵션 가격 변경 감지');
      loadExtraOptionsData();
    };
  
    window.addEventListener('extraOptionsPriceChanged', handleExtraOptionsChange);
    window.addEventListener('adminPriceChanged', handleExtraOptionsChange);
    
    return () => {
      window.removeEventListener('extraOptionsPriceChanged', handleExtraOptionsChange);
      window.removeEventListener('adminPriceChanged', handleExtraOptionsChange);
    };
  }, []);
  
  // 추가옵션 가격 로드 함수
  const loadExtraOptionsData = () => {
    try {
      const prices = loadExtraOptionsPrices();
      setExtraOptionsPrices(prices);
      console.log('OptionSelector: 추가옵션 가격 로드 완료', Object.keys(prices).length);
    } catch (error) {
      console.error('추가옵션 가격 로드 실패:', error);
      setExtraOptionsPrices({});
    }
  };
  
  // 추가옵션의 실제 가격 계산 (관리자 수정 단가 반영)
  const getExtraOptionPrice = (opt) => {
    const adminPrice = extraOptionsPrices[opt.id]?.price;
    if (adminPrice && adminPrice > 0) {
      return adminPrice;
    }
    return Number(opt.price) || 0;
  };
    
  // 관리자 단가가 반영된 실시간 가격 계산 (fallback 포함)
  const calculateRealTimePrice = () => {
    if (!currentBOM || currentBOM.length === 0) {
      return currentPrice; // BOM이 없으면 기본 가격 사용
    }
    
    let totalPrice = 0;
    let hasAdminPrice = false;
    
    currentBOM.forEach(item => {
      const adminPrice = localStorage.getItem(`adminPrice_${item.id}`);
      if (adminPrice !== null && !isNaN(parseInt(adminPrice)) && parseInt(adminPrice) > 0) {
        hasAdminPrice = true;
        totalPrice += parseInt(adminPrice) * (item.quantity || 0);
      } else {
        // 관리자 단가가 없으면 기본 item.price 사용
        totalPrice += (item.price || 0) * (item.quantity || 0);
      }
    });
    
    // 관리자 단가가 있고 유효하면 사용, 아니면 기본 currentPrice 사용 (fallback)
    return (hasAdminPrice && totalPrice > 0) ? totalPrice : currentPrice;
  };

  // 최종 표시 가격 계산 - 정확한 우선순위 적용
  const getFinalDisplayPrice = () => {
    // 1순위: customPrice (가격 직접입력)
    if (customPrice > 0) {
      return customPrice;
    }
    
    // 2순위: 관리자 단가 (실시간 계산된 가격)
    const adminAdjustedPrice = calculateRealTimePrice();
    if (adminAdjustedPrice > 0 && !isNaN(adminAdjustedPrice)) {
      return adminAdjustedPrice;
    }
    
    // 3순위: 기본 가격 (currentPrice) - 최종 fallback
    return currentPrice > 0 ? currentPrice : 0;
  };

  // 실시간 가격 업데이트
  useEffect(() => {
    const updatePrice = () => {
      const newPrice = calculateRealTimePrice();
      setRealTimePrice(newPrice);
    };
    
    // 초기 계산
    updatePrice();
    
    // localStorage 변경 감지
    const handleStorageChange = () => {
      updatePrice();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('adminPriceUpdate', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('adminPriceUpdate', handleStorageChange);
    };
  }, [currentBOM, currentPrice]);

  // currentBOM 변경 시에도 가격 재계산
  useEffect(() => {
    const newPrice = calculateRealTimePrice();
    setRealTimePrice(newPrice);
  }, [currentBOM]);
  
  const onApplyRateChange = e => {
    const v = e.target.value;
    if (v === '' || /^[0-9]{1,3}$/.test(v)) {
      setApplyRateInput(v);
      const num = Number(v);
      if (!isNaN(num) && num >= 0 && num <= 200) setApplyRate(num);
    }
  };

  // 수량 입력 핸들러 수정
  const handleQuantityChange = (e) => {
    const value = e.target.value;
    
    // 빈 값이면 그대로 허용
    if (value === '') {
      setQuantity('');
      return;
    }
    
    const numValue = Number(value);
    
    // 숫자가 아니거나 음수면 무시
    if (isNaN(numValue) || numValue < 0) {
      return;
    }
    
    setQuantity(value);
  };

  // 수량 입력 완료 시 (focus out)
  const handleQuantityBlur = (e) => {
    const value = e.target.value;
    
    // 빈 값이거나 0이면 1로 설정
    if (value === '' || Number(value) <= 0) {
      setQuantity('1');
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

  console.log('🔍 추가옵션 디버깅:', {
    selectedType,
    extraProducts,
    extraProductsForType: extraProducts[selectedType],
    extraCatList,
    extraCatListLength: extraCatList.length
  });
    
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
            onChange={handleQuantityChange}
            onBlur={handleQuantityBlur}
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
        {extraOpen ? '추가옵션 숨기기' : '추가옵션 보기'}
      </button>

      {extraOpen && selectedType && (
        <div>
          {/* 추가옵션 표시 로직 */}
          {extraCatList.length > 0 && (
            <div>
              <h4>추가옵션</h4>
              {extraCatList.map(([cat, arr]) => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
                    {cat}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Array.isArray(arr) && arr.map(opt => {
                      const isChecked = extraOptionsSel.includes(opt.id);
                      const effectivePrice = getExtraOptionPrice(opt);
                      const isModified = extraOptionsPrices[opt.id] && extraOptionsPrices[opt.id].price > 0;
                      
                      return (
                        <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleExtra(opt.id)}
                          />
                          <span>
                            {opt.name}
                            {effectivePrice > 0 && (
                              <span style={{ 
                                fontSize: '12px', 
                                marginLeft: '4px',
                                color: isModified ? '#dc3545' : '#666',
                                fontWeight: isModified ? '600' : 'normal'
                              }}>
                                +{effectivePrice.toLocaleString()}원
                                {isModified && ' (수정됨)'}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 경량랙 커스텀 자재 */}
          {selectedType === '경량랙' && (
            <div style={{ marginTop: 12 }}>
              <h4>사용자 정의 자재</h4>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  placeholder="자재명"
                  value={cmName}
                  onChange={e => setCmName(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="가격"
                  value={cmPrice}
                  onChange={e => setCmPrice(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (cmName.trim() && Number(cmPrice) > 0) {
                      addCustomMaterial(cmName.trim(), Number(cmPrice));
                      setCmName('');
                      setCmPrice('');
                    }
                  }}
                >
                  추가
                </button>
              </div>
              {customMaterials.length > 0 && (
                <ul>
                  {customMaterials.map(m => (
                    <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{m.name}: {Number(m.price).toLocaleString()}원</span>
                      <button onClick={() => removeCustomMaterial(m.id)}>삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {showPrice && (
        <div style={{ marginTop: 12 }}>
          <span>
            계산 가격: {getFinalDisplayPrice().toLocaleString()}원
          </span>
          {customPrice > 0 && (
            <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
              (직접입력 가격 적용됨)
            </span>
          )}
          {customPrice === 0 && realTimePrice !== currentPrice && realTimePrice > 0 && (
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
