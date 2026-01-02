import React, { useEffect, useState } from 'react';
import './ConfirmDialog.css';

/**
 * 버튼 위치를 기준으로 표시되는 확인 다이얼로그 컴포넌트
 * @param {Object} props
 * @param {boolean} props.show - 표시 여부
 * @param {string} props.message - 표시할 메시지
 * @param {HTMLElement} props.anchorElement - 기준이 되는 버튼 요소
 * @param {Function} props.onConfirm - 확인 버튼 클릭 시 호출
 * @param {Function} props.onCancel - 취소 버튼 클릭 시 호출
 */
const ConfirmDialog = ({ 
  show, 
  message, 
  anchorElement, 
  onConfirm,
  onCancel
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && anchorElement) {
      // 버튼의 위치를 기준으로 다이얼로그 위치 계산
      const rect = anchorElement.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      
      // 다이얼로그 크기 추정
      const dialogWidth = 280;
      const dialogHeight = 120;
      
      // 화면 경계 확인
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = rect.bottom + scrollY + 10; // 버튼 아래 10px
      let left = rect.left + scrollX + (rect.width / 2) - (dialogWidth / 2); // 버튼 중앙 기준
      
      // 화면 오른쪽 경계 체크
      if (left + dialogWidth > scrollX + viewportWidth) {
        left = scrollX + viewportWidth - dialogWidth - 10;
      }
      
      // 화면 왼쪽 경계 체크
      if (left < scrollX) {
        left = scrollX + 10;
      }
      
      // 화면 하단 경계 체크 - 버튼 위에 표시
      if (top + dialogHeight > scrollY + viewportHeight) {
        top = rect.top + scrollY - dialogHeight - 10; // 버튼 위에 표시
      }
      
      setPosition({ top, left });
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [show, anchorElement]);

  if (!show) return null;

  const handleConfirm = () => {
    setVisible(false);
    setTimeout(() => {
      if (onConfirm) onConfirm();
    }, 100);
  };

  const handleCancel = () => {
    setVisible(false);
    setTimeout(() => {
      if (onCancel) onCancel();
    }, 100);
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div 
        className="confirm-dialog-overlay"
        onClick={handleCancel}
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
      />
      
      {/* 확인 다이얼로그 */}
      <div
        className={`confirm-dialog ${visible ? 'confirm-visible' : ''}`}
        style={{
          position: 'absolute',
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: 10001
        }}
      >
        <div className="confirm-message">{message}</div>
        <div className="confirm-buttons">
          <button 
            className="confirm-btn confirm-yes" 
            onClick={handleConfirm}
          >
            예
          </button>
          <button 
            className="confirm-btn confirm-no" 
            onClick={handleCancel}
          >
            아니오
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;

