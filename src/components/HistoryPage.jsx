import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HistoryPage.css';

/**
 * HistoryPage component for managing estimates and purchase orders
 * Features:
 * - View history of estimates and orders
 * - Filter by type, customer name, date range, etc.
 * - Convert estimates to orders
 * - Print documents
 * - Edit existing documents
 */
const HistoryPage = () => {
  const navigate = useNavigate();
  
  // State for history items (estimates and orders)
  const [historyItems, setHistoryItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  
  // State for filters
  const [filters, setFilters] = useState({
    documentType: 'all', // 'all', 'estimate', 'order'
    documentNumber: '',
    dateFrom: '',
    dateTo: '',
    status: 'all', // 'all', 'pending', 'completed', 'cancelled'
  });
  
  // State for selected item
  const [selectedItem, setSelectedItem] = useState(null);
  
  // State for view options
  const [view, setView] = useState('list'); // 'list' or 'details'
  
  // Load history from localStorage on component mount
  useEffect(() => {
    loadHistory();
  }, []);
  
  // Filter items whenever filters or history items change
  useEffect(() => {
    filterItems();
  }, [filters, historyItems]);
  
  /**
   * Load history data from localStorage
   */
  const loadHistory = () => {
    try {
      // Get all items from localStorage
      const allItems = [];
      
      // Find all estimates and orders in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('estimate_') || key.startsWith('order_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item) {
              allItems.push(item);
            }
          } catch (e) {
            console.error('Failed to parse item:', key, e);
          }
        }
      }
      
      // Sort by creation date (newest first)
      allItems.sort((a, b) => {
        return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
      });
      
      setHistoryItems(allItems);
      setFilteredItems(allItems);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };
  
  /**
   * Apply filters to history items
   */
  const filterItems = () => {
    let filtered = [...historyItems];
    
    // Filter by document type
    if (filters.documentType !== 'all') {
      filtered = filtered.filter(item => item.type === filters.documentType);
    }
    
    // Filter by document number
    if (filters.documentNumber) {
      const searchTerm = filters.documentNumber.toLowerCase();
      filtered = filtered.filter(item => 
        (item.estimateNumber && item.estimateNumber.toLowerCase().includes(searchTerm)) ||
        (item.orderNumber && item.orderNumber.toLowerCase().includes(searchTerm))
      );
    }
    
    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= fromDate;
      });
    }
    
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of the day
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate <= toDate;
      });
    }
    
    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }
    
    setFilteredItems(filtered);
  };
  
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
      dateTo: '',
      status: 'all'
    });
  };
  
  /**
   * Delete a history item
   */
  const deleteItem = (item) => {
    if (!item || !item.id || !item.type) return;
    
    const confirmDelete = window.confirm(
      `정말로 이 ${item.type === 'estimate' ? '견적서' : '주문서'}를 삭제하시겠습니까? 
      ${item.type === 'estimate' ? item.estimateNumber : item.orderNumber}`
    );
    
    if (confirmDelete) {
      try {
        // Remove from localStorage
        const storageKey = `${item.type}_${item.id}`;
        localStorage.removeItem(storageKey);
        
        // Update state
        setHistoryItems(prev => prev.filter(i => !(i.id === item.id && i.type === item.type)));
        
        if (selectedItem && selectedItem.id === item.id && selectedItem.type === item.type) {
          setSelectedItem(null);
          setView('list');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };
  
  /**
   * Convert an estimate to an order
   */
  const convertToOrder = (estimate) => {
    navigate(`/purchase-order/new`, { state: { fromEstimate: estimate } });
  };
  
  /**
   * Edit an existing item
   */
  const editItem = (item) => {
    if (!item || !item.type) return;
    
    if (item.type === 'estimate') {
      navigate(`/estimate/edit/${item.id}`, { state: { item } });
    } else if (item.type === 'order') {
      navigate(`/purchase-order/edit/${item.id}`, { state: { item } });
    }
  };
  
  /**
   * Print an item
   */
  const printItem = (item) => {
    if (!item || !item.type) return;
    
    // 현재 페이지에서 직접 인쇄하는 방식으로 변경
    const printWindow = window.open('', '_blank');
    const printData = item;
    
    if (item.type === 'estimate') {
      // 견적서 인쇄용 HTML
      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>견적서</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .print-header { text-align: center; margin-bottom: 30px; }
              .print-header h1 { font-size: 24px; margin: 0; }
              .info-table, .quote-table, .total-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              .info-table td, .quote-table th, .quote-table td, .total-table td { border: 1px solid #000; padding: 8px; }
              .quote-table th { background-color: #f0f0f0; text-align: center; }
              .right { text-align: right; }
              .label { background-color: #f8f9fa; font-weight: bold; }
              .notes-section { margin-top: 20px; }
              .form-company { text-align: center; margin-top: 30px; font-weight: bold; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
            <div>문서번호: ${printData.estimateNumber || printData.documentNumber || ''}</div>
          </div>
          
          <table class="info-table">
            <tbody>
              <tr>
                <td class="label">견적일자</td>
                <td>${printData.date}</td>
                <td class="label">사업자등록번호</td>
                <td>232-81-01750</td>
              </tr>
              <tr>
                <td class="label">상호명</td>
                <td>${printData.customerName || printData.companyName || ''}</td>
                <td class="label">상호</td>
                <td>삼미앵글랙산업</td>
              </tr>
              <tr>
                <td colspan="2" rowspan="4" style="text-align: center; font-weight: bold; vertical-align: middle; padding: 16px 0; background: #f8f9fa;">
                  아래와 같이 견적합니다 (부가세, 운임비 별도)
                </td>
                <td class="label">대표자</td>
                <td>박이삭</td>
              </tr>
              <tr>
                <td class="label">소재지</td>
                <td>경기도 광명시 원노온사로 39, 제1동</td>
              </tr>
              <tr>
                <td class="label">TEL</td>
                <td>(02)2611-4597</td>
              </tr>
              <tr>
                <td class="label">FAX</td>
                <td>(02)2611-4595</td>
              </tr>
              <tr>
                <td class="label">홈페이지</td>
                <td>http://www.ssmake.com</td>
              </tr>
            </tbody>
          </table>
          
          <table class="quote-table">
            <thead>
              <tr>
                <th>NO</th>
                <th>품명</th>
                <th>단위</th>
                <th>수량</th>
                <th>단가</th>
                <th>공급가</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              ${(printData.items || []).map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.name || ''}</td>
                  <td>${item.unit || ''}</td>
                  <td>${item.quantity || ''}</td>
                  <td>${parseInt(item.unitPrice || 0).toLocaleString()}</td>
                  <td class="right">${parseInt(item.totalPrice || 0).toLocaleString()}</td>
                  <td>${item.note || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <table class="total-table">
            <tbody>
              <tr>
                <td class="label">소계</td>
                <td class="right">${(printData.subtotal || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="label">부가세</td>
                <td class="right">${(printData.tax || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="label"><strong>합계</strong></td>
                <td class="right"><strong>${(printData.totalAmount || printData.totalPrice || 0).toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
          
          ${printData.notes ? `
            <div class="notes-section">
              <strong>비고:</strong><br>
              ${printData.notes.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
          
          <div class="form-company">(주)삼미앵글랙산업</div>
        </body>
        </html>
      `;
      
      printWindow.document.write(printHTML);
    } else if (item.type === 'order') {
      // 발주서 인쇄용 HTML
      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>발주서</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .print-header { text-align: center; margin-bottom: 30px; }
              .print-header h1 { font-size: 24px; margin: 0; }
              .info-table, .order-table, .material-table, .total-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              .info-table td, .order-table th, .order-table td, .material-table th, .material-table td, .total-table td { border: 1px solid #000; padding: 8px; }
              .order-table th, .material-table th { background-color: #f0f0f0; text-align: center; }
              .right { text-align: right; }
              .label { background-color: #f8f9fa; font-weight: bold; }
              .section-title { margin-top: 30px; margin-bottom: 10px; font-size: 18px; font-weight: bold; }
              .notes-section { margin-top: 20px; }
              .form-company { text-align: center; margin-top: 30px; font-weight: bold; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>발&nbsp;&nbsp;&nbsp;&nbsp;주&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
            <div>거래번호: ${printData.orderNumber || ''}</div>
          </div>
          
          <table class="info-table">
            <tbody>
              <tr>
                <td class="label">거래일자</td>
                <td>${printData.date}</td>
                <td class="label">거래번호</td>
                <td>${printData.orderNumber || ''}</td>
              </tr>
              <tr>
                <td class="label">상호명</td>
                <td>${printData.customerName || printData.companyName || ''}</td>
                <td class="label">상호</td>
                <td>삼미앵글랙산업</td>
              </tr>
              <tr>
                <td colspan="2" rowspan="4" style="text-align: center; font-weight: bold; vertical-align: middle; padding: 18px 0; background: #f8f9fa;">
                  아래와 같이 발주합니다 (부가세, 운임비 별도)
                </td>
                <td class="label">대표자</td>
                <td>박이삭</td>
              </tr>
              <tr>
                <td class="label">소재지</td>
                <td>경기도 광명시 원노온사로 39, 제1동</td>
              </tr>
              <tr>
                <td class="label">TEL</td>
                <td>(02)2611-4597</td>
              </tr>
              <tr>
                <td class="label">FAX</td>
                <td>(02)2611-4595</td>
              </tr>
              <tr>
                <td class="label">홈페이지</td>
                <td>http://www.ssmake.com</td>
              </tr>
            </tbody>
          </table>
          
          <h3 class="section-title">발주 명세</h3>
          <table class="order-table">
            <thead>
              <tr>
                <th>NO</th>
                <th>품명</th>
                <th>단위</th>
                <th>수량</th>
                <th>단가</th>
                <th>공급가</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              ${(printData.items || []).map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.name || ''}</td>
                  <td>${item.unit || ''}</td>
                  <td>${item.quantity || ''}</td>
                  <td>${parseInt(item.unitPrice || 0).toLocaleString()}</td>
                  <td class="right">${parseInt(item.totalPrice || 0).toLocaleString()}</td>
                  <td>${item.note || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${(printData.materials && printData.materials.length > 0) ? `
            <h3 class="section-title">원자재 명세서</h3>
            <table class="material-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>부품명</th>
                  <th>규격/설명</th>
                  <th>수량</th>
                  <th>단가</th>
                  <th>금액</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                ${printData.materials.map((material, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${material.name || ''}</td>
                    <td>${material.specification || ''}</td>
                    <td>${material.quantity || ''}</td>
                    <td>${parseInt(material.unitPrice || 0).toLocaleString()}</td>
                    <td class="right">${parseInt(material.totalPrice || 0).toLocaleString()}</td>
                    <td>${material.note || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          <table class="total-table">
            <tbody>
              <tr>
                <td class="label">소계</td>
                <td class="right">${(printData.subtotal || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="label">부가세</td>
                <td class="right">${(printData.tax || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td class="label"><strong>합계</strong></td>
                <td class="right"><strong>${(printData.totalAmount || printData.totalPrice || 0).toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
          
          ${printData.notes ? `
            <div class="notes-section">
              <strong>비고:</strong><br>
              ${printData.notes.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
          
          <div class="form-company">(주)삼미앵글랙산업</div>
        </body>
        </html>
      `;
      
      printWindow.document.write(printHTML);
    }
    
    printWindow.document.close();
    
    // 인쇄 실행
    printWindow.onload = function() {
      printWindow.print();
      printWindow.close();
    };
  };
  
  /**
   * Get status badge CSS class
   */
  const getStatusClass = (status) => {
    switch (status) {
      case '진행 중':
      case '처리 중':
        return 'status-processing';
      case '완료':
        return 'status-completed';
      case '취소':
        return 'status-cancelled';
      default:
        return 'status-pending';
    }
  };
  
  /**
   * Update item status
   */
  const updateStatus = (item, newStatus) => {
    if (!item || !item.id || !item.type) return;
    
    try {
      // Update item
      const updatedItem = {
        ...item,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      
      // Save to localStorage
      const storageKey = `${item.type}_${item.id}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedItem));
      
      // Update state
      setHistoryItems(prev => prev.map(i => {
        if (i.id === item.id && i.type === item.type) {
          return updatedItem;
        }
        return i;
      }));
      
      if (selectedItem && selectedItem.id === item.id && selectedItem.type === item.type) {
        setSelectedItem(updatedItem);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };
  
  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch {
      return dateString;
    }
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
            {isEstimate ? '견적서' : '주문서'} 상세정보 
            <span className={`status-badge ${getStatusClass(selectedItem.status)}`}>
              {selectedItem.status || '진행 중'}
            </span>
          </h2>
          <button className="back-button" onClick={() => setView('list')}>목록으로</button>
        </div>
        
        <div className="details-content">
          <div className="details-section">
            <h3>기본 정보</h3>
            <div className="details-grid">
              <div className="details-item">
                <strong>{isEstimate ? '견적번호' : '주문번호'}:</strong>
                <span>{isEstimate ? selectedItem.estimateNumber : selectedItem.orderNumber}</span>
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
              {!isEstimate && selectedItem.estimateNumber && (
                <div className="details-item">
                  <strong>관련 견적번호:</strong>
                  <span>{selectedItem.estimateNumber}</span>
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
          
          {!isEstimate && (
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
            <h3>상태 관리</h3>
            <div className="status-buttons">
              <button 
                className={`status-button ${selectedItem.status === '진행 중' ? 'active' : ''}`}
                onClick={() => updateStatus(selectedItem, '진행 중')}
              >
                진행 중
              </button>
              <button 
                className={`status-button ${selectedItem.status === '처리 중' ? 'active' : ''}`}
                onClick={() => updateStatus(selectedItem, '처리 중')}
              >
                처리 중
              </button>
              <button 
                className={`status-button ${selectedItem.status === '완료' ? 'active' : ''}`}
                onClick={() => updateStatus(selectedItem, '완료')}
              >
                완료
              </button>
              <button 
                className={`status-button ${selectedItem.status === '취소' ? 'active' : ''}`}
                onClick={() => updateStatus(selectedItem, '취소')}
              >
                취소
              </button>
            </div>
          </div>
          
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
                <button onClick={() => convertToOrder(selectedItem)}>
                  주문서 생성
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
   * Render list of history items
   */
  const renderItemsList = () => (
    <div className="history-list">
      <div className="list-header">
        <div className="header-cell document-type">유형</div>
        <div className="header-cell document-id">문서번호</div>
        <div className="header-cell date">날짜</div>
        <div className="header-cell customer">고객명</div>
        <div className="header-cell product">제품</div>
        <div className="header-cell price">금액</div>
        <div className="header-cell status">상태</div>
        <div className="header-cell actions">작업</div>
      </div>
      
      {filteredItems.length === 0 ? (
        <div className="no-items">
          <p>표시할 항목이 없습니다.</p>
        </div>
      ) : (
        filteredItems.map((item) => (
          <div 
            key={`${item.type}_${item.id}`}
            className="list-item"
            onClick={() => {
              setSelectedItem(item);
              setView('details');
            }}
          >
            <div className="item-cell document-type">
              {item.type === 'estimate' ? '견적서' : '주문서'}
            </div>
            <div className="item-cell document-id">
              {item.type === 'estimate' ? item.estimateNumber : item.orderNumber}
            </div>
            <div className="item-cell date">
              {formatDate(item.date)}
            </div>
            <div className="item-cell customer">
              {item.customerName}
            </div>
            <div className="item-cell product">
              {item.productType}
            </div>
            <div className="item-cell price">
              {item.totalPrice?.toLocaleString()}원
            </div>
            <div className="item-cell status">
              <span className={`status-badge ${getStatusClass(item.status)}`}>
                {item.status || '진행 중'}
              </span>
            </div>
            <div className="item-cell actions" onClick={(e) => e.stopPropagation()}>
              <button title="편집" onClick={(e) => { e.stopPropagation(); editItem(item); }}>
                ✏️
              </button>
              <button title="인쇄" onClick={(e) => { e.stopPropagation(); printItem(item); }}>
                🖨️
              </button>
              {item.type === 'estimate' && (
                <button 
                  title="주문서 생성" 
                  onClick={(e) => { e.stopPropagation(); convertToOrder(item); }}
                >
                  📋
                </button>
              )}
              <button 
                title="삭제" 
                className="delete-icon"
                onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
              >
                🗑️
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
  
  return (
    <div className="history-page">
      {view === 'list' && (
        <>
          <h2>문서 관리</h2>
          
          <div className="filters-section">
            <div className="filters-container">
              <div className="filter-group">
                <label>문서 유형:</label>
                <select 
                  name="documentType" 
                  value={filters.documentType} 
                  onChange={handleFilterChange}
                >
                  <option value="all">전체</option>
                  <option value="estimate">견적서</option>
                  <option value="order">주문서</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>문서번호:</label>
                <input
                  type="text"
                  name="documentNumber"
                  placeholder="문서번호 검색"
                  value={filters.documentNumber}
                  onChange={handleFilterChange}
                  className="filter-input"
                />
              </div>
              
              <div className="filter-group">
                <label>날짜 범위:</label>
                <div className="date-range">
                  <input 
                    type="date"
                    name="dateFrom"
                    value={filters.dateFrom}
                    onChange={handleFilterChange}
                  />
                  <span>~</span>
                  <input 
                    type="date"
                    name="dateTo"
                    value={filters.dateTo}
                    onChange={handleFilterChange}
                  />
                </div>
              </div>
              
              <div className="filter-group">
                <label>상태:</label>
                <select 
                  name="status" 
                  value={filters.status} 
                  onChange={handleFilterChange}
                >
                  <option value="all">전체</option>
                  <option value="진행 중">진행 중</option>
                  <option value="처리 중">처리 중</option>
                  <option value="완료">완료</option>
                  <option value="취소">취소</option>
                </select>
              </div>
              
              <button 
                className="reset-filters" 
                onClick={resetFilters}
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
              새 주문서 작성
            </button>
          </div>
          
          {renderItemsList()}
        </>
      )}
      
      {view === 'details' && renderItemDetails()}
    </div>
  );
};

export default HistoryPage;
