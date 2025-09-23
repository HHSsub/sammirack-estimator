import React from 'react';
import { useProducts } from '../contexts/ProductContext';

export default function OptionSelector() {
  const {
    loading,
    allOptions,
    availableOptions,
    selectedType,
    selectedOptions,
    quantity,
    customPrice,
    currentPrice,
    currentBOM,
    canAddItem,
    extraProducts,
    extraOptionsSel,
    customMaterials,
    setSelectedType,
    setSelectedOption,
    setQuantity,
    setCustomPrice,
    addToCart,
    setExtraOptionsSel,
    addCustomMaterial,
    removeCustomMaterial,
    clearCustomMaterials
  } = useProducts();

  if (loading) return <div>데이터를 불러오는 중...</div>;

  // ✅ BOM 총 가격 계산
  const bomTotal = currentBOM.reduce((sum, item) => {
    // 통합 단가 관리 시스템에서 효과적인 단가 가져오기
    let effectivePrice = 0;
    if (typeof window !== 'undefined' && window.getEffectivePrice) {
      effectivePrice = window.getEffectivePrice(item);
    } else {
      effectivePrice = Number(item.unitPrice) || 0;
    }
    return sum + (effectivePrice * (Number(item.quantity) || 0));
  }, 0);

  // ✅ 표시할 가격 결정 (우선순위: 커스텀 > BOM 총액 > 기본가격)
  const displayPrice = customPrice > 0 ? customPrice : (bomTotal > 0 ? bomTotal : currentPrice);
  const priceSource = customPrice > 0 ? 'custom' : (bomTotal > 0 ? 'bom' : 'basic');

  console.log(`💰 OptionSelector 가격 표시: ${displayPrice}원 (출처: ${priceSource}, BOM총액: ${bomTotal}원, 기본가격: ${currentPrice}원)`);

  return (
    <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '16px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#495057' }}>🔧 제품 구성</h3>
      
      {/* 제품 타입 선택 */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>제품 타입:</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            backgroundColor: 'white'
          }}
        >
          <option value="">선택하세요</option>
          {allOptions.types.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* 세부 옵션들 */}
      {selectedType && (
        <>
          {/* 크기 */}
          {availableOptions.size && availableOptions.size.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>크기:</label>
              <select
                value={selectedOptions.size || ''}
                onChange={(e) => setSelectedOption('size', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">선택하세요</option>
                {availableOptions.size.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          )}

          {/* 높이 */}
          {availableOptions.height && availableOptions.height.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>높이:</label>
              <select
                value={selectedOptions.height || ''}
                onChange={(e) => setSelectedOption('height', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">선택하세요</option>
                {availableOptions.height.map(height => (
                  <option key={height} value={height}>{height}</option>
                ))}
              </select>
            </div>
          )}

          {/* 단수 */}
          {availableOptions.level && availableOptions.level.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>단수:</label>
              <select
                value={selectedOptions.level || ''}
                onChange={(e) => setSelectedOption('level', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">선택하세요</option>
                {availableOptions.level.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          )}

          {/* 형식 */}
          {availableOptions.formType && availableOptions.formType.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>형식:</label>
              <select
                value={selectedOptions.formType || ''}
                onChange={(e) => setSelectedOption('formType', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">선택하세요</option>
                {availableOptions.formType.map(formType => (
                  <option key={formType} value={formType}>{formType}</option>
                ))}
              </select>
            </div>
          )}

          {/* 색상 (하이랙용) */}
          {availableOptions.color && availableOptions.color.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>색상:</label>
              <select
                value={selectedOptions.color || ''}
                onChange={(e) => setSelectedOption('color', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">선택하세요</option>
                {availableOptions.color.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          )}

          {/* 수량 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>수량:</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* 커스텀 가격 (선택사항) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              커스텀 가격 (선택사항):
            </label>
            <input
              type="number"
              value={customPrice || ''}
              onChange={(e) => setCustomPrice(Number(e.target.value) || 0)}
              placeholder="직접 입력 (원)"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* 추가 옵션들 */}
          {extraProducts[selectedType] && Object.keys(extraProducts[selectedType]).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>추가 옵션:</label>
              {Object.entries(extraProducts[selectedType]).map(([categoryName, options]) => (
                <div key={categoryName} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#6c757d', marginBottom: '6px' }}>
                    {categoryName}
                  </div>
                  <div style={{ paddingLeft: '12px' }}>
                    {Array.isArray(options) && options.map(opt => {
                      const isSelected = extraOptionsSel.includes(opt.id);
                      return (
                        <label key={opt.id} style={{ 
                          display: 'block', 
                          marginBottom: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExtraOptionsSel(prev => [...prev, opt.id]);
                              } else {
                                setExtraOptionsSel(prev => prev.filter(id => id !== opt.id));
                              }
                            }}
                            style={{ marginRight: '6px' }}
                          />
                          <span style={{ color: isSelected ? '#007bff' : '#495057' }}>
                            {opt.name}
                            {opt.price > 0 && ` +${Number(opt.price).toLocaleString()}원`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))} {/* <-- 이 괄호와 세미콜론이 반드시 있어야 합니다!! */}
            </div>
          )}

          {/* 커스텀 자재 (경량랙용) */}
          {selectedType === "경량랙" && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>커스텀 자재:</label>
              {customMaterials.map(material => (
                <div key={material.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '6px 8px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  fontSize: '13px'
                }}>
                  <span>{material.name}</span>
                  <span style={{ color: '#28a745', fontWeight: '500' }}>
                    +{material.price.toLocaleString()}원
                  </span>
                  <button
                    onClick={() => removeCustomMaterial(material.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '0 4px'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="자재명"
                  id="custom-material-name"
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '3px',
                    fontSize: '12px'
                  }}
                />
                <input
                  type="number"
                  placeholder="가격"
                  id="custom-material-price"
                  style={{
                    width: '80px',
                    padding: '6px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '3px',
                    fontSize: '12px'
                  }}
                />
                <button
                  onClick={() => {
                    const nameInput = document.getElementById('custom-material-name');
                    const priceInput = document.getElementById('custom-material-price');
                    const name = nameInput.value.trim();
                    const price = Number(priceInput.value) || 0;
                    if (name && price > 0) {
                      addCustomMaterial(name, price);
                      nameInput.value = '';
                      priceInput.value = '';
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: '1px solid #28a745',
                    backgroundColor: '#28a745',
                    color: 'white',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  추가
                </button>
              </div>
              {customMaterials.length > 0 && (
                <button
                  onClick={clearCustomMaterials}
                  style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #6c757d',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  전체 삭제
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ✅ 개선된 가격 표시 및 추가 버튼 */}
      <div style={{ 
        marginTop: '20px', 
        padding: '12px', 
        backgroundColor: 'white', 
        borderRadius: '6px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: '#495057',
            marginBottom: '4px'
          }}>
            현재 항목 예상 가격
          </div>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: displayPrice > 0 ? '#28a745' : '#6c757d'
          }}>
            {displayPrice > 0 ? `${displayPrice.toLocaleString()}원` : '가격 미설정'}
          </div>
          
          {/* 가격 출처 표시 */}
          <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
            {priceSource === 'custom' && '커스텀 가격 적용'}
            {priceSource === 'bom' && `BOM 부품 단가 합계 (${currentBOM.length}개 부품)`}
            {priceSource === 'basic' && 'data.json 기본가격 적용'}
            {displayPrice === 0 && '단가가 설정된 부품이 없습니다'}
          </div>

          {/* BOM 세부 정보 */}
          {bomTotal > 0 && currentBOM.length > 0 && (
            <div style={{ 
              fontSize: '11px', 
              color: '#6c757d', 
              marginTop: '6px',
              padding: '6px 8px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px'
            }}>
              <div style={{ fontWeight: '500', marginBottom: '2px' }}>BOM 구성:</div>
              {currentBOM.slice(0, 3).map((item, index) => {
                const effectivePrice = typeof window !== 'undefined' && window.getEffectivePrice
                  ? window.getEffectivePrice(item)
                  : (Number(item.unitPrice) || 0);
                return (
                  <div key={index}>
                    • {item.name}: {item.quantity}개 × {effectivePrice.toLocaleString()}원 = {(effectivePrice * item.quantity).toLocaleString()}원
                  </div>
                );
              })}
              {currentBOM.length > 3 && (
                <div>• 외 {currentBOM.length - 3}개 부품...</div>
              )}
            </div>
          )}
        </div>

        <div style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '12px',
          color: '#495057'
        }}>
          계산 가격: {(customPrice > 0 ? customPrice : currentPrice).toLocaleString()}원
        </div>

        <button 
          onClick={addToCart} 
          disabled={!canAddItem}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: canAddItem ? '#007bff' : '#6c757d',
            color: 'white',
            cursor: canAddItem ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={e => {
            if (canAddItem) {
              e.target.style.backgroundColor = '#0056b3';
            }
          }}
          onMouseOut={e => {
            if (canAddItem) {
              e.target.style.backgroundColor = '#007bff';
            }
          }}
        >
          {canAddItem ? '🛒 목록에 추가' : '❌ 추가 불가 (가격 없음)'}
        </button>

        {/* 추가 안내 메시지 */}
        {!canAddItem && (
          <div style={{ 
            fontSize: '12px', 
            color: '#dc3545', 
            marginTop: '8px',
            textAlign: 'center'
          }}>
            부품 단가가 설정되지 않았거나 필수 옵션이 선택되지 않았습니다.
          </div>
        )}

        {canAddItem && bomTotal > 0 && (
          <div style={{ 
            fontSize: '12px', 
            color: '#28a745', 
            marginTop: '8px',
            textAlign: 'center'
          }}>
            ✅ BOM 부품 단가가 설정되어 추가할 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}
