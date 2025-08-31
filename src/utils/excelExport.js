// ----------------------------------------------------------------------------
// src/utils/excelExport.js
// ----------------------------------------------------------------------------
import ExcelJS from 'exceljs';
import { ExcelImageHandler } from './excelImageHandler';
import { LayoutMapper } from './layoutMapper';
import { EXCEL_STYLES } from './excelStyles';

/** 컬럼 너비 정의 */
const EST_COL_WIDTHS = { A:5,B:32,C:15,D:10,E:15,F:15,G:15 };
const PO_COL_WIDTHS  = { A:5,B:30,C:15,D:10,E:15,F:15,G:15,H:15 };

/** 파일명 생성 함수 */
export const generateFileName = (prefix = 'document', data = {}) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const orderNumber = data.documentNumber || data.orderNumber || '';
  const suffix = orderNumber ? `_${orderNumber}` : '';
  return `${prefix}${suffix}_${timestamp}.xlsx`;
};

/** 안전한 셀 병합 함수 */
const safeMergeCells = (worksheet, range) => {
  try {
    worksheet.mergeCells(range);
  } catch (error) {
    if (error.message.includes('Cannot merge already merged cells')) {
      console.warn(`Cells ${range} are already merged, skipping...`);
    } else {
      throw error;
    }
  }
};

/** 통합 엑셀 내보내기 함수 */
export const exportToExcel = async (data, fileName, type = 'estimate') => {
  try {
    let buffer;
    
    switch (type) {
      case 'estimate':
        buffer = await exportEstimateExcel(data);
        break;
      case 'purchase':
        buffer = await exportPurchaseOrderExcel(data);
        break;
      case 'transaction':
        buffer = await exportTransactionStatementExcel(data);
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }
    
    // 파일 다운로드
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
    
    return buffer;
  } catch (error) {
    console.error('Excel export error:', error);
    throw error;
  }
};

/** 견적서 생성 */
export async function exportEstimateExcel(data) {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('견적서');
    
    // 컬럼 너비
    Object.entries(EST_COL_WIDTHS).forEach(([col,w]) => ws.getColumn(col).width = w);
    
    // 레이아웃
    const mapper = new LayoutMapper(ws, 'estimate');
    mapper.setupColumnWidths();
    mapper.setupEstimateLayout(data);
    
    // 이미지 삽입
    const imgH = new ExcelImageHandler(workbook);
    if (data.companyLogo)  await imgH.addCompanyLogo(data.companyLogo, ws, 'H6:I7');
    if (data.companyStamp) await imgH.addCompanyStamp(ws, data.companyStamp);
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Error creating estimate Excel:', error);
    throw error;
  }
}

/** 거래명세서 생성 (견적서와 동일) */
export async function exportTransactionStatementExcel(data) {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('거래명세서');
    
    Object.entries(EST_COL_WIDTHS).forEach(([col,w]) => ws.getColumn(col).width = w);
    
    const mapper = new LayoutMapper(ws, 'transactionStatement');
    mapper.setupColumnWidths();
    mapper.setupTransactionStatementLayout(data);
    
    const imgH = new ExcelImageHandler(workbook);
    if (data.companyLogo)  await imgH.addCompanyLogo(data.companyLogo, ws, 'H6:I7');
    if (data.companyStamp) await imgH.addCompanyStamp(ws, data.companyStamp);
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Error creating transaction statement Excel:', error);
    throw error;
  }
}

/** 발주서 생성 */
export async function exportPurchaseOrderExcel(data) {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('발주서');
    
    Object.entries(PO_COL_WIDTHS).forEach(([col,w]) => ws.getColumn(col).width = w);
    
    const mapper = new LayoutMapper(ws, 'purchaseOrder');
    mapper.setupColumnWidths();
    
    // 셀 병합 오류 방지를 위해 워크시트 초기화
    ws.spliceRows(1, ws.rowCount);
    
    mapper.setupPurchaseOrderLayout(data);
    
    const imgH = new ExcelImageHandler(workbook);
    if (data.companyLogo)  await imgH.addCompanyLogo(data.companyLogo, ws, 'H6:I7');
    if (data.companyStamp) await imgH.addCompanyStamp(ws, data.companyStamp);
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Error creating purchase order Excel:', error);
    throw error;
  }
}
