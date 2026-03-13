import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { exportToExcel, generateFileName } from '../utils/excelExport';
import { showInventoryResult } from './InventoryManager';
import '../styles/EstimateForm.css';
import { generateInventoryPartId, mapExtraToBaseInventoryPart } from '../utils/unifiedPriceManager';
import { regenerateBOMFromDisplayName } from '../utils/bomRegeneration';
import { saveDocumentSync, isTransactionDeducted } from '../utils/realtimeAdminSync';
import { documentsAPI } from '../services/apiClient';
import { getDocumentSettings } from '../utils/documentSettings';
import DocumentSettingsModal from './DocumentSettingsModal';
import { convertDOMToPDFBase64, base64ToBlobURL, sendFax } from '../utils/faxUtils';
import FaxPreviewModal from './FaxPreviewModal';
import ToastNotification from './ToastNotification'; // ✅ 토스트 알림 추가
import { getFullPrintHTML, PROVIDER } from '../utils/printGenerator'; // ✅ 통합 인쇄 유틸
import ConfirmDialog from './ConfirmDialog'; // ✅ 확인 다이얼로그 추가
import { useProducts } from '../contexts/ProductContext'; // ✅ extraProducts 사용
import { getExtraOptionDisplayInfo, generateHighRackDisplayName, extractPartNameFromCleanName } from '../utils/bomDisplayNameUtils'; // ✅ 표시명 생성 유틸
import MaterialSelector from './MaterialSelector';  // 26_01_27 신규기능추가 


