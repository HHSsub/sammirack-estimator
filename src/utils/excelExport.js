// src/utils/excelExport.js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// 파일명 자동 생성
export const generateFileName = (type = 'estimate') => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${type}_${y}${m}${d}.xlsx`;
};

// 공통 스타일
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; // 연한 회색
const lightGrayFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // 옅은 회색
const darkGrayFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } }; // 중간 회색

const centerAlign = { vertical: 'middle', horizontal: 'center', wrapText: true };

// 컬럼 너비
const columnsWidth = [
  { wch: 5 },  // A: NO
  { wch: 39 }, // B: 품명
  { wch: 8 },  // C: 단위
  { wch: 8 },  // D: 수량
  { wch: 15 }, // E: 단가
  { wch: 15 }, // F: 공급가/금액
  { wch: 15 }, // G: 비고
  { wch: 15 }, // H: 비고 확장
];

export const exportToExcel = async (data, type = 'estimate') => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '삼미앵글랙';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(type === 'purchase' ? '발주서' : '견적서');

  // 컬럼 너비 설정
  worksheet.columns = columnsWidth;

  // 행 높이 설정
  worksheet.getRow(5).height = 45;  // 문서제목
  worksheet.getRow(9).height = 40;  // "아래와 같이 ..."
  
  // 문서제목
  worksheet.mergeCells('A5:H5');
  const titleCell = worksheet.getCell('A5');
  titleCell.value = type === 'purchase' ? '발주서' : '견적서';
  titleCell.fill = headerFill;
  titleCell.alignment = centerAlign;
  titleCell.font = { bold: true, size: 14 };

  // 거래일자, 상호명, 담당자
  worksheet.mergeCells('A6:B6');
  worksheet.getCell('A6').value = '거래일자';
  worksheet.getCell('A6').alignment = centerAlign;
  worksheet.mergeCells('A7:B7');
  worksheet.getCell('A7').value = '상호명';
  worksheet.getCell('A7').alignment = centerAlign;
  worksheet.mergeCells('A8:B8');
  worksheet.getCell('A8').value = '담당자';
  worksheet.getCell('A8').alignment = centerAlign;

  // 아래와 같이 ~
  worksheet.mergeCells('A9:C10');
  worksheet.getCell('A9').value = type === 'purchase' ? '아래와 같이 발주합니다' : '아래와 같이 견적합니다';
  worksheet.getCell('A9').alignment = centerAlign;

  // 공급자 및 사업자등록번호
  worksheet.mergeCells('D6:D10');
  worksheet.getCell('D6').value = '삼미앵글랙';
  worksheet.getCell('D6').alignment = centerAlign;

  worksheet.getCell('E6').value = '사업자등록번호';
  worksheet.getCell('F6').value = '232-81-01750';
  worksheet.mergeCells('F6:H6');
  worksheet.getCell('F6').alignment = centerAlign;

  // 상호/대표자/소재지 등
  worksheet.getCell('E7').value = '상호';
  worksheet.getCell('F7').value = '삼미앵글랙산업';
  worksheet.getCell('G7').value = '대표자';
  worksheet.getCell('H7').value = '박이삭';

  worksheet.getCell('E8').value = '소재지';
  worksheet.mergeCells('F8:H8');
  worksheet.getCell('F8').value = '경기도 광명시 원노온사로 39, 철제 스틸하우스 1';
  worksheet.getCell('F8').alignment = centerAlign;

  worksheet.getCell('E9').value = 'TEL';
  worksheet.getCell('F9').value = '010-9548-9578 010-4311-7733';
  worksheet.getCell('G9').value = 'FAX';
  worksheet.getCell('H9').value = '(02)2611-4595';

  worksheet.getCell('E10').value = '홈페이지';
  worksheet.mergeCells('F10:H10');
  worksheet.getCell('F10').value = 'http://www.ssmake.com';
  worksheet.getCell('F10').alignment = centerAlign;

  // 견적/발주 명세 제목
  worksheet.mergeCells('A11:H11');
  worksheet.getCell('A11').value = type === 'purchase' ? '발주 명세' : '견적명세';
  worksheet.getCell('A11').fill = lightGrayFill;
  worksheet.getCell('A11').alignment = centerAlign;

  // 테이블 헤더
  worksheet.getRow(12).values = ['NO', '품명', '단위', '수량', '단가', '공급가', '비고', '비고'];
  worksheet.getRow(12).fill = lightGrayFill;
  worksheet.getRow(12).alignment = centerAlign;

  // 아이템 행 최소값
  const items = data.items && data.items.length > 0 ? data.items : Array(13).fill({ name:'', unit:'', quantity:'', unitPrice:'', totalPrice:'', note:''});
  
  // 데이터 입력
  items.forEach((item, idx) => {
    const rowIndex = 13 + idx;
    worksheet.getCell(`A${rowIndex}`).value = idx + 1;
    worksheet.getCell(`B${rowIndex}`).value = item.name;
    worksheet.getCell(`C${rowIndex}`).value = item.unit;
    worksheet.getCell(`D${rowIndex}`).value = item.quantity;
    worksheet.getCell(`E${rowIndex}`).value = item.unitPrice;
    worksheet.getCell(`F${rowIndex}`).value = item.totalPrice;
    // 비고 병합
    worksheet.mergeCells(`G${rowIndex}:H${rowIndex}`);
    worksheet.getCell(`G${rowIndex}`).value = item.note;
    worksheet.getCell(`G${rowIndex}`).alignment = centerAlign;
  });

  // 합계 계산 (하단 위치 자동)
  const totalRowIndex = 13 + items.length;
  worksheet.mergeCells(`A${totalRowIndex}:F${totalRowIndex}`);
  worksheet.getCell(`A${totalRowIndex}`).value = '소계';
  worksheet.getCell(`A${totalRowIndex}`).alignment = centerAlign;
  worksheet.mergeCells(`G${totalRowIndex}:H${totalRowIndex}`);
  worksheet.getCell(`G${totalRowIndex}`).value = data.subtotal || 0;
  worksheet.getCell(`G${totalRowIndex}`).alignment = centerAlign;

  worksheet.mergeCells(`A${totalRowIndex + 1}:F${totalRowIndex + 1}`);
  worksheet.getCell(`A${totalRowIndex + 1}`).value = '부가세';
  worksheet.getCell(`A${totalRowIndex + 1}`).alignment = centerAlign;
  worksheet.mergeCells(`G${totalRowIndex + 1}:H${totalRowIndex + 1}`);
  worksheet.getCell(`G${totalRowIndex + 1}`).value = data.tax || 0;
  worksheet.getCell(`G${totalRowIndex + 1}`).alignment = centerAlign;

  worksheet.mergeCells(`A${totalRowIndex + 2}:F${totalRowIndex + 2}`);
  worksheet.getCell(`A${totalRowIndex + 2}`).value = '합계';
  worksheet.getCell(`A${totalRowIndex + 2}`).alignment = centerAlign;
  worksheet.mergeCells(`G${totalRowIndex + 2}:H${totalRowIndex + 2}`);
  worksheet.getCell(`G${totalRowIndex + 2}`).value = data.totalAmount || 0;
  worksheet.getCell(`G${totalRowIndex + 2}`).alignment = centerAlign;

  // 특기사항
  const specialIndex = totalRowIndex + 3;
  worksheet.mergeCells(`A${specialIndex}:H${specialIndex + 2}`);
  worksheet.getCell(`A${specialIndex}`).value = data.notes || '';
  worksheet.getCell(`A${specialIndex}`).alignment = { vertical:'top', horizontal:'left', wrapText:true };

  // (주)삼미앵글랙산업
  worksheet.getCell(`H${specialIndex + 3}`).value = '(주)삼미앵글랙산업';
  worksheet.getCell(`H${specialIndex + 3}`).alignment = centerAlign;
  worksheet.getCell(`H${specialIndex + 3}`).font = { bold:true };

  // 도장 이미지 삽입
  try {
    const imageId = workbook.addImage({
      filename: './public/images/도장.png',
      extension: 'png',
    });
    worksheet.addImage(imageId, 'H7:H7');
  } catch (err) {
    console.warn('도장 이미지 로드 실패:', err);
  }

  // 엑셀 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), generateFileName(type));
};
