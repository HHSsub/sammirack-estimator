// src/utils/faxUtils.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const convertDOMToPDFBase64 = async (element) => {
  if (!element) {
    throw new Error('DOM 요소를 찾을 수 없습니다.');
  }

  const printStyleElement = document.createElement('style');
  printStyleElement.textContent = `
    @media screen {
      .no-print,
      .item-controls,
      .item-controls *,
      button.add-item-btn,
      button.add-material-btn,
      .add-item-btn,
      .add-material-btn {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -9999px !important;
      }
      
      .purchase-order-form-container,
      .estimate-form-container,
      .delivery-note-form-container {
        transform: scale(0.88) !important;
        transform-origin: top center !important;
        max-width: 100% !important;
        width: 100% !important;
        padding: 6mm 8mm 6mm !important;
        margin: 0 auto !important;
        background: #fff !important;
        min-height: auto !important;
        box-sizing: border-box;
        font-size: 11px !important;
        line-height: 1.4 !important;
      }
      
      .form-header h1 { 
        font-size: 22px !important;
        font-weight: 900 !important;
        margin-bottom: 8px !important; 
      }
      
      .form-table {
        font-size: 11px !important;
        margin-bottom: 10px !important;
      }
      
      .form-table th,
      .form-table td {
        padding: 12px 8px !important;
        line-height: 2.0 !important;
        vertical-align: middle !important;
        height: auto !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        font-weight: 700 !important;
        font-size: 12px !important;
      }

      .info-table td {
        padding: 10px 8px !important;
        line-height: 1.8 !important;
        white-space: pre-line !important;
      }

      .info-table input,
      .info-table textarea {
        font-size: 12px !important;
        padding: 8px 6px !important;
        font-weight: 600 !important;
        line-height: 1.8 !important;
        min-height: 32px !important;
        white-space: pre-line !important;
        word-break: keep-all !important;
      }
      
      .info-table input[type="text"] {
        min-height: 32px !important;
        font-weight: 700 !important;
      }
      
      .estimate-memo {
        min-height: 75px !important;
        padding: 10px 6px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
      }

      input, textarea {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        outline: none !important;
        font-size: 12px !important;
        padding: 8px 6px !important;
        line-height: 1.8 !important;
        height: auto !important;
        min-height: 30px !important;
        font-weight: 600 !important;
        white-space: pre-line !important;
        word-break: keep-all !important;
      }
      
      .total-table {
        width: 240px !important;
        margin-bottom: 8px !important;
      }
      
      .form-company {
        margin-top: 12px !important;
        padding-top: 6px !important;
        font-size: 14px !important;
        font-weight: 700 !important;
      }
      
      .order-table th:last-child,
      .order-table td:last-child,
      .bom-table th:last-child,
      .bom-table td:last-child { 
        display: none !important; 
      }
      
      .order-table { 
        table-layout: fixed !important; 
        width: 100% !important; 
      }
      .order-table th:nth-child(1), .order-table td:nth-child(1) { width: 4% !important; }
      .order-table th:nth-child(2), .order-table td:nth-child(2) { width: 38% !important; }
      .order-table th:nth-child(3), .order-table td:nth-child(3) { width: 10% !important; }
      .order-table th:nth-child(4), .order-table td:nth-child(4) { width: 8% !important; }
      .order-table th:nth-child(5), .order-table td:nth-child(5) { width: 13% !important; }
      .order-table th:nth-child(6), .order-table td:nth-child(6) { width: 13% !important; }
      .order-table th:nth-child(7), .order-table td:nth-child(7) { width: 11% !important; }
      .order-table th:nth-child(8), .order-table td:nth-child(8) { width: 3% !important; }
      
      .bom-table { 
        table-layout: fixed !important; 
        width: 100% !important; 
      }
      .bom-table th:nth-child(1), .bom-table td:nth-child(1) { width: 5% !important; }
      .bom-table th:nth-child(2), .bom-table td:nth-child(2) { width: 36% !important; }
      .bom-table th:nth-child(3), .bom-table td:nth-child(3) { width: 36% !important; }
      .bom-table th:nth-child(4), .bom-table td:nth-child(4) { width: 12% !important; }
      .bom-table th:nth-child(5), .bom-table td:nth-child(5) { width: 0% !important; display: none !important; }
      .bom-table th:nth-child(6), .bom-table td:nth-child(6) { width: 0% !important; display: none !important; }
      .bom-table th:nth-child(7), .bom-table td:nth-child(7) { width: 11% !important; }
      .bom-table th:nth-child(8), .bom-table td:nth-child(8) { width: 0% !important; }
      
      .order-table th, .order-table td,
      .bom-table th, .bom-table td {
        word-break: break-word !important;
        font-weight: 700 !important;
        padding: 10px 6px !important;
        line-height: 1.8 !important;
      }
      
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
        opacity: 0.8 !important;
      }
    }
  `;

  const hiddenElements = element.querySelectorAll('.no-print, .item-controls, button.add-item-btn, button.add-material-btn');
  const removedElements = [];

  try {
    hiddenElements.forEach((el) => {
      if (el && el.parentNode) {
        removedElements.push({
          element: el,
          parent: el.parentNode,
          nextSibling: el.nextSibling
        });
        el.parentNode.removeChild(el);
      }
    });

    document.head.appendChild(printStyleElement);
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight + 20) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 20) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    return pdfBase64;

  } catch (error) {
    console.error('❌ PDF 변환 오류:', error);
    throw new Error('PDF 변환에 실패했습니다.');
  } finally {
    if (printStyleElement.parentNode) {
      printStyleElement.parentNode.removeChild(printStyleElement);
    }

    removedElements.forEach(({ element, parent, nextSibling }) => {
      if (parent) {
        if (nextSibling) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      }
    });
  }
};

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

export const sendFax = async (pdfBase64, faxNumber, companyName, receiverName) => {
  try {
    const response = await fetch('https://fax-server-git-main-knowgrams-projects.vercel.app/api/send-fax', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdfBase64: pdfBase64,
        faxNumber: faxNumber,
        companyName: companyName,
        receiverName: receiverName
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || '팩스 전송 실패');
    }

    return result;
  } catch (error) {
    console.error('❌ 팩스 전송 오류:', error);
    throw error;
  }
};
