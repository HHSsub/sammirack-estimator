// -----------------------------------------------
// src/utils/excelExport.js
// -----------------------------------------------

import ExcelJS from 'exceljs';
import { ExcelImageHandler } from './excelImageHandler';
import { LayoutMapper } from './layoutMapper';
import { EXCEL_STYLES } from './excelStyles';

/** 열별 너비 정의 */
const EST_COL_WIDTHS = { A:5, B:32, C:15, D:10, E:15, F:15, G:15, H:15 };
const PO_COL_WIDTHS = { A:5, B:30, C:15, D:10, E:15, F:15, G:15, H:15 };

/** 파일명 생성 함수 */
export const generateFileName = (prefix = 'document', data = {}) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const orderNumber = data.documentNumber || data.orderNumber || '';
  const suffix = `${orderNumber ? orderNumber + '_' : ''}${timestamp}`;
  return `${prefix}_${suffix}.xlsx`;
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
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheet.sheet' });
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

/** 견적서 엑셀 생성 */
export async function exportEstimateExcel(data) {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('견적서');
    
    // 컬럼 너비 설정
    Object.entries(EST_COL_WIDTHS).forEach(([col, width]) => {
      ws.getColumn(col).width = width;
    });
    
    // 행 높이 설정
    ws.getRow(9).height = 25.5;
    for (let i = 13; i <= 28; i++) {
      ws.getRow(i).height = 24.95;
    }
    ws.getRow(29).height = 30.0;
    ws.getRow(30).height = 30.0;
    ws.getRow(31).height = 30.0;
    
    // 헤더 영역 설정
    setupEstimateHeader(ws, data);
    
    // 견적 내역 테이블 설정
    setupEstimateTable(ws, data);
    
    // 합계 영역 설정
    setupEstimateSummary(ws, data);
    
    // 특기사항 설정
    setupEstimateNotes(ws, data);
    
    // 이미지 처리
    const imageHandler = new ExcelImageHandler(workbook);
    await imageHandler.addEstimateCompanyLogo(ws, 'F1:H4');
    await imageHandler.addCompanyStamp(ws, 'G29:H31');
    
    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('견적서 생성 오류:', error);
    throw error;
  }
}

/** 발주서 엑셀 생성 */
export async function exportPurchaseOrderExcel(data) {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('발주서');
    
    // 컬럼 너비 설정
    Object.entries(PO_COL_WIDTHS).forEach(([col, width]) => {
      ws.getColumn(col).width = width;
    });
    
    // 행 높이 설정
    ws.getRow(7).height = 16.5;
    ws.getRow(8).height = 25.5;
    ws.getRow(9).height = 16.5;
    ws.getRow(56).height = 16.5;
    
    // 헤더 영역 설정
    setupPurchaseOrderHeader(ws, data);
    
    // 발주 내역 테이블 설정
    setupPurchaseOrderTable(ws, data);
    
    // 원자재 명세서 설정
    setupMaterialSpecification(ws, data);
    
    // 특기사항 설정
    setupPurchaseOrderNotes(ws, data);
    
    // 이미지 처리
    const imageHandler = new ExcelImageHandler(workbook);
    await imageHandler.addPurchaseOrderCompanyLogo(ws, 'F1:H4');
    await imageHandler.addCompanyStamp(ws, 'G55:H57');
    
    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('발주서 생성 오류:', error);
    throw error;
  }
}

/** 거래명세서 엑셀 생성 */
export async function exportTransactionStatementExcel(data) {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('거래명세서');
    
    const layoutMapper = new LayoutMapper(ws, 'transactionStatement');
    await layoutMapper.setupTransactionStatementLayout(data);
    
    const imageHandler = new ExcelImageHandler(workbook);
    await imageHandler.addCompanyLogo(ws, 'F1:H4');
    await imageHandler.addCompanyStamp(ws, 'G20:H22');
    
    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('거래명세서 생성 오류:', error);
    throw error;
  }
}

