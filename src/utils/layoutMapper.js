// ----------------------------------------------------------------------------
// src/utils/layoutMapper.js
// ----------------------------------------------------------------------------
import { EXCEL_STYLES as styles } from './excelStyles';

const { header, text, number, allBorders } = styles;

/**
 * LayoutMapper 클래스
 * - setupEstimateLayout: 견적서 + 거래명세서 공통 레이아웃
 * - setupPurchaseOrderLayout: 발주서 레이아웃
 * - setupTransactionStatementLayout: 거래명세서는 견적서 레이아웃 재활용
 */
export class LayoutMapper {
  constructor(worksheet, documentType) {
    this.ws = worksheet;
    this.type = documentType; // 'estimate' | 'purchaseOrder' | 'transactionStatement'
  }

  /** 컬럼 너비 설정 */
  setupColumnWidths() {
    if (this.type === 'estimate' || this.type === 'transactionStatement') {
      this.ws.columns = [
        { key: 'A', width: 5  }, // NO
        { key: 'B', width: 32 }, // 품목명
        { key: 'C', width: 15 }, // 규격
        { key: 'D', width: 10 }, // 수량
        { key: 'E', width: 15 }, // 단가
        { key: 'F', width: 15 }, // 공급가
        { key: 'G', width: 15 }, // 비고
      ];
    } else if (this.type === 'purchaseOrder') {
      this.ws.columns = [
        { key: 'A', width: 5  }, // NO
        { key: 'B', width: 30 }, // 품목명
        { key: 'C', width: 15 }, // 규격
        { key: 'D', width: 10 }, // 수량
        { key: 'E', width: 15 }, // 단가
        { key: 'F', width: 15 }, // 금액
        { key: 'G', width: 15 }, // 공급가
        { key: 'H', width: 15 }, // 비고
      ];
    }
  }

  /** 견적서 레이아웃 구현 */
  setupEstimateLayout(data) {
    const ws = this.ws;

    // 1) A1~A16 각각 B열과 병합
    for (let r = 1; r <= 16; r++) {
      ws.mergeCells(`A${r}:B${r}`);
    }

    // 2) 기본 정보 영역
    ws.getCell('A5').value = '견적일자';            ws.getCell('A5').style = header;
    ws.mergeCells('C5:D5');                       ws.getCell('C5').value = data.estimateDate;     ws.getCell('C5').style = text;

    ws.getCell('A6').value = '상호명';             ws.getCell('A6').style = text;
    ws.getCell('A7').value = '담당자';             ws.getCell('A7').style = text;

    // 3) “아래와 같이 견적합니다” 영역
    ws.mergeCells('D5:D9');                       ws.getCell('D5').value = '아래와 같이 견적합니다'; ws.getCell('D5').style = text;
    for (let r = 6; r <= 9; r++) {
      ws.getCell(`D${r}`).style = text;
    }

    // 4) 왼쪽 라벨 E5~E9
    ['사업자등록번호','상 호','소 재 지','T E L','홈페이지']
      .forEach((lbl, i) => {
        const cell = ws.getCell(`E${5 + i}`);
        cell.value = lbl;
        cell.style = text;
      });

    // 5) 오른쪽 값 F5~I9
    ws.mergeCells('F5:I5'); ws.getCell('F5').value = data.companyRegistrationNumber; ws.getCell('F5').style = text;
    ws.getCell('F6').value = data.companyName;    ws.getCell('F6').style = text;
    ws.getCell('G6').value = '대표자';             ws.getCell('G6').style = text;
    ws.mergeCells('H6:I6'); ws.getCell('H6').value = data.representative;        ws.getCell('H6').style = text;

    ws.mergeCells('F7:I7'); ws.getCell('F7').value = data.address;                ws.getCell('F7').style = text;
    ws.getCell('F8').value = data.phone;                                         ws.getCell('F8').style = text;
    ws.getCell('G8').value = 'FAX';                                              ws.getCell('G8').style = text;
    ws.mergeCells('H8:I8'); ws.getCell('H8').value = data.fax;                   ws.getCell('H8').style = text;

    ws.mergeCells('F9:I9'); ws.getCell('F9').value = data.website;               ws.getCell('F9').style = text;

    // 6) 합계 영역 머지
    ws.mergeCells('A10:C10'); ws.getCell('A10').value = '견적금액(부가세포함)';   ws.getCell('A10').style = header;

    // 7) 테이블 타이틀
    ws.getCell('A17').value = 'NO';                                              ws.getCell('A17').style = header;
    ws.mergeCells('B16:G16'); ws.getCell('B16').value = '견적명세';              ws.getCell('B16').style = header;

    // 8) 아이템 데이터 바인딩
    data.items.forEach((item, idx) => {
      const row = 17 + idx;

      ws.getCell(`A${row}`).value = idx + 1;   ws.getCell(`A${row}`).style = text;
      ws.getCell(`B${row}`).value = item.name; ws.getCell(`B${row}`).style = text;
      ws.getCell(`C${row}`).value = item.spec; ws.getCell(`C${row}`).style = text;
      ws.getCell(`D${row}`).value = item.quantity;  ws.getCell(`D${row}`).style = number;
      ws.getCell(`E${row}`).value = item.unitPrice; ws.getCell(`E${row}`).style = number;
      ws.getCell(`F${row}`).value = item.supplyAmount; ws.getCell(`F${row}`).style = number;
      ws.getCell(`G${row}`).value = item.remarks || ''; ws.getCell(`G${row}`).style = text;
    });

    // 9) 전체 테두리 (A5:G35)
    for (let r = 5; r <= 35; r++) {
      for (let c = 1; c <= 7; c++) {
        const cell = ws.getCell(r, c);
        cell.style = { ...cell.style, ...allBorders };
      }
    }
  }

