// src/utils/excelExport.js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// 이미지 삽입 헬퍼
const loadImage = async (url) => {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return buffer;
};

// 기본 스타일
const baseStyles = {
  documentTitle: {
    font: { bold: true, size: 14, name: '맑은 고딕' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BFBFBF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    },
  },
  defaultCell: {
    font: { size: 10, name: '맑은 고딕' },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    },
  },
  moneyData: {
    font: { size: 10, name: '맑은 고딕' },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    },
    numFmt: '#,##0',
  },
  itemHeader: {
    font: { bold: true, size: 10, name: '맑은 고딕' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    },
  },
  specialNote: {
    font: { size: 10, name: '맑은 고딕' },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } },
    border: {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } },
    },
  },
  companyFooter: {
    font: { bold: true, size: 12, name: '맑은 고딕' },
    alignment: { horizontal: 'center', vertical: 'middle' },
  },
};

// 공통 셀 스타일 적용
const applyStyle = (cell, style) => {
  Object.assign(cell, { ...style });
};

// 파일명 자동 생성
export const generateFileName = (type = 'estimate') => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${type}_${y}${m}${d}.xlsx`;
};

// 메인 엑셀 생성 함수
export const exportExcel = async ({
  type = 'estimate', // 'estimate', 'purchase', 'transaction'
  data = [],
  materials = [],
  specialNote = '',
}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(type === 'purchase' ? '발주서' : type === 'transaction' ? '거래명세서' : '견적서');

  // 열 너비 기본 세팅
  worksheet.columns = [
    { key: 'A', width: 5 },
    { key: 'B', width: 30 },
    { key: 'C', width: 10 },
    { key: 'D', width: 10 },
    { key: 'E', width: 12 },
    { key: 'F', width: 12 },
    { key: 'G', width: 12 },
    { key: 'H', width: 12 },
  ];

  // 문서 제목
  worksheet.mergeCells('A5:H5');
  const titleCell = worksheet.getCell('A5');
  titleCell.value = type === 'purchase' ? '발주서' : type === 'transaction' ? '거래명세서' : '견적서';
  applyStyle(titleCell, baseStyles.documentTitle);

  // 고객/공급자/사업자정보 예시
  worksheet.mergeCells('A6:B6'); worksheet.getCell('A6').value = '거래일자'; applyStyle(worksheet.getCell('A6'), baseStyles.defaultCell);
  worksheet.mergeCells('A7:B7'); worksheet.getCell('A7').value = '상호명'; applyStyle(worksheet.getCell('A7'), baseStyles.defaultCell);
  worksheet.mergeCells('A8:B8'); worksheet.getCell('A8').value = '담당자'; applyStyle(worksheet.getCell('A8'), baseStyles.defaultCell);

  worksheet.mergeCells('D6:D10'); worksheet.getCell('D6').value = '공급자'; applyStyle(worksheet.getCell('D6'), baseStyles.defaultCell);
  worksheet.getCell('E6').value = '사업자등록번호'; applyStyle(worksheet.getCell('E6'), baseStyles.defaultCell);
  worksheet.mergeCells('F6:H6'); worksheet.getCell('F6').value = '232-81-01750'; applyStyle(worksheet.getCell('F6'), baseStyles.defaultCell);

  worksheet.getCell('E7').value = '상호'; applyStyle(worksheet.getCell('E7'), baseStyles.defaultCell);
  worksheet.getCell('F7').value = '삼미앵글랙산업'; applyStyle(worksheet.getCell('F7'), baseStyles.defaultCell);
  worksheet.getCell('G7').value = '대표자'; applyStyle(worksheet.getCell('G7'), baseStyles.defaultCell);
  worksheet.getCell('H7').value = '박이삭'; applyStyle(worksheet.getCell('H7'), baseStyles.defaultCell);

  worksheet.getCell('E8').value = '소재지'; applyStyle(worksheet.getCell('E8'), baseStyles.defaultCell);
  worksheet.mergeCells('F8:H8'); worksheet.getCell('F8').value = '경기도 광명시 원노온사로 39, 철제 스틸하우스 1'; applyStyle(worksheet.getCell('F8'), baseStyles.defaultCell);

  worksheet.getCell('E9').value = 'TEL'; applyStyle(worksheet.getCell('E9'), baseStyles.defaultCell);
  worksheet.mergeCells('F9:H9'); worksheet.getCell('F9').value = '010-9548-9578 / 010-4311-7733'; applyStyle(worksheet.getCell('F9'), baseStyles.defaultCell);

  worksheet.getCell('E10').value = '홈페이지'; applyStyle(worksheet.getCell('E10'), baseStyles.defaultCell);
  worksheet.mergeCells('F10:H10'); worksheet.getCell('F10').value = 'http://www.ssmake.com'; applyStyle(worksheet.getCell('F10'), baseStyles.defaultCell);

  // 견적/원자재 헤더
  worksheet.mergeCells('A11:H11'); worksheet.getCell('A11').value = '견적명세'; applyStyle(worksheet.getCell('A11'), baseStyles.itemHeader);
  worksheet.getRow(12).values = ['NO','품명','단위','수량','단가','공급가','비고','비고2'];
  worksheet.getRow(12).eachCell((cell) => applyStyle(cell, baseStyles.itemHeader));

  // 데이터 채우기
  let startRow = 13;
  data.forEach((row, i) => {
    const excelRow = worksheet.getRow(startRow + i);
    excelRow.getCell(1).value = row.no;
    excelRow.getCell(2).value = row.name;
    excelRow.getCell(3).value = row.unit;
    excelRow.getCell(4).value = row.qty;
    excelRow.getCell(5).value = row.price;
    excelRow.getCell(6).value = row.total;
    excelRow.getCell(7).value = row.note;
    excelRow.getCell(8).value = row.note2;

    excelRow.eachCell((cell, idx) => {
      if(idx === 5 || idx === 6) applyStyle(cell, baseStyles.moneyData);
      else applyStyle(cell, baseStyles.defaultCell);
    });
  });

  // 발주서일 경우 원자재 추가
  if(type === 'purchase') {
    let materialStart = 26;
    materials.forEach((row, i) => {
      const r = worksheet.getRow(materialStart + i);
      r.getCell(1).value = row.no;
      r.getCell(2).value = row.name;
      r.getCell(3).value = row.qty;
      r.getCell(4).value = row.unitPrice;
      r.getCell(5).value = row.totalPrice;
      r.getCell(6).value = row.note;
      r.getCell(7).value = row.note2;
      r.getCell(8).value = row.note3;
      r.eachCell((cell, idx) => {
        if(idx === 4 || idx === 5) applyStyle(cell, baseStyles.moneyData);
        else applyStyle(cell, baseStyles.defaultCell);
      });
    });
  }

  // 특기사항
  worksheet.mergeCells(`A${startRow + data.length}:H${startRow + data.length + 2}`);
  worksheet.getCell(`A${startRow + data.length}`).value = specialNote;
  applyStyle(worksheet.getCell(`A${startRow + data.length}`), baseStyles.specialNote);

  // 회사명 푸터
  const footerRow = type === 'purchase' ? startRow + data.length + 3 : startRow + data.length + 1;
  worksheet.getCell(`H${footerRow}`).value = '(주)삼미앵글산업';
  applyStyle(worksheet.getCell(`H${footerRow}`), baseStyles.companyFooter);

  // 이미지 삽입 (예: public/logo.png)
  try {
    const logoBuffer = await loadImage('/logo.png');
    const imageId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    worksheet.addImage(imageId, 'B2:C4');
  } catch(e) {
    console.warn('이미지 로딩 실패:', e);
  }

  // 브라우저 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${type}.xlsx`);
};
