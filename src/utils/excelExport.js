// 고급 ExcelJS 내보내기 유틸리티 - 웹 프린트 레이아웃 완벽 복제

import ExcelJS from 'exceljs';
import { ExcelImageHandler } from './excelImageHandler.js';
import { LayoutMapper } from './layoutMapper.js';
import { EXCEL_STYLES } from './excelStyles.js';

/**
 * 견적서 Excel 생성
 * @param {Object} data - 견적서 데이터
 * @param {Object} options - 추가 옵션
 */
export async function generateEstimateExcel(data, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('견적서');
  
  // 이미지 핸들러 초기화
  const imageHandler = new ExcelImageHandler(workbook);
  
  // 레이아웃 매퍼 초기화
  const layoutMapper = new LayoutMapper(worksheet, 'estimate');
  
  try {
    // 1. 컬럼 너비 설정
    layoutMapper.setupColumnWidths();
    
    // 2. 회사 로고 추가
    if (data.companyLogo) {
      await imageHandler.addCompanyLogo(data.companyLogo, worksheet);
    }
    
    // 3. 문서 제목 추가
    layoutMapper.addDocumentTitle('견 적 서', true);
    
    // 4. 회사 정보 추가
    layoutMapper.addCompanyInfo(data.company || {
      name: data.companyName || '',
      address: data.companyAddress || '',
      phone: data.companyPhone || ''
    });
    
    // 5. 고객 정보 추가
    if (data.client || data.customerName) {
      layoutMapper.addClientInfo({
        name: data.customerName || data.client?.name || '',
        address: data.customerAddress || data.client?.address || ''
      });
    }
    
    // 6. 문서 번호 및 날짜 정보
    layoutMapper.addEmptyRow();
    const docInfoRow = layoutMapper.getCurrentRow();
    
    worksheet.getCell(`A${docInfoRow}`).value = '문서번호:';
    worksheet.getCell(`B${docInfoRow}`).value = data.documentNumber || '';
    
    worksheet.getCell(`E${docInfoRow}`).value = '작성일:';
    worksheet.getCell(`F${docInfoRow}`).value = data.date || new Date().toISOString().split('T')[0];
    Object.assign(worksheet.getCell(`F${docInfoRow}`), EXCEL_STYLES.date);
    
    layoutMapper.currentRow = docInfoRow + 1;
    
    // 7. 테이블 헤더 추가
    const headers = ['품목명', '단위', '수량', '단가', '금액', '비고'];
    layoutMapper.addTableHeader(headers);
    
    // 8. 테이블 데이터 추가
    let totalAmount = 0;
    
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0);
        totalAmount += amount;
        
        layoutMapper.addTableRow([
          item.name || '',
          item.unit || '',
          item.quantity || 0,
          item.unitPrice || 0,
          amount,
          item.note || item.remarks || ''
        ]);
      });
    }
    
    // 9. 합계 행 추가
    layoutMapper.addTotalRow({ total: data.totalAmount || totalAmount }, 4);
    
    // 10. 세금 정보 추가 (있는 경우)
    if (data.tax || data.subtotal) {
      layoutMapper.addEmptyRow();
      
      if (data.subtotal) {
        const subtotalRow = layoutMapper.getCurrentRow();
        worksheet.mergeCells(`A${subtotalRow}:D${subtotalRow}`);
        worksheet.getCell(`A${subtotalRow}`).value = '소계';
        worksheet.getCell(`E${subtotalRow}`).value = data.subtotal;
        Object.assign(worksheet.getCell(`A${subtotalRow}`), EXCEL_STYLES.tableData);
        Object.assign(worksheet.getCell(`E${subtotalRow}`), EXCEL_STYLES.currency);
        layoutMapper.currentRow++;
      }
      
      if (data.tax) {
        const taxRow = layoutMapper.getCurrentRow();
        worksheet.mergeCells(`A${taxRow}:D${taxRow}`);
        worksheet.getCell(`A${taxRow}`).value = '세액';
        worksheet.getCell(`E${taxRow}`).value = data.tax;
        Object.assign(worksheet.getCell(`A${taxRow}`), EXCEL_STYLES.tableData);
        Object.assign(worksheet.getCell(`E${taxRow}`), EXCEL_STYLES.currency);
        layoutMapper.currentRow++;
      }
    }
    
    // 11. 비고란 추가
    if (data.remarks || data.note) {
      layoutMapper.addRemarksSection(data.remarks || data.note);
    }
    
    // 12. 도장 이미지 추가
    if (data.companyStamp) {
      const totalRows = layoutMapper.getCurrentRow();
      await imageHandler.addCompanyStamp(data.companyStamp, worksheet, totalRows);
    }
    
    // 13. 파일 다운로드
    const fileName = options.fileName || `견적서_${data.documentNumber || new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    downloadExcelFile(buffer, fileName);
    
    return { success: true, message: '견적서 Excel 파일이 생성되었습니다.' };
    
  } catch (error) {
    console.error('견적서 Excel 생성 실패:', error);
    return { success: false, message: '견적서 Excel 생성에 실패했습니다.', error };
  }
}

/**
 * 발주서 Excel 생성
 * @param {Object} data - 발주서 데이터
 * @param {Object} options - 추가 옵션
 */
export async function generatePurchaseOrderExcel(data, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('발주서');
  
  const imageHandler = new ExcelImageHandler(workbook);
  const layoutMapper = new LayoutMapper(worksheet, 'purchaseOrder');
  
  try {
    // 1. 컬럼 너비 설정
    layoutMapper.setupColumnWidths();
    
    // 2. 회사 로고 추가
    if (data.companyLogo) {
      await imageHandler.addCompanyLogo(data.companyLogo, worksheet);
    }
    
    // 3. 문서 제목 추가
    layoutMapper.addDocumentTitle('발 주 서', true);
    
    // 4. 발주 정보 추가
    layoutMapper.addCompanyInfo(data.company || {
      name: data.companyName || '',
      address: data.companyAddress || '',
      phone: data.companyPhone || ''
    });
    
    // 5. 공급업체 정보 추가
    if (data.supplier || data.supplierName) {
      layoutMapper.addClientInfo({
        name: data.supplierName || data.supplier?.name || '',
        address: data.supplierAddress || data.supplier?.address || ''
      });
    }
    
    // 6. 발주 상세 정보
    layoutMapper.addEmptyRow();
    const orderInfoRow = layoutMapper.getCurrentRow();
    
    // 발주번호
    worksheet.getCell(`A${orderInfoRow}`).value = '발주번호:';
    worksheet.getCell(`B${orderInfoRow}`).value = data.orderNumber || data.documentNumber || '';
    
    // 납기일
    worksheet.getCell(`E${orderInfoRow}`).value = '납기일:';
    worksheet.getCell(`F${orderInfoRow}`).value = data.deliveryDate || '';
    Object.assign(worksheet.getCell(`F${orderInfoRow}`), EXCEL_STYLES.date);
    
    layoutMapper.currentRow = orderInfoRow + 1;
    
    // 7. 테이블 헤더 추가 (자재 정보가 있으면 다른 헤더 사용)
    let headers;
    if (data.materials && data.materials.length > 0) {
      headers = ['품명', '규격', '수량', '단가', '금액', '비고'];
    } else {
      headers = ['품목명', '단위', '수량', '단가', '금액', '납기', '비고'];
    }
    layoutMapper.addTableHeader(headers);
    
    // 8. 테이블 데이터 추가
    let totalAmount = 0;
    
    // 일반 품목 처리
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0);
        totalAmount += amount;
        
        if (data.materials && data.materials.length > 0) {
          layoutMapper.addTableRow([
            item.name || '',
            item.specification || item.unit || '',
            item.quantity || 0,
            item.unitPrice || 0,
            amount,
            item.note || item.remarks || ''
          ]);
        } else {
          layoutMapper.addTableRow([
            item.name || '',
            item.unit || '',
            item.quantity || 0,
            item.unitPrice || 0,
            amount,
            item.deliveryDate || '',
            item.note || item.remarks || ''
          ]);
        }
      });
    }
    
    // 자재 정보 처리
    if (data.materials && data.materials.length > 0) {
      data.materials.forEach(material => {
        const amount = (material.quantity || 0) * (material.unitPrice || 0);
        totalAmount += amount;
        
        layoutMapper.addTableRow([
          material.name || '',
          material.specification || '',
          material.quantity || 0,
          material.unitPrice || 0,
          amount,
          material.note || material.remarks || ''
        ]);
      });
    }
    
    // 9. 합계 행 추가
    const mergeColumns = (data.materials && data.materials.length > 0) ? 4 : 5;
    layoutMapper.addTotalRow({ total: data.totalAmount || totalAmount }, mergeColumns);
    
    // 10. 특별 조건 추가
    if (data.conditions || data.remarks) {
      layoutMapper.addRemarksSection(data.conditions || data.remarks);
    }
    
    // 11. 도장 이미지 추가
    if (data.companyStamp) {
      const totalRows = layoutMapper.getCurrentRow();
      await imageHandler.addCompanyStamp(data.companyStamp, worksheet, totalRows);
    }
    
    // 12. 파일 다운로드
    const fileName = options.fileName || `발주서_${data.orderNumber || data.documentNumber || new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    downloadExcelFile(buffer, fileName);
    
    return { success: true, message: '발주서 Excel 파일이 생성되었습니다.' };
    
  } catch (error) {
    console.error('발주서 Excel 생성 실패:', error);
    return { success: false, message: '발주서 Excel 생성에 실패했습니다.', error };
  }
}

