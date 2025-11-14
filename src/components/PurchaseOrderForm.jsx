import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { exportToExcel, generateFileName } from '../utils/excelExport';
import { loadAdminPricesDirect, resolveAdminPrice, generatePartId } from '../utils/adminPriceHelper';
import { deductInventoryOnPrint, showInventoryResult } from './InventoryManager';
import '../styles/PurchaseOrderForm.css';
import { generateInventoryPartId } from '../utils/unifiedPriceManager';

const PROVIDER = {
  bizNumber: '232-81-01750',
  companyName: '삼미앵글랙산업',
  ceo: '박이삭',
  address: '경기도 광명시 원노온사로 39, 철제 스틸하우스 1',
  homepage: 'http://www.ssmake.com',
  tel: '010-9548-9578  010-4311-7733',
  fax: '(02)2611-4595',
  stampImage: `${import.meta.env.BASE_URL}images/도장.png`
};

const PurchaseOrderForm = () => {
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;

  const documentNumberInputRef = useRef(null);
  const adminPricesRef = useRef({}); // 최신 관리자 단가 캐시

  const cartData = location.state || {};
  const { cart = [], totalBom = [] } = cartData;

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    documentNumber: '',
    orderNumber: '',
    companyName: '',
    bizNumber: '',
    items: [
      { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    materials: [],
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    notes: '',
    topMemo: ''
  });

  // 관리자 단가 로드
  useEffect(() => {
    adminPricesRef.current = loadAdminPricesDirect();
  }, []);

  // 기존 저장 문서 로드
  useEffect(() => {
    if (isEditMode && id) {
      const storageKey = `purchase_${id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { setFormData(JSON.parse(saved)); } catch {}
      }
    }
  }, [id, isEditMode]);

  // 초기 cart / BOM 반영 (관리자 단가 재적용)
  useEffect(() => {
    if (!isEditMode && cart.length > 0) {
      adminPricesRef.current = loadAdminPricesDirect(); // 혹시 직전 수정 직후일 수 있으니 재로드
      const cartItems = cart.map(item => {
        const qty = item.quantity || 1;
        const unitPrice = Math.round((item.price || 0) / (qty || 1));
        return {
          name: item.displayName || item.name || '',
            unit: '개',
            quantity: qty,
            unitPrice,
            totalPrice: unitPrice * qty,
            note: ''
        };
      });

      const bomMaterials = (totalBom || []).map(m => {
        const adminPrice = resolveAdminPrice(adminPricesRef.current, m);
        const appliedUnitPrice = (adminPrice && adminPrice > 0)
          ? adminPrice
          : (Number(m.unitPrice) || 0);
        const quantity = Number(m.quantity) || 0;
        return {
          name: m.name,
          rackType: m.rackType,
          specification: m.specification || '',
          quantity,
          unitPrice: appliedUnitPrice,
          totalPrice: appliedUnitPrice * quantity,
          note: m.note || ''
        };
      });

      setFormData(prev => ({
        ...prev,
        items: cartItems.length ? cartItems : prev.items,
        materials: bomMaterials.length ? bomMaterials : prev.materials
      }));
    }
  }, [cart, totalBom, isEditMode]);

  // 합계 계산 (BOM 우선: BOM 항목 있고 실합계>0 → matSum, 아니면 itemSum)
  useEffect(() => {
    // 관리자 단가 재반영 (사용자가 폼에서 수량 수정 시 단가 유지)
    const materialsWithAdmin = formData.materials.map(mat => {
      const adminPrice = resolveAdminPrice(adminPricesRef.current, mat);
      const quantity = Number(mat.quantity) || 0;
      const unitPrice = adminPrice && adminPrice > 0 ? adminPrice : (Number(mat.unitPrice) || 0);
      return {
        ...mat,
        unitPrice,
        totalPrice: unitPrice * quantity
      };
    });

    const itemSum = formData.items.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const matSum = materialsWithAdmin.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const subtotal = (materialsWithAdmin.length > 0 && matSum > 0) ? matSum : itemSum;
    const tax = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + tax;

    if (JSON.stringify(materialsWithAdmin) !== JSON.stringify(formData.materials)) {
      setFormData(prev => ({
        ...prev,
        materials: materialsWithAdmin,
        subtotal,
        tax,
        totalAmount
      }));
    } else {
      setFormData(prev => ({ ...prev, subtotal, tax, totalAmount }));
    }
  }, [formData.items, formData.materials]);

  const updateFormData = (f, v) => setFormData(prev => ({ ...prev, [f]: v }));

  // 품목 편집
  const updateItem = (idx, f, v) => {
    const items = [...formData.items];
    items[idx][f] = v;
    if (f === 'quantity' || f === 'unitPrice') {
      const q = parseFloat(items[idx].quantity) || 0;
      const u = parseFloat(items[idx].unitPrice) || 0;
      items[idx].totalPrice = q * u;
    }
    setFormData(prev => ({ ...prev, items }));
  };
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name:'', unit:'', quantity:'', unitPrice:'', totalPrice:'', note:'' }]
    }));
  };
  const removeItem = (idx) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  // BOM 자재 편집 (관리자 단가 적용 유지: 사용자가 단가 직접 바꾸면 수동 단가로 덮어씀)
  const updateMaterial = (idx, f, v) => {
    const materials = [...formData.materials];
    materials[idx][f] = v;
    if (f === 'quantity' || f === 'unitPrice') {
      const q = parseFloat(materials[idx].quantity) || 0;
      const u = parseFloat(materials[idx].unitPrice) || 0;
      materials[idx].totalPrice = q * u;
    }
    setFormData(prev => ({ ...prev, materials }));
  };
  const addMaterial = () => {
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, { name:'', specification:'', quantity:'', unitPrice:'', totalPrice:'', note:'' }]
    }));
  };
  const removeMaterial = (idx) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력하세요.');
      documentNumberInputRef.current?.focus();
      return;
    }
    const itemId = isEditMode ? id : Date.now();
    const storageKey = `purchase_${itemId}`;
    const newOrder = {
      ...formData,
      id: itemId,
      type: 'purchase',
      status: formData.status || '진행 중',
      purchaseNumber: formData.documentNumber,
      customerName: formData.companyName,
      productType: formData.items[0]?.name || '',
      quantity: formData.items.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0),
      unitPrice: formData.items[0] ? (parseInt(formData.items[0].unitPrice) || 0) : 0,
      totalPrice: formData.totalAmount,
      updatedAt: new Date().toISOString(),
      ...(isEditMode ? {} : { createdAt: new Date().toISOString() })
    };
    localStorage.setItem(storageKey, JSON.stringify(newOrder));
    alert(isEditMode ? '청구서가 수정되었습니다.' : '청구서가 저장되었습니다.');
  };

  const handleExportToExcel = () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      return;
    }
    exportToExcel(formData, 'purchase')
      .then(()=>alert('엑셀 파일이 다운로드되었습니다.'))
      .catch(e=>{
        console.error(e);
        alert('엑셀 다운로드 오류');
      });
  };

const handlePrint = async () => {
  if (!formData.documentNumber.trim()) {
    alert('거래번호(문서번호)를 입력해주세요.');
    documentNumberInputRef.current?.focus();
    return;
  }

  // ✅ 1단계: 재고 부족 여부만 먼저 체크 (실제 감소는 안 함)
  if (cart && cart.length > 0) {
    // ✅ 재고 체크만 수행 (감소는 나중에)
    const checkResult = await checkInventoryAvailability(cart);
    
    // 재고 부족 경고가 있는 경우
    if (checkResult.warnings && checkResult.warnings.length > 0) {
      const shortageList = checkResult.warnings
        .slice(0, 5)
        .map(w => `• ${w.name} (${w.specification || ''}): 필요 ${w.required}개, 가용 ${w.available}개`)
        .join('\n');
      
      const message = checkResult.warnings.length > 5
        ? `⚠️ 재고 부족 경고 (${checkResult.warnings.length}개 부품)\n\n${shortageList}\n... 외 ${checkResult.warnings.length - 5}개\n\n계속 진행하시겠습니까?`
        : `⚠️ 재고 부족 경고\n\n${shortageList}\n\n계속 진행하시겠습니까?`;
      
      const userChoice = window.confirm(
        message + '\n\n확인 = 무시하고 인쇄\n취소 = 인쇄 중단'
      );
      
      if (!userChoice) {
        alert('인쇄가 취소되었습니다.\n재고는 감소되지 않았습니다.');
        return;  // ✅ 여기서 return하면 재고 감소 안 됨
      }
    }
  }

  // ✅ 2단계: 브라우저 인쇄 다이얼로그 표시
  window.print();

  // ✅ 3단계: 인쇄 다이얼로그가 닫힌 후에만 재고 감소
  // (사용자가 인쇄 다이얼로그에서 "취소"를 누르면 재고 감소 안 됨)
  
  // ⚠️ 중요: window.print()는 동기 함수이지만 다이얼로그 결과를 알 수 없음
  // 따라서 "인쇄 완료" 확인 후 재고 감소 진행
  
  setTimeout(async () => {
    const confirmDeduct = window.confirm(
      '인쇄가 완료되었습니까?n확인 = 재고 감소\n취소 = 재고 유지'
    );
    
    if (confirmDeduct && cart && cart.length > 0) {
      const result = await deductInventoryOnPrint(cart, '청구서', formData.documentNumber);
      
      if (result.success) {
        if (result.warnings && result.warnings.length > 0) {
          alert(`✅ 재고가 감소되었습니다.\n⚠️ ${result.warnings.length}개 부품 재고 부족`);
        } else {
          alert('✅ 재고가 정상적으로 감소되었습니다.');
        }
      } else {
        alert(`❌ 재고 감소 실패: ${result.message}`);
      }
    } else {
      alert('재고가 감소되지 않았습니다.');
    }
  }, 500);
};


// ✅ 추가: 재고 체크만 수행하는 함수 (감소는 안 함)
const checkInventoryAvailability = async (cartItems) => {
  if (!cartItems || !Array.isArray(cartItems)) {
    return { success: true, warnings: [] };
  }
  
  try {
    const { inventoryService } = await import('../services/InventoryService');
    const serverInventory = await inventoryService.getInventory();
    
    const warnings = [];
    
    cartItems.forEach((item) => {
      if (!item.bom || !Array.isArray(item.bom) || item.bom.length === 0) {
        return;
      }
      
      item.bom.forEach((bomItem) => {
        const inventoryPartId = generateInventoryPartId({
          rackType: bomItem.rackType || '',
          name: bomItem.name || '',
          specification: bomItem.specification || '',
          colorWeight: bomItem.colorWeight || ''
        });
        
        const requiredQty = Number(bomItem.quantity) || 0;
        const currentStock = Number(serverInventory[inventoryPartId]) || 0;
        
        if (requiredQty > 0 && currentStock < requiredQty) {
          warnings.push({
            partId: inventoryPartId,
            name: bomItem.name,
            specification: bomItem.specification || '',
            rackType: bomItem.rackType || '',
            required: requiredQty,
            available: currentStock,
            shortage: requiredQty - currentStock
          });
        }
      });
    });
    
    return {
      success: true,
      warnings
    };
    
  } catch (error) {
    console.error('❌ 재고 체크 실패:', error);
    return {
      success: false,
      warnings: [],
      message: error.message
    };
  }
};

  return (
    <div className="purchase-order-form-container">
      <div className="form-header">
        <h1>청&nbsp;구&nbsp;서</h1>
      </div>

      <div className="info-table-stamp-wrapper">
        <table className="form-table info-table compact">
          <tbody>
            <tr>
              <td className="label" style={{width:110}}>거래일자</td>
              <td>
                <div style={{display:'flex', gap:'8px', alignItems:'center', width:'100%'}}>
                  <div style={{flex:'0 0 60%'}}>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={e=>updateFormData('date', e.target.value)}
                      style={{fontSize:'14px', fontWeight:600, padding:'6px 8px', width:'100%'}}
                    />
                  </div>
                  <div style={{display:'flex', flexDirection:'column', flex:'0 0 40%'}}>
                    <label style={{fontSize:'11px', fontWeight:600, marginBottom:2}}>거래번호</label>
                    <input
                      ref={documentNumberInputRef}
                      type="text"
                      value={formData.documentNumber}
                      onChange={e=>{
                        documentNumberInputRef.current?.classList.remove('invalid');
                        updateFormData('documentNumber', e.target.value);
                        updateFormData('purchaseNumber', e.target.value);
                      }}
                      placeholder=""
                      style={{padding:'6px 8px', fontSize:'13px', width:'100%'}}
                    />
                  </div>
                </div>
              </td>
              <td className="label">사업자등록번호</td>
              <td>{PROVIDER.bizNumber}</td>
            </tr>
            <tr>
              <td className="label">사업자등록번호</td>
              <td>
                <input
                  type="text"
                  value={formData.bizNumber}
                  onChange={e=>updateFormData('bizNumber', e.target.value)}
                  placeholder=""
                />
              </td>
              <td className="label">상호명</td>
              <td>{PROVIDER.companyName}</td>
            </tr>
            <tr>
              <td className="label">상호명</td>
              <td>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e=>updateFormData('companyName', e.target.value)}
                  placeholder="상호명 입력"
                />
              </td>
              <td className="label">대표자</td>
              <td className="rep-cell" style={{whiteSpace:'nowrap'}}>
                <span className="ceo-inline">
                  <span className="ceo-name">{PROVIDER.ceo}</span>
                  {PROVIDER.stampImage && (
                    <img
                      src={PROVIDER.stampImage}
                      alt="도장"
                      className="stamp-inline"
                    />
                  )}
                </span>
              </td>
            </tr>
            <tr>
              <td className="label" rowSpan={4}>메모</td>
              <td rowSpan={4}>
                <textarea
                  className="estimate-memo memo-narrow"
                  value={formData.topMemo}
                  onChange={e=>updateFormData('topMemo', e.target.value)}
                  placeholder=""
                />
              </td>
              <td className="label">소재지</td>
              <td>{PROVIDER.address}</td>
            </tr>
            <tr>
              <td className="label">TEL</td>
              <td>{PROVIDER.tel}</td>
            </tr>
            <tr>
              <td className="label">홈페이지</td>
              <td>{PROVIDER.homepage}</td>
            </tr>
            <tr>
              <td className="label">FAX</td>
              <td>{PROVIDER.fax}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 품목 목록 */}
      <h3 style={{margin:'14px 0 6px', fontSize:16}}>품목 목록</h3>
      <table className="form-table order-table">
        <thead>
          <tr>
            <th style={{width:'50px'}}>NO</th>
            <th>품명</th>
            <th style={{width:'70px'}}>단위</th>
            <th style={{width:'90px'}}>수량</th>
            <th style={{width:'110px'}}>단가</th>
            <th style={{width:'120px'}}>공급가</th>
            <th style={{width:'120px'}}>비고</th>
            <th className="no-print" style={{width:'70px'}}>작업</th>
          </tr>
        </thead>
        <tbody>
          {formData.items.map((it, idx) => (
            <tr key={`item-${idx}`}>
              <td>{idx+1}</td>
              <td><input type="text" value={it.name} onChange={e=>updateItem(idx,'name',e.target.value)} placeholder="품명" /></td>
              <td><input type="text" value={it.unit} onChange={e=>updateItem(idx,'unit',e.target.value)} placeholder="단위" /></td>
              <td><input type="number" value={it.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} placeholder="수량" /></td>
              <td><input type="number" value={it.unitPrice} onChange={e=>updateItem(idx,'unitPrice',e.target.value)} placeholder="단가" /></td>
              <td className="right">{it.totalPrice?parseInt(it.totalPrice).toLocaleString():'0'}</td>
              <td><input type="text" value={it.note} onChange={e=>updateItem(idx,'note',e.target.value)} placeholder="비고" /></td>
              <td className="no-print">
                <button type="button" onClick={()=>removeItem(idx)} disabled={formData.items.length===1} className="remove-btn">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="item-controls no-print" style={{marginBottom:18}}>
        <button type="button" onClick={addItem} className="add-item-btn">+ 품목 추가</button>
      </div>

      {/* BOM */}
      <h3 style={{margin:'14px 0 6px', fontSize:16}}>원자재 명세서</h3>
      <table className="form-table bom-table">
        <thead>
          <tr>
            <th style={{width:'50px'}}>NO</th>
            <th style={{width:'190px'}}>부품명</th>
            <th className="spec-col">규격</th>
            <th style={{width:'70px'}}>수량</th>
            <th style={{width:'70px'}}>단가</th>
            <th style={{width:'90px'}}>금액</th>
            <th style={{width:'90px'}}>비고</th>
            <th className="no-print" style={{width:'70px'}}>작업</th>
          </tr>
        </thead>
        <tbody>
          {formData.materials.map((m, idx) => (
            <tr key={`mat-${idx}`}>
              <td>{idx+1}</td>
              <td><input type="text" value={m.name} onChange={e=>updateMaterial(idx,'name',e.target.value)} placeholder="부품명" /></td>
              <td className="spec-cell">
                <input
                  type="text"
                  value={m.specification}
                  onChange={e=>updateMaterial(idx,'specification',e.target.value)}
                  placeholder="규격"
                />
              </td>
              <td><input type="number" value={m.quantity} onChange={e=>updateMaterial(idx,'quantity',e.target.value)} placeholder="수량" /></td>
              <td><input type="number" value={m.unitPrice} onChange={e=>updateMaterial(idx,'unitPrice',e.target.value)} placeholder="단가" /></td>
              <td className="right">{m.totalPrice?parseInt(m.totalPrice).toLocaleString():'0'}</td>
              <td><input type="text" value={m.note} onChange={e=>updateMaterial(idx,'note',e.target.value)} placeholder="비고" /></td>
              <td className="no-print">
                <button type="button" onClick={()=>removeMaterial(idx)} className="remove-btn">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="item-controls no-print" style={{marginBottom:18}}>
        <button type="button" onClick={addMaterial} className="add-item-btn">+ 자재 추가</button>
      </div>

      <table className="form-table total-table">
        <tbody>
          <tr><td className="label">소계</td><td className="right">{formData.subtotal.toLocaleString()}</td></tr>
          <tr><td className="label">부가세</td><td className="right">{formData.tax.toLocaleString()}</td></tr>
          <tr><td className="label"><strong>합계</strong></td><td className="right"><strong>{formData.totalAmount.toLocaleString()}</strong></td></tr>
        </tbody>
      </table>

      <div className="notes-section">
        <label>비고:</label>
        <textarea
          value={formData.notes}
          onChange={e=>updateFormData('notes', e.target.value)}
          placeholder="기타 사항을 입력하세요"
          rows={4}
        />
      </div>

      <div className="form-actions no-print">
        <button type="button" onClick={handleSave} className="save-btn">저장하기</button>
        <button type="button" onClick={handleExportToExcel} className="excel-btn">엑셀로 저장하기</button>
        <button type="button" onClick={handlePrint} className="print-btn">인쇄하기</button>
      </div>

      <div className="form-company">({PROVIDER.companyName})</div>
    </div>
  );
};

export default PurchaseOrderForm;
