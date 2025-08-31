// ----------------------------------------------------------------------------
// src/utils/layoutMapper.js
// ----------------------------------------------------------------------------
import { EXCEL_STYLES as styles } from './excelStyles';
import { insertImage } from './excelImageHandler';

const { header, text, number, allBorders } = styles;

/**
 * 견적서 레이아웃 세팅
 */
function setupEstimateLayout(ws, data) {
  // 1) A1~A16 각 행을 B열과 병합
  for (let r = 1; r <= 16; r++) {
    ws.mergeCells(`A${r}:B${r}`);
  }

  // 2) 로고/도장 이미지 삽입
  insertImage(ws, data.logo, 'A1', { width: 150, height: 60 });
  insertImage(ws, data.stamp, 'F1', { width: 80, height: 80 });

  // 3) 견적일자
  ws.getCell('A5').value = '견적일자';
  ws.getCell('A5').style = header;
  ws.mergeCells('C5:D5');
  ws.getCell('C5').value = data.estimateDate;
  ws.getCell('C5').style = text;

  // 4) 상호명 · 담당자 레이블
  ws.getCell('A6').value = '상호명';
  ws.getCell('A6').style = text;
  ws.getCell('A7').value = '담당자';
  ws.getCell('A7').style = text;

  // 5) “아래와 같이 견적합니다” 병합 및 텍스트
  ws.mergeCells('D5:D9');
  ws.getCell('D5').value = '아래와 같이 견적합니다';
  ws.getCell('D5').style = text;
  for (let r = 6; r <= 9; r++) {
    ws.getCell(`D${r}`).style = text;
  }

  // 6) E5~E9: 왼쪽 라벨
  ['사업자등록번호', '상 호', '소 재 지', 'T E L', '홈페이지'].forEach((lbl, idx) => {
    const cell = ws.getCell(`E${5 + idx}`);
    cell.value = lbl;
    cell.style = text;
  });

  // 7) F5:I5 사업자등록번호
  ws.mergeCells('F5:I5');
  ws.getCell('F5').value = data.companyRegistrationNumber;
  ws.getCell('F5').style = text;

  // 8) F6 : 상호명
  ws.getCell('F6').value = data.companyName;
  ws.getCell('F6').style = text;

  // 9) G6:"대표자" / H6:I6:대표자명
  ws.getCell('G6').value = '대표자';
  ws.getCell('G6').style = text;
  ws.mergeCells('H6:I6');
  ws.getCell('H6').value = data.representative;
  ws.getCell('H6').style = text;

  // 10) F7:I7 : 주소
  ws.mergeCells('F7:I7');
  ws.getCell('F7').value = data.address;
  ws.getCell('F7').style = text;

  // 11) F8 : 전화번호 / G8: "FAX" / H8:I8 : 팩스번호
  ws.getCell('F8').value = data.phone;
  ws.getCell('F8').style = text;
  ws.getCell('G8').value = 'FAX';
  ws.getCell('G8').style = text;
  ws.mergeCells('H8:I8');
  ws.getCell('H8').value = data.fax;
  ws.getCell('H8').style = text;

  // 12) F9:I9 : 홈페이지
  ws.mergeCells('F9:I9');
  ws.getCell('F9').value = data.website;
  ws.getCell('F9').style = text;

  // 13) A10:C10 : 견적금액(부가세포함)
  ws.mergeCells('A10:C10');
  ws.getCell('A10').value = '견적금액(부가세포함)';
  ws.getCell('A10').style = header;

  // 14) 표 머릿글 설정
  ws.getCell('A17').value = 'NO';
  ws.getCell('A17').style = header;
  ws.mergeCells('B16:G16');
  ws.getCell('B16').value = '견적명세';
  ws.getCell('B16').style = header;

  // 15) 열 너비 조정 (B=품목명)
  ws.getColumn('B').width = 32;

  // 16) 아이템 데이터 매핑
  data.items.forEach((item, idx) => {
    const r = 17 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    ws.getCell(`A${r}`).style = text;

    ws.getCell(`B${r}`).value = item.name;
    ws.getCell(`B${r}`).style = text;

    ws.getCell(`C${r}`).value = item.spec;
    ws.getCell(`C${r}`).style = text;

    ws.getCell(`D${r}`).value = item.quantity;
    ws.getCell(`D${r}`).style = number;

    ws.getCell(`E${r}`).value = item.unitPrice;
    ws.getCell(`E${r}`).style = number;

    ws.getCell(`F${r}`).value = item.supplyAmount;
    ws.getCell(`F${r}`).style = number;

    ws.getCell(`G${r}`).value = item.remarks || '';
    ws.getCell(`G${r}`).style = text;
  });

  // 17) 전체 테두리 (A5:G35)
  for (let row = 5; row <= 35; row++) {
    for (let col = 1; col <= 7; col++) {
      const cell = ws.getCell(row, col);
      cell.style = { ...cell.style, ...allBorders };
    }
  }
}


/**
 * 발주서 레이아웃 세팅
 */
