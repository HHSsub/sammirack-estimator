// ----------------------------------------------------------------------------
// src/utils/excelExport.js
// ----------------------------------------------------------------------------
import ExcelJS from 'exceljs';
import { ExcelImageHandler } from './excelImageHandler';
import { LayoutMapper } from './layoutMapper';
import { EXCEL_STYLES } from './excelStyles';

const EST_COL_WIDTHS = {
  A: 5,   // No
  B: 32,  // 품목명
  C: 15,  // 규격
  D: 10,  // 수량
  E: 15,  // 단가
  F: 15,  // 공급가
  G: 15   // 비고
};

const PO_COL_WIDTHS = {
  A: 5,   // No
  B: 30,  // 품목명
  C: 15,  // 규격
  D: 10,  // 수량
  E: 15,  // 단가
  F: 15,  // 금액
  G: 15,  // 공급가
  H: 15   // 비고
};

/**
 * 견적서 엑셀 생성
 */
export async function exportEstimateExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('견적서', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 16 }]
  });

  // 컬럼 너비 설정
  Object.entries(EST_COL_WIDTHS).forEach(([col, width]) => {
    ws.getColumn(col).width = width;
  });

  // 레이아웃 매핑
  LayoutMapper.setupEstimateLayout(ws, data);

  // 총합계 셀 스타일 및 값
  ws.getCell('F10').value = data.totalAmount;
  ws.getCell('F10').style = EXCEL_STYLES.number;

  return workbook.xlsx.writeBuffer();
}

/**
 * 거래명세서 엑셀 생성
 */
export async function exportTransactionExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('거래명세서', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 16 }]
  });

  // 컬럼 너비는 견적서와 동일
  Object.entries(EST_COL_WIDTHS).forEach(([col, width]) => {
    ws.getColumn(col).width = width;
  });

  // 레이아웃 매핑 (견적서와 동일)
  LayoutMapper.setupTransactionLayout(ws, data);

  // 총합계 셀 스타일 및 값
  ws.getCell('F10').value = data.totalAmount;
  ws.getCell('F10').style = EXCEL_STYLES.number;

  return workbook.xlsx.writeBuffer();
}

/**
 * 발주서 엑셀 생성
 */
export async function exportPurchaseOrderExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('발주서', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 16 }]
  });

  // 컬럼 너비 설정
  Object.entries(PO_COL_WIDTHS).forEach(([col, width]) => {
    ws.getColumn(col).width = width;
  });

  // 레이아웃 매핑
  LayoutMapper.setupPurchaseOrderLayout(ws, data);

  // 소계/부가세/합계 값 및 스타일
  ws.getCell('G31').value = data.subTotal;
  ws.getCell('G31').style = EXCEL_STYLES.number;

  ws.getCell('G32').value = data.vat;
  ws.getCell('G32').style = EXCEL_STYLES.number;

  ws.getCell('G33').value = data.grandTotal;
  ws.getCell('G33').style = EXCEL_STYLES.number;

  return workbook.xlsx.writeBuffer();
}
