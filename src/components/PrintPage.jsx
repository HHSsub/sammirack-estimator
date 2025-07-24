import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import GyeonjukPrint from './GyeonjukPrint';
import BaljuPrint from './BaljuPrint';
import '../styles/PrintStyles.css';

/**
 * PrintPage component for handling print-only views
 * This component renders either estimate or purchase order documents
 * and automatically triggers print dialog
 */
const PrintPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const type = searchParams.get('type'); // 'gyeonjuk' or 'balju'
  const dataParam = searchParams.get('data');
  
  let data = null;
  try {
    data = dataParam ? JSON.parse(decodeURIComponent(dataParam)) : null;
  } catch (error) {
    console.error('Error parsing print data:', error);
  }

  useEffect(() => {
    // Auto-trigger print dialog after component mounts
    const timer = setTimeout(() => {
      window.print();
    }, 500);

    // Handle after print events
    const handleAfterPrint = () => {
      // Navigate back to previous page or close window
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        window.close();
      }
    };

    // Add event listeners for print events
    window.addEventListener('afterprint', handleAfterPrint);
    
    // Cleanup
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [navigate]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        window.print();
      }
      if (event.key === 'Escape') {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          window.close();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  if (!type || !data) {
    return (
      <div className="print-error">
        <h2>프린트 오류</h2>
        <p>프린트할 데이터가 없습니다.</p>
        <button onClick={() => navigate(-1)} className="print-button">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="print-page">
      {/* Print Actions - Hidden during print */}
      <div className="print-actions no-print">
        <button 
          onClick={() => window.print()} 
          className="print-button"
        >
          인쇄하기 (Ctrl+P)
        </button>
        <button 
          onClick={() => navigate(-1)} 
          className="print-button"
          style={{ background: '#6c757d' }}
        >
          돌아가기 (ESC)
        </button>
      </div>

      {/* Print Content */}
      <div className="print-content">
        {type === 'gyeonjuk' && <GyeonjukPrint data={data} />}
        {type === 'balju' && <BaljuPrint data={data} />}
      </div>

      {/* Print Instructions - Hidden during print */}
      <div className="print-instructions no-print">
        <p>
          <strong>인쇄 팁:</strong>
        </p>
        <ul>
          <li>브라우저의 인쇄 설정에서 "배경 그래픽 인쇄"를 활성화하세요</li>
          <li>용지 크기를 A4로 설정하세요</li>
          <li>여백을 "최소"로 설정하면 더 좋은 결과를 얻을 수 있습니다</li>
          <li>Chrome 브라우저에서 최적의 인쇄 품질을 제공합니다</li>
        </ul>
      </div>
    </div>
  );
};

export default PrintPage;
