import React, { useState, useEffect } from 'react';

const AdminPriceEditor = ({ item, onClose, onSave }) => {
  const [editPrice, setEditPrice] = useState(item.unitPrice || 0);
  const [originalPrice] = useState(item.unitPrice || 0);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'history'
  const [loading, setLoading] = useState(false);

  // 부품 고유 ID 생성
  const generatePartId = (item) => {
    const { rackType, name, specification } = item;
    const cleanName = name.replace(/[^\w가-힣]/g, '');
    const cleanSpec = (specification || '').replace(/[^\w가-힣]/g, '');
    return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
  };

  const partId = generatePartId(item);

  // 컴포넌트 마운트 시 히스토리 로드
  useEffect(() => {
    loadPriceHistory();
  }, [partId]);

  // 가격 변경 히스토리 로드
  const loadPriceHistory = () => {
    try {
      const stored = localStorage.getItem('admin_price_history') || '{}';
      const historyData = JSON.parse(stored);
      const partHistory = historyData[partId] || [];
      setHistory(partHistory);
    } catch (error) {
      console.error('히스토리 로드 실패:', error);
      setHistory([]);
    }
  };

  // 가격 변경 히스토리 저장
  const savePriceHistory = (oldPrice, newPrice) => {
    try {
      const stored = localStorage.getItem('admin_price_history') || '{}';
      const historyData = JSON.parse(stored);
      
      if (!historyData[partId]) {
        historyData[partId] = [];
      }

      const newEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        account: 'admin', // 현재는 admin만 접근 가능
        oldPrice: Number(oldPrice),
        newPrice: Number(newPrice),
        rackOption: item.displayName || `${item.rackType} ${item.specification || ''}`.trim()
      };

      historyData[partId].unshift(newEntry); // 최신 순으로 정렬
      
      // 히스토리 최대 50개로 제한
      if (historyData[partId].length > 50) {
        historyData[partId] = historyData[partId].slice(0, 50);
      }

      localStorage.setItem('admin_price_history', JSON.stringify(historyData));
      setHistory(historyData[partId]);
    } catch (error) {
      console.error('히스토리 저장 실패:', error);
    }
  };

  // 현재 관리자 수정 단가 로드
  const loadAdminEditPrice = () => {
    try {
      const stored = localStorage.getItem('admin_edit_prices') || '{}';
      const priceData = JSON.parse(stored);
      return priceData[partId] || null;
    } catch (error) {
      console.error('관리자 수정 단가 로드 실패:', error);
      return null;
    }
  };

  // 관리자 수정 단가 저장
  const saveAdminEditPrice = (newPrice) => {
    try {
      const stored = localStorage.getItem('admin_edit_prices') || '{}';
      const priceData = JSON.parse(stored);
      
      if (newPrice && newPrice > 0) {
        priceData[partId] = {
          price: Number(newPrice),
          timestamp: new Date().toISOString(),
          account: 'admin',
          partInfo: {
            rackType: item.rackType,
            name: item.name,
            specification: item.specification || ''
          }
        };
      } else {
        // 가격이 0이거나 null이면 삭제 (기본값 사용)
        delete priceData[partId];
      }

      localStorage.setItem('admin_edit_prices', JSON.stringify(priceData));
    } catch (error) {
      console.error('관리자 수정 단가 저장 실패:', error);
    }
  };

  // 저장 처리
  const handleSave = async () => {
    const newPrice = Number(editPrice) || 0;
    const oldPrice = originalPrice || 0;

    if (newPrice === oldPrice) {
      onClose();
      return;
    }

    setLoading(true);

    try {
      // 1. 히스토리 저장
      savePriceHistory(oldPrice, newPrice);
      
      // 2. 관리자 수정 단가 저장
      saveAdminEditPrice(newPrice);
      
      // 3. 상위 컴포넌트에 변경사항 전달
      if (onSave) {
        onSave(partId, newPrice, oldPrice);
      }

      onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 날짜 포맷팅
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-price-editor-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="admin-price-editor-modal" style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>부품 단가 수정</h3>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>×</button>
        </div>

        {/* 부품 정보 표시 */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>부품명:</strong> {item.name}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>규격:</strong> {item.specification || '-'}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>랙 타입:</strong> {item.rackType}
          </div>
          <div>
            <strong>부품 ID:</strong> <code style={{ fontSize: '12px', background: '#e9ecef', padding: '2px 6px', borderRadius: '3px' }}>{partId}</code>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', borderBottom: '2px solid #e9ecef' }}>
            <button
              onClick={() => setActiveTab('edit')}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === 'edit' ? '2px solid #007bff' : 'none',
                color: activeTab === 'edit' ? '#007bff' : '#6c757d',
                fontWeight: activeTab === 'edit' ? 'bold' : 'normal'
              }}
            >
              단가 수정
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === 'history' ? '2px solid #007bff' : 'none',
                color: activeTab === 'history' ? '#007bff' : '#6c757d',
                fontWeight: activeTab === 'history' ? 'bold' : 'normal'
              }}
            >
              역대 변동 이력 ({history.length})
            </button>
          </div>
        </div>

        {/* 단가 수정 탭 */}
        {activeTab === 'edit' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                현재 단가
              </label>
              <div style={{
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                {originalPrice ? `${originalPrice.toLocaleString()}원` : '단가 정보 없음'}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                새로운 단가 *
              </label>
              <input
                type="number"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
                placeholder="새로운 단가를 입력하세요"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: loading ? '#6c757d' : '#007bff',
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 변동 이력 탭 */}
        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                변경 이력이 없습니다.
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #dee2e6' }}>날짜/시간</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #dee2e6' }}>계정</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #dee2e6' }}>이전 단가</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #dee2e6' }}>변경 단가</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #dee2e6' }}>변동액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => {
                      const diff = entry.newPrice - entry.oldPrice;
                      return (
                        <tr key={entry.id}>
                          <td style={{ padding: '8px', border: '1px solid #dee2e6', fontSize: '13px' }}>
                            {formatDate(entry.timestamp)}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                            {entry.account}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            {entry.oldPrice.toLocaleString()}원
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            {entry.newPrice.toLocaleString()}원
                          </td>
                          <td style={{
                            padding: '8px',
                            border: '1px solid #dee2e6',
                            textAlign: 'right',
                            color: diff > 0 ? '#dc3545' : diff < 0 ? '#28a745' : '#6c757d',
                            fontWeight: 'bold'
                          }}>
                            {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPriceEditor;
