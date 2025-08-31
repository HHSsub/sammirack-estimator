// 웹 레이아웃을 Excel 레이아웃으로 매핑하는 유틸리티
import { EXCEL_STYLES, COLUMN_WIDTHS, ROW_HEIGHTS } from './excelStyles';

export class LayoutMapper {
  constructor(worksheet, documentType) {
    this.worksheet = worksheet;
    this.documentType = documentType; // 'estimate', 'purchaseOrder', 'transactionStatement'
    this.currentRow = 1;
  }

  /**
   * 컬럼 너비 설정
   */
  setupColumnWidths() {
    const widths = COLUMN_WIDTHS[this.documentType] || COLUMN_WIDTHS.estimate;
    Object.entries(widths).forEach(([column, width]) => {
      this.worksheet.getColumn(column).width = width;
    });
  }

  /**
   * 견적서 레이아웃 구현
   */
  setupEstimateLayout(data) {
    const ws = this.worksheet;

    // 1. 제목(견적서): 병합 셀 B4:G4, 중앙 정렬, 큰 글씨, 연한색 배경
    ws.mergeCells("B4:G4");
    const titleCell = ws.getCell("B4");
    titleCell.value = "견 적 서";
    Object.assign(titleCell, EXCEL_STYLES.documentTitle);

    // A5셀 "견적일자" 텍스트
    ws.getCell("A5").value = "견적일자";
    Object.assign(ws.getCell("A5"), EXCEL_STYLES.text);

    // 견적일자 날짜 -> C5:D5까지 셀병합해서 공간차지
    ws.mergeCells("C5:D5");
    ws.getCell("C5").value = data.estimateDate; // data.estimateDate 변수 사용
    Object.assign(ws.getCell("C5"), EXCEL_STYLES.text);

    // 상호명,담당자 -> 각각 A6,A7칸에 위치할 수 있도록
    ws.getCell("A6").value = "상호명";
    Object.assign(ws.getCell("A6"), EXCEL_STYLES.text);
    ws.getCell("A7").value = "담당자";
    Object.assign(ws.getCell("A7"), EXCEL_STYLES.text);

    // D5:D9 -> "아래와 같이 견적합니다"
    ws.mergeCells("D5:D9");
    ws.getCell("D5").value = "아래와 같이 견적합니다";
    Object.assign(ws.getCell("D5"), EXCEL_STYLES.text);

    // E5:E9 -> 5개의 칸 각각 "사업자등록번호", "상 호", "소 재 지", "T E L", "홈페이지" 가 들어갈 수 있도록
    ws.getCell("E5").value = "사업자등록번호";
    Object.assign(ws.getCell("E5"), EXCEL_STYLES.text);
    ws.getCell("E6").value = "상 호";
    Object.assign(ws.getCell("E6"), EXCEL_STYLES.text);
    ws.getCell("E7").value = "소 재 지";
    Object.assign(ws.getCell("E7"), EXCEL_STYLES.text);
    ws.getCell("E8").value = "T E L";
    Object.assign(ws.getCell("E8"), EXCEL_STYLES.text);
    ws.getCell("E9").value = "홈페이지";
    Object.assign(ws.getCell("E9"), EXCEL_STYLES.text);

    // F5:I5 -> 4개의 셀 병합하여, "232 - 81 - 01750" 값이 들어가 있을 수 있도록
    ws.mergeCells("F5:I5");
    ws.getCell("F5").value = "232 - 81 - 01750";
    Object.assign(ws.getCell("F5"), EXCEL_STYLES.text);

    // F6 -> "삼미앵글랙산업"이란 값이 들어가 있도록
    ws.getCell("F6").value = "삼미앵글랙산업";
    Object.assign(ws.getCell("F6"), EXCEL_STYLES.text);

    // G6,H6 -> 각각 "대표자", "박이삭"이란값이 들어가 있도록
    ws.getCell("G6").value = "대표자";
    Object.assign(ws.getCell("G6"), EXCEL_STYLES.text);
    ws.getCell("H6").value = "박이삭";
    Object.assign(ws.getCell("H6"), EXCEL_STYLES.text);

    // F7:I7 -> 4개의 셀 병합하여, "경기도 광명시 원노온사로 39, 철제 스틸하우스 1" 값이 들어가 있을 수 있도록
    ws.mergeCells("F7:I7");
    ws.getCell("F7").value = "경기도 광명시 원노온사로 39, 철제 스틸하우스 1";
    Object.assign(ws.getCell("F7"), EXCEL_STYLES.text);

    // F8,G8 -> 각각 "010-9548-9578  010-4311-7733", "FAX"이란 값이 들어가 있도록
    ws.getCell("F8").value = "010-9548-9578  010-4311-7733";
    Object.assign(ws.getCell("F8"), EXCEL_STYLES.text);
    ws.getCell("G8").value = "FAX";
    Object.assign(ws.getCell("G8"), EXCEL_STYLES.text);

    // H8:I8 -> 2개의 셀 병합하여, "(02)2611-4595"이란 값이 들어가 있도록
    ws.mergeCells("H8:I8");
    ws.getCell("H8").value = "(02)2611-4595";
    Object.assign(ws.getCell("H8"), EXCEL_STYLES.text);

    // F9:I9 -> "http://www.ssmake.com"이란 값이 들어가 있도록
    ws.mergeCells("F9:I9");
    ws.getCell("F9").value = "http://www.ssmake.com";
    Object.assign(ws.getCell("F9"), EXCEL_STYLES.text);

    // A10:C10 -> 3개의 셀 병합하여, "견적금액(부가세포함)"이란 값이 들어가 있도록
    ws.mergeCells("A10:C10");
    ws.getCell("A10").value = "견적금액(부가세포함)";
    Object.assign(ws.getCell("A10"), EXCEL_STYLES.text);

    // B16:G16 -> 병합셀에 "금액명세"란 값이 아니라, "견적명세"란 값이 사용되도록
    ws.mergeCells("B16:G16");
    ws.getCell("B16").value = "견적명세";
    Object.assign(ws.getCell("B16"), EXCEL_STYLES.headerCell);

    // B18품목명 -> 제목이 가려지지않도록, 열너비가 32가 되도록
    ws.getColumn("B").width = 32;

    // A17 -> "NO"라는 칼럼밸류가 들어가있도록,
    ws.getCell("A17").value = "NO";
    Object.assign(ws.getCell("A17"), EXCEL_STYLES.headerCell);

    // A1:A16 -> 각각, 바로 우측에 있는 셀과 병합되어지도록 (빈칸으로 남아있지 않도록)
    for (let i = 1; i <= 16; i++) {
      ws.mergeCells(`A${i}:B${i}`);
    }

    // 데이터 테이블 헤더 (A17부터 시작)
    const headers = [
      { key: "no", header: "NO", width: 5 },
      { key: "itemName", header: "품목명", width: 32 },
      { key: "standard", header: "규격", width: 15 },
      { key: "unit", header: "단위", width: 8 },
      { key: "quantity", header: "수량", width: 8 },
      { key: "unitPrice", header: "단가", width: 12 },
      { key: "amount", header: "금액", width: 15 },
    ];

    let currentHeaderRow = 17;
    headers.forEach((header, index) => {
      const cell = ws.getCell(currentHeaderRow, index + 1);
      cell.value = header.header;
      Object.assign(cell, EXCEL_STYLES.headerCell);
      if (header.width) {
        ws.getColumn(index + 1).width = header.width;
      }
    });

    // 데이터 행 추가
    let currentRow = currentHeaderRow + 1;
    data.items.forEach((item, index) => {
      ws.getCell(currentRow, 1).value = index + 1;
      Object.assign(ws.getCell(currentRow, 1), EXCEL_STYLES.dataCell);

      ws.getCell(currentRow, 2).value = item.itemName;
      Object.assign(ws.getCell(currentRow, 2), EXCEL_STYLES.dataCell);

      ws.getCell(currentRow, 3).value = item.standard;
      Object.assign(ws.getCell(currentRow, 3), EXCEL_STYLES.dataCell);

      ws.getCell(currentRow, 4).value = item.unit;
      Object.assign(ws.getCell(currentRow, 4), EXCEL_STYLES.dataCell);

      ws.getCell(currentRow, 5).value = item.quantity;
      Object.assign(ws.getCell(currentRow, 5), EXCEL_STYLES.number);

      ws.getCell(currentRow, 6).value = item.unitPrice;
      Object.assign(ws.getCell(currentRow, 6), EXCEL_STYLES.number);

      ws.getCell(currentRow, 7).value = item.amount;
      Object.assign(ws.getCell(currentRow, 7), EXCEL_STYLES.number);

      currentRow++;
    });

    // 소계, 부가가치세, 합계
    ws.mergeCells(`A${currentRow}:F${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "소계";
    Object.assign(ws.getCell(`A${currentRow}`), EXCEL_STYLES.headerCell);
    ws.getCell(`G${currentRow}`).value = data.subTotal;
    Object.assign(ws.getCell(`G${currentRow}`), EXCEL_STYLES.number);
    currentRow++;

    ws.mergeCells(`A${currentRow}:F${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "부가가치세";
    Object.assign(ws.getCell(`A${currentRow}`), EXCEL_STYLES.headerCell);
    ws.getCell(`G${currentRow}`).value = data.vat;
    Object.assign(ws.getCell(`G${currentRow}`), EXCEL_STYLES.number);
    currentRow++;

    ws.mergeCells(`A${currentRow}:F${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "합계";
    Object.assign(ws.getCell(`A${currentRow}`), EXCEL_STYLES.totalAmount);
    ws.getCell(`G${currentRow}`).value = data.totalAmount;
    Object.assign(ws.getCell(`G${currentRow}`), EXCEL_STYLES.totalAmount);
    currentRow++;

    // 비고
    ws.mergeCells(`A${currentRow}:G${currentRow + 4}`);
    ws.getCell(`A${currentRow}`).value = "비고";
    Object.assign(ws.getCell(`A${currentRow}`), EXCEL_STYLES.headerCell);
    ws.getCell(`A${currentRow + 1}`).value = data.remarks;
    Object.assign(ws.getCell(`A${currentRow + 1}`), EXCEL_STYLES.text);

    // 서명/도장 영역
    ws.mergeCells(`G${currentRow + 1}:H${currentRow + 3}`);
    Object.assign(ws.getCell(`G${currentRow + 1}`), EXCEL_STYLES.signatureArea);
  }

  /**
   * 발주서 레이아웃 구현
   */
  setupPurchaseOrderLayout(data) {
    const ws = this.worksheet;

    // 1. 제목(발주서): 병합 셀 B4:G4, 중앙 정렬, 큰 글씨, 연한색 배경
    ws.mergeCells("B4:G4");
    const titleCell = ws.getCell("B4");
    titleCell.value = "발 주 서";
    Object.assign(titleCell, EXCEL_STYLES.documentTitle);

    // A5셀 "견적일자" 텍스트
    ws.getCell("A5").value = "견적일자";
    Object.assign(ws.getCell("A5"), EXCEL_STYLES.text);

    // 견적일자 날짜 -> C5:D5까지 셀병합해서 공간차지
    ws.mergeCells("C5:D5");
    ws.getCell("C5").value = data.orderDate; // data.orderDate 변수 사용
    Object.assign(ws.getCell("C5"), EXCEL_STYLES.text);

    // 상호명,담당자 -> 각각 A6,A7칸에 위치할 수 있도록
    ws.getCell("A6").value = "상호명";
    Object.assign(ws.getCell("A6"), EXCEL_STYLES.text);
    ws.getCell("A7").value = "담당자";
    Object.assign(ws.getCell("A7"), EXCEL_STYLES.text);

    // D5:D9 -> "아래와 같이 견적합니다" (발주서에서는 "아래와 같이 발주합니다"로 변경)
    ws.mergeCells("D5:D9");
    ws.getCell("D5").value = "아래와 같이 발주합니다";
    Object.assign(ws.getCell("D5"), EXCEL_STYLES.text);

    // E5:E9 -> 5개의 칸 각각 "사업자등록번호", "상 호", "소 재 지", "T E L", "홈페이지" 가 들어갈 수 있도록
    ws.getCell("E5").value = "사업자등록번호";
    Object.assign(ws.getCell("E5"), EXCEL_STYLES.text);
    ws.getCell("E6").value = "상 호";
    Object.assign(ws.getCell("E6"), EXCEL_STYLES.text);
    ws.getCell("E7").value = "소 재 지";
    Object.assign(ws.getCell("E7"), EXCEL_STYLES.text);
    ws.getCell("E8").value = "T E L";
    Object.assign(ws.getCell("E8"), EXCEL_STYLES.text);
    ws.getCell("E9").value = "홈페이지";
    Object.assign(ws.getCell("E9"), EXCEL_STYLES.text);

    // F5:I5 -> 4개의 셀 병합하여, "232 - 81 - 01750" 값이 들어가 있을 수 있도록
    ws.mergeCells("F5:I5");
    ws.getCell("F5").value = "232 - 81 - 01750";
    Object.assign(ws.getCell("F5"), EXCEL_STYLES.text);

    // F6 -> "삼미앵글랙산업"이란 값이 들어가 있도록
    ws.getCell("F6").value = "삼미앵글랙산업";
    Object.assign(ws.getCell("F6"), EXCEL_STYLES.text);

    // G6,H6 -> 각각 "대표자", "박이삭"이란값이 들어가 있도록
    ws.getCell("G6").value = "대표자";
    Object.assign(ws.getCell("G6"), EXCEL_STYLES.text);
    ws.getCell("H6").value = "박이삭";
    Object.assign(ws.getCell("H6"), EXCEL_STYLES.text);

    // F7:I7 -> 4개의 셀 병합하여, "경기도 광명시 원노온사로 39, 철제 스틸하우스 1" 값이 들어가 있을 수 있도록
    ws.mergeCells("F7:I7");
    ws.getCell("F7").value = "경기도 광명시 원노온사로 39, 철제 스틸하우스 1";
    Object.assign(ws.getCell("F7"), EXCEL_STYLES.text);

    // F8,G8 -> 각각 "010-9548-9578  010-4311-7733", "FAX"이란 값이 들어가 있도록
    ws.getCell("F8").value = "010-9548-9578  010-4311-7733";
    Object.assign(ws.getCell("F8"), EXCEL_STYLES.text);
    ws.getCell("G8").value = "FAX";
    Object.assign(ws.getCell("G8"), EXCEL_STYLES.text);

    // H8:I8 -> 2개의 셀 병합하여, "(02)2611-4595"이란 값이 들어가 있도록
    ws.mergeCells("H8:I8");
    ws.getCell("H8").value = "(02)2611-4595";
    Object.assign(ws.getCell("H8"), EXCEL_STYLES.text);

    // F9:I9 -> "http://www.ssmake.com"이란 값이 들어가 있도록
    ws.mergeCells("F9:I9");
    ws.getCell("F9").value = "http://www.ssmake.com";
    Object.assign(ws.getCell("F9"), EXCEL_STYLES.text);

    // A10:C10 -> 3개의 셀 병합하여, "견적금액(부가세포함)"이란 값이 들어가 있도록
    ws.mergeCells("A10:C10");
    ws.getCell("A10").value = "견적금액(부가세포함)";
    Object.assign(ws.getCell("A10"), EXCEL_STYLES.text);

    // "납기"라는 칸자체를 없애고, 비고를 좌측으로 당길것
    // 발주서의 헤더 정의 (납기 제거)
    const poHeaders = [
      { key: "no", header: "NO", width: 5 },
      { key: "itemName", header: "품목명", width: 32 },
      { key: "standard", header: "규격", width: 15 },
      { key: "unit", header: "단위", width: 8 },
      { key: "quantity", header: "수량", width: 8 },
      { key: "unitPrice", header: "단가", width: 12 },
      { key: "supplyAmount", header: "공급가", width: 15 }, // G17 "공급가" 사용
      { key: "remarks", header: "비고", width: 15 }, // 비고 좌측으로 당김
    ];

    let currentPOHeaderRow = 17;
    poHeaders.forEach((header, index) => {
      const cell = ws.getCell(currentPOHeaderRow, index + 1);
      cell.value = header.header;
      Object.assign(cell, EXCEL_STYLES.headerCell);
      if (header.width) {
        ws.getColumn(index + 1).width = header.width;
      }
    });

    // 데이터 행 추가
    let currentPORow = currentPOHeaderRow + 1;
    data.items.forEach((item, index) => {
      ws.getCell(currentPORow, 1).value = index + 1;
      Object.assign(ws.getCell(currentPORow, 1), EXCEL_STYLES.dataCell);

      ws.getCell(currentPORow, 2).value = item.itemName;
      Object.assign(ws.getCell(currentPORow, 2), EXCEL_STYLES.dataCell);

      ws.getCell(currentPORow, 3).value = item.standard;
      Object.assign(ws.getCell(currentPORow, 3), EXCEL_STYLES.dataCell);

      ws.getCell(currentPORow, 4).value = item.unit;
      Object.assign(ws.getCell(currentPORow, 4), EXCEL_STYLES.dataCell);

      ws.getCell(currentPORow, 5).value = item.quantity;
      Object.assign(ws.getCell(currentPORow, 5), EXCEL_STYLES.number);

      ws.getCell(currentPORow, 6).value = item.unitPrice;
      Object.assign(ws.getCell(currentPORow, 6), EXCEL_STYLES.number);

      ws.getCell(currentPORow, 7).value = item.supplyAmount; // 공급가
      Object.assign(ws.getCell(currentPORow, 7), EXCEL_STYLES.number);

      ws.getCell(currentPORow, 8).value = item.remarks; // 비고
      Object.assign(ws.getCell(currentPORow, 8), EXCEL_STYLES.dataCell);

      currentPORow++;
    });

    // 소계, 부가가치세, 합계
    // G31:H33 -> "소계"는 C31:G31까지 셀 병합하여 공간차지, "부가가치세"는 C32:G32까지 셀 병합하여 공간차지, "합계"는 C33:G33까지 셀 병합하여 공간차지
    ws.mergeCells(`C${currentPORow}:G${currentPORow}`);
    ws.getCell(`C${currentPORow}`).value = "소계";
    Object.assign(ws.getCell(`C${currentPORow}`), EXCEL_STYLES.headerCell);
    ws.getCell(`H${currentPORow}`).value = data.subTotal;
    Object.assign(ws.getCell(`H${currentPORow}`), EXCEL_STYLES.number);
    currentPORow++;

    ws.mergeCells(`C${currentPORow}:G${currentPORow}`);
    ws.getCell(`C${currentPORow}`).value = "부가가치세";
    Object.assign(ws.getCell(`C${currentPORow}`), EXCEL_STYLES.headerCell);
    ws.getCell(`H${currentPORow}`).value = data.vat;
    Object.assign(ws.getCell(`H${currentPORow}`), EXCEL_STYLES.number);
    currentPORow++;

    ws.mergeCells(`C${currentPORow}:G${currentPORow}`);
    ws.getCell(`C${currentPORow}`).value = "합계";
    Object.assign(ws.getCell(`C${currentPORow}`), EXCEL_STYLES.totalAmount);
    ws.getCell(`H${currentPORow}`).value = data.totalAmount;
    Object.assign(ws.getCell(`H${currentPORow}`), EXCEL_STYLES.totalAmount);
    currentPORow++;

    // 서명/도장 영역
    ws.mergeCells(`G${currentPORow + 1}:H${currentPORow + 3}`);
    Object.assign(ws.getCell(`G${currentPORow + 1}`), EXCEL_STYLES.signatureArea);
  }

  /**
   * 거래명세서 레이아웃 구현
   */
  setupTransactionStatementLayout(data) {
    const ws = this.worksheet;

    // TODO: Implement transaction statement layout
  }

  // 헬퍼 함수: 컬럼명(예: 'A')을 인덱스(0부터 시작)로 변환
  getColumnIndex(col) {
    return col.charCodeAt(0) - 65;
  }

  // 헬퍼 함수: 행 번호(예: '1')를 인덱스(0부터 시작)로 변환
  getRowIndex(row) {
    return parseInt(row) - 1;
  }
}

export const COLUMN_WIDTHS = {
  estimate: {
    A: 5,
    B: 32,
    C: 15,
    D: 10,
    E: 15,
    F: 15,
    G: 15,
    H: 15,
    I: 15,
  },
  purchaseOrder: {
    A: 5,
    B: 32,
    C: 15,
    D: 10,
    E: 15,
    F: 15,
    G: 15,
    H: 15,
    I: 15,
  },
  transactionStatement: {
    // Define widths for transaction statement
  },
};

export const ROW_HEIGHTS = {
  // Define row heights if needed
};
