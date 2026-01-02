import React, { useEffect, useState } from 'react';
import './ToastNotification.css';

/**
 * 버튼 위치를 기준으로 표시되는 토스트 알림 컴포넌트
 * @param {Object} props
 * @param {boolean} props.show - 표시 여부
 * @param {string} props.message - 표시할 메시지
 * @param {string} props.type - 'success' | 'error' | 'info'
 * @param {HTMLElement} props.anchorElement - 기준이 되는 버튼 요소
 * @param {number} props.duration - 자동 사라지는 시간 (ms, 기본 2000)
 * @param {Function} props.onClose - 닫힐 때 호출되는 콜백
 */
const ToastNotification = ({ 
  show, 
  message, 
  type = 'success', 
  anchorElement, 
  duration = 2000,
  onClose 
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && anchorElement) {
      // 버튼의 위치를 기준으로 토스트 위치 계산
      const rect = anchorElement.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;
      
      // 토스트 크기 추정 (나중에 실제 크기로 조정 가능)
      const toastWidth = 200;
      const toastHeight = 50;
      
      // 화면 경계 확인
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = rect.bottom + scrollY + 10; // 버튼 아래 10px
      let left = rect.left + scrollX + (rect.width / 2) - (toastWidth / 2); // 버튼 중앙 기준
      
      // 화면 오른쪽 경계 체크
      if (left + toastWidth > scrollX + viewportWidth) {
        left = scrollX + viewportWidth - toastWidth - 10;
      }
      
      // 화면 왼쪽 경계 체크
      if (left < scrollX) {
        left = scrollX + 10;
      }
      
      // 화면 하단 경계 체크 - 버튼 위에 표시
      if (top + toastHeight > scrollY + viewportHeight) {
        top = rect.top + scrollY - toastHeight - 10; // 버튼 위에 표시
      }
      
      setPosition({ top, left });
      
      setVisible(true);
      
      // 자동으로 사라지기
      if (duration > 0) {
        const timer = setTimeout(() => {
          setVisible(false);
          setTimeout(() => {
            if (onClose) onClose();
          }, 300); // 페이드아웃 애니메이션 시간
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [show, anchorElement, duration, onClose]);

  if (!show) return null;

  return (
    <div
      className={`toast-notification toast-${type} ${visible ? 'toast-visible' : ''}`}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 10000
      }}
    >
      <span className="toast-icon">
        {type === 'success' && '✅'}
        {type === 'error' && '❌'}
        {type === 'info' && 'ℹ️'}
      </span>
      <span className="toast-message">{message}</span>
    </div>
  );
};

export default ToastNotification;

