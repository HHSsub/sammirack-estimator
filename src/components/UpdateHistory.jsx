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
    // 새로운 업데이트는 여기에 추가하세요
    { date: '2025-03-06', content: '견적서 화면에서 발주서 즉시전환가능, 품목추가 버튼에서 하이랙 기둥 높이글자제거, 파렛트랙 기둥은 브러시랑 세트로, 스마트스토어 문서 자동저장 개선' },
    { date: '2025-02-27', content: '자재 추가 버튼에서 규격 빨간글씨, 하이랙 기둥부터 먼저보이게, 스마트스토어API 자동 발주서 저장로직 실험적 구현' },
    { date: '2025-02-12', content: '여러 PC 동시요청 덮어쓰이지 않도록 서버요청분할, 재고감소완료시 문서번호 글자색깔변경 등등' },
    { date: '2025-02-06', content: '원자재목록 표기시 재고관리상 같은 부품끼리 합산해서 부품표시되도록 수정' },
    { date: '2025-02-04', content: '품목(원자재)추가시 재고 정상 감소 작동 확인[경량랙에서 테스트완료]' },
    { date: '2025-02-03', content: '품목추가버튼 수정, 공임/운임 퀵버튼추가, 문서연동위한 원자재로딩로직 전반 개선' },
    { date: '2025-02-01', content: '문서관리탭 기능 전반적 검토, 유령문서 삭제 및 삭제/검색기능 최적화 진행' },
    { date: '2025-01-27', content: '재고관리연동 오류 수정 및 안정화 작업 진행' },
    { date: '2025-01-27', content: '가비아 서버 대이동, DB가비아에 구축 및 홈페이지 주소 변경, 각종 안정성 테스트진행' },
    { date: '2025-01-26', content: '경량랙 3색상 재고 신규추가, 재고 동기화 점검 및 수정, 자재추가 품목추가 드롭다운 신규기능 추가 및 버튼 위치 조정' },
    { date: '2025-01-15', content: '팩스 글자색, 배치, 글자크기간격조정. 스텐랙선반 재고 원복, 하이랙 부품이름 색깔포함, 하이랙 색깔별 로드빔 분리' },
    { date: '2025-01-12', content: '기둥 갯수 계산 및 합치기 로직 수정 (하이랙)' },
    { date: '2025-01-08', content: '발주서·거래명세서 원자재 테이블 열 간격 조정, 문서 작성 시 수량 입력 UI 개선(3자리 이상), 팩스 발송 상단 주요 테이블 텍스트 검정색·굵은 글씨 적용, 경량랙 색상 옵션 추가(아이보리·블랙·실버), 재고 관리 버튼 반응성 검증 및 버그 수정, 스텐랙 재고 중복 제거 및 재고 감소 연동 테스트 완료, 문서 하단 비고란 글자 크기 확대, 문서 상단 메모 영역 길이 확장(약 30%), 파렛트랙 기타 추가옵션4(550kg) 삭제 및 하이랙 용어 통일(600kg), 파렛트랙 철판형 로드빔 구형·신형 추가 및 기타 추가옵션 구조 조정, 기타 추가옵션 장바구니 내 "추가옵션" 스티커 표시로 시각적 구분, 하이랙 기타 추가옵션 재고 연동 오류 수정 및 호환성 테스트 완료' },
    { date: '2025-01-02', content: '팝업뜨는 위치 수정, FAX글자크기수정 및 디자인개선검증완료, 택배프로그램추가개선, 업데이트이력 확인기능추가, 파렛트랙 신형추가' },
    { date: '2025-01-01', content: '문서 관리 페이지 이모지 대신 텍스트로' },
    { date: '2024-12-28', content: '하이랙 기둥 규격기반 분리기준 추가, 하이랙 기둥 재고 및 단가 ID추가,사업자 주소 정정' },
  ];

  // 페이지네이션 설정
  const itemsPerPage = 3; // 한 페이지에 보여줄 항목 수
  const [currentPage, setCurrentPage] = useState(0); // 기본값: 최신 페이지 (0)

  // 각 항목의 토글 상태 관리 (기본값: 모두 닫힘)
  const [expandedItems, setExpandedItems] = useState(new Set());

  // 토글 함수
  const toggleItem = (index) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  // 총 페이지 수 계산
  const totalPages = Math.ceil(updates.length / itemsPerPage);

  // 현재 페이지에 표시할 업데이트 항목 계산
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUpdates = updates.slice(startIndex, endIndex);

  // 위 화살표: 최신 이력으로 이동 (currentPage 감소)
  const goToNewer = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // 아래 화살표: 과거 이력으로 이동 (currentPage 증가)
  const goToOlder = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  // 첫 페이지(최신)인지 확인
  const isFirstPage = currentPage === 0;
  // 마지막 페이지(과거)인지 확인
  const isLastPage = currentPage === totalPages - 1;

  return (
    <div className="update-history-container">
      <div className="update-history-header">
        <div className="update-history-title-row">
          <h3>📌 업데이트 이력</h3>
          {totalPages > 1 && (
            <div className="update-history-nav-buttons">
              <button
                onClick={goToNewer}
                disabled={isFirstPage}
                className="nav-btn nav-btn-up"
                title="최신 이력 보기 (↑)"
              >
                ↑
              </button>
              <button
                onClick={goToOlder}
                disabled={isLastPage}
                className="nav-btn nav-btn-down"
                title="과거 이력 보기 (↓)"
              >
                ↓
              </button>
            </div>
          )}
        </div>
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
              {currentUpdates.map((update, index) => {
                const itemIndex = startIndex + index;
                const isExpanded = expandedItems.has(itemIndex);
                return (
                  <li key={itemIndex} className="update-item">
                    <span className="update-date">{update.date}</span>
                    <div className="update-content-wrapper">
                      <button
                        className="toggle-content-btn"
                        onClick={() => toggleItem(itemIndex)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? '내용숨기기' : '내용보기'}
                      </button>
                      {isExpanded && (
                        <div className="update-content">
                          {update.content}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
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
