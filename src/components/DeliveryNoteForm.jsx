import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { exportToExcel } from '../utils/excelExport';
import { loadAdminPricesDirect, resolveAdminPrice } from '../utils/adminPriceHelper';
import { showInventoryResult } from './InventoryManager';
import '../styles/PurchaseOrderForm.css';
import { convertDOMToPDFBase64, base64ToBlobURL, sendFax } from '../utils/faxUtils'; // ✅ 추가
import { saveDocumentSync } from '../utils/realtimeAdminSync';
import { documentsAPI } from '../services/apiClient';
import { getDocumentSettings } from '../utils/documentSettings';
import DocumentSettingsModal from './DocumentSettingsModal';
import FaxPreviewModal from './FaxPreviewModal'; // ✅ 추가
import ToastNotification from './ToastNotification'; // ✅ 토스트 알림 추가
import ConfirmDialog from './ConfirmDialog'; // ✅ 확인 다이얼로그 추가
import { useProducts } from '../contexts/ProductContext'; // ✅ extraProducts 사용
import { getExtraOptionDisplayInfo, generateHighRackDisplayName, extractPartNameFromCleanName } from '../utils/bomDisplayNameUtils'; // ✅ 표시명 생성 유틸
import ItemSelector from './ItemSelector';      // 26_01_27 품목셀렉터 추가
import MaterialSelector from './MaterialSelector';  // 26_01_27 재고셀렉터 추가
import { generateInventoryPartId, mapExtraToBaseInventoryPart } from '../utils/unifiedPriceManager';
import { regenerateBOMFromDisplayName } from '../utils/bomRegeneration';

const PROVIDER = {
  bizNumber: '232-81-01750',
  companyName: '삼미앵글랙산업',
  ceo: '박이삭',
  address: '경기도 광명시 원노온사로 39, 철제 스틸하우스 1',
  website: 'http://www.ssmake.com',
  tel: '010-9548-9578  010-4311-7733',
  fax: '(02)2611-4595',
  stampImage: `${import.meta.env.BASE_URL}images/도장.png`
};

// ✅ 경량랙 색상 표시용 함수 (색상+부품명 조합)
const getMaterialDisplayName = (mat) => {
  const name = mat.name || '';
  // 경량랙 + 색상 있음 + 안전핀/안전좌 제외
  if (mat.rackType === '경량랙' && mat.color &&
    !['안전핀', '안전좌'].includes(mat.name)) {
    return `${mat.color}${name}`;  // "아이보리기둥", "블랙선반" 등
  }
  return name;
};

