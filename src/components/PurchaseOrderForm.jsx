import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { exportToExcel, generateFileName } from '../utils/excelExport';
import { loadAdminPricesDirect, resolveAdminPrice } from '../utils/adminPriceHelper';
import { deductInventoryOnPrint, showInventoryResult } from './InventoryManager';
import '../styles/PurchaseOrderForm.css';
import { generatePartId, generateInventoryPartId } from '../utils/unifiedPriceManager';
import { saveDocumentSync } from '../utils/realtimeAdminSync';
import { documentsAPI } from '../services/apiClient';
import { getDocumentSettings } from '../utils/documentSettings';
import DocumentSettingsModal from './DocumentSettingsModal';
import { convertDOMToPDFBase64, base64ToBlobURL, sendFax } from '../utils/faxUtils'; // ✅ 추가
import FaxPreviewModal from './FaxPreviewModal'; // ✅ 추가
import ToastNotification from './ToastNotification'; // ✅ 토스트 알림 추가
import ConfirmDialog from './ConfirmDialog'; // ✅ 확인 다이얼로그 추가
import { useProducts } from '../contexts/ProductContext'; // ✅ extraProducts 사용
import { getExtraOptionDisplayInfo, generateHighRackDisplayName, extractPartNameFromCleanName } from '../utils/bomDisplayNameUtils'; // ✅ 표시명 생성 유틸
import MaterialSelector from './MaterialSelector';  // 26_01_27 신규기능추가 
import { regenerateBOMFromDisplayName } from '../utils/bomRegeneration';

const PROVIDER = {
  bizNumber: '232-81-01750',
  companyName: '삼미앵글랙산업',
  ceo: '박이삭',
  address: '경기도 광명시 원노온사로 39, 철제 스틸하우스 1',
  website: 'http://www.ssmake.com',
  tel: '010-9548-9578\n010-4311-7733',
  fax: '(02)2611-4595',
  stampImage: `${import.meta.env.BASE_URL}images/도장.png`
};

