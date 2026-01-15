// src/utils/faxUtils.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * DOM 요소를 PDF로 변환하고 Base64 문자열 반환
 * @param {HTMLElement} element - 변환할 DOM 요소
 * @returns {Promise<string>} PDF Base64 문자열
 */
export const convertDOMToPDFBase64 = async (element) => {
  if (!element) {
    throw new Error('DOM 요소를 찾을 수 없습니다.');
  }

  // ✅ 1단계: 인쇄 시 숨겨야 할 요소들 선택
  const hiddenElements = element.querySelectorAll('.no-print');

  // ✅ 1-1단계: 팩스 캡처 시 무조건 숨겨야 할 UI 버튼들
  const forcedHiddenElements = element.querySelectorAll(
    '.add-item-btn, .add-material-btn, .item-controls, .remove-btn'
  );

  const originalDisplayValues = [];
  const forcedOriginalDisplayValues = [];
  const originalTextareaHeights = [];
  const textareaReplacements = []; // textarea를 div로 변환한 것들 저장

  // ✅ 프린트 미디어 쿼리를 적용하기 위한 임시 스타일 (FAX 전용)
  const printStyleElement = document.createElement('style');
  printStyleElement.textContent = `
    /* =================================================
       FAX CAPTURE STYLE (html2canvas 전용)
       - 화면/프리뷰와 완전히 분리
       ================================================= */

    @media screen {

      /* -------------------------------------------------
         1. 캡처 시 무조건 숨겨야 하는 UI
         ------------------------------------------------- */
      .no-print,
      .add-item-btn,
      .add-material-btn,
      .item-controls,
      .remove-btn {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* -------------------------------------------------
         2. 팩스 가독성: 전체 Bold 유지
         ------------------------------------------------- */
      * {
        font-weight: 700 !important;
      }

      /* -------------------------------------------------
         3. 컨테이너 공통 (문서별 공통 처리)
         ------------------------------------------------- */
        .purchase-order-form-container,
        .estimate-form-container,
        .delivery-note-form-container {
          transform: scale(0.88) !important;      /* ✅ 0.90 → 0.88 */
          transform-origin: top center !important;
          max-width: 100% !important;
          width: 100% !important;  /* A4 영역 내 보장 */
          padding: 10mm 2mm 4mm 2mm !important;        /* 상단 여백 추가 (약 6mm 추가) + 좌우 패딩 동일 */
          margin: 0 auto !important;  /* 중앙 정렬 */
          background: #fff !important;
          min-height: auto !important;
          box-sizing: border-box !important;
          font-size: 12px !important;
          line-height: 1.35 !important;
          overflow: visible !important;  /* 도장 이미지가 잘리지 않도록 */
        }

      /* -------------------------------------------------
         4. 제목
         ------------------------------------------------- */
      .form-header h1 { 
        font-size: 20px !important; 
        margin-bottom: 6px !important; 
      }

      /* -------------------------------------------------
         5. 테이블 공통
         - 🔴 글자 상·하 잘림 완전 차단
         ------------------------------------------------- */
      .form-table th,
      .form-table td,
      .order-table th,
      .order-table td,
      .bom-table th,
      .bom-table td {
        line-height: 1.65 !important;          /* html2canvas 안전값 */
        padding-top: 10px !important;
        padding-bottom: 12px !important;
        padding-left: 4px !important;  /* 좌측 패딩 */
        padding-right: 4px !important;  /* 우측 패딩 */
        vertical-align: middle !important;
        overflow: visible !important;
      }

      /* ✅ 간격 최소화 (footer안잘리기위함) */
      .total-table {
        margin-bottom: 5px !important;
      }
      
      .form-table {
        margin-bottom: 10px !important;
      }
      
      .order-table,
      .bom-table {
        margin-bottom: 8px !important;
      }

      /* -------------------------------------------------
         6. 숫자/전화번호/팩스번호 붙어보임 방지
         ------------------------------------------------- */
      td,
      th,
      input,
      textarea {
        letter-spacing: 0.04em !important;
        font-feature-settings: "tnum" 1, "lnum" 1 !important;
        white-space: pre-wrap !important;
      }

      /* -------------------------------------------------
         7. URL / 도메인 점(.) 사라짐 방지
         ------------------------------------------------- */
      .info-table td,
      .info-table input {
        letter-spacing: 0.06em !important;
        word-spacing: 0.15em !important;
      }

      /* -------------------------------------------------
         8. info-table 입력 필드
         ------------------------------------------------- */
      .info-table input,
      .info-table textarea {
        font-size: 18px !important;  /* ✅ 13px → 18px */
        padding: 8px 6px !important; /* ✅ 6px → 8px */
        font-weight: 700 !important;
      }
      /* ✅ 라벨(거래일자, 거래번호 등) 글자 크기 및 너비 최소화 */
      .form-table .label {
        font-size: 18px !important;  /* ✅ 추가 */
        font-weight: 700 !important;
        width: auto !important;
        min-width: 80px !important;  /* 최소 너비만 설정 */
        max-width: 100px !important;  /* 최대 너비 제한으로 컨텐츠 공간 확보 */
      }
      
      /* ✅ 소재지 주소 한 줄로 표시 (글자 크기 약간 축소, 잘림 방지) */
      .info-table td:not(.label) {
        font-size: 16.5px !important;  /* 18px에서 1px 축소 */
      }
      
      /* ✅ info-table 전체 너비 제한 (A4 내 보장) */
      .info-table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;  /* 고정 레이아웃으로 A4 내 보장 */
        box-sizing: border-box !important;
      }
      
      /* ✅ info-table 칼럼 너비 고정 (A4 내 보장, 좌우 대칭) */
      .info-table tr td.label {
        width: 13% !important;  /* 좌우 라벨 동일한 너비 (대칭) - 사업자등록번호 표시 공간 확보 */
        min-width: 13% !important;
        max-width: 13% !important;
        white-space: nowrap !important;  /* 라벨 한 줄 유지 */
        padding-left: 2px !important;  /* 좌측 여백 1px 추가 */
        padding-right: 2px !important;  /* 우측 여백 1px 추가 */
      }
      
      .info-table tr td:nth-child(1) {
        width: 13% !important;  /* 좌측 라벨 (사업자등록번호 한 줄 표시) */
        min-width: 13% !important;
        max-width: 13% !important;
        padding-left: 2px !important;
        padding-right: 2px !important;
      }
      
      .info-table tr td:nth-child(2) {
        width: 37% !important;  /* 좌측 정보 (거래일자 + 거래번호 공간 확보 - 소재지 공간 확보를 위해 1% 감소) */
        min-width: 37% !important;
      }
      
      .info-table tr td:nth-child(3) {
        width: 13% !important;  /* 우측 라벨 (좌측과 동일 - 대칭) */
        min-width: 13% !important;
        max-width: 13% !important;
        padding-left: 2px !important;
        padding-right: 2px !important;
      }
      
      .info-table tr td:nth-child(4) {
        width: 37% !important;  /* 우측 정보 (소재지 등) - 소재지 "1" 숫자 표시를 위해 1% 증가 */
        white-space: nowrap !important;  /* 한 줄로 유지 */
        overflow: hidden !important;  /* A4 벗어남 방지 */
        text-overflow: ellipsis !important;  /* 잘림 표시 */
      }
      
      /* ✅ 모든 테이블 너비 확장 (A4 내 보장) */
      .form-table,
      .order-table,
      .bom-table {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;  /* A4 벗어남 방지 */
      }
      
      /* ✅ 원자재명세서(bom-table) 칼럼 너비 조정 - 규격 칼럼 확대, 수량/비고 축소 */
      .bom-table {
        table-layout: fixed !important;  /* 고정 레이아웃으로 칼럼 너비 제어 */
      }
      
      .bom-table th:nth-child(1),
      .bom-table td:nth-child(1) {
        width: 5% !important;  /* NO */
      }
      
      .bom-table th:nth-child(2),
      .bom-table td:nth-child(2) {
        width: 40% !important;  /* 부품명 (가장 긴 내용, 규격보다 길게) */
      }
      
      .bom-table th:nth-child(3),
      .bom-table td:nth-child(3) {
        width: 35% !important;  /* 규격 칼럼 - 넓히기 (kg 글자 잘림 방지) */
        min-width: 35% !important;
        word-break: break-word !important;  /* 잘림 방지 */
        white-space: normal !important;  /* 줄바꿈 허용 */
        overflow: hidden !important;  /* A4 벗어남 방지 */
      }
      
      .bom-table th:nth-child(4),
      .bom-table td:nth-child(4) {
        width: 10% !important;  /* 수량 */
      }
      
      .bom-table th:nth-child(7),
      .bom-table td:nth-child(7) {
        width: 10% !important;  /* 비고 */
      }
      
      .bom-table th:nth-child(4),
      .bom-table td:nth-child(4) {
        width: 10% !important;  /* 수량 칼럼 - 경미하게 축소 */
      }
      
      .bom-table th:nth-child(7),
      .bom-table td:nth-child(7) {
        width: 10% !important;  /* 비고 칼럼 - 경미하게 축소 */
      }
      

      /* -------------------------------------------------
         9. 메모 영역
         ------------------------------------------------- */
      .estimate-memo {
        min-height: 50px !important;
        padding: 10px 6px !important;
        font-size: 18px !important;
        line-height: 1.5 !important;
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        overflow: visible !important;  /* 내용이 잘리지 않도록 */
        height: auto !important;  /* 내용에 맞게 자동 높이 조정 */
      }

      /* -------------------------------------------------
         10. input / textarea 공통
         ------------------------------------------------- */
      input {
        height: 40px !important;        /* ✅ */
        padding: 8px 6px !important;
        line-height: 1.6 !important;
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        outline: none !important;
        font-size: 18px !important;  /* ✅ 추가 */
      }
      
      textarea {
        min-height: 70px !important;    /* ✅ */
        padding: 8px 6px !important;
        line-height: 1.6 !important;
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        outline: none !important;
        font-size: 18px !important;  /* ✅ 추가 */
        overflow: visible !important;  /* 내용이 잘리지 않도록 */
      }

      /* ✅ footer(회사명) 페이지 넘김 방지 */
      /* ✅ footer 강력 방지 */
      .form-company {
        page-break-inside: avoid !important;
        page-break-before: avoid !important;
        margin-top: 5px !important;
        padding-top: 0 !important;
      }

      /* -------------------------------------------------
         11. 도장 - 모든 요소 위에 표시, 위에서 잘림 방지
         html2canvas 캡처 시 테이블 경계를 뚫고 나오도록 강제
         ------------------------------------------------- */
      /* ✅ 도장 이미지의 모든 부모 요소 overflow visible 강제 */
      .info-table-stamp-wrapper,
      .info-table-stamp-wrapper *,
      .info-table-stamp-wrapper table,
      .info-table-stamp-wrapper tbody,
      .info-table-stamp-wrapper tr,
      .info-table-stamp-wrapper td {
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
      }
      
      /* ✅ 모든 테이블 요소에 overflow visible 강제 적용 */
      .form-table,
      .form-table *,
      .form-table table,
      .form-table tbody,
      .form-table thead,
      .form-table tr,
      .form-table td,
      .form-table th {
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
      }
      
      .info-table,
      .info-table *,
      .info-table table,
      .info-table tbody,
      .info-table thead,
      .info-table tr,
      .info-table td,
      .info-table th {
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
      }
      
      .rep-cell {
        position: relative !important;
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        z-index: 999 !important;
        padding-top: 50px !important;  /* 도장 이미지가 위로 올라갈 충분한 공간 */
        padding-bottom: 10px !important;
        padding-right: 50px !important;  /* 우측으로도 확장 가능하도록 */
      }
      
      .ceo-inline {
        position: relative !important;
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        z-index: 998 !important;
      }

      /* ✅ 도장 이미지 - absolute로 설정하여 rep-cell 기준으로 배치 */
      .stamp-inline,
      img[alt="도장"],
      .rep-cell .stamp-inline,
      .rep-cell img[alt="도장"],
      .ceo-inline .stamp-inline,
      .ceo-inline img[alt="도장"] {
        position: absolute !important;  /* fixed 제거, absolute만 사용 */
        top: -40px !important;  /* 위로 더 올라가도록 */
        right: -40px !important;  /* 우측으로 더 나가도록 */
        width: 80px !important;
        height: 80px !important;
        max-width: 80px !important;
        max-height: 80px !important;
        z-index: 999999 !important;  /* 최상단으로 설정 */
        opacity: 0.85 !important;
        pointer-events: none !important;
        transform: none !important;
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  `;

  try {
    // ✅ 2단계: no-print 요소 숨김
    hiddenElements.forEach((el, index) => {
      originalDisplayValues[index] = el.style.display;
      el.style.display = 'none';
    });

    // ✅ 2-1단계: 버튼류 강제 숨김
    forcedHiddenElements.forEach((el, index) => {
      forcedOriginalDisplayValues[index] = el.style.display;
      el.style.display = 'none';
    });

    // ✅ 2-2단계: 메모 textarea를 div로 임시 변환 (html2canvas가 제대로 캡처하도록)
    const memoTextareas = element.querySelectorAll('textarea.estimate-memo');
    memoTextareas.forEach((textarea) => {
      // textarea의 모든 스타일과 속성 복사
      const computedStyle = window.getComputedStyle(textarea);
      const textareaValue = textarea.value || '';
      
      // div 생성
      const div = document.createElement('div');
      div.className = textarea.className;
      div.textContent = textareaValue; // 줄바꿈이 포함된 텍스트
      
      // 모든 스타일 복사
      div.style.cssText = textarea.style.cssText;
      div.style.width = computedStyle.width;
      div.style.height = 'auto'; // 내용에 맞게 자동 높이
      div.style.minHeight = computedStyle.minHeight;
      div.style.padding = computedStyle.padding;
      div.style.fontSize = computedStyle.fontSize;
      div.style.fontFamily = computedStyle.fontFamily;
      div.style.fontWeight = computedStyle.fontWeight;
      div.style.lineHeight = computedStyle.lineHeight;
      div.style.whiteSpace = 'pre-wrap'; // 줄바꿈 유지
      div.style.wordWrap = 'break-word';
      div.style.overflowWrap = 'break-word';
      div.style.overflow = 'visible';
      div.style.border = computedStyle.border;
      div.style.backgroundColor = computedStyle.backgroundColor;
      div.style.color = computedStyle.color;
      div.style.boxSizing = 'border-box';
      div.style.display = 'block';
      
      // textarea를 숨기고 div로 교체
      textarea.style.display = 'none';
      textarea.parentNode.insertBefore(div, textarea);
      
      // 나중에 복원하기 위해 저장
      textareaReplacements.push({ textarea, div });
    });

    // ✅ 3단계: 스타일 적용
    document.head.appendChild(printStyleElement);

    // ✅ 4단계: 스타일 적용 대기 및 div 높이 계산 대기
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // ✅ 4-1단계: div 높이 재계산 (렌더링 후)
    textareaReplacements.forEach(({ div }) => {
      // 강제로 리플로우 발생시켜 높이 계산
      div.style.height = 'auto';
      const scrollHeight = div.scrollHeight;
      div.style.height = `${scrollHeight}px`;
    });
    
    // div 높이 계산 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    // ✅ 4-2단계: 도장 이미지를 테이블 밖으로 이동 (html2canvas 캡처 전)
    const stampImages = element.querySelectorAll('.stamp-inline, img[alt="도장"]');
    const stampBackups = [];
    stampImages.forEach((stamp) => {
      const computedStyle = window.getComputedStyle(stamp);
      const rect = stamp.getBoundingClientRect();
      const parentRect = element.getBoundingClientRect();
      
      // 원본 위치 저장
      stampBackups.push({
        element: stamp,
        originalParent: stamp.parentElement,
        originalPosition: stamp.style.position,
        originalTop: stamp.style.top,
        originalRight: stamp.style.right,
        originalZIndex: stamp.style.zIndex
      });
      
      // 도장을 body에 직접 추가하여 테이블 경계를 완전히 벗어나게 함
      stamp.style.position = 'fixed';
      stamp.style.top = `${rect.top - parentRect.top - 60}px`;  // 위로 더 올라가도록
      stamp.style.right = `${parentRect.right - rect.right - 20}px`;
      stamp.style.zIndex = '9999999';
      stamp.style.overflow = 'visible';
      stamp.style.clip = 'auto';
      stamp.style.clipPath = 'none';
      
      // 부모의 overflow도 visible로 강제
      let parent = stamp.parentElement;
      while (parent && parent !== element) {
        parent.style.overflow = 'visible';
        parent.style.clip = 'auto';
        parent.style.clipPath = 'none';
        parent = parent.parentElement;
      }
    });

    // ✅ 5단계: html2canvas
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        // 클론된 문서에서도 도장 이미지 위치 재조정
        const clonedStamps = clonedDoc.querySelectorAll('.stamp-inline, img[alt="도장"]');
        clonedStamps.forEach((stamp) => {
          stamp.style.position = 'fixed';
          stamp.style.overflow = 'visible';
          stamp.style.clip = 'auto';
          stamp.style.clipPath = 'none';
          stamp.style.zIndex = '9999999';
          
          // 모든 부모 요소의 overflow를 visible로 설정
          let parent = stamp.parentElement;
          while (parent) {
            parent.style.overflow = 'visible';
            parent.style.clip = 'auto';
            parent.style.clipPath = 'none';
            parent = parent.parentElement;
          }
        });
      },
      ignoreElements: (el) =>
        el.classList.contains('no-print') ||
        el.classList.contains('add-item-btn') ||
        el.classList.contains('add-material-btn') ||
        el.classList.contains('item-controls') ||
        el.classList.contains('remove-btn')
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // ✅ 5-1단계: 도장 이미지 원래 위치로 복원
    stampBackups.forEach((backup) => {
      backup.element.style.position = backup.originalPosition;
      backup.element.style.top = backup.originalTop;
      backup.element.style.right = backup.originalRight;
      backup.element.style.zIndex = backup.originalZIndex;
    });

    // ✅ 6단계: PDF 생성
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('datauristring').split(',')[1];

  } catch (error) {
    console.error('❌ PDF 변환 오류:', error);
    throw new Error('PDF 변환에 실패했습니다.');
  } finally {
    // ✅ 7단계: 도장 이미지 원래 위치로 복원 (에러 발생 시에도 복원)
    if (typeof stampBackups !== 'undefined' && stampBackups.length > 0) {
      stampBackups.forEach((backup) => {
        if (backup.element && backup.element.parentElement) {
          backup.element.style.position = backup.originalPosition || '';
          backup.element.style.top = backup.originalTop || '';
          backup.element.style.right = backup.originalRight || '';
          backup.element.style.zIndex = backup.originalZIndex || '';
        }
      });
    }

    // ✅ 8단계: 스타일 제거
    if (printStyleElement.parentNode) {
      printStyleElement.parentNode.removeChild(printStyleElement);
    }

    // ✅ 9단계: 숨김 복원
    hiddenElements.forEach((el, index) => {
      el.style.display = originalDisplayValues[index];
    });
    forcedHiddenElements.forEach((el, index) => {
      el.style.display = forcedOriginalDisplayValues[index];
    });

    // ✅ 9단계: 메모 textarea div 변환 복원
    textareaReplacements.forEach(({ textarea, div }) => {
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
      textarea.style.display = '';
    });
  }
};

/**
 * PDF Base64를 Blob URL로 변환 (미리보기용)
 */
export const base64ToBlobURL = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
};

/**
 * Vercel 팩스 서버로 팩스 전송
 */
export const sendFax = async (pdfBase64, faxNumber, companyName, receiverName) => {
  const response = await fetch(
    'https://fax-server-git-main-knowgrams-projects.vercel.app/api/send-fax',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, faxNumber, companyName, receiverName })
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message);
  return result;
};