/** 견적서 헤더 설정 */
function setupEstimateHeader(ws, data) {
  // 견적서 제목
  safeMergeCells(ws, 'A1:H1');
  ws.getCell('A1').value = '견적서';
  ws.getCell('A1').style = {
    ...EXCEL_STYLES.documentTitle,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
  };
  
  // 발주업체 정보
  safeMergeCells(ws, 'A2:B2');
  ws.getCell('A2').value = '발주업체';
  ws.getCell('A2').style = EXCEL_STYLES.companyInfo;
  
  safeMergeCells(ws, 'C2:E2');
  ws.getCell('C2').value = data.companyName || '';
  
  safeMergeCells(ws, 'A3:B3');
  ws.getCell('A3').value = '상호명';
  ws.getCell('A3').style = EXCEL_STYLES.companyInfo;
  
  safeMergeCells(ws, 'C3:E3');
  ws.getCell('C3').value = data.companyName || '';
  
  safeMergeCells(ws, 'A4:B4');
  ws.getCell('A4').value = '담당자';
  ws.getCell('A4').style = EXCEL_STYLES.companyInfo;
  
  safeMergeCells(ws, 'C4:E4');
  ws.getCell('C4').value = data.manager || '';
  
  // 우측 회사 정보
  ws.getCell('F2').value = '사업자등록번호';
  ws.getCell('G2').value = '232-81-01750';
  
  ws.getCell('F3').value = '상 호';
  ws.getCell('G3').value = '삼미랙특수산업';
  
  ws.getCell('F4').value = '소 재 지';
  ws.getCell('G4').value = '경기도 광명시 하안로 39 광명테크노파크 B동 1층';
  
  ws.getCell('F5').value = 'TEL';
  ws.getCell('G5').value = '010-9548-9578\n010-4311-7733';
  
  ws.getCell('F6').value = 'FAX';
  ws.getCell('G6').value = '(02)2611-4595';
  
  ws.getCell('F7').value = '홈페이지';
  ws.getCell('G7').value = 'http://www.ssmake.com';
  
  // 인사말
  safeMergeCells(ws, 'A9:H10');
  ws.getCell('A9').value = '아래와 같이 발주합니다';
  ws.getCell('A9').style = {
    font: { name: 'Arial', size: 12, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
}

/** 견적서 테이블 설정 */
function setupEstimateTable(ws, data) {
  // 테이블 헤더
  safeMergeCells(ws, 'A11:H11');
  ws.getCell('A11').value = '견적내역';
  ws.getCell('A11').style = {
    ...EXCEL_STYLES.documentTitle,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
  };
  
  // 컬럼 헤더
  ws.getCell('A12').value = 'NO';
  ws.getCell('B12').value = '품목';
  ws.getCell('C12').value = '단위';
  ws.getCell('D12').value = '수량';
  ws.getCell('E12').value = '단가';
  ws.getCell('F12').value = '공급가';
  safeMergeCells(ws, 'G12:H12');
  ws.getCell('G12').value = '비고';
  
  // 헤더 스타일 적용
  for (let col = 1; col <= 8; col++) {
    const cell = ws.getCell(12, col);
    cell.style = {
      ...EXCEL_STYLES.header,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
    };
  }
  
  // 데이터 행
  const items = data.items || [];
  let totalAmount = 0;
  
  for (let i = 0; i < Math.max(items.length, 13); i++) {
    const rowNum = 13 + i;
    const item = items[i];
    
    if (item) {
      ws.getCell(`A${rowNum}`).value = i + 1;
      ws.getCell(`B${rowNum}`).value = item.name || '';
      ws.getCell(`C${rowNum}`).value = item.unit || '개';
      ws.getCell(`D${rowNum}`).value = item.quantity || 1;
      ws.getCell(`E${rowNum}`).value = item.price || 0;
      ws.getCell(`F${rowNum}`).value = (item.quantity || 1) * (item.price || 0);
      safeMergeCells(ws, `G${rowNum}:H${rowNum}`);
      ws.getCell(`G${rowNum}`).value = item.note || '';
      
      totalAmount += (item.quantity || 1) * (item.price || 0);
    } else {
      // 빈 행
      for (let col = 1; col <= 6; col++) {
        ws.getCell(rowNum, col).value = '';
      }
      safeMergeCells(ws, `G${rowNum}:H${rowNum}`);
    }
    
    // 테두리 적용
    for (let col = 1; col <= 8; col++) {
      const cell = ws.getCell(rowNum, col);
      cell.style = {
        ...cell.style,
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    }
  }
  
  return totalAmount;
}

/** 견적서 합계 설정 */
function setupEstimateSummary(ws, data) {
  const totalAmount = calculateTotalAmount(data.items || []);
  const vat = Math.round(totalAmount * 0.1);
  const grandTotal = totalAmount + vat;
  
  // 소계
  safeMergeCells(ws, 'A26:F26');
  ws.getCell('A26').value = '소계';
  ws.getCell('A26').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
  safeMergeCells(ws, 'G26:H26');
  ws.getCell('G26').value = totalAmount.toLocaleString();
  ws.getCell('G26').style = {
    font: { name: 'Arial', size: 11 },
    alignment: { horizontal: 'right', vertical: 'middle' }
  };
  
  // 부가가치세
  safeMergeCells(ws, 'A27:F27');
  ws.getCell('A27').value = '부가가치세';
  ws.getCell('A27').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
  safeMergeCells(ws, 'G27:H27');
  ws.getCell('G27').value = vat.toLocaleString();
  ws.getCell('G27').style = {
    font: { name: 'Arial', size: 11 },
    alignment: { horizontal: 'right', vertical: 'middle' }
  };
  
  // 합계
  safeMergeCells(ws, 'A28:F28');
  ws.getCell('A28').value = '합계';
  ws.getCell('A28').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
  safeMergeCells(ws, 'G28:H28');
  ws.getCell('G28').value = grandTotal.toLocaleString();
  ws.getCell('G28').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'right', vertical: 'middle' }
  };
}

/** 견적서 특기사항 설정 */
function setupEstimateNotes(ws, data) {
  safeMergeCells(ws, 'A29:H29');
  ws.getCell('A29').value = '특기사항';
  ws.getCell('A29').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'left', vertical: 'middle' }
  };
  
  safeMergeCells(ws, 'A30:H30');
  ws.getCell('A30').value = data.notes || '';
  ws.getCell('A30').style = {
    font: { name: 'Arial', size: 10 },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
  };
  
  safeMergeCells(ws, 'A31:H31');
  ws.getCell('A31').value = '(주)삼미랙특수산업';
  ws.getCell('A31').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'right', vertical: 'middle' }
  };
}