/**
 * 거래명세서 Excel 생성
 * @param {Object} data - 거래명세서 데이터
 * @param {Object} options - 추가 옵션
 */
export async function generateTransactionStatementExcel(data, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('거래명세서');
  
  const imageHandler = new ExcelImageHandler(workbook);
  const layoutMapper = new LayoutMapper(worksheet, 'transactionStatement');
  
  try {
    // 1. 컬럼 너비 설정
    layoutMapper.setupColumnWidths();
    
    // 2. 회사 로고 추가
    if (data.companyLogo) {
      await imageHandler.addCompanyLogo(data.companyLogo, worksheet);
    }
    
    // 3. 문서 제목 추가
    layoutMapper.addDocumentTitle('거 래 명 세 서', true);
    
    // 4. 회사 정보 추가
    layoutMapper.addCompanyInfo(data.company || {
      name: data.companyName || '',
      address: data.companyAddress || '',
      phone: data.companyPhone || ''
    });
    
    // 5. 거래처 정보 추가
    if (data.client || data.customerName) {
      layoutMapper.addClientInfo({
        name: data.customerName || data.client?.name || '',
        address: data.customerAddress || data.client?.address || ''
      });
    }
    
    // 6. 거래 기간 정보
    layoutMapper.addEmptyRow();
    const periodRow = layoutMapper.getCurrentRow();
    
    worksheet.getCell(`A${periodRow}`).value = '거래기간:';
    worksheet.getCell(`B${periodRow}`).value = `${data.startDate || ''} ~ ${data.endDate || ''}`;
    Object.assign(worksheet.getCell(`B${periodRow}`), EXCEL_STYLES.date);
    
    layoutMapper.currentRow = periodRow + 1;
    
    // 7. 테이블 헤더 추가
    const headers = ['거래일자', '품목명', '단위', '수량', '단가', '금액', '비고'];
    layoutMapper.addTableHeader(headers);
    
    // 8. 테이블 데이터 추가
    let totalAmount = 0;
    
    if (data.transactions && data.transactions.length > 0) {
      data.transactions.forEach(transaction => {
        const amount = (transaction.quantity || 0) * (transaction.unitPrice || 0);
        totalAmount += amount;
        
        layoutMapper.addTableRow([
          transaction.date || '',
          transaction.name || '',
          transaction.unit || '',
          transaction.quantity || 0,
          transaction.unitPrice || 0,
          amount,
          transaction.remarks || transaction.note || ''
        ]);
      });
    } else if (data.items && data.items.length > 0) {
      // items 데이터가 있는 경우 처리
      data.items.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0);
        totalAmount += amount;
        
        layoutMapper.addTableRow([
          data.date || new Date().toISOString().split('T')[0],
          item.name || '',
          item.unit || '',
          item.quantity || 0,
          item.unitPrice || 0,
          amount,
          item.note || item.remarks || ''
        ]);
      });
    }
    
    // 9. 합계 행 추가
    layoutMapper.addTotalRow({ total: data.totalAmount || totalAmount }, 5);
    
    // 10. 결제 조건 추가
    if (data.paymentTerms || data.remarks) {
      const remarksText = data.paymentTerms ? `결제조건: ${data.paymentTerms}` : data.remarks;
      layoutMapper.addRemarksSection(remarksText);
    }
    
    // 11. 도장 이미지 추가
    if (data.companyStamp) {
      const totalRows = layoutMapper.getCurrentRow();
      await imageHandler.addCompanyStamp(data.companyStamp, worksheet, totalRows);
    }
    
    // 12. 파일 다운로드
    const fileName = options.fileName || `거래명세서_${data.documentNumber || new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    downloadExcelFile(buffer, fileName);
    
    return { success: true, message: '거래명세서 Excel 파일이 생성되었습니다.' };
    
  } catch (error) {
    console.error('거래명세서 Excel 생성 실패:', error);
    return { success: false, message: '거래명세서 Excel 생성에 실패했습니다.', error };
  }
}

/**
 * Excel 파일 다운로드 헬퍼 함수
 * @param {ArrayBuffer} buffer - Excel 파일 버퍼
 * @param {string} filename - 파일명
 */
function downloadExcelFile(buffer, filename) {
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 통합 Excel 내보내기 함수 (기존 코드와 호환성 유지)
 * @param {Object} formData - 폼 데이터
 * @param {string} fileName - 파일명
 * @param {string} formType - 폼 타입 ('estimate', 'purchase', 'delivery')
 */
export const exportToExcel = async (formData, fileName, formType) => {
  try {
    const options = { fileName: `${fileName}.xlsx` };
    
    switch (formType) {
      case 'estimate':
        return await generateEstimateExcel(formData, options);
      case 'purchase':
        return await generatePurchaseOrderExcel(formData, options);
      case 'delivery':
        return await generateTransactionStatementExcel(formData, options);
      default:
        throw new Error(`지원하지 않는 문서 타입: ${formType}`);
    }
  } catch (error) {
    console.error('Excel 내보내기 오류:', error);
    alert('Excel 파일 생성 중 오류가 발생했습니다.');
    return { success: false, error };
  }
};

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 반환
 */
export const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

/**
 * 파일명에 현재 날짜 추가
 */
export const generateFileName = (baseName, formData) => {
  const date = getCurrentDate();
  const docNumber = formData.documentNumber || '';
  return `${baseName}_${docNumber}_${date}`;
};

// 기본 내보내기
export default {
  generateEstimateExcel,
  generatePurchaseOrderExcel,
  generateTransactionStatementExcel,
  exportToExcel,
  getCurrentDate,
  generateFileName
};