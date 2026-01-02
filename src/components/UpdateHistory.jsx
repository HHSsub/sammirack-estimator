// src/components/UpdateHistory.jsx
import React from 'react';
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
    // 새로운 업데이트는 여기에 추가하세요
  ];

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
          <ul>
            {updates.map((update, index) => (
              <li key={index} className="update-item">
                <span className="update-date">{update.date}</span>
                <span className="update-content">{update.content}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="update-history-footer">
        <p>💡 건의사항이나 버그 발견 시 관리자에게 연락 바랍니다. (Tel : 010-6317-4543) </p>
      </div>
    </div>
  );
};

export default UpdateHistory;
