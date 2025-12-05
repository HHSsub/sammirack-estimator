import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { exportToExcel, generateFileName } from '../utils/excelExport';
import { showInventoryResult } from './InventoryManager';
import '../styles/EstimateForm.css';
import { generateInventoryPartId } from '../utils/unifiedPriceManager';
import { regenerateBOMFromDisplayName } from '../utils/bomRegeneration';  // ✅ 추가
import { saveDocumentSync } from '../utils/realtimeAdminSync';
import { convertDOMToPDFBase64, base64ToBlobURL, sendFax } from '../utils/faxUtils'; // ✅ 추가
import FaxPreviewModal from './FaxPreviewModal'; // ✅ 추가

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

const EstimateForm = () => {
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;

  const documentNumberInputRef = useRef(null);
  const cartData = location.state || {};
  const { 
    cart = [], 
    totalBom = [],
    customItems = [],          // ✅ 추가
    editingDocumentId = null,  // ✅ 추가
    editingDocumentData = {}   // ✅ 추가
  } = cartData;

  // ✅ FAX 관련 state 추가
  const [showFaxModal, setShowFaxModal] = useState(false);
  const [pdfBlobURL, setPdfBlobURL] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);

  const [formData, setFormData] = useState({
    date: editingDocumentData.date || new Date().toISOString().split('T')[0],
    documentNumber: editingDocumentData.documentNumber || '',
    companyName: editingDocumentData.companyName || '',
    bizNumber: editingDocumentData.bizNumber || '',
    items: [
      { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    materials: [],  // ✅ 절대 삭제하지 않음
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    notes: editingDocumentData.notes || '',
    topMemo: editingDocumentData.topMemo || ''
  });

  useEffect(() => {
    if (isEditMode) {
      const storageKey = `estimate_${id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { 
          const data = JSON.parse(saved);
          
          if (!data.materials || data.materials.length === 0) {
            console.log('⚠️ 구버전 견적서 - materials 자동 생성');
            
            // ✅ 임시 배열에 모든 BOM 수집
            const allBoms = [];
            data.items.forEach(item => {
              if (item.name) {
                const bom = regenerateBOMFromDisplayName(item.name, item.quantity || 1);
                allBoms.push(...bom);
              }
            });
            
            // ✅ 중복 제거 및 수량 합산
            const bomMap = new Map();
            allBoms.forEach(item => {
              const key = generateInventoryPartId(item);
              
              if (bomMap.has(key)) {
                const existing = bomMap.get(key);
                bomMap.set(key, {
                  ...existing,
                  quantity: existing.quantity + (item.quantity || 0),
                  totalPrice: existing.totalPrice + (item.totalPrice || 0)
                });
              } else {
                bomMap.set(key, { ...item });
              }
            });
            
            data.materials = Array.from(bomMap.values());
            console.log(`✅ materials 자동 생성 완료: ${data.materials.length}개`);
          }
          
          setFormData(data);
        } catch(e) {
          console.error('견적서 로드 실패:', e);
        }
      }
    }
  }, [id, isEditMode]);

  useEffect(() => {
    if (!isEditMode && cart.length > 0) {
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
      
      const allItems = [...cartItems, ...customItems];
      
      const bomMaterials = (totalBom || []).map(m => ({
        name: m.name,
        rackType: m.rackType,
        specification: m.specification || '',
        quantity: Number(m.quantity) || 0,
        unitPrice: Number(m.unitPrice) || 0,
        totalPrice: (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0),
        note: m.note || ''
      }));
      
      // ✅ 수정: allItems가 비어있어도 강제 설정
      setFormData(prev => ({ 
        ...prev, 
        items: allItems.length ? allItems : [{ name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }],
        materials: bomMaterials
      }));
    }
  }, [cart, totalBom, customItems, isEditMode]);

  useEffect(() => {
    const subtotal = formData.items.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const tax = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + tax;
    
    // ✅ 값이 실제로 바뀌었을 때만 업데이트
    if (formData.subtotal !== subtotal || formData.tax !== tax || formData.totalAmount !== totalAmount) {
      setFormData(prev => ({ ...prev, subtotal, tax, totalAmount }));
    }
  }, [formData.items, formData.subtotal, formData.tax, formData.totalAmount]);

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (idx, field, value) => {
    const items = [...formData.items];
    items[idx][field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      const q = parseFloat(items[idx].quantity) || 0;
      const u = parseFloat(items[idx].unitPrice) || 0;
      items[idx].totalPrice = q * u;
    }
    setFormData(prev => ({ ...prev, items }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }]
    }));
  };

  const removeItem = (idx) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async () => {
      if (!formData.documentNumber.trim()) {
        alert('거래번호(문서번호)를 입력하세요.');
        documentNumberInputRef.current?.focus();
        return;
      }
      
      // ✅ 동일 거래번호 찾기
      let itemId;
      let existingDoc = null;
      
      if (editingDocumentId) {
        // 편집 모드: 기존 ID 재사용
        itemId = editingDocumentId;
      } else if (isEditMode) {
        // 기존 편집 모드 (URL 기반)
        itemId = id;
      } else {
        // ✅ 신규 작성: 동일 거래번호 검색
        existingDoc = findDocumentByNumber(formData.documentNumber, 'estimate');
        if (existingDoc) {
          // 동일 거래번호 발견 -> 덮어쓰기 확인
          const confirmOverwrite = window.confirm(
            `거래번호 "${formData.documentNumber}"가 이미 존재합니다.\n덮어쓰시겠습니까?`
          );
          if (confirmOverwrite) {
            itemId = existingDoc.id;
          } else {
            return; // 취소
          }
        } else {
          // 새 문서
          itemId = Date.now();
        }
      }
      
      const storageKey = `estimate_${itemId}`;
      
      const newEstimate = {
        ...formData,
        id: itemId,
        type: 'estimate',
        status: formData.status || '진행 중',
        estimateNumber: formData.documentNumber,
        customerName: formData.companyName,
        productType: formData.items[0]?.name || '',
        quantity: formData.items.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0),
        unitPrice: formData.items[0] ? (parseInt(formData.items[0].unitPrice) || 0) : 0,
        totalPrice: formData.totalAmount,
        updatedAt: new Date().toISOString(),
        ...(existingDoc || isEditMode || editingDocumentId ? {} : { createdAt: new Date().toISOString() })
      };
    
    // ✅ 레거시 키 저장
    localStorage.setItem(storageKey, JSON.stringify(newEstimate));
    
    // ✅ 서버 동기화 저장
    const success = await saveDocumentSync(newEstimate);
    
    if (success) {
      alert(isEditMode ? '견적서가 수정되었습니다.' : '견적서가 저장되었습니다.');
      window.dispatchEvent(new Event('documentsupdated'));
    } else {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleExportToExcel = () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      return;
    }
    exportToExcel(formData, 'estimate')
      .then(() => alert('엑셀 파일이 다운로드되었습니다.'))
      .catch(e => {
        console.error(e);
        alert('엑셀 다운로드 오류');
      });
  };

  const handlePrint = async () => {  // ← async 추가
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }
    window.print();
  };

  // ✅ FAX 전송 핸들러 추가 
  const handleFaxPreview = async () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }

    try {
      // 문서 DOM 요소 찾기
      const docElement = document.querySelector('.estimate-form-container');
      if (!docElement) {
        alert('문서 영역을 찾을 수 없습니다.');
        return;
      }

      alert('PDF 생성 중입니다. 잠시만 기다려주세요...');

      // PDF 변환
      const base64 = await convertDOMToPDFBase64(docElement);
      setPdfBase64(base64);

      // Blob URL 생성 (미리보기용)
      const blobURL = base64ToBlobURL(base64);
      setPdfBlobURL(blobURL);

      // 모달 표시
      setShowFaxModal(true);
    } catch (error) {
      console.error('❌ PDF 생성 오류:', error);
      alert(`PDF 생성에 실패했습니다.\n오류: ${error.message}`);
    }
  };

const handleSendFax = async (faxNumber) => {
  if (!pdfBase64) {
    alert('PDF가 생성되지 않았습니다.');
    return;
  }

  try {
    const result = await sendFax(
      pdfBase64,
      faxNumber,
      formData.companyName,
      ''
    );

    if (result.success) {
      // ✅ 성공 시 잔액 정보 표시
      alert(
        `✅ 팩스 전송이 완료되었습니다!\n\n` +
        `📄 발송번호: ${result.jobNo}\n` +
        `📑 페이지 수: ${result.pages}장\n` +
        `💰 남은 잔액: ${(result.cash || 0).toLocaleString()}원`
      );
      setShowFaxModal(false);
    } else {
      throw new Error(result.error || '알 수 없는 오류');
    }
  } catch (error) {
    console.error('❌ 팩스 전송 오류:', error);
    
    // ✅ 오류 유형별 메시지 개선
    let errorMessage = '팩스 전송에 실패했습니다.\n\n';
    
    if (error.message.includes('잔액')) {
      errorMessage += `❌ ${error.message}\n\n발송닷컴 사이트에서 충전해주세요.`;
    } else if (error.message.includes('타임아웃')) {
      errorMessage += '❌ 서버 응답 시간 초과\n잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('네트워크')) {
      errorMessage += '❌ 네트워크 연결 오류\n인터넷 연결을 확인해주세요.';
    } else {
      errorMessage += `오류: ${error.message}`;
    }
    
    alert(errorMessage);
  }
};

  const handleCloseFaxModal = () => {
    setShowFaxModal(false);
    if (pdfBlobURL) {
      URL.revokeObjectURL(pdfBlobURL);
      setPdfBlobURL(null);
    }
    setPdfBase64(null);
  };

  return (
    <div className="estimate-form-container">
      <div className="form-header">
        <h1>견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
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
                    <label style={{fontSize:'12px', fontWeight:600, marginBottom:2}}>거래번호</label>
                    <input
                      ref={documentNumberInputRef}
                      type="text"
                      value={formData.documentNumber}
                      onChange={e=>{
                        documentNumberInputRef.current?.classList.remove('invalid');
                        updateFormData('documentNumber', e.target.value);
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
              <td className="memo-cell" rowSpan={4}>
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

      <table className="form-table quote-table">
        <thead>
          <tr>
            <th>NO</th>
            <th>품명</th>
            <th>단위</th>
            <th>수량</th>
            <th>단가</th>
            <th>공급가</th>
            <th>비고</th>
            <th className="no-print">작업</th>
          </tr>
        </thead>
        <tbody>
          {formData.items.map((it, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td><input type="text" value={it.name} onChange={e=>updateItem(idx,'name',e.target.value)} placeholder="품명" /></td>
              <td><input type="text" value={it.unit} onChange={e=>updateItem(idx,'unit',e.target.value)} placeholder="단위" /></td>
              <td><input type="number" value={it.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} placeholder="수량" /></td>
              <td><input type="number" value={it.unitPrice} onChange={e=>updateItem(idx,'unitPrice',e.target.value)} placeholder="단가" /></td>
              <td className="right">{it.totalPrice?parseInt(it.totalPrice).toLocaleString():'0'}</td>
              <td><input type="text" value={it.note} onChange={e=>updateItem(idx,'note',e.target.value)} placeholder="비고" /></td>
              <td className="no-print">
                <button
                  type="button"
                  onClick={()=>removeItem(idx)}
                  disabled={formData.items.length===1}
                  className="remove-btn"
                >삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="item-controls no-print">
        <button 
          type="button" 
          onClick={addItem}  // ✅ 단순화
          className="add-item-btn"
        >
          + 품목 추가
        </button>
      </div>

      <table className="form-table total-table">
        <tbody>
          <tr>
            <td className="label">소계</td>
            <td className="right">{formData.subtotal.toLocaleString()}</td>
          </tr>
            <tr>
              <td className="label">부가세</td>
              <td className="right">{formData.tax.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="label"><strong>합계</strong></td>
              <td className="right"><strong>{formData.totalAmount.toLocaleString()}</strong></td>
            </tr>
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
        <button type="button" onClick={handleFaxPreview} className="fax-btn">📠 FAX 전송</button>
      </div>

      <div className="form-company">({PROVIDER.companyName})</div>
      {/* ✅ FAX 미리보기 모달 추가 */}
      {showFaxModal && (
        <FaxPreviewModal
          pdfBlobURL={pdfBlobURL}
          onClose={handleCloseFaxModal}
          onSendFax={handleSendFax}
        />
      )}
    </div>
  );
};

// ✅ EstimateForm.jsx 맨 아래, export default EstimateForm; 바로 위에 추가
function findDocumentByNumber(docNumber, docType) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`${docType}_`)) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const checkNumber = docType === 'estimate' ? data.estimateNumber :
                           docType === 'purchase' ? data.purchaseNumber :
                           data.documentNumber;
        if (checkNumber === docNumber) {
          return data;
        }
      } catch {}
    }
  }
  return null;
}

export default EstimateForm;
