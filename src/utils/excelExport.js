import * as XLSX from 'xlsx';
import { getEstimateStyles, getPurchaseOrderStyles, getTransactionStyles, baseStyles } from './excelStyles.js';
import { addImageToWorkbook } from './excelImageHandler.js';
import { createEstimateLayout, createPurchaseOrderLayout, createTransactionLayout, validateAndCleanData } from './layoutMapper.js';

// 파일명 생성 함수 (빌드 에러 해결)
export const generateFileName = (type, date = new Date()) => {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const typeMap = {
    'estimate': '견적서',
    'purchase': '발주서',
    'transaction': '거래명세서'
  };
  
  const typeName = typeMap[type] || '문서';
  
  return `${typeName}_${dateStr}.xlsx`;
};

// 메인 엑셀 내보내기 함수
export const exportToExcel = async (rawData, type = 'estimate') => {
  try {
    console.log('엑셀 내보내기 시작:', { type, rawData });
    
    // 데이터 검증 및 정제
    const data = validateAndCleanData(rawData, type);
    console.log('정제된 데이터:', data);
    
    // 새 워크북 생성
    const workbook = XLSX.utils.book_new();
    
    // 문서 타입에 따른 레이아웃 생성
    const layout = createDocumentLayout(data, type);
    console.log('layout 객체:', layout);
    console.log('레이아웃 생성 완료');

    if (!layout || !Array.isArray(layout.data)) {
      throw new Error(`레이아웃 데이터가 올바르지 않습니다: ${JSON.stringify(layout)}`);
    }

    // 빈 값 방어코드
    layout.data = layout.data.filter(row => Array.isArray(row));

    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(layout.data);

    // 방어 코드: merges 범위가 layout.data를 벗어나지 않도록 필터링
    const maxRow = layout.data.length - 1;
    const maxCol = layout.data[0]?.length - 1 || 0;

    const safeMerges = (layout.merges || []).filter(m =>
      m && m.s && m.e &&
      m.s.r <= maxRow && m.e.r <= maxRow &&
      m.s.c <= maxCol && m.e.c <= maxCol
    );

    // 병합 셀 적용
    worksheet['!merges'] = safeMerges;

    // 스타일 적용
    applyStyles(worksheet, layout.styles, type);
    console.log('스타일 적용 완료');

    // 컬럼 너비 설정
    worksheet['!cols'] = getColumnWidths();

    // 이미지 삽입
    try {
      const imageCell = type === 'purchase' ? 'H7' : 'H7';
      await addImageToWorkbook(workbook, worksheet, imageCell);
      console.log('이미지 추가 완료');
    } catch (imageError) {
      console.warn('이미지 추가 실패, 계속 진행:', imageError);
    }

    // 테두리 적용
    applyBorders(worksheet, layout.borders.start, layout.borders.end, baseStyles.defaultCell.border);
    console.log('테두리 적용 완료');

    XLSX.utils.book_append_sheet(workbook, worksheet, '문서');

    // 파일 다운로드
    const fileName = generateFileName(type, new Date());
    XLSX.writeFile(workbook, fileName);

    console.log(`${fileName} 파일이 성공적으로 생성되었습니다.`);
    return true;

  } catch (error) {
    console.error('엑셀 내보내기 중 오류:', error);
    alert('엑셀 파일 생성 중 오류가 발생했습니다: ' + error.message);
    return false;
  }
};

// 문서 타입별 레이아웃 생성
const createDocumentLayout = (data, type) => {
  switch (type) {
    case 'estimate':
    case 'transaction':
      return createEstimateLayout(data, type);
    case 'purchase':
      return createPurchaseOrderLayout(data);
    default:
      throw new Error(`지원되지 않는 문서 타입: ${type}`);
  }
};

// 스타일 적용
const applyStyles = (worksheet, styles, type) => {
  worksheet['!rows'] = worksheet['!rows'] || [];

  // 모든 셀에 기본 스타일 적용
  for (let r = 0; r < worksheet['!rows'].length || worksheet['!rows'].length === 0 ? worksheet['!rows'].length : worksheet['!rows'].length; r++) {
    for (let c = 0; c < getColumnWidths().length; c++) {
      const cellRef = `${String.fromCharCode(65 + c)}${r + 1}`;
      if (!worksheet[cellRef]) {
        worksheet[cellRef] = { v: '', t: 's' };
      }
      worksheet[cellRef].s = baseStyles.defaultCell;
    }
  }

  // 특정 셀 스타일 적용
  Object.keys(styles || {}).forEach(cellRef => {
    if (!worksheet[cellRef]) {
      worksheet[cellRef] = { v: '', t: 's' };
    }
    worksheet[cellRef].s = { ...worksheet[cellRef].s, ...styles[cellRef] };
  });

  // 행 높이 설정
  if (styles["9"] && styles["9"].hpt) {
    worksheet['!rows'][8] = { hpt: styles["9"].hpt };
  }
  if (styles["5"] && styles["5"].hpt) {
    worksheet['!rows'][4] = { hpt: styles["5"].hpt };
  }
};

// 셀 병합 적용
const applyMerges = (worksheet, merges) => {
  if (!worksheet['!merges']) {
    worksheet['!merges'] = [];
  }
  worksheet['!merges'].push(...(merges || []));
};

// 컬럼 너비 설정
const getColumnWidths = () => [
  { wch: 5 },   // A: NO
  { wch: 39 },  // B: 품명
  { wch: 8 },   // C: 단위
  { wch: 8 },   // D: 수량
  { wch: 12 },  // E: 단가
  { wch: 12 },  // F: 공급가/금액
  { wch: 15 },  // G: 비고
  { wch: 15 }   // H: 비고 확장
];

// 개별 export 함수들
export const exportEstimate = (estimateData) => {
  exportToExcel(estimateData, 'estimate');
};

export const exportPurchaseOrder = (purchaseData) => {
  exportToExcel(purchaseData, 'purchase');
};

export const exportTransaction = (transactionData) => {
  exportToExcel(transactionData, 'transaction');
};

// 기본 export
export default {
  exportToExcel,
  exportEstimate,
  exportPurchaseOrder,
  exportTransaction,
  generateFileName
};

// 범위에 테두리 적용
const applyBorders = (worksheet, startCell, endCell, style) => {
  const startCol = startCell.charCodeAt(0) - 65;
  const startRow = parseInt(startCell.substring(1)) - 1;
  const endCol = endCell.charCodeAt(0) - 65;
  const endRow = parseInt(endCell.substring(1)) - 1;

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cellRef = `${String.fromCharCode(65 + c)}${r + 1}`;
      if (!worksheet[cellRef]) {
        worksheet[cellRef] = { v: '', t: 's' };
      }
      worksheet[cellRef].s = worksheet[cellRef].s || {};
      worksheet[cellRef].s.border = style;
    }
  }
};
