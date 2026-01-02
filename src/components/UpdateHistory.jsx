// src/components/UpdateHistory.jsx
import React, { useState } from 'react';
import '../styles/UpdateHistory.css';

/**
 * 개발 업데이트 이력을 표시하는 컴포넌트
 * 
 * 업데이트 내용 추가 방법:
 * 아래 updates 배열에 새로운 객체를 추가하세요.
 * { date: 'YYYY-MM-DD', content: '업데이트 내용 설명' }
 * 
 * 예시:
 * { date: '2025-01-02', content: '견적서 엑셀 출력 기능 개선' }
 */
const UpdateHistory = () => {
  // 업데이트 이력 배열 (최신순 정렬)
  const updates = [
    { date: '2024-12-28', content: '하이랙 기둥 규격기반 분리기준 추가, 하이랙 기둥 재고 및 단가 ID추가,사업자 주소 정정' },
    { date: '2025-01-01', content: '문서 관리 페이지 이모지 대신 텍스트로' },
    { date: '2025-01-02', content: 'FAX글자크기수정 및 디자인개선검증완료, 택배프로그램추가개선, 업데이트이력 확인기능추가, 파렛트랙 신형추가' },
    // 새로운 업데이트는 여기에 추가하세요
  ];

  // 페이지네이션 설정
  const itemsPerPage = 10; // 한 페이지에 보여줄 항목 수
  const [currentPage, setCurrentPage] = useState(0); // 기본값: 최신 페이지 (0)
  
  // 총 페이지 수 계산
  const totalPages = Math.ceil(updates.length / itemsPerPage);
  
  // 현재 페이지에 표시할 업데이트 항목 계산
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUpdates = updates.slice(startIndex, endIndex);
  
  // 이전 페이지로 이동
  const goToPreviousPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  // 다음 페이지로 이동
  const goToNextPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  // 첫 페이지(최신)인지 확인
  const isFirstPage = currentPage === 0;
  // 마지막 페이지(과거)인지 확인
  const isLastPage = currentPage === totalPages - 1;

  return (
    <div className="update-history-container">
      <div className="update-history-header">
        <h3>📌 업데이트 이력</h3>
        <p className="update-description">
          시스템 개선사항 및 버그 수정 내역을 확인할 수 있습니다. 
          건의사항이나 버그는 관리자에게 문의해주세요.
        </p>
      </div>
      
      <div className="update-history-list">
        {updates.length === 0 ? (
          <div className="no-updates">
            <p>업데이트 이력이 없습니다.</p>
          </div>
        ) : (
          <>
            <ul>
              {currentUpdates.map((update, index) => (
                <li key={startIndex + index} className="update-item">
                  <span className="update-date">{update.date}</span>
                  <span className="update-content">{update.content}</span>
                </li>
              ))}
            </ul>
            
            {/* 페이지네이션 컨트롤 */}
            {totalPages > 1 && (
              <div className="update-history-pagination">
                <button
                  onClick={goToPreviousPage}
                  disabled={isLastPage}
                  className="pagination-btn pagination-btn-left"
                  title="과거 이력 보기 (←)"
                >
                  &lt;
                </button>
                <span className="pagination-info">
                  {totalPages - currentPage} / {totalPages} 페이지
                  {currentPage === 0 && ' (최신)'}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={isFirstPage}
                  className="pagination-btn pagination-btn-right"
                  title="최신 이력 보기 (→)"
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="update-history-footer">
        <p>💡 건의사항이나 버그 발견 시 관리자에게 연락 바랍니다. (Tel : 010-6317-4543) </p>
      </div>
    </div>
  );
};

export default UpdateHistory;