  /** 발주서 레이아웃 세팅 */
  setupPurchaseOrderLayout(data) {
    const ws = this.ws;

    // 1) A1~A16 병합
    for (let r = 1; r <= 16; r++) {
      ws.mergeCells(`A${r}:B${r}`);
    }

    // 2) 발주일자
    ws.getCell('A5').value = '견적일자';            ws.getCell('A5').style = header;
    ws.mergeCells('C5:D5');                       ws.getCell('C5').value = data.orderDate;       ws.getCell('C5').style = text;

    // 3) 상호명 · 담당자
    ws.getCell('A6').value = '상호명';             ws.getCell('A6').style = text;
    ws.getCell('A7').value = '담당자';             ws.getCell('A7').style = text;

    // 4) “아래와 같이 견적합니다”
    ws.mergeCells('D5:D9');                       ws.getCell('D5').value = '아래와 같이 견적합니다'; ws.getCell('D5').style = text;
    for (let r = 6; r <= 9; r++) {
      ws.getCell(`D${r}`).style = text;
    }

    // 5) E5~E9 라벨
    ['사업자등록번호','상 호','소 재 지','T E L','홈페이지']
      .forEach((lbl, i) => {
        const cell = ws.getCell(`E${5 + i}`);
        cell.value = lbl;
        cell.style = text;
      });

    // 6) F5:I9 값
    ws.mergeCells('F5:I5'); ws.getCell('F5').value = data.companyRegistrationNumber; ws.getCell('F5').style = text;
    ws.getCell('F6').value = data.companyName;    ws.getCell('F6').style = text;
    ws.getCell('G6').value = '대표자';             ws.getCell('G6').style = text;
    ws.mergeCells('H6:I6'); ws.getCell('H6').value = data.representative;        ws.getCell('H6').style = text;

    ws.mergeCells('F7:I7'); ws.getCell('F7').value = data.address;                ws.getCell('F7').style = text;
    ws.getCell('F8').value = data.phone;                                         ws.getCell('F8').style = text;
    ws.getCell('G8').value = 'FAX';                                              ws.getCell('G8').style = text;
    ws.mergeCells('H8:I8'); ws.getCell('H8').value = data.fax;                   ws.getCell('H8').style = text;

    ws.mergeCells('F9:I9'); ws.getCell('F9').value = data.website;               ws.getCell('F9').style = text;

    // 7) 합계 영역
    ws.mergeCells('A10:C10'); ws.getCell('A10').value = '견적금액(부가세포함)';   ws.getCell('A10').style = header;

    // 8) 테이블 타이틀
    ws.getCell('A17').value = 'NO';                                              ws.getCell('A17').style = header;
    ws.mergeCells('B16:G16'); ws.getCell('B16').value = '견적명세';              ws.getCell('B16').style = header;
    ws.getCell('G17').value = '공급가';                                          ws.getCell('G17').style = header;
    ws.getCell('H17').value = '비고';                                            ws.getCell('H17').style = header;

    // 9) 데이터 바인딩
    data.items.forEach((item, idx) => {
      const row = 17 + idx;
      ws.getCell(`A${row}`).value = idx + 1;        ws.getCell(`A${row}`).style = text;
      ws.getCell(`B${row}`).value = item.name;      ws.getCell(`B${row}`).style = text;
      ws.getCell(`C${row}`).value = item.spec;      ws.getCell(`C${row}`).style = text;
      ws.getCell(`D${row}`).value = item.quantity;  ws.getCell(`D${row}`).style = number;
      ws.getCell(`E${row}`).value = item.unitPrice; ws.getCell(`E${row}`).style = number;
      ws.getCell(`F${row}`).value = item.amount;    ws.getCell(`F${row}`).style = number;
      ws.getCell(`G${row}`).value = item.supplyPrice; ws.getCell(`G${row}`).style = number;
      ws.getCell(`H${row}`).value = item.remarks || ''; ws.getCell(`H${row}`).style = text;
    });

    // 10) 소계/부가세/합계 영역 머지
    ws.mergeCells('C31:G31'); ws.getCell('C31').value = '소계';         ws.getCell('C31').style = text;
    ws.mergeCells('C32:G32'); ws.getCell('C32').value = '부가가치세'; ws.getCell('C32').style = text;
    ws.mergeCells('C33:G33'); ws.getCell('C33').value = '합계';         ws.getCell('C33').style = text;

    // 11) 전체 테두리 (A5:H62)
    for (let r = 5; r <= 62; r++) {
      for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(r, c);
        cell.style = { ...cell.style, ...allBorders };
      }
    }
  }

  /** 거래명세서 레이아웃은 견적서와 동일하게 재활용 */
  setupTransactionStatementLayout(data) {
    this.setupEstimateLayout(data);
  }
}
