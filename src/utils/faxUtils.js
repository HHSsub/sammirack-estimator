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
  const originalDisplayValues = [];

  try {
    // ✅ 2단계: 모든 no-print 요소를 임시로 숨김
    hiddenElements.forEach((el, index) => {
      originalDisplayValues[index] = el.style.display;
      el.style.display = 'none';
    });

    // ✅ 3단계: html2canvas로 DOM을 이미지로 변환
    const canvas = await html2canvas(element, {
      scale: 2, // 해상도 향상
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      ignoreElements: (element) => {
        // 추가 안전장치: no-print 클래스가 있으면 무시
        return element.classList.contains('no-print');
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // ✅ 4단계: A4 크기로 PDF 생성
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // 첫 페이지 추가
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // 여러 페이지 필요한 경우 추가
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Base64 문자열 반환
    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    return pdfBase64;

  } catch (error) {
    console.error('❌ PDF 변환 오류:', error);
    throw new Error('PDF 변환에 실패했습니다.');
  } finally {
    // ✅ 5단계: 숨긴 요소들 복원 (반드시 실행)
    hiddenElements.forEach((el, index) => {
      el.style.display = originalDisplayValues[index];
    });
  }
};

/**
 * PDF Base64를 Blob URL로 변환 (미리보기용)
 * @param {string} base64 - PDF Base64 문자열
 * @returns {string} Blob URL
 */
export const base64ToBlobURL = (base64) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

/**
 * Vercel 팩스 서버로 팩스 전송
 * @param {string} pdfBase64 - PDF Base64 문자열
 * @param {string} faxNumber - 팩스 번호
 * @param {string} companyName - 상호명 (선택)
 * @param {string} receiverName - 수신자명 (선택)
 * @returns {Promise<Object>} 전송 결과
 */
export const sendFax = async (pdfBase64, faxNumber, companyName = '', receiverName = '') => {
  const VERCEL_FAX_API = 'https://fax-server-git-main-knowgrams-projects.vercel.app/api/send-fax';

  try {
    const response = await fetch(VERCEL_FAX_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pdfBase64,
        faxNumber,
        companyName,
        receiverName
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status} 오류`);
    }

    return result;
  } catch (error) {
    console.error('❌ 팩스 전송 오류:', error);
    throw error;
  }
};
