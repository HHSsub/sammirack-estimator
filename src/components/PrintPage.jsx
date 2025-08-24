import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import GyeonjukPrint from './GyeonjukPrint';
import BaljuPrint from './BaljuPrint';
import { exportEstimateToExcel, exportPurchaseOrderToExcel } from '../utils/excelUtils';
import '../styles/PrintStyles.css';

const PrintPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [printData, setPrintData] = useState(null);
  const printExecutedRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // URL 파라미터에서 데이터 추출
    const type = searchParams.get('type');
    const dataParam = searchParams.get('data');
    
    if (!type || !dataParam) {
      console.error('프린트 타입 또는 데이터가 없습니다.');
      navigate(-1);
      return;
    }

    try {
      const decodedData = JSON.parse(decodeURIComponent(dataParam));
      setPrintData(decodedData);
    } catch (error) {
      console.error('데이터 파싱 오류:', error);
      navigate(-1);
      return;
    }

    // CSS 로딩 완료 대기
    const checkStylesLoaded = () => {
      const styleSheets = Array.from(document.styleSheets);
      const printStylesLoaded = styleSheets.some(sheet => {
        try {
          return sheet.href && sheet.href.includes('PrintStyles');
        } catch (e) {
          return false;
        }
      });

      if (printStylesLoaded || styleSheets.length > 0) {
        setIsLoading(false);
        // 추가 지연으로 렌더링 완료 보장
        timeoutRef.current = setTimeout(() => {
          executePrint();
        }, 500);
      } else {
        // 재시도
        setTimeout(checkStylesLoaded, 100);
      }
    };

    checkStylesLoaded();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchParams, navigate]);

  const executePrint = () => {
    if (printExecutedRef.current) return;
    printExecutedRef.current = true;

    // 프린트 이벤트 리스너 등록
    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      handlePrintComplete();
    };

    const handleBeforePrint = () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      // 프린트 시작 시 미리보기 메시지 숨기기
      const previewNotices = document.querySelectorAll('.print-preview-notice');
      previewNotices.forEach(notice => {
        notice.style.display = 'none';
      });
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    // 프린트 실행
    try {
      window.print();
    } catch (error) {
      console.error('프린트 실행 오류:', error);
      handlePrintComplete();
    }

    // 타임아웃으로 안전장치 설정 (30초)
    setTimeout(() => {
      if (printExecutedRef.current) {
        window.removeEventListener('afterprint', handleAfterPrint);
        window.removeEventListener('beforeprint', handleBeforePrint);
        handlePrintComplete();
      }
    }, 30000);
  };

  const handlePrintComplete = () => {
    // 브라우저 히스토리가 있으면 뒤로 가기, 없으면 창 닫기 시도
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      try {
        window.close();
      } catch (error) {
        // 창 닫기 실패 시 홈으로 이동
        navigate('/');
      }
    }
  };

  const handleManualPrint = () => {
    if (!printExecutedRef.current) {
      executePrint();
    }
  };

  const handleExcelExport = () => {
    const type = searchParams.get('type');
    if (type === 'gyeonjuk') {
      exportEstimateToExcel(printData);
    } else if (type === 'balju') {
      exportPurchaseOrderToExcel(printData);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div>프린트 준비 중...</div>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          잠시만 기다려주세요.
        </div>
      </div>
    );
  }

  const type = searchParams.get('type');

  return (
    <div>
      {/* 수동 프린트 버튼 (자동 프린트 실패 시 대비) */}
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px', 
        zIndex: 1000,
        display: 'flex',
        gap: '10px'
      }}>
        <button 
          onClick={handleManualPrint}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          프린트
        </button>
        <button 
          onClick={handleExcelExport}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          엑셀 저장
        </button>
        <button 
          onClick={() => navigate(-1)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          닫기
        </button>
      </div>

      {/* 프린트 컴포넌트 렌더링 */}
      {type === 'gyeonjuk' && <GyeonjukPrint data={printData} />}
      {type === 'balju' && <BaljuPrint data={printData} />}
    </div>
  );
};

export default PrintPage;
