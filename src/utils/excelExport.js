// 고급 ExcelJS 내보내기 유틸리티 - 웹 프린트 레이아웃 완벽 복제
import ExcelJS from 'exceljs';
import { ExcelImageHandler } from './excelImageHandler';
import { LayoutMapper } from './layoutMapper';
import { EXCEL_STYLES } from './excelStyles';

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

    // 2. 견적서 레이아웃 구현 (새로운 정확한 레이아웃)
    layoutMapper.setupEstimateLayout(data);

    // 3. 회사 로고 추가 (견적서 위치: H6:I7)
    if (data.companyLogo) {
      await imageHandler.addCompanyLogo(data.companyLogo, worksheet, 'H6:I7');
    }

    // 4. 도장 이미지 추가 (견적서 위치: G32:H34)
    if (data.companyStamp) {
      await imageHandler.addCompanyStamp(worksheet, data.companyStamp);
    }

    // 5. 모든 셀에 테두리 적용 (A5:G35)
    for (let row = 5; row <= 35; row++) {
      for (let col = 1; col <= 7; col++) { // A부터 G까지
        const cell = worksheet.getCell(row, col);
        Object.assign(cell, EXCEL_STYLES.allBorders);
      }
    }

    // 6. 파일 다운로드
    downloadExcelFile(workbook, generateFileName('견적서'));

  } catch (error) {
    console.error("Error generating estimate Excel:", error);
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

  // 이미지 핸들러 초기화
  const imageHandler = new ExcelImageHandler(workbook);

  // 레이아웃 매퍼 초기화
  const layoutMapper = new LayoutMapper(worksheet, 'purchaseOrder');

  try {
    // 1. 컬럼 너비 설정
    layoutMapper.setupColumnWidths();

    // 2. 발주서 레이아웃 구현 (새로운 정확한 레이아웃)
    layoutMapper.setupPurchaseOrderLayout(data);

    // 3. 회사 로고 추가 (발주서 위치: H6:I7)
    if (data.companyLogo) {
      await imageHandler.addCompanyLogo(data.companyLogo, worksheet, 'H6:I7');
    }

    // 4. 도장 이미지 추가 (발주서 위치: G32:H34)
    if (data.companyStamp) {
      await imageHandler.addCompanyStamp(worksheet, data.companyStamp);
    }

    // 5. 모든 셀에 테두리 적용 (A5:H62)
    for (let row = 5; row <= 62; row++) {
      for (let col = 1; col <= 8; col++) { // A부터 H까지
        const cell = worksheet.getCell(row, col);
        Object.assign(cell, EXCEL_STYLES.allBorders);
      }
    }

    // 6. 파일 다운로드
    downloadExcelFile(workbook, generateFileName('발주서'));

  } catch (error) {
    console.error("Error generating purchase order Excel:", error);
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

  // 이미지 핸들러 초기화
  const imageHandler = new ExcelImageHandler(workbook);

  // 레이아웃 매퍼 초기화
  const layoutMapper = new LayoutMapper(worksheet, 'transactionStatement');

  try {
    // 1. 컬럼 너비 설정
    layoutMapper.setupColumnWidths();

    // 2. 거래명세서 레이아웃 구현
    layoutMapper.setupTransactionStatementLayout(data);

    // 3. 회사 로고 추가
    if (data.companyLogo) {
      await imageHandler.addCompanyLogo(data.companyLogo, worksheet, 'H6:I7');
    }

    // 4. 도장 이미지 추가
    if (data.companyStamp) {
      await imageHandler.addCompanyStamp(worksheet, data.companyStamp);
    }

    // 5. 파일 다운로드
    downloadExcelFile(workbook, generateFileName('거래명세서'));

  } catch (error) {
    console.error("Error generating transaction statement Excel:", error);
  }
}

/**
 * Excel 파일 다운로드
 * @param {Object} workbook - ExcelJS 워크북 객체
 * @param {string} fileName - 파일 이름
 */
function downloadExcelFile(workbook, fileName) {
  workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }).catch(error => {
    console.error("Error downloading Excel file:", error);
  });
}

/**
 * 현재 날짜를 YYYYMMDD 형식으로 반환
 * @returns {string}
 */
function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 파일 이름 생성
 * @param {string} documentType - 문서 타입 (예: '견적서', '발주서')
 * @returns {string}
 */
export function generateFileName(documentType) {
  return `${documentType}_${getCurrentDate()}.xlsx`;
}

export const exportToExcel = async (data, fileName, type) => {
  switch (type) {
    case 'estimate':
      await generateEstimateExcel(data);
      break;
    case 'purchase':
      await generatePurchaseOrderExcel(data);
      break;
    case 'transaction':
      await generateTransactionStatementExcel(data);
      break;
    default:
      console.error('Unknown document type for Excel export');
  }
};