const EstimateForm = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const cartData = location.state || {};
  const {
    cart = [],
    totalBom = [],
    materials = [], // ✅ 추가
    customItems = [],
    customMaterials = [],
    editingDocumentId = null,
    editingDocumentType = null,
    editingDocumentData = {}
  } = cartData;

  const isEditMode = !!id;  // ✅ 원래대로

  // ✅ extraProducts 로드 (컴포넌트 최상위 레벨에서 호출 - React Hook 규칙 준수)
  const { extraProducts } = useProducts();

  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFaxModal, setShowFaxModal] = useState(false);
  const [pdfBlobURL, setPdfBlobURL] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);

  // ✅ 토스트 알림 state 추가
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const saveButtonRef = useRef(null);

  // ✅ 확인 다이얼로그 state 추가
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    message: '',
    onConfirm: null
  });
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState('material'); // 'item' or 'material'

  const documentNumberInputRef = useRef(null);
  const cartInitializedRef = useRef(false);

  const [formData, setFormData] = useState({
    date: editingDocumentData.date || new Date().toISOString().split('T')[0],
    documentNumber: editingDocumentData.documentNumber || '',
    companyName: editingDocumentData.companyName || '',
    bizNumber: editingDocumentData.bizNumber || '',
    items: [
      { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    materials: [],
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    notes: editingDocumentData.notes || '',
    topMemo: editingDocumentData.topMemo || '',
    documentSettings: null,  // ✅ 이 문서 저장 당시의 회사 정보 (도장 제외)
    // ✅ 재고 감소 상태 필드 추가
    inventoryDeducted: editingDocumentData.inventoryDeducted || false,
    inventoryDeductedAt: editingDocumentData.inventoryDeductedAt || null,
    inventoryDeductedBy: editingDocumentData.inventoryDeductedBy || null
  });

  // ✅ 관리자 체크
  useEffect(() => {
    const userInfoStr = localStorage.getItem('currentUser');
    if (userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        setIsAdmin(userInfo.role === 'admin' || userInfo.username === 'admin');
      } catch (e) {
        setIsAdmin(false);
      }
    }
  }, []);

  // ✅ 기존 문서 로드 (편집 모드 또는 editingDocumentId가 있을 때)
  useEffect(() => {
    const docIdToLoad = isEditMode ? String(id) : (editingDocumentId ? String(editingDocumentId) : null);
    const docTypeToLoad = isEditMode ? 'estimate' : (editingDocumentType || 'estimate');

    if (docIdToLoad) {
      // ✅ .0 접미사 방지를 위해 ID를 문자열로 정규화
      // ✅ .0 접미사 방지를 위해 ID를 문자열로 정규화
      const normalizedId = docIdToLoad.replace(/\.0$/, '');

      // ✅ [Fix] 저장 키 생성 시 중복 접두사 방지
      let storageKey;
      if (normalizedId.startsWith(`${docTypeToLoad}_`)) {
        storageKey = normalizedId;
      } else {
        storageKey = `${docTypeToLoad}_${normalizedId}`;
      }
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);

          if (!data.materials || data.materials.length === 0) {
            console.log('⚠️ 구버전 견적서 - materials 자동 생성');

            const allBoms = [];
            data.items.forEach(item => {
              if (item.name) {
                const bom = regenerateBOMFromDisplayName(item.name, item.quantity || 1);
                allBoms.push(...bom);
              }
            });

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

          // ✅ 편집 후 진입 시 state.totalBom으로 materials 보정 (비어 있으면)
          if (editingDocumentId && totalBom && totalBom.length > 0 && (!data.materials || data.materials.length === 0)) {
            data.materials = totalBom;
          }

          // ✅ 편집 후 진입 시 state.cart로 items 보정 (비어 있으면)
          if (editingDocumentId && cart && cart.length > 0 && (!data.items || data.items.length === 0 || (data.items.length === 1 && !data.items[0].name))) {
            const loadedCartItems = cart.map(item => {
              const qty = item.quantity || 1;
              const unitPrice = item.unitPrice || Math.round((item.price || 0) / (qty || 1));
              return {
                name: item.displayName || item.name || '',
                unit: '개',
                quantity: qty,
                unitPrice,
                totalPrice: unitPrice * qty,
                note: ''
              };
            });
            data.items = loadedCartItems;
          }

          // ✅ 저장된 cart에서 extraOptions 복원
          if (data.cart && Array.isArray(data.cart)) {
            console.log('✅ 저장된 cart에서 extraOptions 복원:', data.cart);
            // cart는 나중에 사용할 수 있도록 보관 (필요시)
          }

          // ✅ 편집 후 진입 시 state.editingDocumentData로 메타정보 보정 (비어 있으면)
          const mergedData = {
            ...data,
            date: data.date || editingDocumentData.date || data.date,
            documentNumber: data.documentNumber || data.estimateNumber || editingDocumentData.documentNumber || data.documentNumber,
            companyName: data.companyName || editingDocumentData.companyName || data.companyName,
            bizNumber: data.bizNumber || editingDocumentData.bizNumber || data.bizNumber,
            notes: data.notes || editingDocumentData.notes || data.notes,
            topMemo: data.topMemo || editingDocumentData.topMemo || data.topMemo,
            documentSettings: data.documentSettings || null
          };

          setFormData(mergedData);

          // ✅ 문서 로드 완료 플래그 설정 (새 cart 반영 방지)
          cartInitializedRef.current = true;
        } catch (e) {
          console.error('견적서 로드 실패:', e);
        }
      }
    }
  }, [id, isEditMode, editingDocumentId, totalBom, materials]);

  // ✅ 새 문서 - cart 초기화
  useEffect(() => {
    if (!isEditMode && cart.length > 0 && !cartInitializedRef.current) {
      cartInitializedRef.current = true;
      const restoredCartItems = cart.map(item => {
        const qty = item.quantity || 1;
        // ✅ 원래 unitPrice 있으면 보존, 없으면 계산
        const unitPrice = item.unitPrice || Math.round((item.price || 0) / (qty || 1));
        return {
          name: item.displayName || item.name || '',
          unit: '개',
          quantity: qty,
          unitPrice,
          totalPrice: unitPrice * qty,
          note: ''
        };
      });

      // ✅ customMaterials를 items 형식으로 변환
      // ✅ cart에서 extraOptions 추출 - 각 옵션을 개별 표시
      const extraOptionItems = [];

      cart.forEach(item => {
        if (item.extraOptions && Array.isArray(item.extraOptions)) {
          item.extraOptions.forEach(optId => {
            // optId가 ID인 경우 extraProducts에서 이름 찾기 - 유틸 함수 사용
            const displayInfo = getExtraOptionDisplayInfo(item.type, optId, extraProducts);

            // opt가 객체인 경우 (하위 호환성)
            let optName = '';
            let optPrice = 0;
            if (displayInfo) {
              optName = displayInfo.name;
              optPrice = displayInfo.price;
            } else if (optId && typeof optId === 'object' && optId.name) {
              optName = optId.name;
              optPrice = optId.price || 0;
            }

            if (optName) {
              extraOptionItems.push({
                name: `[추가옵션] ${optName}`,
                unit: '개',
                quantity: 1,
                unitPrice: optPrice,
                totalPrice: optPrice,
                note: '추가옵션'
              });
            }
          });
        }
      });

      // ✅ customMaterials를 items 형식으로 변환 (경량랙 전용)
      const customMaterialItems = [];
      cart.forEach(item => {
        if (item.customMaterials && Array.isArray(item.customMaterials)) {
          item.customMaterials.forEach(mat => {
            if (mat && mat.name) {
              customMaterialItems.push({
                name: `[추가옵션] ${mat.name}`,
                unit: '개',
                quantity: 1,
                unitPrice: mat.price || 0,
                totalPrice: mat.price || 0,
                note: '추가옵션'
              });
            }
          });
        }
      });

      const allItems = [...restoredCartItems, ...customItems, ...extraOptionItems, ...customMaterialItems];

      // ✅ BOM 추출: totalBom 또는 materials 확인
      let bomMaterials = [];
      const incomingMaterials = (totalBom && totalBom.length > 0) ? totalBom : materials;

      if (incomingMaterials && incomingMaterials.length > 0) {
        bomMaterials = incomingMaterials.map(m => {
          // ✅ 하이랙 부품의 경우 색상 정보가 포함된 이름 사용
          let displayName = m.name;
          if (m.rackType === '하이랙' && m.colorWeight) {
            const partName = extractPartNameFromCleanName(m.name) || m.name;
            displayName = generateHighRackDisplayName(partName, m.colorWeight);
          }

          return {
            name: displayName,
            rackType: m.rackType,
            specification: m.specification || '',
            quantity: Number(m.quantity) || 0,
            colorWeight: m.colorWeight || '',  // ✅ HiRack 색상+중량 정보 보존  
            color: m.color || '',              // ✅ 경량랙 색상 정보 보존  
            unitPrice: Number(m.unitPrice) || 0,
            totalPrice: (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0),
            note: m.note || ''
          };
        });
      } else {
        // ✅ materials가 없으면 cart에서 직접 BOM 추출
        cart.forEach(item => {
          if (item.bom && Array.isArray(item.bom) && item.bom.length > 0) {
            item.bom.forEach(bomItem => {
              bomMaterials.push({
                name: bomItem.name,
                rackType: bomItem.rackType,
                specification: bomItem.specification || '',
                quantity: Number(bomItem.quantity) || 0,
                unitPrice: Number(bomItem.unitPrice) || 0,
                totalPrice: (Number(bomItem.quantity) || 0) * (Number(bomItem.unitPrice) || 0),
                note: bomItem.note || ''
              });
            });
          } else if (item.displayName || item.name) {
            // ✅ BOM 없음 -> 이름에서 재생성 (History 등)
            const regenerated = regenerateBOMFromDisplayName(item.displayName || item.name, item.quantity || 1);
            bomMaterials.push(...regenerated);
          }
        });
      }

      const allMaterials = [...bomMaterials, ...customMaterials];

      setFormData(prev => ({
        ...prev,
        items: allItems.length ? allItems : [{ name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }],
        materials: allMaterials
      }));
    }
  }, [cart, totalBom, customItems, customMaterials, isEditMode]);

  // ✅ 합계 계산
  useEffect(() => {
    const subtotal = formData.items.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const tax = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + tax;

    setFormData(prev => {
      if (prev.subtotal === subtotal && prev.tax === tax && prev.totalAmount === totalAmount) {
        return prev;
      }
      return { ...prev, subtotal, tax, totalAmount };
    });
  }, [formData.items.length, formData.items.map(it => it.totalPrice).join(',')]);

  // ✅ 표시용 회사 정보 (도장은 항상 PROVIDER 사용)
  const getDisplaySettings = () => {
    // 문서에 저장된 설정이 있으면 사용
    if (formData.documentSettings) {
      return {
        ...formData.documentSettings,
        stampImage: PROVIDER.stampImage  // ✅ 도장은 항상 고정
      };
    }

    // 없으면 현재 localStorage 또는 기본값
    const currentSettings = getDocumentSettings();
    return {
      ...currentSettings,
      stampImage: PROVIDER.stampImage  // ✅ 도장은 항상 고정
    };
  };

  const displaySettings = getDisplaySettings();

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

  // 아래 주석코드 삭제 금지
  // const addItem = () => {
  //   setFormData(prev => ({
  //     ...prev,
  //     items: [...prev.items, { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }]
  //   }));
  // };
  const addItem = () => {
    setSelectorTarget('item');
    setShowMaterialSelector(true);
  };


  const handleMaterialAdd = (materialData) => {
    // ✅ inventoryPartId 생성 (재고 감소용)
    const materialWithId = {
      ...materialData,
      inventoryPartId: materialData.isService ? null : (materialData.inventoryPartId || (() => {
        const rawId = generateInventoryPartId({
          rackType: materialData.rackType || '기타',
          name: materialData.name,
          specification: materialData.specification || '',
          colorWeight: materialData.colorWeight || ''
        });
        return mapExtraToBaseInventoryPart(rawId);
      })())
    };

    if (selectorTarget === 'item') {
      // ✅ 품목으로 추가할 때는 표시 이름을 "품명 (규격)" 형태로 구성
      const itemDisplayName = materialData.specification
        ? `${materialData.name} (${materialData.specification})`
        : materialData.name;

      setFormData(prev => {
        const nextState = {
          ...prev,
          items: [...prev.items, {
            name: itemDisplayName,
            unit: '개',
            quantity: materialData.quantity,
            unitPrice: materialData.unitPrice,
            totalPrice: materialData.totalPrice,
            note: materialData.note || ''
          }]
        };

        // 서비스 항목(공임, 운임)이 아닐 때만 원자재 명세서(BOM)에 추가
        if (!materialWithId.isService) {
          let materialsToAdd = [{
            ...materialWithId,
            name: materialData.originalName || materialWithId.name
          }];

          // ✅ 추가상품: 기둥 세트인 경우 경사/수평브레싱도 함께 추가
          if (materialData.additionalMaterials && materialData.additionalMaterials.length > 0) {
            const additionalWithIds = materialData.additionalMaterials.map(additional => ({
              ...additional,
              inventoryPartId: additional.inventoryPartId || (() => {
                const rawId = generateInventoryPartId({
                  rackType: additional.rackType || '기타',
                  name: additional.name,
                  specification: additional.specification || '',
                  colorWeight: additional.colorWeight || ''
                });
                return mapExtraToBaseInventoryPart(rawId);
              })()
            }));
            materialsToAdd = [...materialsToAdd, ...additionalWithIds];
          }

          const newMaterials = [...prev.materials];
          materialsToAdd.forEach(newItem => {
            const existingIdx = newMaterials.findIndex(m =>
              m.inventoryPartId === newItem.inventoryPartId &&
              m.name === newItem.name &&
              m.specification === newItem.specification &&
              m.rackType === newItem.rackType
            );

            if (existingIdx >= 0) {
              const prevQty = parseInt(newMaterials[existingIdx].quantity) || 0;
              const addQty = parseInt(newItem.quantity) || 0;
              newMaterials[existingIdx].quantity = prevQty + addQty;

              const unitPrice = parseFloat(newMaterials[existingIdx].unitPrice) || 0;
              newMaterials[existingIdx].totalPrice = (prevQty + addQty) * unitPrice;
            } else {
              newMaterials.push(newItem);
            }
          });

          nextState.materials = newMaterials;
        }

        return nextState;
      });
    } else {
      // ✅ 자재로만 추가
      setFormData(prev => ({
        ...prev,
        materials: [...prev.materials, materialWithId]
      }));
    }
  };

  const removeItem = (idx) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async () => {
    if (!formData.documentNumber.trim()) {
      setToast({
        show: true,
        message: '거래번호(문서번호)를 입력하세요.',
        type: 'error'
      });
      documentNumberInputRef.current?.focus();
      return;
    }

    // ✅ 동일 거래번호 찾기
    let itemId;
    let existingDoc = null;

    if (editingDocumentId) {
      itemId = editingDocumentId;
    } else if (isEditMode) {
      itemId = id;
    } else {
      existingDoc = findDocumentByNumber(formData.documentNumber, 'estimate');
      if (existingDoc) {
        // 동일 거래번호 발견 -> 덮어쓰기 확인 다이얼로그 표시
        setConfirmDialog({
          show: true,
          message: `거래번호 "${formData.documentNumber}"가 이미 존재합니다.\n기존 문서를 덮어쓰시겠습니까?`,
          onConfirm: () => {
            proceedWithSave(existingDoc.id, existingDoc);
          }
        });
        return; // 확인 다이얼로그에서 처리
      } else {
        itemId = `estimate_${Date.now()}`;  // ✅ prefix 추가
      }
    }

    // 저장 로직 실행
    await proceedWithSave(itemId, existingDoc);
  };

  // ✅ 저장 로직 분리
  const proceedWithSave = async (itemId, existingDoc) => {
    const storageKey = `estimate_${itemId}`;

    // ✅ 현재 문서 양식 설정 (도장 제외)
    const currentSettings = getDocumentSettings();
    const documentSettings = {
      bizNumber: currentSettings.bizNumber,
      companyName: currentSettings.companyName,
      ceo: currentSettings.ceo,
      address: currentSettings.address,
      homepage: currentSettings.homepage || "http://www.ssmake.com",
      tel: currentSettings.tel,
      fax: currentSettings.fax
      // stampImage는 제외 (항상 PROVIDER 고정)
    };

    // ✅ cart에서 extraOptions 추출 (문서 저장 시 포함)
    const cartWithExtraOptions = cart.map(item => ({
      ...item,
      extraOptions: item.extraOptions || []
    }));

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
      // ✅ 편집 모드: 기존 documentSettings 유지, 신규: 현재 설정 저장
      documentSettings: (existingDoc || isEditMode || editingDocumentId)
        ? (formData.documentSettings || documentSettings)
        : documentSettings,
      // ✅ extraOptions 저장 (문서 로드 시 복원용)
      cart: cartWithExtraOptions,
      ...(existingDoc || isEditMode || editingDocumentId ? {} : { createdAt: new Date().toISOString() })
    };

    localStorage.setItem(storageKey, JSON.stringify(newEstimate));

    const success = await saveDocumentSync(newEstimate);

    if (success) {
      try {
        await documentsAPI.save(newEstimate.id, {
          docId: newEstimate.id,
          type: newEstimate.type,
          date: newEstimate.date,
          documentNumber: newEstimate.estimateNumber,
          companyName: newEstimate.companyName,
          bizNumber: newEstimate.bizNumber,
          items: newEstimate.items || [],
          materials: newEstimate.materials || [],
          subtotal: newEstimate.subtotal,
          tax: newEstimate.tax,
          totalAmount: newEstimate.totalAmount,
          notes: newEstimate.notes,
          topMemo: newEstimate.topMemo,
          inventoryDeducted: newEstimate.inventoryDeducted,
          inventoryDeductedAt: newEstimate.inventoryDeductedAt,
          inventoryDeductedBy: newEstimate.inventoryDeductedBy
        });
      } catch (err) {
        console.error('문서 즉시 서버 저장 실패:', err);
      }
      setToast({
        show: true,
        message: isEditMode ? '견적서가 수정되었습니다.' : '견적서가 저장되었습니다.',
        type: 'success'
      });
      window.dispatchEvent(new Event('documentsupdated'));
    } else {
      setToast({
        show: true,
        message: '저장 중 오류가 발생했습니다.',
        type: 'error'
      });
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

  const handlePrint = async () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }

    const title = `견적서_${formData.documentNumber}`;
    const fullHTML = getFullPrintHTML({
      ...formData,
      type: 'estimate'
    }, {
      title,
      baseURL: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''),
      globalSettings: getDocumentSettings()
    });

    // ✅ hidden iframe을 사용하여 새 창 없이 현재 페이지에서 인쇄창 호출
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    iframe.contentWindow.document.write(fullHTML);
    iframe.contentWindow.document.close();

    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };
  const handleFaxPreview = async () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }

    try {
      alert('PDF 생성 중입니다. 잠시만 기다려주세요...');

      const title = `견적서_${formData.documentNumber}`;
      const fullHTML = getFullPrintHTML({
        ...formData,
        type: 'estimate'
      }, {
        title,
        baseURL: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''),
        globalSettings: getDocumentSettings()
      });

      // iframe을 사용하여 HTML 렌더링 후 PDF 변환
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(fullHTML);
      iframe.contentDocument.close();

      setTimeout(async () => {
        const docElement = iframe.contentDocument.body;
        const base64 = await convertDOMToPDFBase64(docElement);
        setPdfBase64(base64);

        const blobURL = base64ToBlobURL(base64);
        setPdfBlobURL(blobURL);

        setShowFaxModal(true);
        document.body.removeChild(iframe);
      }, 500);

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

  const convertToPurchase = () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }

    console.log('🔍 견적서→발주서 변환 시작:', formData.estimateNumber);

    // 1. 카트 데이터 추출
    const cart = (formData.cart && formData.cart.length > 0 ? formData.cart : formData.items || []).map(it => ({
      ...it,
      name: it.name || it.displayName || '',
      displayName: it.displayName || it.name || '',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
      price: it.totalPrice || it.price || 0,
      unit: it.unit || '개'
    }));

    // 2. 원자재(BOM) 추출 및 유실 시 재생성
    let materials = formData.materials || [];
    if (materials.length === 0 && cart.length > 0) {
      console.log('🔄 원자재 유실 감지 - 재생성 시도');
      const regenerated = [];
      cart.forEach(cartItem => {
        const bom = regenerateBOMFromDisplayName(cartItem.displayName || cartItem.name || '');
        if (bom && bom.length > 0) {
          regenerated.push(...bom.map(b => ({
            ...b,
            quantity: b.quantity * (cartItem.quantity || 1)
          })));
        }
      });
      if (regenerated.length > 0) {
        materials = regenerated;
      }
    }

    // ✅ 3. materials에 inventoryPartId 추가 (재고 감소 필수!)
    materials = materials.map(mat => {
      const inventoryPartId = generateInventoryPartId({
        rackType: mat.rackType || '',
        name: mat.name || '',
        specification: mat.specification || '',
        colorWeight: mat.colorWeight || '',
        color: mat.color || ''
      });

      console.log(`  🔑 InvID 생성: ${mat.name} → ${inventoryPartId}`);

      return {
        ...mat,
        inventoryPartId
      };
    });

    console.log(`✅ 변환 완료: cart ${cart.length}개, materials ${materials.length}개`);

    // 4. 발주서로 이동
    navigate('/purchase-order/new', {
      state: {
        cart: cart,
        totalBom: materials,
        materials: materials,
        estimateData: formData,
        editingDocumentId: null,
        editingDocumentType: 'estimate',
        editingDocumentData: {}
      }
    });
  };

  return (
    <div className="estimate-form-container">
      {isAdmin && (
        <button
          className="document-settings-btn no-print"
          onClick={() => setShowSettingsModal(true)}
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            padding: '6px 10px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          ⚙️ 문서 양식 수정
        </button>
      )}

      <div className="form-header">
        <h1>견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
      </div>

      <div className="info-table-stamp-wrapper">
        <table className="form-table info-table compact">
          <tbody>
            <tr>
              <td className="label" style={{ width: 110 }}>거래일자</td>
              <td>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                  <div style={{ flex: '0 0 55%' }}>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={e => updateFormData('date', e.target.value)}
                      style={{ fontSize: '14px', fontWeight: 600, padding: '3px 4px', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 45%', paddingLeft: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 2 }}>거래번호</label>
                    <input
                      ref={documentNumberInputRef}
                      type="text"
                      value={formData.documentNumber}
                      onChange={e => {
                        documentNumberInputRef.current?.classList.remove('invalid');
                        updateFormData('documentNumber', e.target.value);
                        updateFormData('estimateNumber', e.target.value);
                      }}
                      placeholder=""
                      style={{
                        padding: '3px 4px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: (formData.inventoryDeducted || isTransactionDeducted(formData.documentNumber || formData.estimateNumber)) ? '#22c55e' : '#000000',
                        width: '100%'
                      }}
                    />
                  </div>
                </div>
              </td>
              <td className="label">사업자등록번호</td>
              <td>{displaySettings.bizNumber}</td>
            </tr>
            <tr>
              <td className="label">사업자등록번호</td>
              <td>
                <input
                  type="text"
                  value={formData.bizNumber}
                  onChange={e => updateFormData('bizNumber', e.target.value)}
                  placeholder=""
                />
              </td>
              <td className="label">상호명</td>
              <td>{displaySettings.companyName}</td>
            </tr>
            <tr>
              <td className="label">상호명</td>
              <td>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e => updateFormData('companyName', e.target.value)}
                  placeholder="" /* 상호명 입력 placeholder제거 (인쇄할떄나와서) */
                />
              </td>
              <td className="label">대표자</td>
              <td className="rep-cell" style={{ whiteSpace: 'nowrap' }}>
                <span className="ceo-inline">
                  <span className="ceo-name">{displaySettings.ceo}</span>
                  {displaySettings.stampImage && (
                    <img
                      src={displaySettings.stampImage}
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
                  onChange={e => updateFormData('topMemo', e.target.value)}
                  placeholder=""
                />
              </td>
              <td className="label">소재지</td>
              <td>{displaySettings.address}</td>
            </tr>
            <tr>
              <td className="label">TEL</td>
              <td>{displaySettings.tel}</td>
            </tr>
            <tr>
              <td className="label">홈페이지</td>
              <td>{displaySettings.website || displaySettings.homepage}</td>
            </tr>
            <tr>
              <td className="label">FAX</td>
              <td>{displaySettings.fax}</td>
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
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="text" value={it.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="품명" style={{ flex: 1 }} />
                  {it.note === '추가옵션' && (
                    <span style={{
                      fontSize: '10px',
                      color: '#17a2b8',
                      backgroundColor: '#d1ecf1',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      추가옵션
                    </span>
                  )}
                </div>
              </td>
              <td><input type="text" value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="단위" /></td>
              <td><input type="number" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="수량" /></td>
              <td><input type="number" value={it.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} placeholder="단가" /></td>
              <td className="right">{it.totalPrice ? parseInt(it.totalPrice).toLocaleString() : '0'}</td>
              <td><input type="text" value={it.note} onChange={e => updateItem(idx, 'note', e.target.value)} placeholder="" /></td>
              <td className="no-print">
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={formData.items.length === 1}
                  className="remove-btn"
                >삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!(showFaxModal || showSettingsModal) && (
        <div className="item-controls no-print" style={{ marginBottom: 18, display: (showFaxModal || showSettingsModal) ? 'none' : 'block' }}>
          <button type="button" onClick={addItem} className="add-item-btn">+ 품목 추가</button>
        </div>
      )}
      <MaterialSelector
        isOpen={showMaterialSelector}
        onClose={() => setShowMaterialSelector(false)}
        onAdd={handleMaterialAdd}
      />
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
          onChange={e => updateFormData('notes', e.target.value)}
          placeholder="기타 사항"
          rows={4}
        />
      </div>

      <div className="form-actions no-print" style={{ display: (showFaxModal || showSettingsModal) ? 'none' : 'flex' }}>
        <button
          type="button"
          onClick={handleSave}
          className="save-btn"
          ref={saveButtonRef}
        >
          저장하기
        </button>
        <button type="button" onClick={handleExportToExcel} className="excel-btn">엑셀로 저장하기</button>
        <button type="button" onClick={convertToPurchase} className="invoice-btn">발주서 생성</button>
        <button type="button" onClick={handlePrint} className="print-btn">인쇄하기</button>
        <button type="button" onClick={handleFaxPreview} className="fax-btn">📠 FAX 전송</button>
      </div>

      {/* ✅ 토스트 알림 */}
      <ToastNotification
        show={toast.show}
        message={toast.message}
        type={toast.type}
        anchorElement={saveButtonRef.current}
        duration={2000}
        onClose={() => setToast({ ...toast, show: false })}
      />

      {/* ✅ 확인 다이얼로그 */}
      <ConfirmDialog
        show={confirmDialog.show}
        message={confirmDialog.message}
        anchorElement={saveButtonRef.current}
        onConfirm={() => {
          if (confirmDialog.onConfirm) {
            confirmDialog.onConfirm();
          }
          setConfirmDialog({ ...confirmDialog, show: false });
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, show: false })}
      />

      <div className="form-company">({PROVIDER.companyName})</div>

      {showFaxModal && (
        <FaxPreviewModal
          pdfBlobURL={pdfBlobURL}
          onClose={handleCloseFaxModal}
          onSendFax={handleSendFax}
        />
      )}

      <DocumentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
};

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
      } catch { }
    }
  }
  return null;
}

export default EstimateForm;