const PurchaseOrderForm = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const cartData = location.state || {};
  const {
    cart = [],
    totalBom = [],
    materials = [], // ✅ 추가
    estimateData = {},
    customItems = [],
    customMaterials = [],
    editingDocumentId = null,
    editingDocumentType = null,
    editingDocumentData = {}
  } = cartData;

  const isEditMode = !!id;  // ✅ 원래대로

  // ✅ extraProducts 로드 (컴포넌트 최상위 레벨에서 호출 - React Hook 규칙 준수)
  const { extraProducts } = useProducts();

  const documentNumberInputRef = useRef(null);
  const adminPricesRef = useRef({});
  const cartInitializedRef = useRef(false);

  // ✅ 관리자 체크
  const [isAdmin, setIsAdmin] = useState(false);
  // ✅ 설정 모달
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // ✅ 현재 전역 설정
  const [currentGlobalSettings, setCurrentGlobalSettings] = useState(null);

  // ✅ FAX 관련 state 추가
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

  const [formData, setFormData] = useState({
    date: editingDocumentData.date || estimateData.date || new Date().toISOString().split('T')[0],
    documentNumber: editingDocumentData.documentNumber || estimateData.estimateNumber || '',
    orderNumber: '',
    companyName: editingDocumentData.companyName || estimateData.companyName || '',
    bizNumber: editingDocumentData.bizNumber || estimateData.bizNumber || '',
    items: [
      { name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }
    ],
    materials: materials || totalBom || [], // ✅ state.materials 우선, 없으면 totalBom
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    notes: editingDocumentData.notes || estimateData.notes || '',
    topMemo: editingDocumentData.topMemo || estimateData.topMemo || '',
    documentSettings: null  // ✅ 이 문서의 회사정보
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

  // 기존 저장 문서 로드 (편집 모드 또는 editingDocumentId가 있을 때)
  useEffect(() => {
    const docIdToLoad = isEditMode ? String(id) : (editingDocumentId ? String(editingDocumentId) : null);
    const docTypeToLoad = isEditMode ? 'purchase' : (editingDocumentType || 'estimate');

    if (docIdToLoad) {
      // ✅ .0 접미사 방지를 위해 ID를 문자열로 정규화
      const normalizedId = docIdToLoad.replace(/\.0$/, '');
      const storageKey = `${docTypeToLoad}_${normalizedId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);

          // ✅ 원자재 검증: 비정상적인 수량 체크 (10000개 이상)
          const hasBadMaterials = (data.materials || []).some(mat =>
            Number(mat.quantity) > 10000
          );

          if (hasBadMaterials || !data.materials || data.materials.length === 0) {
            console.warn('⚠️ 원자재 데이터 손상 감지 - 재생성 시작');

            // ✅ items에서 BOM 재생성
            const allBoms = [];
            (data.items || []).forEach(item => {
              if (item.name) {
                const bom = regenerateBOMFromDisplayName(item.name, item.quantity || 1);

                if (bom.length === 0) {
                  // 기타 품목
                  const qty = Number(item.quantity) || 1;
                  const totalPrice = Number(item.totalPrice) || 0;
                  const unitPrice = item.customPrice || item.unitPrice || (item.totalPrice ? Math.round(item.totalPrice / qty) : Math.round((item.price || 0) / qty));
                  allBoms.push({
                    rackType: '기타',
                    name: item.name,
                    specification: '',
                    quantity: qty,
                    unitPrice: unitPrice,
                    totalPrice: totalPrice,
                    note: '기타 품목'
                  });
                } else {
                  allBoms.push(...bom);
                }
              }
            });

            // ✅ 중복 제거 및 수량 합산
            const bomMap = new Map();
            allBoms.forEach(item => {
              const key = generatePartId(item);
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

            console.log('✅ 원자재 재생성 완료:', data.materials.length, '개');

            // ✅ 즉시 저장 (손상된 데이터 덮어쓰기)
            localStorage.setItem(storageKey, JSON.stringify(data));
          }

          // ✅ 편집 후 진입 시 state.totalBom으로 materials 보정 (비어 있으면)
          if (editingDocumentId && totalBom && totalBom.length > 0 && (!data.materials || data.materials.length === 0)) {
            data.materials = totalBom;
          }

          // ✅ 편집 후 진입 시 state.cart로 items 보정 (비어 있으면)
          if (editingDocumentId && cart && cart.length > 0 && (!data.items || data.items.length === 0 || (data.items.length === 1 && !data.items[0].name))) {
            const loadedCartItems = cart.map(item => {
              const qty = item.quantity || 1;
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
            data.items = loadedCartItems;
          }

          // ✅ 편집 후 진입 시 state.editingDocumentData로 메타정보 보정 (비어 있으면)
          const mergedData = {
            ...data,
            date: data.date || editingDocumentData.date || estimateData.date || data.date,
            documentNumber: data.documentNumber || data.purchaseNumber || editingDocumentData.documentNumber || estimateData.estimateNumber || data.documentNumber,
            companyName: data.companyName || editingDocumentData.companyName || estimateData.companyName || data.companyName,
            bizNumber: data.bizNumber || editingDocumentData.bizNumber || estimateData.bizNumber || data.bizNumber,
            notes: data.notes || editingDocumentData.notes || estimateData.notes || data.notes,
            topMemo: data.topMemo || editingDocumentData.topMemo || estimateData.topMemo || data.topMemo,
            documentSettings: data.documentSettings || null
          };

          // ✅ materials 디버깅 로그 추가
          console.log('🔍🔍🔍 PurchaseOrderForm: 문서 로드 완료 🔍🔍🔍');
          console.log('📦 최종 materials:', data.materials);
          console.log('📦 materials 개수:', data.materials?.length || 0);

          setFormData(mergedData);

          // ✅ 문서 로드 완료 플래그 설정 (새 cart 반영 방지)
          cartInitializedRef.current = true;
        } catch (e) {
          console.error('청구서 로드 실패:', e);
        }
      }
    }
  }, [id, isEditMode, editingDocumentId, totalBom]);

  // 초기 cart / BOM 반영 (관리자 단가 재적용)
  useEffect(() => {
    // ✅ 수정: isEditMode가 아닐 때만 실행하되, cartInitializedRef로 중복 실행 방지
    if (!isEditMode && (cart.length > 0 || totalBom.length > 0 || materials.length > 0) && !cartInitializedRef.current) {
      console.log('📦 신규 문서 초기 데이터 로드 시작');
      cartInitializedRef.current = true;
      adminPricesRef.current = loadAdminPricesDirect();

      // items 복원 (cart 우선, 없으면 totalBom에서 역추적? 아니면 그냥 cart)
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

      if (incomingMaterials && incomingMaterials.length > 0) {
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
            colorWeight: m.colorWeight || '',  // ✅ HiRack 색상+중량 정보 보존  
            color: m.color || '',              // ✅ 경량랙 색상 정보 보존  
            quantity,
            unitPrice: appliedUnitPrice,
            totalPrice: appliedUnitPrice * quantity,
            note: m.note || ''
          };
        });
      } else {
        // ✅ totalBom이 없으면 cart에서 직접 BOM 추출
        cart.forEach(item => {
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
      }

      const allMaterials = [...bomMaterials, ...customMaterials];

      // ✅ 수정: 강제 설정
      setFormData(prev => ({
        ...prev,
        items: allItems.length ? allItems : [{ name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '' }],
        materials: allMaterials.length ? allMaterials : []
      }));
    }
  }, [cart, totalBom, materials, customItems, customMaterials, isEditMode]);
  // ✅ 합계 계산: 무조건 품목 목록(items) 기준 (1126_1621수정)
  useEffect(() => {
    // ✅ materials가 비어있어도 합계 계산은 수행해야 함 (items 기준이므로)
    // if (formData.materials.length === 0) {
    //   return;
    // }

    const materialsWithAdmin = formData.materials.map(mat => {
      const adminPrice = resolveAdminPrice(adminPricesRef.current, mat);
      const quantity = Number(mat.quantity) || 0;
      // ✅ 수정: mat과 quantity 사용
      const unitPrice = mat.customPrice || mat.unitPrice || (mat.totalPrice ? Math.round(mat.totalPrice / quantity) : Math.round((mat.price || 0) / quantity));
      return {
        ...mat,
        unitPrice,
        totalPrice: unitPrice * quantity
      };
    });

    const itemSum = formData.items.reduce((s, it) => s + (parseFloat(it.totalPrice) || 0), 0);
    const subtotal = itemSum;
    const tax = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + tax;

    setFormData(prev => {
      // ✅ 변경 없으면 같은 객체 반환
      const materialsChanged = JSON.stringify(materialsWithAdmin) !== JSON.stringify(prev.materials);
      const totalsChanged = prev.subtotal !== subtotal || prev.tax !== tax || prev.totalAmount !== totalAmount;

      if (!materialsChanged && !totalsChanged) {
        return prev;
      }
      return {
        ...prev,
        materials: materialsWithAdmin,
        subtotal,
        tax,
        totalAmount
      };
    });
  }, [formData.items, formData.materials]);


  // ✅ 표시용 설정
  const displaySettings = formData.documentSettings || currentGlobalSettings || PROVIDER;
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
    setSelectorTarget('item');
    setShowMaterialSelector(true);
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
    setSelectorTarget('material');
    setShowMaterialSelector(true);
  };


  const handleMaterialAdd = (materialData) => {
    // ✅ inventoryPartId 생성 (재고 감소용)
    const materialWithId = {
      ...materialData,
      inventoryPartId: materialData.isService ? null : (materialData.inventoryPartId || generateInventoryPartId({
        rackType: materialData.rackType || '기타',
        name: materialData.name,
        specification: materialData.specification || '',
        colorWeight: materialData.colorWeight || ''
      }))
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
          nextState.materials = [...prev.materials, materialWithId];
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

  const removeMaterial = (idx) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async () => {
    if (!formData.documentNumber.trim()) {
      // 거래번호 입력 요청은 토스트로 표시
      setToast({
        show: true,
        message: '거래번호(문서번호)를 입력해주세요.',
        type: 'error'
      });
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
      existingDoc = findDocumentByNumber(formData.documentNumber, 'purchase');
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
        // 새 문서
        itemId = Date.now();
      }
    }

    // 저장 로직 실행
    await proceedWithSave(itemId, existingDoc);
  };

  // ✅ 저장 로직 분리
  const proceedWithSave = async (itemId, existingDoc) => {
    const storageKey = `purchase_${itemId}`;

    // ✅ cart에서 extraOptions 추출 (문서 저장 시 포함)
    const cartWithExtraOptions = cart.map(item => ({
      ...item,
      extraOptions: item.extraOptions || []
    }));

    const newOrder = {
      ...formData,
      id: itemId,
      type: 'purchase',
      status: formData.status || '진행 중',
      purchaseNumber: formData.documentNumber,
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
      // ✅ extraOptions 저장 (문서 로드 시 복원용)
      cart: cartWithExtraOptions,
      ...(isEditMode ? {} : { createdAt: new Date().toISOString() })
    };

    // ✅ 레거시 키 저장 (하위 호환)
    localStorage.setItem(storageKey, JSON.stringify(newOrder));

    // ✅ 서버 동기화 저장 (필수!)
    const success = await saveDocumentSync(newOrder);

    if (success) {
      try {
        await documentsAPI.save(newOrder.id, {
          docId: newOrder.id,
          type: newOrder.type,
          date: newOrder.date,
          documentNumber: newOrder.purchaseNumber,
          companyName: newOrder.companyName,
          bizNumber: newOrder.bizNumber,
          items: newOrder.items || [],
          materials: newOrder.materials || [],
          subtotal: newOrder.subtotal,
          tax: newOrder.tax,
          totalAmount: newOrder.totalAmount,
          notes: newOrder.notes,
          topMemo: newOrder.topMemo
        });
      } catch (err) {
        console.error('문서 즉시 서버 저장 실패:', err);
      }
      // ✅ 토스트 알림으로 변경
      setToast({
        show: true,
        message: isEditMode ? '청구서가 수정되었습니다.' : '청구서가 저장되었습니다.',
        type: 'success'
      });

      // ✅ 문서 업데이트 이벤트 발생
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
    exportToExcel(formData, 'purchase')
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

    // ✅ 1단계: 재고 부족 여부 체크
    if (cart && cart.length > 0) {
      const checkResult = await checkInventoryAvailability(cart);

      if (checkResult.warnings && checkResult.warnings.length > 0) {
        // ✅ 재고 부족 패널 표시 (confirm 창 제거)
        window.dispatchEvent(new CustomEvent('showShortageInventoryPanel', {
          detail: {
            shortageItems: checkResult.warnings.map(w => ({
              partId: w.partId,
              name: w.name,
              specification: w.specification,
              rackType: w.rackType,
              quantity: w.required,
              requiredQuantity: w.required,
              serverInventory: w.available,
              shortage: w.shortage,
              isShortage: true
            })),
            documentType: '청구서 (인쇄)',
            timestamp: Date.now(),
            // ✅ 콜백 함수 추가
            onConfirm: () => {
              // "무시하고 인쇄" 클릭 시 실행
              proceedWithPrint();
            },
            onCancel: () => {
              alert('인쇄가 취소되었습니다.\n재고는 감소되지 않았습니다.');
            }
          }
        }));

        return;  // ✅ 여기서 리턴 (패널에서 선택하도록)
      }
    }

    // 재고 부족 없으면 바로 인쇄
    await proceedWithPrint();
  };

  // ✅ 실제 인쇄 로직 분리
  const proceedWithPrint = async () => {
    // ✅ 1. 브라우저 인쇄 다이얼로그 표시
    window.print();

    // ✅ 2. 인쇄 다이얼로그가 닫힌 후 재고 감소 여부 확인
    setTimeout(async () => {
      const confirmDeduct = window.confirm(
        '인쇄가 완료되었습니까?\n\n' +
        '✅ 확인: 재고 감소 (부족한 부품은 0으로 처리)\n' +
        '❌ 취소: 재고 유지'
      );

      if (confirmDeduct && cart && cart.length > 0) {
        // ✅ 재고 감소 실행 (청구서 생성 플로우: cart에 bom 없으면 formData.materials 사용)
        const materialsForDeduct = (() => {
          // 1) cart에 bom이 있으면 cart 사용
          if (!cart.every(i => !i.bom?.length)) {
            return cart;
          }

          // 2) cart에 bom 없으면 formData.materials에서 정확히 필터링
          if (formData.materials?.length > 0) {
            const filtered = formData.materials.filter(m => {
              // undefined, null 제거
              if (!m) return false;
              // 서비스 항목 제거
              if (m.isService) return false;
              // inventoryPartId 없는 항목 제거
              if (!m.inventoryPartId || m.inventoryPartId === '--') return false;
              return true;
            });

            console.log('🔍 재고 감소 대상 필터링 결과:', filtered.map(m => ({
              name: m.name,
              inventoryPartId: m.inventoryPartId,
              quantity: m.quantity
            })));

            return filtered.length > 0 ? filtered : undefined;
          }

          return undefined;
        })();

        console.log('🔍🔍🔍 재고 감소 직전 materials 확인:', formData.materials.map(m => ({
          name: m.name,
          inventoryPartId: m.inventoryPartId
        })));
        const result = await deductInventoryOnPrint(cart, '청구서', formData.documentNumber, materialsForDeduct);

        if (result.success) {
          let message = '✅ 재고가 감소되었습니다.\n\n';

          // ✅ 정상 감소된 부품
          const normalParts = result.deductedParts.filter(p => !p.wasShortage);
          const shortageParts = result.deductedParts.filter(p => p.wasShortage);

          if (normalParts.length > 0) {
            message += `📦 정상 감소: ${normalParts.length}개 부품\n`;
          }

          // ✅ 부족하여 0으로 처리된 부품
          if (shortageParts.length > 0) {
            message += `⚠️ 재고 부족 (0으로 처리): ${shortageParts.length}개 부품\n\n`;

            // 최대 3개만 표시
            const displayParts = shortageParts.slice(0, 3);
            displayParts.forEach(p => {
              message += `  • ${p.name}: ${p.deducted}개 감소 → 재고 0\n`;
            });

            if (shortageParts.length > 3) {
              message += `  • 외 ${shortageParts.length - 3}개 부품...\n`;
            }

            message += '\n재고 관리 탭에서 부족한 부품을 확인하세요.';
          }

          alert(message);
        } else {
          alert(`❌ 재고 감소 실패: ${result.message}`);
        }
      } else {
        alert('재고가 감소되지 않았습니다.');
      }
    }, 500);
  };

  // ✅ FAX 전송 버튼 클릭 시 - 재고부터 체크 후 PDF 생성
  const handleFaxPreview = async () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호(문서번호)를 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }

    // ✅ 1단계: 재고 체크
    if (cart && cart.length > 0) {
      const checkResult = await checkInventoryAvailability(cart);

      // ✅ 전체 BOM 목록 추출 (부족 여부 상관없이 모든 BOM)
      const allBomItems = [];
      cart.forEach((item) => {
        if (item.bom && Array.isArray(item.bom) && item.bom.length > 0) {
          allBomItems.push(...item.bom);
        }
      });

      // ✅ 재고 부족이 있든 없든 패널 표시 (전체 BOM 현황 보여주기 위해)
      if (checkResult.warnings && checkResult.warnings.length > 0) {
        window.dispatchEvent(new CustomEvent('showShortageInventoryPanel', {
          detail: {
            shortageItems: checkResult.warnings.map(w => ({
              partId: w.partId,
              name: w.name,
              specification: w.specification,
              rackType: w.rackType,
              quantity: w.required,
              requiredQuantity: w.required,
              serverInventory: w.available,
              shortage: w.shortage,
              isShortage: true,
              colorWeight: w.colorWeight || ''
            })),
            allBomItems: allBomItems,  // ✅ 전체 BOM 추가
            documentType: '청구서 (FAX)',
            timestamp: Date.now(),
            onConfirm: () => {
              // "무시하고 진행" 클릭 시
              proceedWithFaxPreview();
            },
            onCancel: () => {
              alert('FAX 전송이 취소되었습니다.');
            }
          }
        }));

        return;  // ✅ 패널에서 사용자 선택 대기
      }
    }

    // 재고 부족 없으면 바로 PDF 생성
    await proceedWithFaxPreview();
  };

  // ✅ 실제 PDF 생성 및 FAX 모달 표시
  const proceedWithFaxPreview = async () => {
    try {
      const docElement = document.querySelector('.purchase-order-form-container');
      if (!docElement) { alert('문서 영역을 찾을 수 없습니다.'); return; }

      // ✅ 캡처 모드 ON
      docElement.classList.add('fax-capture');

      const base64 = await convertDOMToPDFBase64(docElement);

      setPdfBase64(base64);
      setPdfBlobURL(base64ToBlobURL(base64));
      setShowFaxModal(true);
    } catch (e) {
      console.error(e);
      alert(`PDF 생성에 실패했습니다.\n오류: ${e.message}`);
    } finally {
      // ✅ 캡처 모드 OFF
      const el = document.querySelector('.purchase-order-form-container');
      el?.classList.remove('fax-capture');
    }
  };

  // ✅ handleSendFax는 이제 재고 체크 없이 바로 전송만 수행
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

        // ✅ FAX 전송 성공 후 재고 감소
        if (cart && cart.length > 0) {
          const materialsForDeductFax = (cart.every(i => !i.bom?.length) && formData.materials?.length)
            ? formData.materials.filter(m => !m.isService)
            : undefined;
          const deductResult = await deductInventoryOnPrint(cart, '청구서(FAX)', formData.documentNumber, materialsForDeductFax);

          if (deductResult.success) {
            if (deductResult.warnings && deductResult.warnings.length > 0) {
              console.warn(`⚠️ ${deductResult.warnings.length}개 부품 재고 부족`);
            } else {
              console.log('✅ 재고가 정상적으로 감소되었습니다.');
            }
          } else {
            console.error(`❌ 재고 감소 실패: ${deductResult.message}`);
          }
        }
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

  // ✅ 실제 FAX 전송 로직 분리
  const proceedWithFax = async (faxNumber) => {
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

        // ✅ FAX 전송 성공 후 재고 감소
        if (cart && cart.length > 0) {
          const materialsForDeduct = !cart.every(i => !i.bom?.length)
            ? cart
            : (formData.materials?.length > 0
              ? formData.materials.filter(m => m && !m.isService && m.inventoryPartId)  // ← 필터 강화
              : undefined);
          const deductResult = await deductInventoryOnPrint(cart, '청구서(FAX)', formData.documentNumber, materialsForDeductFax);

          if (deductResult.success) {
            if (deductResult.warnings && deductResult.warnings.length > 0) {
              console.warn(`⚠️ ${deductResult.warnings.length}개 부품 재고 부족`);
            } else {
              console.log('✅ 재고가 정상적으로 감소되었습니다.');
            }
          } else {
            console.error(`❌ 재고 감소 실패: ${deductResult.message}`);
          }
        }
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

  const handleCreatePurchase = () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호를 먼저 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }

    // 현재 formData를 청구서로 전달
    navigate('/purchase-order/new', {
      state: {
        cart: [],
        totalBom: formData.materials || [],
        customItems: formData.items || [],
        customMaterials: [],
        editingDocumentData: {
          documentNumber: formData.documentNumber,
          companyName: formData.companyName,
          bizNumber: formData.bizNumber,
          date: formData.date,
          notes: formData.notes,
          topMemo: formData.topMemo
        }
      }
    });
  };

  const handleCreateDelivery = () => {
    if (!formData.documentNumber.trim()) {
      alert('거래번호를 먼저 입력해주세요.');
      documentNumberInputRef.current?.focus();
      return;
    }

    // 현재 formData를 거래명세서로 전달
    navigate('/delivery-note/new', {
      state: {
        cart: [],
        totalBom: formData.materials || [],
        customItems: formData.items || [],
        customMaterials: [],
        editingDocumentData: {
          documentNumber: formData.documentNumber,
          companyName: formData.companyName,
          bizNumber: formData.bizNumber,
          date: formData.date,
          notes: formData.notes,
          topMemo: formData.topMemo
        }
      }
    });
  };
  const handleCloseFaxModal = () => {
    setShowFaxModal(false);
    if (pdfBlobURL) {
      URL.revokeObjectURL(pdfBlobURL);
      setPdfBlobURL(null);
    }
    setPdfBase64(null);
  };

  // ✅ 추가: 재고 체크만 수행하는 함수 (감소는 안 함)
  const checkInventoryAvailability = async (cartItems) => {
    if (!cartItems || !Array.isArray(cartItems)) {
      return { success: true, warnings: [] };
    }

    try {
      const { inventoryService } = await import('../services/InventoryService');
      let serverInventory;

      try {
        serverInventory = await inventoryService.getInventory();
        console.log('✅ 서버 재고 데이터 로드 성공:', Object.keys(serverInventory).length, '개 항목');
      } catch (serverError) {
        console.warn('⚠️ 서버 재고 데이터 로드 실패, 로컬스토리지 사용:', serverError);
        const localInventory = JSON.parse(localStorage.getItem('inventory_data') || '{}');
        serverInventory = localInventory;
        console.log('📦 로컬스토리지 재고 데이터 사용:', Object.keys(serverInventory).length, '개 항목');

        if (Object.keys(serverInventory).length === 0) {
          console.warn('⚠️ 로컬스토리지 재고 데이터도 없음, 재고 체크 건너뜀');
          return {
            success: true,
            warnings: [],
            message: '재고 데이터를 불러올 수 없어 재고 체크를 건너뜁니다.'
          };
        }
      }

      const warnings = [];

      // ✅ 기존 로직: cart에서 BOM 확인
      cartItems.forEach((item) => {
        if (item.bom && Array.isArray(item.bom) && item.bom.length > 0) {
          item.bom.forEach((bomItem) => {
            let inventoryPartId;
            if (bomItem.inventoryPartId) {
              inventoryPartId = bomItem.inventoryPartId;
              console.log(`  🔑 BOM에서 inventoryPartId 사용: "${inventoryPartId}"`);
            } else {
              inventoryPartId = generateInventoryPartId({
                rackType: bomItem.rackType || '',
                name: bomItem.name || '',
                specification: bomItem.specification || '',
                colorWeight: bomItem.colorWeight || ''
              });
              console.log(`  🔑 generateInventoryPartId로 생성: "${inventoryPartId}"`);
            }

            const requiredQty = Number(bomItem.quantity) || 0;
            const currentStock = Number(serverInventory[inventoryPartId]) || 0;

            console.log(`  📊 서버 재고: ${currentStock}개`);
            console.log(`  📈 필요 수량: ${requiredQty}개`);

            if (requiredQty > 0 && currentStock < requiredQty) {
              const shortage = requiredQty - currentStock;
              console.log(`  ⚠️ 재고 부족: ${currentStock} → ${requiredQty} (부족: ${shortage}개)`);
              warnings.push({
                partId: inventoryPartId,
                name: bomItem.name,
                specification: bomItem.specification || '',
                rackType: bomItem.rackType || '',
                required: requiredQty,
                available: currentStock,
                shortage: shortage
              });
            } else {
              console.log(`  ✅ 재고 충분: ${currentStock} >= ${requiredQty}`);
            }
          });
        }
      });

      // ✅ 추가 로직: cart에 bom이 없으면 formData.materials 사용
      if (warnings.length === 0 && cartItems.every(item => !item.bom || item.bom.length === 0)) {
        console.log('📦 cart에 BOM 없음 - formData.materials 사용');

        if (formData.materials && formData.materials.length > 0) {
          formData.materials.forEach((material) => {
            if (material.isService) return; // ✅ 서비스 항목(공임, 운임)은 재고 체크 제외
            let inventoryPartId;
            if (material.inventoryPartId) {
              inventoryPartId = material.inventoryPartId;
            } else {
              inventoryPartId = generateInventoryPartId({
                rackType: material.rackType || '',
                name: material.name || '',
                specification: material.specification || '',
                colorWeight: material.colorWeight || ''
              });
            }

            const requiredQty = Number(material.quantity) || 0;
            const currentStock = Number(serverInventory[inventoryPartId]) || 0;

            if (requiredQty > 0 && currentStock < requiredQty) {
              const shortage = requiredQty - currentStock;
              warnings.push({
                partId: inventoryPartId,
                name: material.name,
                specification: material.specification || '',
                rackType: material.rackType || '',
                required: requiredQty,
                available: currentStock,
                shortage: shortage
              });
            }
          });
        }
      }

      return {
        success: true,
        warnings
      };

    } catch (error) {
      console.error('❌ 재고 체크 실패:', error);
      return {
        success: true,
        warnings: [],
        message: '재고 체크 중 오류가 발생하여 재고 체크를 건너뜁니다: ' + error.message
      };
    }
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
        <h1>청&nbsp;구&nbsp;서</h1>
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
                        updateFormData('purchaseNumber', e.target.value);
                      }}
                      placeholder=""
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
                  placeholder="" /* 상호명 입력 placeholder 제거 */
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
                  placeholder=""
                />
              </td>
              <td className="label">소재지</td>
              <td>{displaySettings.address}</td>
            </tr>
            <tr>
              <td className="label">TEL</td>
              <td style={{ whiteSpace: 'pre-line' }}>{displaySettings.tel}</td>
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

      {/* 품목 목록 */}
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
                <button type="button" onClick={() => removeItem(idx)} disabled={formData.items.length === 1} className="remove-btn">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="item-controls no-print" style={{ marginBottom: 18, display: (showFaxModal || showSettingsModal) ? 'none' : 'block' }}>
        <button type="button" onClick={addItem} className="add-item-btn">+ 품목 추가</button>
      </div>
      {/* ItemSelector 제거됨 */}

      {/* BOM */}
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
              <td><input type="text" value={m.name} onChange={e => updateMaterial(idx, 'name', e.target.value)} placeholder="부품명" /></td>
              <td className="spec-cell">
                <input
                  type="text"
                  value={m.specification}
                  onChange={e => updateMaterial(idx, 'specification', e.target.value)}
                  placeholder=""
                />
              </td>
              <td><input type="number" value={m.quantity} onChange={e => updateMaterial(idx, 'quantity', e.target.value)} placeholder="수량" /></td>
              <td style={{ display: 'none' }}><input type="number" value={m.unitPrice} onChange={e => updateMaterial(idx, 'unitPrice', e.target.value)} placeholder="단가" /></td>
              <td style={{ display: 'none' }} className="right">{m.totalPrice ? parseInt(m.totalPrice).toLocaleString() : '0'}</td>
              <td><input type="text" value={m.note} onChange={e => updateMaterial(idx, 'note', e.target.value)} placeholder="" /></td>
              <td className="no-print">
                <button type="button" onClick={() => removeMaterial(idx)} className="remove-btn">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="item-controls no-print" style={{ marginBottom: 18, display: showFaxModal ? 'none' : 'block' }}>
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
        <button type="button" onClick={handleExportToExcel} className="excel-btn">엑셀로 저장하기</button>
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

export default PurchaseOrderForm;
