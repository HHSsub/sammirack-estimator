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

/** 견적서 생성 */
export async function exportEstimateExcel(data) {
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

  // 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/** 거래명세서 생성 (견적서와 동일) */
export async function exportTransactionStatementExcel(data) {
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
}

/** 발주서 생성 */
export async function exportPurchaseOrderExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('발주서');

  Object.entries(PO_COL_WIDTHS).forEach(([col,w]) => ws.getColumn(col).width = w);

  const mapper = new LayoutMapper(ws, 'purchaseOrder');
  mapper.setupColumnWidths();
  mapper.setupPurchaseOrderLayout(data);

  const imgH = new ExcelImageHandler(workbook);
  if (data.companyLogo)  await imgH.addCompanyLogo(data.companyLogo, ws, 'H6:I7');
  if (data.companyStamp) await imgH.addCompanyStamp(ws, data.companyStamp);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