/** 발주서 헤더 설정 */
function setupPurchaseOrderHeader(ws, data) {
  // 발주서 제목
  safeMergeCells(ws, 'A1:H1');
  ws.getCell('A1').value = '발주서';
  ws.getCell('A1').style = {
    ...EXCEL_STYLES.documentTitle,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
  };
  
  // 발주업체 정보
  safeMergeCells(ws, 'A2:B2');
  ws.getCell('A2').value = '발주업체';
  ws.getCell('A2').style = EXCEL_STYLES.companyInfo;
  
  safeMergeCells(ws, 'C2:E2');
  ws.getCell('C2').value = data.companyName || '';
  
  safeMergeCells(ws, 'A3:B3');
  ws.getCell('A3').value = '상호명';
  ws.getCell('A3').style = EXCEL_STYLES.companyInfo;
  
  safeMergeCells(ws, 'C3:E3');
  ws.getCell('C3').value = data.companyName || '';
  
  safeMergeCells(ws, 'A4:H4');
  ws.getCell('A4').value = '담당자';
  ws.getCell('A4').style = EXCEL_STYLES.companyInfo;
  
  // 우측 회사 정보
  ws.getCell('F5').value = '사업자등록번호';
  ws.getCell('G5').value = '232-81-01750';
  
  ws.getCell('F6').value = '상 호';
  ws.getCell('G6').value = '삼미랙특수산업';
  
  ws.getCell('F7').value = '소 재 지';
  ws.getCell('G7').value = '경기도 광명시 하안로 39 광명테크노파크 B동 1층';
  
  ws.getCell('F8').value = 'TEL';
  ws.getCell('G8').value = '010-9548-9578\n010-4311-7733';
  
  ws.getCell('F9').value = 'FAX';
  ws.getCell('G9').value = '(02)2611-4595';
  
  ws.getCell('F10').value = '홈페이지';
  ws.getCell('G10').value = 'http://www.ssmake.com';
  
  // 인사말
  safeMergeCells(ws, 'A8:C9');
  ws.getCell('A8').value = '아래와 같이 발주합니다';
  ws.getCell('A8').style = {
    font: { name: 'Arial', size: 12, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };
}

/** 발주서 테이블 설정 */
function setupPurchaseOrderTable(ws, data) {
  // 테이블 헤더
  safeMergeCells(ws, 'A10:H10');
  ws.getCell('A10').value = '발주내역';
  ws.getCell('A10').style = {
    ...EXCEL_STYLES.documentTitle,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
  };
  
  // 컬럼 헤더
  ws.getCell('A11').value = 'NO';
  ws.getCell('B11').value = '품목';
  ws.getCell('C11').value = '단위';
  ws.getCell('D11').value = '수량';
  ws.getCell('E11').value = '단가';
  ws.getCell('F11').value = '공급가';
  safeMergeCells(ws, 'G11:H11');
  ws.getCell('G11').value = '비고';
  
  // 헤더 스타일 적용
  for (let col = 1; col <= 8; col++) {
    const cell = ws.getCell(11, col);
    cell.style = {
      ...EXCEL_STYLES.header,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
    };
  }
  
  // 데이터 행 (12-22행)
  const items = data.items || [];
  let totalAmount = 0;
  
  for (let i = 0; i < Math.max(items.length, 11); i++) {
    const rowNum = 12 + i;
    const item = items[i];
    
    if (item) {
      ws.getCell(`A${rowNum}`).value = i + 1;
      ws.getCell(`B${rowNum}`).value = item.name || '';
      ws.getCell(`C${rowNum}`).value = item.unit || '개';
      ws.getCell(`D${rowNum}`).value = item.quantity || 1;
      ws.getCell(`E${rowNum}`).value = item.price || 0;
      ws.getCell(`F${rowNum}`).value = (item.quantity || 1) * (item.price || 0);
      safeMergeCells(ws, `G${rowNum}:H${rowNum}`);
      ws.getCell(`G${rowNum}`).value = item.note || '';
      
      totalAmount += (item.quantity || 1) * (item.price || 0);
    } else {
      // 빈 행
      for (let col = 1; col <= 6; col++) {
        ws.getCell(rowNum, col).value = '';
      }
      safeMergeCells(ws, `G${rowNum}:H${rowNum}`);
    }
  }
  
  // 합계 행 (20-22행)
  const vat = Math.round(totalAmount * 0.1);
  const grandTotal = totalAmount + vat;
  
  safeMergeCells(ws, 'A20:F20');
  ws.getCell('A20').value = '소계';
  safeMergeCells(ws, 'G20:H20');
  ws.getCell('G20').value = totalAmount.toLocaleString();
  
  safeMergeCells(ws, 'A21:F21');
  ws.getCell('A21').value = '부가가치세';
  safeMergeCells(ws, 'G21:H21');
  ws.getCell('G21').value = vat.toLocaleString();
  
  safeMergeCells(ws, 'A22:F22');
  ws.getCell('A22').value = '합계';
  safeMergeCells(ws, 'G22:H22');
  ws.getCell('G22').value = grandTotal.toLocaleString();
}

/** 원자재 명세서 설정 */
function setupMaterialSpecification(ws, data) {
  // 원자재 명세서 제목
  safeMergeCells(ws, 'A23:H23');
  ws.getCell('A23').value = '원자재 명세서';
  ws.getCell('A23').style = {
    ...EXCEL_STYLES.documentTitle,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
  };
  
  // 컬럼 헤더
  ws.getCell('A24').value = 'NO';
  ws.getCell('B24').value = '품목명';
  ws.getCell('C24').value = '규격';
  ws.getCell('D24').value = '단위';
  ws.getCell('E24').value = '수량';
  ws.getCell('F24').value = '공급가';
  safeMergeCells(ws, 'G24:H24');
  ws.getCell('G24').value = '비고';
  
  // 헤더 스타일 적용
  for (let col = 1; col <= 8; col++) {
    const cell = ws.getCell(24, col);
    cell.style = {
      ...EXCEL_STYLES.header,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
    };
  }
  
  // 원자재 데이터 (25-54행)
  const materials = [
    { name: '기둥(750)', spec: '2', unit: '개', quantity: 0, price: 0 },
    { name: '상판대', spec: '4', unit: '개', quantity: 0, price: 0 },
    { name: '선반', spec: '2', unit: '개', quantity: 0, price: 0 },
    { name: '후면보강대', spec: '2', unit: '개', quantity: 0, price: 0 },
    { name: '보강대', spec: '10', unit: '개', quantity: 0, price: 0 },
    { name: '연결대', spec: '2', unit: '개', quantity: 0, price: 0 },
    { name: '지지대', spec: '8', unit: '개', quantity: 0, price: 0 }
  ];
  
  for (let i = 0; i < 30; i++) {
    const rowNum = 25 + i;
    const material = materials[i];
    
    if (material) {
      ws.getCell(`A${rowNum}`).value = i + 1;
      ws.getCell(`B${rowNum}`).value = material.name;
      ws.getCell(`C${rowNum}`).value = material.spec;
      ws.getCell(`D${rowNum}`).value = material.unit;
      ws.getCell(`E${rowNum}`).value = material.quantity;
      ws.getCell(`F${rowNum}`).value = material.price;
      safeMergeCells(ws, `G${rowNum}:H${rowNum}`);
    } else {
      // 빈 행
      for (let col = 1; col <= 6; col++) {
        ws.getCell(rowNum, col).value = '';
      }
      safeMergeCells(ws, `G${rowNum}:H${rowNum}`);
    }
  }
}

/** 발주서 특기사항 설정 */
function setupPurchaseOrderNotes(ws, data) {
  safeMergeCells(ws, 'A55:H55');
  ws.getCell('A55').value = '특기사항';
  ws.getCell('A55').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'left', vertical: 'middle' }
  };
  
  safeMergeCells(ws, 'A56:H56');
  ws.getCell('A56').value = data.notes || '';
  ws.getCell('A56').style = {
    font: { name: 'Arial', size: 10 },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
  };
  
  safeMergeCells(ws, 'A57:H57');
  ws.getCell('A57').value = '(주)삼미랙특수산업';
  ws.getCell('A57').style = {
    font: { name: 'Arial', size: 11, bold: true },
    alignment: { horizontal: 'right', vertical: 'middle' }
  };
}

/** 총 금액 계산 */
function calculateTotalAmount(items) {
  return items.reduce((total, item) => {
    return total + ((item.quantity || 1) * (item.price || 0));
  }, 0);
}