function setupPurchaseOrderLayout(ws, data) {
  // 1) A1~A16 각 행을 B열과 병합
  for (let r = 1; r <= 16; r++) {
    ws.mergeCells(`A${r}:B${r}`);
  }

  // 2) 로고/도장 이미지 삽입
  insertImage(ws, data.logo, 'A1', { width: 150, height: 60 });
  insertImage(ws, data.stamp, 'F1', { width: 80, height: 80 });

  // 3) 발주일자
  ws.getCell('A5').value = '견적일자';
  ws.getCell('A5').style = header;
  ws.mergeCells('C5:D5');
  ws.getCell('C5').value = data.orderDate;
  ws.getCell('C5').style = text;

  // 4) 상호명 · 담당자 레이블
  ws.getCell('A6').value = '상호명';
  ws.getCell('A6').style = text;
  ws.getCell('A7').value = '담당자';
  ws.getCell('A7').style = text;

  // 5) “아래와 같이 견적합니다” 병합 및 텍스트
  ws.mergeCells('D5:D9');
  ws.getCell('D5').value = '아래와 같이 견적합니다';
  ws.getCell('D5').style = text;
  for (let r = 6; r <= 9; r++) {
    ws.getCell(`D${r}`).style = text;
  }

  // 6) E5~E9: 왼쪽 라벨
  ['사업자등록번호', '상 호', '소 재 지', 'T E L', '홈페이지'].forEach((lbl, idx) => {
    const cell = ws.getCell(`E${5 + idx}`);
    cell.value = lbl;
    cell.style = text;
  });

  // 7) F5:I5 사업자등록번호
  ws.mergeCells('F5:I5');
  ws.getCell('F5').value = data.companyRegistrationNumber;
  ws.getCell('F5').style = text;

  // 8) F6 : 상호명
  ws.getCell('F6').value = data.companyName;
  ws.getCell('F6').style = text;

  // 9) G6:"대표자" / H6:I6:대표자명
  ws.getCell('G6').value = '대표자';
  ws.getCell('G6').style = text;
  ws.mergeCells('H6:I6');
  ws.getCell('H6').value = data.representative;
  ws.getCell('H6').style = text;

  // 10) F7:I7 : 주소
  ws.mergeCells('F7:I7');
  ws.getCell('F7').value = data.address;
  ws.getCell('F7').style = text;

  // 11) F8 : 전화번호 / G8: "FAX" / H8:I8 : 팩스번호
  ws.getCell('F8').value = data.phone;
  ws.getCell('F8').style = text;
  ws.getCell('G8').value = 'FAX';
  ws.getCell('G8').style = text;
  ws.mergeCells('H8:I8');
  ws.getCell('H8').value = data.fax;
  ws.getCell('H8').style = text;

  // 12) F9:I9 : 홈페이지
  ws.mergeCells('F9:I9');
  ws.getCell('F9').value = data.website;
  ws.getCell('F9').style = text;

  // 13) A10:C10 : 견적금액(부가세포함)
  ws.mergeCells('A10:C10');
  ws.getCell('A10').value = '견적금액(부가세포함)';
  ws.getCell('A10').style = header;

  // 14) “납기” 제거하고 표 머릿글 재배치
  ws.getCell('A17').value = 'NO';
  ws.getCell('A17').style = header;
  ws.mergeCells('B16:G16');
  ws.getCell('B16').value = '견적명세';
  ws.getCell('B16').style = header;

  ws.getCell('G17').value = '공급가';
  ws.getCell('G17').style = header;
  ws.getCell('H17').value = '비고';
  ws.getCell('H17').style = header;

  // 15) 아이템 데이터 매핑
  data.items.forEach((item, idx) => {
    const r = 17 + idx;
    ws.getCell(`A${r}`).value = idx + 1;
    ws.getCell(`A${r}`).style = text;

    ws.getCell(`B${r}`).value = item.name;
    ws.getCell(`B${r}`).style = text;

    ws.getCell(`C${r}`).value = item.spec;
    ws.getCell(`C${r}`).style = text;

    ws.getCell(`D${r}`).value = item.quantity;
    ws.getCell(`D${r}`).style = number;

    ws.getCell(`E${r}`).value = item.unitPrice;
    ws.getCell(`E${r}`).style = number;

    ws.getCell(`F${r}`).value = item.amount;
    ws.getCell(`F${r}`).style = number;

    ws.getCell(`G${r}`).value = item.supplyPrice;
    ws.getCell(`G${r}`).style = number;

    ws.getCell(`H${r}`).value = item.remarks || '';
    ws.getCell(`H${r}`).style = text;
  });

  // 16) 소계/부가세/합계 병합
  ws.mergeCells('C31:G31');
  ws.getCell('C31').value = '소계';
  ws.getCell('C31').style = text;
  ws.mergeCells('C32:G32');
  ws.getCell('C32').value = '부가가치세';
  ws.getCell('C32').style = text;
  ws.mergeCells('C33:G33');
  ws.getCell('C33').value = '합계';
  ws.getCell('C33').style = text;

  // 17) 전체 테두리 (A5:H62)
  for (let row = 5; row <= 62; row++) {
    for (let col = 1; col <= 8; col++) {
      const cell = ws.getCell(row, col);
      cell.style = { ...cell.style, ...allBorders };
    }
  }
}

/**
 * 거래명세서 레이아웃 : 견적서와 동일
 */
const setupTransactionLayout = setupEstimateLayout;

// named export
export const LayoutMapper = {
  setupEstimateLayout,
  setupTransactionLayout,
  setupPurchaseOrderLayout
};
