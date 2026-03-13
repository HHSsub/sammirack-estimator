import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HistoryPage.css';
import {
  loadAllDocuments,
  loadDeletedDocuments,
  saveDocumentSync,
  deleteDocumentSync,
  restoreDocumentSync,
  permanentDeleteDocumentSync,
  forceServerSync
} from '../utils/realtimeAdminSync';
import { regenerateBOMFromDisplayName, setBomDataForRegeneration } from '../utils/bomRegeneration';
import { generateInventoryPartId, generatePartId, loadAllMaterials } from '../utils/unifiedPriceManager';
import { documentsAPI } from '../services/apiClient';
import { getFullPrintHTML, generateDocHTML } from '../utils/printGenerator';
import { getDocumentSettings } from '../utils/documentSettings';

// ✅ Format Helpers (컴포넌트 외부로 이동하여 Memo 컴포넌트에서 사용 가능하게 함)
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return `${date.getFullYear()} - ${String(date.getMonth() + 1).padStart(2, '0')} - ${String(date.getDate()).padStart(2, '0')} `;
  } catch { return dateString; }
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return `${date.getFullYear()} - ${String(date.getMonth() + 1).padStart(2, '0')} - ${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} `;
  } catch { return dateString; }
};

// ✅ 목록 행 성능 최적화를 위한 Memo 컴포넌트
const HistoryItemRow = React.memo(({ 
  item, 
  isSelected, 
  isInventoryDeducted, 
  onSelect, 
  onRowClick, 
  onEdit, 
  onPrint, 
  onConvertToPurchase, 
  onDelete, 
  onMemoClick 
}) => {
  const isSSDoc = item.estimateNumber?.startsWith('SS-') || 
                  item.purchaseNumber?.startsWith('SS-') || 
                  item.documentNumber?.startsWith('SS-');

  return (
    <div
      className={`list-item ${isSelected ? 'selected' : ''} ${isInventoryDeducted ? 'inventory-deducted' : ''}`}
      onClick={() => onRowClick(item)}
    >
      <div className="item-cell checkbox-cell" style={{ width: '40px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(item, e.target.checked)}
          style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
        />
      </div>
      <div className="item-cell document-type">
        {item.type === 'estimate' ? '견적서' : item.type === 'purchase' ? '발주서' : '거래명세서'}
      </div>
      <div className={`item-cell document-id ${isSSDoc ? 'ss-document' : ''}`}>
        {item.type === 'estimate' ? item.estimateNumber : item.type === 'purchase' ? item.purchaseNumber : item.documentNumber || ''}
      </div>
      <div className="item-cell date">
        {formatDate(item.date)}
      </div>
      <div className="item-cell updated-date">
        {item.updatedAt ? formatDateTime(item.updatedAt) : '-'}
      </div>
      <div className="item-cell product">
        {item.productType}
      </div>
      <div className="item-cell price">
        {item.totalPrice?.toLocaleString()}원
      </div>
      <div
        className="item-cell memo"
        onClick={(e) => {
          e.stopPropagation();
          onMemoClick(item);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div style={{
          width: '100%',
          color: '#ff6600',
          fontWeight: 'bold',
          fontSize: '13px',
          padding: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {item.memo && item.memo.length > 15
            ? `${item.memo.substring(0, 15)}...`
            : (item.memo || '메모...')}
        </div>
      </div>
      <div className="item-cell actions" onClick={(e) => e.stopPropagation()}>
        <button title="편집" onClick={(e) => { e.stopPropagation(); onEdit(item); }}>편집</button>
        <button title="인쇄" onClick={(e) => { e.stopPropagation(); onPrint(item); }}>인쇄</button>
        {item.type === 'estimate' && (
          <button title="발주서 생성" onClick={(e) => { e.stopPropagation(); onConvertToPurchase(item); }}>발주서생성</button>
        )}
        <button title="삭제" className="delete-icon" onClick={(e) => { e.stopPropagation(); onDelete(item); }}>삭제</button>
      </div>
    </div>
  );
});


/**
 * HistoryPage component for managing estimates, purchase orders, and delivery notes
 * Features:
 * - View history of estimates, purchase (orders), and delivery (notes)
 * - Filter by type, customer name, date range, etc.
 * - Convert estimates to orders
 * - Print documents including delivery notes
 * - Edit and delete documents including delivery notes
 * - ✅ 서버 동기화 (gabia)
 * - ✅ 삭제된 문서 목록 보기 및 복구
 * - ✅ 컬럼별 정렬 기능
 * - ✅ 메모 기능 (상태 대체)
 */
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

const HistoryPage = () => {
  const navigate = useNavigate();
  // State for history items (estimates, orders, delivery notes)
  const [historyItems, setHistoryItems] = useState([]);
  // State for filters
  const [filters, setFilters] = useState({
    documentType: 'all',
    documentNumber: '',
    dateFrom: '',
    dateTo: ''
  });
  // State for selected item
  const [selectedItem, setSelectedItem] = useState(null);
  // State for view options
  const [view, setView] = useState('list'); // 'list', 'details', 'deleted'
  // ✅ 동기화 상태
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  // ✅ 삭제된 문서 목록
  const [deletedItems, setDeletedItems] = useState([]);
  // ✅ 정렬 상태
  // ✅ localStorage에서 정렬 설정 불러오기
  const [sortColumn, setSortColumn] = useState(() => {
    return localStorage.getItem('historyPage_sortColumn') || 'updatedAt';  // ✅ 기본값: 수정날짜(updated-date)
  });
  const [sortDirection, setSortDirection] = useState(() => {
    return localStorage.getItem('historyPage_sortDirection') || 'desc';
  });
  // ✅ 메모 모달 state
  const [memoModalItem, setMemoModalItem] = useState(null);
  const [memoModalValue, setMemoModalValue] = useState('');

  // ✅ 일괄 작업을 위한 선택 상태
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Load history on component mount
  useEffect(() => {
    loadHistory();

    // ✅ BOM 재생성을 위한 데이터 로드
    const loadData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}bom_data_weight_added.json`);
        if (response.ok) {
          const data = await response.json();
          setBomDataForRegeneration(data);
          console.log('✅ BOM 재생성용 데이터 로드 완료');
        }
      } catch (e) {
        console.error('BOM 데이터 로드 실패:', e);
      }
    };
    loadData();

    // ✅ 문서 업데이트 이벤트 리스너
    const handleDocumentsUpdate = () => {
      console.log('📄 문서 업데이트 감지 - 목록 새로고침');
      loadHistory();
    };

    window.addEventListener('documentsupdated', handleDocumentsUpdate);

    // ✅ 재고 감소 상태 업데이트 이벤트 리스너
    const handleInventoryStatusUpdate = () => {
      console.log('📦 재고 상태 업데이트 감지 - 목록 새로고침');
      loadHistory();
    };

    window.addEventListener('documentInventoryStatusUpdated', handleInventoryStatusUpdate);

    return () => {
      window.removeEventListener('documentsupdated', handleDocumentsUpdate);
      window.removeEventListener('documentInventoryStatusUpdated', handleInventoryStatusUpdate);
    };
  }, []);


  /**
   * ✅ Load history data from synced documents
   */
  const loadHistory = useCallback(() => {
    try {
      const syncedDocuments = loadAllDocuments(false);

      // ✅ [전수조사 반영] UI 레벨 중복 제거 로직 (Deduplication)
      // 동일 ID(.0 포함)가 여러건일 경우 가장 최신(updatedAt) 1건만 노출
      const deduplicatedMap = new Map();

      syncedDocuments.forEach(doc => {
        // ID 정규화 (.0 제거 및 문자열화)
        // ID 정규화 (.0 제거 및 문자열화)
        let normId = String(doc.id || '').replace(/\.0$/, '');
        const type = doc.type || 'estimate';

        // 만약 ID가 type_으로 시작하면 제거 (순수 ID 추출)
        if (normId.startsWith(`${type}_`)) {
          normId = normId.substring(type.length + 1);
        }

        const docKey = `${type}_${normId}`;

        const existing = deduplicatedMap.get(docKey);
        if (!existing || new Date(doc.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
          deduplicatedMap.set(docKey, { ...doc, id: normId, type });
        }
      });

      const validDocuments = Array.from(deduplicatedMap.values()).filter(doc => {
        // [수정] 필터링 조건 완화: 번호가 없어도 항목이 있거나, 항목이 없어도 번호가 있으면 노출 (수백개 유실 방지)
        const hasNumber = doc.estimateNumber || doc.purchaseNumber || doc.documentNumber || doc.id;
        const hasContent = (doc.items && doc.items.length > 0) || (doc.cart && doc.cart.length > 0) || (doc.materials && doc.materials.length > 0);
        return hasNumber || hasContent;
      });

      const documentsWithMemo = validDocuments.map(doc => {
        if (!doc.memo && doc.topMemo) {
          return { ...doc, memo: doc.topMemo };
        }
        return doc;
      });

      setHistoryItems(documentsWithMemo);
      setLastSyncTime(new Date());

      console.log(`📄 문서 로드 완료: ${documentsWithMemo.length} 개(유령문서 제외)`);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }, []);

  /**
   * ✅ 삭제된 문서 로드
   */
  const loadDeletedHistory = useCallback(() => {
    try {
      const deleted = loadDeletedDocuments();
      deleted.sort((a, b) => {
        return new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0);
      });
      setDeletedItems(deleted);
      console.log(`🗑️ 삭제된 문서 로드: ${deleted.length} 개`);
    } catch (error) {
      console.error('삭제된 문서 로드 실패:', error);
    }
  }, []);

  /**
   * ✅ 서버 강제 동기화
   */
  const handleForceSync = async () => {
    try {
      setIsSyncing(true);
      await forceServerSync();
      loadHistory();
      alert('서버 동기화가 완료되었습니다.');
    } catch (error) {
      console.error('동기화 실패:', error);
      alert('서버 동기화에 실패했습니다: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * ✅ 컬럼별 정렬 처리
   */
  const handleSort = (column) => {
    let newDirection = 'desc';
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }

    // ✅ localStorage에 저장
    localStorage.setItem('historyPage_sortColumn', column);
    localStorage.setItem('historyPage_sortDirection', newDirection);

    setSortColumn(column);
    setSortDirection(newDirection);
  };

  /**
   * ✅ 검색 및 필터링 최적화 (useMemo)
   * 기존: useEffect + State 업데이트로 인한 이중 렌더링 및 렉 발생 원인 제거
   */
  const filteredItems = useMemo(() => {
    let result = [...historyItems];

    // Filter by document type
    if (filters.documentType !== 'all') {
      result = result.filter(item => item.type === filters.documentType);
    }

    // Filter by document number
    if (filters.documentNumber) {
      const searchTerm = filters.documentNumber.toLowerCase().trim();
      result = result.filter(item => {
        // ✅ [중요] 현재 문서 유형에 따라 실제로 화면에 표시되는 '거래번호' 필드에서만 찾습니다.
        // 이를 통해 검색어 중복 매칭(test 입력 시 엉뚱한 결과)을 방지합니다.
        let visibleId = '';
        if (item.type === 'estimate') visibleId = item.estimateNumber;
        else if (item.type === 'purchase') visibleId = item.purchaseNumber;
        else visibleId = item.documentNumber;

        const idStr = String(visibleId || '').toLowerCase();
        return idStr.includes(searchTerm);
      });
    }

    // ✅ Filter by date range (문자열 비교)
    if (filters.dateFrom) {
      result = result.filter(item => {
        if (!item.date) return false;
        const itemDateStr = item.date.split('T')[0];
        return itemDateStr >= filters.dateFrom;
      });
    }

    if (filters.dateTo) {
      result = result.filter(item => {
        if (!item.date) return false;
        const itemDateStr = item.date.split('T')[0];
        return itemDateStr <= filters.dateTo;
      });
    }

    return result;
  }, [filters, historyItems]);


  /**
   * ✅ 정렬 최적화 (useMemo)
   * 정렬도 렌더링마다 수행하지 않고, filteredItems나 정렬조건이 바뀔 때만 수행
   */
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'documentType':
          aValue = a.type || '';
          bValue = b.type || '';
          break;
        case 'documentNumber':
          aValue = a.type === 'estimate' ? a.estimateNumber :
            a.type === 'purchase' ? a.purchaseNumber :
              a.documentNumber || '';
          bValue = b.type === 'estimate' ? b.estimateNumber :
            b.type === 'purchase' ? b.purchaseNumber :
              b.documentNumber || '';
          break;
        case 'date':
          aValue = new Date(a.date || 0).getTime();
          bValue = new Date(b.date || 0).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt || a.date || 0).getTime();
          bValue = new Date(b.updatedAt || b.date || 0).getTime();
          break;
        case 'product':
          aValue = a.productType || '';
          bValue = b.productType || '';
          break;
        case 'price':
          aValue = a.totalPrice || 0;
          bValue = b.totalPrice || 0;
          break;
        case 'memo':
          aValue = a.memo || '';
          bValue = b.memo || '';
          break;
        default:
          aValue = new Date(a.updatedAt || a.date || 0).getTime();
          bValue = new Date(b.updatedAt || b.date || 0).getTime();
      }

      // 정렬 비교
      let result = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        result = aValue.localeCompare(bValue, 'ko');
      } else {
        result = aValue - bValue;
      }

      // 오름차순/내림차순 적용
      result = sortDirection === 'asc' ? result : -result;

      // ✅ 2차 정렬: 값 동일 시 거래번호 기준 내림차순 (최신순 느낌 유지)
      if (result === 0) {
        const aNum = String(a.estimateNumber || a.purchaseNumber || a.documentNumber || '');
        const bNum = String(b.estimateNumber || b.purchaseNumber || b.documentNumber || '');
        return bNum.localeCompare(aNum, 'ko');
      }

      return result;
    });
  }, [filteredItems, sortColumn, sortDirection]);

  // Dummy function to prevent errors if invoked elsewhere (though it shouldn't be)
  const filterItems = useCallback(() => { }, []);

  /**
   * Handle filter changes
   */
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * Reset all filters
   */
  const resetFilters = () => {
    setFilters({
      documentType: 'all',
      documentNumber: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  /**
   * ✅ Delete a history item (소프트 삭제)
   */
  const deleteItem = async (item) => {
    if (!item || !item.id || !item.type) return;

    const confirmDelete = window.confirm(
      `정말로 이 ${item.type === 'estimate' ? '견적서' : item.type === 'purchase' ? '발주서' : '거래명세서'}를 삭제하시겠습니까 ?
  ${item.type === 'estimate' ? item.estimateNumber : item.type === 'purchase' ? item.purchaseNumber : item.documentNumber || ''}
      
※ 삭제된 문서는 '삭제된 문서 보기'에서 복구할 수 있습니다.`
    );

    if (confirmDelete) {
      try {
        // ✅ 소프트 삭제 (서버 동기화)
        const success = await deleteDocumentSync(item.id, item.type);

        if (success) {
          // ✅ 선택 상태에서도 제거
          const itemKey = `${item.type}_${item.id}`;
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(itemKey);
            return next;
          });

          // ✅ UI 즉시 반영 (강제 업데이트) - 이 부분이 실행되어야 화면에서 사라집니다
          console.log(`⚡ UI 강제 삭제 처리: ${item.id} (${item.type})`);

          setHistoryItems(prev => {
            const updatedList = prev.filter(i => {
              // ID와 타입이 모두 일치하는 항목을 제거
              const isMatch = (i.id == item.id) && (i.type === item.type);
              return !isMatch;
            });
            console.log(`📉 목록 개수 변화: ${prev.length} -> ${updatedList.length} `);
            return updatedList;
          });

          if (selectedItem && selectedItem.id === item.id && selectedItem.type === item.type) {
            setSelectedItem(null);
            setView('list');
          }

          console.log('✅ 문서 삭제 로직 완료');
        } else {
          alert('문서 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('문서 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  /**
   * ✅ 삭제된 문서 복구
   */
  const restoreItem = async (item) => {
    if (!item || !item.id || !item.type) return;

    const confirmRestore = window.confirm(
      `이 ${item.type === 'estimate' ? '견적서' : item.type === 'purchase' ? '발주서' : '거래명세서'}를 복구하시겠습니까 ?
  ${item.type === 'estimate' ? item.estimateNumber : item.type === 'purchase' ? item.purchaseNumber : item.documentNumber || ''} `
    );

    if (confirmRestore) {
      try {
        const success = await restoreDocumentSync(item.id, item.type);

        if (success) {
          // 삭제 목록에서 제거
          setDeletedItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
          // 일반 목록 새로고침
          loadHistory();
          alert('문서가 복구되었습니다.');
        } else {
          alert('문서 복구에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error restoring item:', error);
        alert('문서 복구 중 오류가 발생했습니다.');
      }
    }
  };

  /**
   * ✅ 문서 영구 삭제
   */
  const permanentDeleteItem = async (item) => {
    if (!item || !item.id || !item.type) return;

    const confirmDelete = window.confirm(
      `⚠️ 경고: 이 문서를 영구적으로 삭제하시겠습니까 ?

  ${item.type === 'estimate' ? item.estimateNumber : item.type === 'purchase' ? item.purchaseNumber : item.documentNumber || ''}

이 작업은 되돌릴 수 없습니다!`
    );

    if (confirmDelete) {
      try {
        const success = await permanentDeleteDocumentSync(item.id, item.type);

        if (success) {
          setDeletedItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
          alert('문서가 영구 삭제되었습니다.');
        } else {
          alert('영구 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error permanently deleting item:', error);
        alert('영구 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  /**
   * ✅ 견적서를 발주서로 변환 (BOM 복구 및 하이랙 규격 보정 포함)
   */
  const convertToPurchase = (item) => {
    if (!item) return;

    console.log('🔍 견적서 변환 시작:', item.id);

    // 1. 카트 데이터 추출
    const cart = ((item.cart && item.cart.length > 0) ? item.cart : (item.items || [])).map(it => ({
      ...it,
      name: it.name || it.displayName || '',
      displayName: it.displayName || it.name || '',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
      price: it.totalPrice || it.price || 0,
      unit: it.unit || '개'
    }));

    // 2. 원자재(BOM) 추출 및 유실 시 재생성
    let materials = item.materials || [];
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

    // 4. 하이랙 특수 로직 (기법/규격 보정)
    // (기존에 있었던 복잡한 spec parsing 로직 중 필수적인 부분만 유지하거나, 
    // 이미 regenerateBOMFromDisplayName에서 처리된다면 생략 가능하지만 
    // 안정성을 위해 기본적인 메타정보는 구성함)

    const estimateData = {
      estimateNumber: item.estimateNumber || item.documentNumber || '',
      companyName: item.customerName || item.companyName || '',
      bizNumber: item.bizNumber || '',
      contactInfo: item.contactInfo || '',
      notes: item.notes || '',
      topMemo: item.topMemo || ''
    };

    navigate('/purchase-order/new', {
      state: {
        cart: cart,
        totalBom: materials,
        materials: materials,
        estimateData: item,
        editingDocumentId: null,
        editingDocumentType: 'estimate',
        editingDocumentData: {}
      }
    });
  };

  /**
   * ✅ 수정 버튼 - 홈 화면으로 이동하여 장바구니 기반 편집
   */
  const editItem = async (item) => {
    console.log('📝 편집 시작:', item);

    try {
      // 1) 서버에서 전체 문서 데이터 가져오기
      let docId = item.id;
      const expectedPrefix = `${item.type}_`;
      if (!docId.startsWith(expectedPrefix)) {
        docId = `${expectedPrefix}${docId}`;
        console.log('✅ doc_id 정규화:', docId);
      }

      const response = await documentsAPI.getById(docId);
      const fullDoc = response.data;
      console.log('📄 서버에서 받은 전체 문서:', fullDoc);

      // 2) Cart 복원
      let cart = [];
      if (fullDoc.items && Array.isArray(fullDoc.items) && fullDoc.items.length > 0) {
        cart = fullDoc.items.map(itm => ({
          ...itm,
          displayName: itm.displayName || itm.name || '',
          quantity: Number(itm.quantity) || 1,
          unitPrice: Number(itm.unitPrice) || 0,
          totalPrice: Number(itm.totalPrice) || 0,
          customPrice: Number(itm.customPrice) || 0,
          price: Number(itm.unitPrice) || 0
        }));
      }
      console.log('📦 복원된 cart:', cart);

      // 3) Materials 복원 + BOM 재생성
      let materials = [];
      if (fullDoc.materials && Array.isArray(fullDoc.materials) && fullDoc.materials.length > 0) {
        materials = fullDoc.materials.map(mat => ({
          ...mat,
          quantity: Number(mat.quantity) || 0,
          unitPrice: Number(mat.unitPrice) || 0,
          totalPrice: Number(mat.totalPrice) || 0
        }));
        console.log('✅ 기존 materials 복원:', materials);
      } else if (cart.length > 0) {
        console.log('⚠️ materials 비어있음 - cart에서 BOM 재생성');
        materials = [];
        cart.forEach(cartItem => {
          const displayName = cartItem.displayName || cartItem.name || '';
          if (displayName) {
            try {
              const bomItems = regenerateBOMFromDisplayName(displayName);
              const itemQty = Number(cartItem.quantity) || 1;
              bomItems.forEach(bomItem => {
                materials.push({
                  ...bomItem,
                  quantity: (bomItem.quantity || 0) * itemQty,
                  unitPrice: Number(bomItem.unitPrice) || 0,
                  totalPrice: Number(bomItem.totalPrice) || 0
                });
              });
            } catch (err) {
              console.error('❌ BOM 재생성 실패:', displayName, err);
            }
          }
        });
        console.log('✅ BOM 재생성 완료:', materials);
      }

      // 4) Admin 가격 재적용
      console.log('💰 Admin 가격 재적용 시작...');
      const { loadAdminPrices, generatePartId } = await import('../utils/unifiedPriceManager');
      const adminPrices = await loadAdminPrices();
      console.log('📊 불러온 Admin 가격:', adminPrices);

      // Cart에 Admin 가격 적용
      cart = cart.map(cartItem => {
        // 1순위: customPrice 보존
        if (cartItem.customPrice && cartItem.customPrice > 0) {
          return {
            ...cartItem,
            unitPrice: cartItem.customPrice,
            totalPrice: cartItem.customPrice * cartItem.quantity,
            price: cartItem.customPrice
          };
        }

        // 2순위: Admin 가격 적용
        const partId = generatePartId(cartItem);
        const adminPrice = adminPrices[partId];
        if (adminPrice && adminPrice.price > 0) {
          const newPrice = adminPrice.price;
          return {
            ...cartItem,
            unitPrice: newPrice,
            totalPrice: newPrice * cartItem.quantity,
            price: newPrice
          };
        }

        // 3순위: 기존 가격 유지
        return {
          ...cartItem,
          price: cartItem.unitPrice || cartItem.price || 0
        };
      });

      // Materials에 Admin 가격 적용
      materials = materials.map(mat => {
        const partId = generatePartId(mat);
        const adminPrice = adminPrices[partId];
        if (adminPrice && adminPrice.price > 0) {
          const newPrice = adminPrice.price;
          return {
            ...mat,
            unitPrice: newPrice,
            totalPrice: newPrice * mat.quantity
          };
        }
        return mat;
      });

      // 5) 편집 데이터 구성 및 이동
      const editingData = {
        cart,
        totalBom: materials,
        materials: materials,
        editingDocumentId: fullDoc.id,
        editingDocumentType: fullDoc.type || 'estimate',
        editingDocumentData: {
          ...fullDoc,
          items: cart,
          materials: materials
        }
      };

      navigate('/', { state: editingData });

    } catch (error) {
      console.error('❌ 편집 실패:', error);
      alert('문서를 불러오는데 실패했습니다: ' + error.message);
    }
  };

  /**
   * ✅ 선택 관련 핸들러
   */
  const handleSelectRow = useCallback((item, isChecked) => {
    const itemKey = `${item.type}_${item.id}`;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isChecked) next.add(itemKey);
      else next.delete(itemKey);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((isChecked) => {
    if (isChecked) {
      const allKeys = sortedItems.map(item => `${item.type}_${item.id}`);
      setSelectedIds(new Set(allKeys));
    } else {
      setSelectedIds(new Set());
    }
  }, [sortedItems]);

  /**
   * ✅ 재고 처리가 완료된 거래번호 목록 (성능 최적화: 루프 밖에서 미리 계산)
   */
  const deductedDocNumbers = useMemo(() => {
    const deducted = new Set();
    historyItems.forEach(doc => {
      if (doc.inventoryDeducted === true && !doc.deleted) {
        const num = doc.documentNumber || doc.purchaseNumber || doc.deliveryNumber || doc.estimateNumber;
        if (num) deducted.add(String(num).trim());
      }
    });
    return deducted;
  }, [historyItems]);

  const isAllSelected = sortedItems.length > 0 && selectedIds.size >= sortedItems.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < sortedItems.length;

  /**
   * ✅ 핸들러 안정화 (useCallback)
   */
  const handleRowClick = useCallback((it) => {
    setSelectedItem(it);
    setView('details');
  }, []);

  const handleMemoClick = useCallback((it) => {
    setMemoModalItem(it);
    setMemoModalValue(it.memo || '');
  }, []);

  const handleEdit = useCallback((it) => editItem(it), []); // editItem은 추후 useCallback 고려
  const handlePrint = useCallback((it) => printItem(it), []);
  const handleConvertToPurchase = useCallback((it) => convertToPurchase(it), []);
  const handleDelete = useCallback((it) => deleteItem(it), []);

  /**
   * ✅ 통합 HTML 생성 함수 (PurchaseOrderForm 디자인 100% 복제)
   */
  const printItem = (item) => {
    if (!item || !item.type) return;

    const title = item.type === 'estimate' ? '견적서' : item.type === 'purchase' ? '발주서' : '거래명세서';
    const fullHTML = getFullPrintHTML(item, { 
      title, 
      baseURL: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''),
      globalSettings: getDocumentSettings() // ✅ 현재 관리자 설정 전달
    });

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

  /**
   * ✅ 일괄 인쇄 기능
   */
  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return;

    const itemsToPrint = Array.from(selectedIds).map(key => {
      const [type, id] = key.split('_');
      const realId = key.substring(type.length + 1);
      return historyItems.find(item => item.id === realId && item.type === type);
    }).filter(Boolean);

    if (itemsToPrint.length === 0) return;

    const fullHTML = getFullPrintHTML(itemsToPrint, { 
      title: `일괄 인쇄 (${itemsToPrint.length}건)`, 
      baseURL: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''),
      globalSettings: getDocumentSettings() // ✅ 현재 관리자 설정 전달
    });

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

  /**
   * ✅ Update memo (서버 동기화)
   */
  const updateMemo = async (item, newMemo) => {
    if (!item || !item.id || !item.type) return;

    try {
      const updatedItem = {
        ...item,
        memo: newMemo
        // ✅ updatedAt 제거 - 메모는 문서 수정 시간에 영향 안 줌
      };

      const success = await saveDocumentSync(updatedItem);

      if (success) {
        setHistoryItems(prev => prev.map(i => {
          if (i.id === item.id && i.type === item.type) {
            return updatedItem;
          }
          return i;
        }));

        if (selectedItem && selectedItem.id === item.id && selectedItem.type === item.type) {
          setSelectedItem(updatedItem);
        }
      }
    } catch (error) {
      console.error('메모 업데이트 실패:', error);
    }
  };


  /**
   * ✅ 정렬 아이콘 표시
   */
  const renderSortIcon = (column) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  /**
   * Render item details view
   */
  const renderItemDetails = () => {
    if (!selectedItem) return null;

    const isEstimate = selectedItem.type === 'estimate';

    return (
      <div className="item-details">
        <div className="details-header">
          <h2>
            {isEstimate ? '견적서' : selectedItem.type === 'purchase' ? '발주서' : '거래명세서'} 상세정보
          </h2>
          <button className="back-button" onClick={() => setView('list')}>목록으로</button>
        </div>

        <div className="details-content">
          <div className="details-section">
            <h3>기본 정보</h3>
            <div className="details-grid">
              <div className="details-item">
                <strong>
                  {isEstimate ? '거래번호' : selectedItem.type === 'purchase' ? '주문번호' : '거래명세서 번호'}:
                </strong>
                <span>
                  {isEstimate ? selectedItem.estimateNumber : selectedItem.type === 'purchase' ? selectedItem.purchaseNumber : selectedItem.documentNumber || ''}
                </span>
              </div>
              <div className="details-item">
                <strong>날짜:</strong>
                <span>{formatDate(selectedItem.date)}</span>
              </div>
              <div className="details-item">
                <strong>고객명:</strong>
                <span>{selectedItem.customerName}</span>
              </div>
              <div className="details-item">
                <strong>연락처:</strong>
                <span>{selectedItem.contactInfo}</span>
              </div>
              {selectedItem.createdBy && (
                <div className="details-item">
                  <strong>생성자:</strong>
                  <span className="creator-info">{selectedItem.createdBy}</span>
                </div>
              )}
              {selectedItem.syncedAt && (
                <div className="details-item">
                  <strong>마지막 동기화:</strong>
                  <span>{formatDateTime(selectedItem.syncedAt)}</span>
                </div>
              )}
              {!isEstimate && selectedItem.estimateNumber && selectedItem.type !== 'delivery' && (
                <div className="details-item">
                  <strong>관련 거래번호:</strong>
                  <span>{selectedItem.estimateNumber}</span>
                </div>
              )}
              {selectedItem.memo && (
                <div className="details-item">
                  <strong>메모:</strong>
                  <span style={{ color: '#ff6600', fontWeight: 'bold' }}>{selectedItem.memo}</span>
                </div>
              )}
            </div>
          </div>

          <div className="details-section">
            <h3>제품 정보</h3>
            <div className="details-grid">
              <div className="details-item">
                <strong>제품 유형:</strong>
                <span>{selectedItem.productType}</span>
              </div>
              {selectedItem.selectedOptions && Object.entries(selectedItem.selectedOptions).map(([key, value]) => (
                <div className="details-item" key={key}>
                  <strong>
                    {key === 'size' ? '규격' :
                      key === 'height' ? '높이' :
                        key === 'level' ? '단수' :
                          key === 'color' ? '색상' : key}:
                  </strong>
                  <span>{value}</span>
                </div>
              ))}
              <div className="details-item">
                <strong>수량:</strong>
                <span>{selectedItem.quantity}</span>
              </div>
              <div className="details-item">
                <strong>단가:</strong>
                <span>{selectedItem.unitPrice?.toLocaleString()}원</span>
              </div>
              <div className="details-item">
                <strong>총액:</strong>
                <span>{selectedItem.totalPrice?.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          {selectedItem.type === 'purchase' && (
            <div className="details-section">
              <h3>배송 정보</h3>
              <div className="details-grid">
                <div className="details-item">
                  <strong>배송 예정일:</strong>
                  <span>{formatDate(selectedItem.deliveryDate) || '미정'}</span>
                </div>
                <div className="details-item full-width">
                  <strong>배송지:</strong>
                  <span>{selectedItem.deliveryAddress || ''}</span>
                </div>
                <div className="details-item full-width">
                  <strong>결제 조건:</strong>
                  <span>{selectedItem.paymentTerms || '계약금 50%, 잔금 50% (출고 전)'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="details-section">
            <h3>문서 작업</h3>
            <div className="action-buttons">
              <button onClick={() => editItem(selectedItem)}>
                편집
              </button>
              <button onClick={() => printItem(selectedItem)}>
                인쇄
              </button>
              {isEstimate && (
                <button onClick={() => convertToPurchase(selectedItem)}>
                  발주서 생성
                </button>
              )}
              <button className="delete-button" onClick={() => deleteItem(selectedItem)}>
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * ✅ Render deleted items list
   */
  const renderDeletedItemsList = () => (
    <div className="deleted-items-section">
      <div className="deleted-header">
        <h2>🗑️ 삭제된 문서 목록</h2>
        <button className="back-button" onClick={() => {
          setView('list');
          setDeletedItems([]);
        }}>
          ← 문서 목록으로
        </button>
      </div>

      {deletedItems.length === 0 ? (
        <div className="no-items">
          <p>삭제된 문서가 없습니다.</p>
        </div>
      ) : (
        <div className="history-list">
          <div className="list-header">
            <div className="header-cell document-type">유형</div>
            <div className="header-cell document-id">거래번호</div>
            <div className="header-cell date">삭제일</div>
            <div className="header-cell customer">삭제자</div>
            <div className="header-cell product">제품</div>
            <div className="header-cell price">금액</div>
            <div className="header-cell actions">작업</div>
          </div>

          {deletedItems.map((item) => (
            <div
              key={`deleted_${item.type}_${item.id} `}
              className="list-item deleted-item"
            >
              <div className="item-cell document-type">
                {item.type === 'estimate' ? '견적서' : item.type === 'purchase' ? '발주서' : '거래명세서'}
              </div>
              <div className="item-cell document-id">
                {item.type === 'estimate' ? item.estimateNumber : item.type === 'purchase' ? item.purchaseNumber : item.documentNumber || ''}
              </div>
              <div className="item-cell date">
                {formatDateTime(item.deletedAt)}
              </div>
              <div className="item-cell customer">
                {item.deletedBy || '-'}
              </div>
              <div className="item-cell product">
                {item.productType}
              </div>
              <div className="item-cell price">
                {item.totalPrice?.toLocaleString()}원
              </div>
              <div className="item-cell actions">
                <button
                  title="복구"
                  className="restore-button"
                  onClick={() => restoreItem(item)}
                >
                  ♻️ 복구
                </button>
                <button
                  title="영구 삭제"
                  className="permanent-delete-button"
                  onClick={() => permanentDeleteItem(item)}
                >
                  🔥 영구삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /**
   * Render list of history items
   */
  const renderItemsList = () => {
    // const sortedItems = getSortedItems(filteredItems); // Removed
    // sortedItems is now a memoized value

    return (
      <div className="history-list">
        <div className="list-header">
          <div className="header-cell checkbox-cell" style={{ width: '40px', textAlign: 'center' }}>
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              ref={el => { if (el) el.indeterminate = isSomeSelected; }}
            />
          </div>
          <div className="header-cell document-type sortable" onClick={() => handleSort('documentType')}>
            유형{renderSortIcon('documentType')}
          </div>
          <div className="header-cell document-id sortable" onClick={() => handleSort('documentNumber')}>
            거래번호{renderSortIcon('documentNumber')}
          </div>
          <div className="header-cell date sortable" onClick={() => handleSort('date')}>
            날짜{renderSortIcon('date')}
          </div>
          <div className="header-cell updated-date sortable" onClick={() => handleSort('updatedAt')}>
            최종 수정{renderSortIcon('updatedAt')}
          </div>
          <div className="header-cell product sortable" onClick={() => handleSort('product')}>
            제품{renderSortIcon('product')}
          </div>
          <div className="header-cell price sortable" onClick={() => handleSort('price')}>
            금액{renderSortIcon('price')}
          </div>
          <div className="header-cell memo sortable" onClick={() => handleSort('memo')}>
            메모{renderSortIcon('memo')}
          </div>
          <div className="header-cell actions">작업</div>
        </div>

        {sortedItems.length === 0 ? (
          <div className="no-items">
            <p>표시할 항목이 없습니다.</p>
          </div>
        ) : (
          sortedItems.map((item) => (
            <HistoryItemRow 
              key={`${item.type}_${item.id}`}
              item={item}
              isSelected={selectedIds.has(`${item.type}_${item.id}`)}
              isInventoryDeducted={item.inventoryDeducted || deductedDocNumbers.has(String(item.estimateNumber || item.purchaseNumber || item.documentNumber).trim())}
              onSelect={handleSelectRow}
              onRowClick={handleRowClick}
              onEdit={handleEdit}
              onPrint={handlePrint}
              onConvertToPurchase={handleConvertToPurchase}
              onDelete={handleDelete}
              onMemoClick={handleMemoClick}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div className="history-page" style={{ padding: '20px 5%' }}>
      {view === 'list' && (
        <>
          <div className="page-header">
            <h2>문서 관리</h2>
            <div className="sync-status">
              {lastSyncTime && (
                <span className="last-sync">
                  마지막 동기화: {formatDateTime(lastSyncTime)}
                </span>
              )}
              {selectedIds.size > 0 && (
                <span className="selected-count" style={{ marginRight: '15px', color: '#ff6600', fontWeight: 'bold' }}>
                  {selectedIds.size}개 선택됨
                </span>
              )}
              <button
                className="sync-button"
                onClick={handleForceSync}
                disabled={isSyncing}
              >
                {isSyncing ? '동기화 중...' : '🔄 서버 동기화'}
              </button>
            </div>
          </div>

          <div className="filters-section">
            <div className="filters-container" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              alignItems: 'end'
            }}>

              <div className="filter-group">
                <label>거래번호:</label>
                <input
                  type="text"
                  name="documentNumber"
                  placeholder="거래번호 검색"
                  value={filters.documentNumber}
                  onChange={handleFilterChange}
                  className="filter-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="filter-group" style={{ gridColumn: 'span 2' }}>
                <label>날짜 범위:</label>
                <div className="date-range" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="date"
                    name="dateFrom"
                    value={filters.dateFrom}
                    onChange={handleFilterChange}
                    style={{ flex: 1 }}
                  />
                  <span>~</span>
                  <input
                    type="date"
                    name="dateTo"
                    value={filters.dateTo}
                    onChange={handleFilterChange}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <button
                className="reset-filters"
                onClick={resetFilters}
                style={{
                  padding: '8px 16px',
                  height: 'fit-content'
                }}
              >
                필터 초기화
              </button>
            </div>
          </div>

          <div className="action-buttons top-actions">
            <button onClick={() => navigate('/estimate/new')}>
              새 견적서 작성
            </button>
            <button onClick={() => navigate('/purchase-order/new')}>
              새 발주서 작성
            </button>
            {selectedIds.size > 0 && (
              <button
                className="bulk-print-button"
                onClick={() => handleBulkPrint()}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#ff6600',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginRight: 'auto', // Push others to right if needed, but flex takes care
                }}
              >
                🖨️ 선택 항목 일괄 인쇄 ({selectedIds.size})
              </button>
            )}
            <button
              className="deleted-docs-button"
              onClick={() => {
                loadDeletedHistory();
                setView('deleted');
              }}
            >
              🗑️ 삭제된 문서 보기
            </button>
          </div>

          {renderItemsList()}
        </>
      )}
      {view === 'details' && renderItemDetails()}
      {view === 'deleted' && renderDeletedItemsList()}
      {/* ✅ 메모 모달 */}
      {memoModalItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setMemoModalItem(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>메모 편집</h3>
            <textarea
              value={memoModalValue}
              onChange={(e) => setMemoModalValue(e.target.value)}
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
              placeholder="메모를 입력하세요..."
            />
            <div style={{
              marginTop: '16px',
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setMemoModalItem(null)}
                style={{
                  padding: '8px 16px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  await updateMemo(memoModalItem, memoModalValue);
                  setMemoModalItem(null);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoryPage;
