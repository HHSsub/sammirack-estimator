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
          width: 100% !important;
          padding: 6mm 8mm 4mm !important;        /* ✅ 8mm 8mm 6mm → 6mm 8mm 4mm */
          margin: 0 !important;
          background: #fff !important;
          min-height: auto !important;
          box-sizing: border-box;
          font-size: 12px !important;
          line-height: 1.35 !important;
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
        vertical-align: middle !important;
        overflow: visible !important;
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
      /* ✅ 라벨(거래일자, 거래번호 등) 글자 크기 */
      .form-table .label {
        font-size: 18px !important;  /* ✅ 추가 */
        font-weight: 700 !important;
      }

      /* -------------------------------------------------
         9. 메모 영역
         ------------------------------------------------- */
      .estimate-memo {
        min-height: 70px !important;
        padding: 10px 6px !important;
        font-size: 18px !important;
        line-height: 1.6 !important;
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
      }

      /* ✅ footer(회사명) 페이지 넘김 방지 */
      .form-company {
        page-break-inside: avoid !important;
        page-break-before: avoid !important;
      }

      /* -------------------------------------------------
         11. 도장
         ------------------------------------------------- */
      .rep-cell {
        position: relative !important;
        overflow: visible !important;
      }

      .stamp-inline {
        position: absolute !important;
        top: -15px !important;
        right: -30px !important;
        width: 80px !important;
        height: 80px !important;
        z-index: 999 !important;
        opacity: 0.85 !important;
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

    // ✅ 3단계: 스타일 적용
    document.head.appendChild(printStyleElement);

    // ✅ 4단계: 스타일 적용 대기
    await new Promise(resolve => setTimeout(resolve, 300));

    // ✅ 5단계: html2canvas
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      windowHeight: element.scrollHeight,
      ignoreElements: (el) =>
        el.classList.contains('no-print') ||
        el.classList.contains('add-item-btn') ||
        el.classList.contains('add-material-btn') ||
        el.classList.contains('item-controls') ||
        el.classList.contains('remove-btn')
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

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
    // ✅ 7단계: 스타일 제거
    if (printStyleElement.parentNode) {
      printStyleElement.parentNode.removeChild(printStyleElement);
    }

    // ✅ 8단계: 숨김 복원
    hiddenElements.forEach((el, index) => {
      el.style.display = originalDisplayValues[index];
    });
    forcedHiddenElements.forEach((el, index) => {
      el.style.display = forcedOriginalDisplayValues[index];
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