const DeliveryNoteForm = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const cartData = location.state || {};
  const {
    cart = [],
    totalBom = [],
    materials = [], // ✅ 추가
    estimateData = {}, // ✅ 추가
    customItems = [],
    customMaterials = [],
    editingDocumentId = null,
    editingDocumentType = null,
    editingDocumentData = {}
  } = cartData;

  const isEditMode = !!id;  // ✅ 원래대로

  // ✅ extraProducts 로드 (컴포넌트 최상위 레벨에서 호출)
  const { extraProducts } = useProducts();

  const documentNumberInputRef = useRef(null);
  const cartInitializedRef = useRef(false);

  // ✅ 관리자 체크
  const [isAdmin, setIsAdmin] = useState(false);
  // ✅ 설정 모달
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // ✅ 현재 전역 설정
  const [currentGlobalSettings, setCurrentGlobalSettings] = useState(null);

  // ✅ 토스트 알림 state 추가
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const saveButtonRef = useRef(null);

  // ✅ 확인 다이얼로그 state 추가
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    message: '',
    onConfirm: null
  });
  // 품목, 재고 셀렉터 
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);

  const adminPricesRef = useRef({});

  // ✅ FAX 관련 state 추가
  const [showFaxModal, setShowFaxModal] = useState(false);
  const [pdfBlobURL, setPdfBlobURL] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);

  const [formData, setFormData] = useState({
    date: editingDocumentData.date || estimateData.date || new Date().toISOString().split('T')[0],
    documentNumber: editingDocumentData.documentNumber || estimateData.estimateNumber || '',
    orderNumber: '',
    companyName: editingDocumentData.companyName || estimateData.companyName || '',
    bizNumber: editingDocumentData.bizNumber || estimateData.bizNumber || '',
    items: [
      { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    materials: materials || totalBom || [],
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    notes: editingDocumentData.notes || estimateData.notes || '',      // ✅ 수정
    topMemo: editingDocumentData.topMemo || estimateData.topMemo || '',   // ✅ 수정
    documentSettings: null,  // ✅ 이 문서의 회사정보
    // ✅ 재고 감소 상태 필드 (표시용)
    inventoryDeducted: false,
    inventoryDeductedAt: null
  });

  // ✅ 관리자 체크 및 전역 설정 로드
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

    const globalSettings = getDocumentSettings();
    setCurrentGlobalSettings(globalSettings);
  }, []);

  // 관리자 단가 로드
  useEffect(() => {
    adminPricesRef.current = loadAdminPricesDirect();
  }, []);

  // 기존 저장 데이터 로드 (편집 모드 또는 editingDocumentId가 있을 때)
  useEffect(() => {
    const docIdToLoad = isEditMode ? String(id) : (editingDocumentId ? String(editingDocumentId) : null);
    const docTypeToLoad = isEditMode ? 'delivery' : (editingDocumentType || 'estimate');

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

          // ✅ 저장된 cart에서 extraOptions 복원
          if (data.cart && Array.isArray(data.cart)) {
            console.log('✅ 저장된 cart에서 extraOptions 복원:', data.cart);
            // cart는 나중에 사용할 수 있도록 보관 (필요시)
          }

          // ✅ 편집 후 진입 시 state.totalBom으로 materials 보정 (비어 있으면)
          const materialsToUse = (editingDocumentId && totalBom && totalBom.length > 0 && (!data.materials || data.materials.length === 0))
            ? totalBom
            : (data.materials || []);

          // ✅ 편집 후 진입 시 state.editingDocumentData로 메타정보 보정 (비어 있으면)
          const mergedData = {
            ...data,
            date: data.date || editingDocumentData.date || data.date,
            documentNumber: data.documentNumber || editingDocumentData.documentNumber || data.documentNumber,
            companyName: data.companyName || editingDocumentData.companyName || data.companyName,
            bizNumber: data.bizNumber || editingDocumentData.bizNumber || data.bizNumber,
            notes: data.notes || editingDocumentData.notes || data.notes,
            topMemo: data.topMemo || editingDocumentData.topMemo || data.topMemo,
            materials: materialsToUse,
            documentSettings: data.documentSettings || null
          };

          setFormData(mergedData);

          // ✅ 문서 로드 완료 플래그 설정 (새 cart 반영 방지)
          cartInitializedRef.current = true;
        } catch (e) {
          console.error('거래명세서 로드 실패:', e);
        }
      }
    }
  }, [id, isEditMode, editingDocumentId, totalBom]);

  // 초기 cart / BOM 반영
  useEffect(() => {
    // 🔴 디버깅 로그 추가
    console.log('🚨🚨🚨 DeliveryNoteForm useEffect 진입 시도');
    console.log('  isEditMode:', isEditMode);
    console.log('  cart.length:', cart?.length);
    console.log('  totalBom.length:', totalBom?.length);
    console.log('  materials.length:', materials?.length);
    console.log('  cartInitializedRef.current:', cartInitializedRef.current);

    // ✅ 수정: isEditMode가 아닐 때만 실행하되, cartInitializedRef로 중복 실행 방지
    if (!isEditMode && (cart.length > 0 || totalBom.length > 0 || materials.length > 0) && !cartInitializedRef.current) {
      console.log('📦 신규 문서 초기 데이터 로드 시작');
      cartInitializedRef.current = true;
      adminPricesRef.current = loadAdminPricesDirect();

      const restoredCartItems = cart.map(item => {
        const qty = item.quantity || 1;
        // ✅ 원래 unitPrice 있으면 보존, 없으면 계산
        const unitPrice = item.customPrice || item.unitPrice || (item.totalPrice ? Math.round(item.totalPrice / qty) : Math.round((item.price || 0) / qty));
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

      // 🔴 디버깅 로그 추가
      console.log('🔍 incomingMaterials 확인:');
      console.log('  totalBom:', totalBom);
      console.log('  materials:', materials);
      console.log('  incomingMaterials:', incomingMaterials);
      console.log('  incomingMaterials.length:', incomingMaterials?.length);
      if (incomingMaterials && incomingMaterials.length > 0) {
        console.log('✅ 전달된 materials 사용');
        bomMaterials = incomingMaterials.map(m => {
          const adminPrice = resolveAdminPrice(adminPricesRef.current, m);
          const appliedUnitPrice = adminPrice && adminPrice > 0
            ? adminPrice
            : (Number(m.unitPrice) || 0);
          const quantity = Number(m.quantity) || 0;

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
            quantity,
            unitPrice: appliedUnitPrice,
            totalPrice: appliedUnitPrice * quantity,
            note: m.note || ''
          };
        });
      } else {
        console.warn('⚠️ totalBom 비어있음 - cart에서 BOM 추출 시도');

        // ✅ cart에서 직접 BOM 추출
        cart.forEach(item => {
          console.log('🔍 cart item:', item);
          console.log('🔍 item.bom:', item.bom);

          if (item.bom && Array.isArray(item.bom) && item.bom.length > 0) {
            item.bom.forEach(bomItem => {
              const adminPrice = resolveAdminPrice(adminPricesRef.current, bomItem);
              const appliedUnitPrice = adminPrice && adminPrice > 0 ? adminPrice : (Number(bomItem.unitPrice) || 0);
              const quantity = Number(bomItem.quantity) || 0;

              // ✅ 하이랙 부품의 경우 색상 정보가 포함된 이름 사용
              let displayName = bomItem.name;
              if (bomItem.rackType === '하이랙' && bomItem.colorWeight) {
                const partName = extractPartNameFromCleanName(bomItem.name) || bomItem.name;
                displayName = generateHighRackDisplayName(partName, bomItem.colorWeight);
              }

              bomMaterials.push({
                name: displayName,
                rackType: bomItem.rackType,
                specification: bomItem.specification || '',
                quantity,
                unitPrice: appliedUnitPrice,
                totalPrice: appliedUnitPrice * quantity,
                note: bomItem.note || ''
              });
            });
          } else if (item.displayName || item.name) {
            // ✅ item.bom이 없는 경우 이름에서 재생성 (History에서 넘어온 경우 등)
            console.log(`  🔄 BOM 없음 - 이름에서 재생성: ${item.displayName || item.name}`);
            const regenerated = regenerateBOMFromDisplayName(item.displayName || item.name, item.quantity || 1);
            regenerated.forEach(bomItem => {
              const adminPrice = resolveAdminPrice(adminPricesRef.current, bomItem);
              const appliedUnitPrice = adminPrice && adminPrice > 0 ? adminPrice : (Number(bomItem.unitPrice) || 0);

              bomMaterials.push({
                ...bomItem,
                unitPrice: appliedUnitPrice,
                totalPrice: appliedUnitPrice * (bomItem.quantity || 0)
              });
            });
          }
        });

        console.log('✅ cart에서 추출한 bomMaterials:', bomMaterials);
      }

      console.log('🔍 최종 bomMaterials:', bomMaterials);

      const allMaterials = [...bomMaterials, ...customMaterials];

      // ✅ 수정: 강제 설정
      setFormData(prev => ({
        ...prev,
        items: allItems.length ? allItems : [{ name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }],
        materials: allMaterials.length ? allMaterials : []
      }));
      // 🔴 디버깅 로그 추가
      console.log('🚀🚀🚀 DeliveryNoteForm setFormData 호출 완료!');
      console.log('  설정된 items 개수:', allItems.length);
      console.log('  설정된 materials 개수:', allMaterials.length);
      console.log('  allMaterials:', allMaterials);
    }
  }, [cart, totalBom, materials, customItems, customMaterials, isEditMode]);

  // 합계 계산 (BOM이 있고 matSum>0 이면 BOM, 아니면 itemSum)
  useEffect(() => {
    const materialsRecalc = formData.materials.map(mat => {
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
    const matSum = materialsRecalc.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const subtotal = (materialsRecalc.length > 0 && matSum > 0) ? matSum : itemSum;
    const tax = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + tax;

    setFormData(prev => {
      // ✅ materials가 비어있으면 기존 값 유지 (초기화 방지)
      const materialsToUse = materialsRecalc.length > 0 ? materialsRecalc : prev.materials;

      const materialsChanged = JSON.stringify(materialsToUse) !== JSON.stringify(prev.materials);
      const totalsChanged = prev.subtotal !== subtotal || prev.tax !== tax || prev.totalAmount !== totalAmount;

      if (!materialsChanged && !totalsChanged) {
        return prev;
      }
      return { ...prev, materials: materialsToUse, subtotal, tax, totalAmount };
    });
  }, [formData.items, formData.materials]);

  // ✅ 표시용 설정
  const displaySettings = formData.documentSettings || currentGlobalSettings || PROVIDER;
  const updateFormData = (f, v) => setFormData(prev => ({ ...prev, [f]: v }));

  const upItem = (idx, f, v) => {
    const items = [...formData.items];
    items[idx][f] = v;
    if (f === 'quantity' || f === 'unitPrice') {
      const q = parseFloat(items[idx].quantity) || 0;
      const u = parseFloat(items[idx].unitPrice) || 0;
      items[idx].totalPrice = q * u;
    }
    setFormData(p => ({ ...p, items }));
  };
  // const addItem=()=>setFormData(p=>({...p,items:[...p.items,{name:'',unit:'',quantity:'',unitPrice:'',totalPrice:'',note:''}]}));
  const addItem = () => {
    setShowItemSelector(true);  // 품목셀렉터 신규추가 (26_01_27)
  };
  const handleItemAdd = (itemData) => {
    // ✅ 품목 추가
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, itemData]
    }));

    // ✅ BOM 자동 생성 및 추가
    if (itemData.name) {
      const bom = regenerateBOMFromDisplayName(itemData.name, itemData.quantity || 1);

      if (bom && bom.length > 0) {
        // 관리자 단가 적용
        const bomWithAdminPrice = bom.map(bomItem => {
          const adminPrice = resolveAdminPrice(adminPricesRef.current, bomItem);
          const appliedUnitPrice = adminPrice && adminPrice > 0 ? adminPrice : (Number(bomItem.unitPrice) || 0);
          const quantity = Number(bomItem.quantity) || 0;

          return {
            ...bomItem,
            unitPrice: appliedUnitPrice,
            totalPrice: appliedUnitPrice * quantity
          };
        });

        // materials에 추가
        setFormData(prev => ({
          ...prev,
          materials: [...prev.materials, ...bomWithAdminPrice]
        }));
      }
    }
  };
  const rmItem = (idx) => setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const upMat = (idx, f, v) => {
    const materials = [...formData.materials];
    materials[idx][f] = v;
    if (f === 'quantity' || f === 'unitPrice') {
      const q = parseFloat(materials[idx].quantity) || 0;
      const u = parseFloat(materials[idx].unitPrice) || 0;
      materials[idx].totalPrice = q * u;
    }
    setFormData(p => ({ ...p, materials }));
  };
  // const addMaterial=()=>setFormData(p=>({...p,materials:[...p.materials,{name:'',specification:'',quantity:'',unitPrice:'',totalPrice:'',note:''}]}));
  const addMaterial = () => {
    setShowMaterialSelector(true);  // 재고셀렉터 신규추가(26_01_27)
  };
  const handleMaterialAdd = (materialData) => {
    // ✅ inventoryPartId 생성 (청구서쪽에서 재고감소용)
    const materialWithId = {
      ...materialData,
      inventoryPartId: (() => {
        const rawId = generateInventoryPartId({
          rackType: materialData.rackType || '기타',
          name: materialData.name,
          specification: materialData.specification || '',
          colorWeight: materialData.colorWeight || ''
        });
        return mapExtraToBaseInventoryPart(rawId);
      })()
    };

    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, materialWithId]
    }));
  };
  const rmMat = (idx) => setFormData(p => ({ ...p, materials: p.materials.filter((_, i) => i !== idx) }));

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
      existingDoc = findDocumentByNumber(formData.documentNumber, 'delivery');
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
        itemId = `delivery_${Date.now()}`;  // ✅ prefix 추가
      }
    }

    // 저장 로직 실행
    await proceedWithSave(itemId, existingDoc);
  };

  // ✅ 저장 로직 분리
  const proceedWithSave = async (itemId, existingDoc) => {
    const storageKey = `delivery_${itemId}`;

    // ✅ cart에서 extraOptions 추출 (문서 저장 시 포함)
    const cartWithExtraOptions = cart.map(item => ({
      ...item,
      extraOptions: item.extraOptions || []
    }));

    const newDoc = {  // ✅ 기존 변수명 그대로 사용
      ...formData,
      id: itemId,
      type: 'delivery',
      // ✅ extraOptions 저장 (문서 로드 시 복원용)
      cart: cartWithExtraOptions,
      status: formData.status || '진행 중',
      deliveryNumber: formData.documentNumber,
      // ✅ 문서 설정: 편집=기존유지, 신규=현재전역설정
      documentSettings: (existingDoc || isEditMode || editingDocumentId)
        ? (formData.documentSettings || currentGlobalSettings)
        : currentGlobalSettings,
      customerName: formData.companyName,
      productType: formData.items[0]?.name || '',
      quantity: formData.items.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0),
      unitPrice: formData.items[0] ? (parseInt(formData.items[0].unitPrice) || 0) : 0,
      totalPrice: formData.totalAmount,
      updatedAt: new Date().toISOString(),
      ...(isEditMode ? {} : { createdAt: new Date().toISOString() })
    };

    // ✅ 레거시 키 저장
    localStorage.setItem(storageKey, JSON.stringify(newDoc));

    // ✅ 서버 동기화 저장 추가
    const success = await saveDocumentSync(newDoc);

    if (success) {
      try {
        await documentsAPI.save(newDoc.id, {
          docId: newDoc.id,
          type: newDoc.type,
          date: newDoc.date,
          documentNumber: newDoc.deliveryNumber || newDoc.documentNumber,
          companyName: newDoc.companyName,
          bizNumber: newDoc.bizNumber,
          items: newDoc.items || [],
          materials: newDoc.materials || [],
          subtotal: newDoc.subtotal,
          tax: newDoc.tax,
          totalAmount: newDoc.totalAmount,
          notes: newDoc.notes,
          topMemo: newDoc.topMemo,
          inventoryDeducted: newDoc.inventoryDeducted,
          inventoryDeductedAt: newDoc.inventoryDeductedAt,
          inventoryDeductedBy: newDoc.inventoryDeductedBy
        });
      } catch (err) {
        console.error('문서 즉시 서버 저장 실패:', err);
      }
      setToast({
        show: true,
        message: isEditMode ? '문서가 수정되었습니다.' : '문서가 저장되었습니다.',
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

  const handleExport = () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      return;
    }
    exportToExcel(formData, 'delivery')
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
      const docElement = document.querySelector('.purchase-order-form-container');
      if (!docElement) {
        alert('문서 영역을 찾을 수 없습니다.');
        return;
      }

      alert('PDF 생성 중입니다. 잠시만 기다려주세요...');

      const base64 = await convertDOMToPDFBase64(docElement);
      setPdfBase64(base64);

      const blobURL = base64ToBlobURL(base64);
      setPdfBlobURL(blobURL);

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
    <div className="purchase-order-form-container">
      {/* ✅ 문서 양식 수정 버튼 (관리자만) */}
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
        <h1>거&nbsp;래&nbsp;명&nbsp;세&nbsp;서</h1>
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
                    <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: 2 }}>거래번호</label>
                    <input
                      ref={documentNumberInputRef}
                      type="text"
                      value={formData.documentNumber}
                      onChange={e => {
                        documentNumberInputRef.current?.classList.remove('invalid');
                        updateFormData('documentNumber', e.target.value);
                        updateFormData('orderNumber', e.target.value);
                      }}
                      style={{ padding: '3px 4px', fontSize: '18px', fontWeight: 'bold', color: '#000000', width: '100%' }}
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
                  placeholder="" /* 상호명 placeholder제거 (인쇄에 미포함되도록) */
                />
              </td>
              <td className="label">대표자</td>
              <td className="rep-cell" style={{ whiteSpace: 'nowrap' }}>
                <span className="ceo-inline">
                  <span className="ceo-name">{displaySettings.ceo}</span>
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
                  onChange={e => updateFormData('topMemo', e.target.value)}
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
              <td>{displaySettings.website}</td>
            </tr>
            <tr>
              <td className="label">FAX</td>
              <td>{displaySettings.fax}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: '14px 0 6px', fontSize: 16 }}>품목 목록</h3>
      <table className="form-table order-table">
        <thead>
          <tr>
            <th style={{ width: '50px' }}>NO</th>
            <th>품명</th>
            <th style={{ width: '70px' }}>단위</th>
            <th style={{ width: '90px' }}>수량</th>
            <th style={{ width: '110px' }}>단가</th>
            <th style={{ width: '120px' }}>공급가</th>
            <th style={{ width: '120px' }}>비고</th>
            <th className="no-print" style={{ width: '70px' }}>작업</th>
          </tr>
        </thead>
        <tbody>
          {formData.items.map((it, idx) => (
            <tr key={`item-${idx}`}>
              <td>{idx + 1}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="text" value={it.name} onChange={e => upItem(idx, 'name', e.target.value)} placeholder="품명" style={{ flex: 1 }} />
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
              <td><input type="text" value={it.unit} onChange={e => upItem(idx, 'unit', e.target.value)} placeholder="단위" /></td>
              <td><input type="number" value={it.quantity} onChange={e => upItem(idx, 'quantity', e.target.value)} placeholder="수량" /></td>
              <td><input type="number" value={it.unitPrice} onChange={e => upItem(idx, 'unitPrice', e.target.value)} placeholder="단가" /></td>
              <td className="right">{it.totalPrice ? parseInt(it.totalPrice).toLocaleString() : '0'}</td>
              <td><input type="text" value={it.note} onChange={e => upItem(idx, 'note', e.target.value)} placeholder="" /></td>
              <td className="no-print">
                <button type="button" onClick={() => rmItem(idx)} disabled={formData.items.length === 1} className="remove-btn">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!(showFaxModal || showSettingsModal) && (
        <div className="item-controls no-print" style={{ marginBottom: 18, display: showFaxModal ? 'none' : 'block' }}>
          <button type="button" onClick={addItem} className="add-item-btn">+ 품목 추가</button>
        </div>
      )}

      <ItemSelector
        isOpen={showItemSelector}
        onClose={() => setShowItemSelector(false)}
        onAdd={handleItemAdd}
      />

      <h3 style={{ margin: '14px 0 6px', fontSize: 16 }}>원자재 명세서</h3>
      <table className="form-table bom-table">
        <thead>
          <tr>
            <th style={{ width: '50px' }}>NO</th>
            <th style={{ width: '350px' }}>부품명</th>
            <th className="spec-col" style={{ width: '150px' }}>규격</th>
            <th style={{ width: '70px' }}>수량</th>
            <th style={{ width: '70px', display: 'none' }}>단가</th>
            <th style={{ width: '90px', display: 'none' }}>금액</th>
            <th style={{ width: '90px' }}>비고</th>
            <th className="no-print" style={{ width: '70px' }}>작업</th>
          </tr>
        </thead>
        <tbody>
          {formData.materials.map((m, idx) => (
            <tr key={`mat-${idx}`}>
              <td>{idx + 1}</td>
              <td><input type="text" value={getMaterialDisplayName(m)} onChange={e => upMat(idx, 'name', e.target.value)} placeholder="부품명" /></td>
              <td className="spec-cell">
                <input
                  type="text"
                  value={m.specification}
                  onChange={e => upMat(idx, 'specification', e.target.value)}
                  placeholder=""
                />
              </td>
              <td><input type="number" value={m.quantity} onChange={e => updateMaterial(idx, 'quantity', e.target.value)} placeholder="수량" /></td>
              <td style={{ display: 'none' }}><input type="number" value={m.unitPrice} onChange={e => updateMaterial(idx, 'unitPrice', e.target.value)} placeholder="단가" /></td>
              <td style={{ display: 'none' }} className="right">{m.totalPrice ? parseInt(m.totalPrice).toLocaleString() : '0'}</td>
              <td><input type="text" value={m.note} onChange={e => updateMaterial(idx, 'note', e.target.value)} placeholder="" /></td>
              <td className="no-print">
                <button type="button" onClick={() => rmMat(idx)} className="remove-btn">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="item-controls no-print" style={{ marginBottom: 18, display: (showFaxModal || showSettingsModal) ? 'none' : 'block' }}>
        <button type="button" onClick={addMaterial} className="add-item-btn">+ 자재 추가</button>
      </div>
      <MaterialSelector
        isOpen={showMaterialSelector}
        onClose={() => setShowMaterialSelector(false)}
        onAdd={handleMaterialAdd}
      />
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
        <button type="button" onClick={exportToExcel} className="excel-btn">엑셀로 저장하기</button>

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

      {/* ✅ 문서 양식 설정 모달 */}
      <DocumentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          const globalSettings = getDocumentSettings();
          setCurrentGlobalSettings(globalSettings);
        }}
      />
    </div>
  );
};

// ✅ 파일 맨 아래, export default 바로 위에 추가
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

export default DeliveryNoteForm;
