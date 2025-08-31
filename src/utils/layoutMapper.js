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
    this.mergedRanges = new Set(); // 병합된 범위를 추적
  }

  // 안전한 셀 병합 함수
  safeMergeCells(range) {
    if (this.mergedRanges.has(range)) {
      console.warn(`Range ${range} is already merged, skipping...`);
      return false;
    }
    
    try {
      this.ws.mergeCells(range);
      this.mergedRanges.add(range);
      return true;
    } catch (error) {
      if (error.message.includes('Cannot merge already merged cells')) {
        console.warn(`Cannot merge ${range}: already merged`);
        this.mergedRanges.add(range);
        return false;
      } else {
        console.error(`Error merging cells ${range}:`, error);
        throw error;
      }
    }
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
    
    // 병합 범위 초기화
    this.mergedRanges.clear();

    // 1) A1~A16 각각 B열과 병합
    for (let r = 1; r <= 16; r++) {
      this.safeMergeCells(`A${r}:B${r}`);
    }

    // 2) 기본 정보 영역
    ws.getCell('A5').value = '견적일자';            ws.getCell('A5').style = header;
    this.safeMergeCells('C5:D5');                   ws.getCell('C5').value = data.estimateDate;     ws.getCell('C5').style = text;

    ws.getCell('A6').value = '상호명';             ws.getCell('A6').style = text;
    ws.getCell('A7').value = '담당자';             ws.getCell('A7').style = text;

    // 3) "아래와 같이 견적합니다" 영역
    this.safeMergeCells('D5:D9');                   ws.getCell('D5').value = '아래와 같이 견적합니다'; ws.getCell('D5').style = text;
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
    this.safeMergeCells('F5:I5'); ws.getCell('F5').value = data.companyRegistrationNumber; ws.getCell('F5').style = text;
    ws.getCell('F6').value = data.companyName;    ws.getCell('F6').style = text;
    ws.getCell('G6').value = '대표자';             ws.getCell('G6').style = text;
    this.safeMergeCells('H6:I6'); ws.getCell('H6').value = data.representative;        ws.getCell('H6').style = text;

    this.safeMergeCells('F7:I7'); ws.getCell('F7').value = data.address;                ws.getCell('F7').style = text;
    ws.getCell('F8').value = data.phone;                                         ws.getCell('F8').style = text;
    ws.getCell('G8').value = 'FAX';                                              ws.getCell('G8').style = text;
    this.safeMergeCells('H8:I8'); ws.getCell('H8').value = data.fax;                   ws.getCell('H8').style = text;

    this.safeMergeCells('F9:I9'); ws.getCell('F9').value = data.website;               ws.getCell('F9').style = text;

    // 6) 합계 영역 머지
    this.safeMergeCells('A10:C10'); ws.getCell('A10').value = '견적금액(부가세포함)';   ws.getCell('A10').style = header;

    // 7) 테이블 타이틀
    ws.getCell('A17').value = 'NO';                                              ws.getCell('A17').style = header;
    this.safeMergeCells('B16:G16'); ws.getCell('B16').value = '견적명세';              ws.getCell('B16').style = header;

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
    
    // 병합 범위 초기화
    this.mergedRanges.clear();

    // 1) A1~A16 병합
    for (let r = 1; r <= 16; r++) {
      this.safeMergeCells(`A${r}:B${r}`);
    }

    // 2) 발주일자
    ws.getCell('A5').value = '발주일자';            ws.getCell('A5').style = header;
    this.safeMergeCells('C5:D5');                   ws.getCell('C5').value = data.date || data.orderDate;       ws.getCell('C5').style = text;

    // 3) 상호명 · 담당자
    ws.getCell('A6').value = '상호명';             ws.getCell('A6').style = text;
    ws.getCell('C6').value = data.companyName;     ws.getCell('C6').style = text;
    ws.getCell('A7').value = '담당자';             ws.getCell('A7').style = text;

    // 4) "아래와 같이 발주합니다"
    this.safeMergeCells('D5:D9');                   ws.getCell('D5').value = '아래와 같이 발주합니다'; ws.getCell('D5').style = text;
    for (let r = 6; r <= 9; r++) {
      ws.getCell(`D${r}`).style = text;
    }

    // 5) E5~E9 라벨 (회사 정보)
    ['사업자등록번호','상 호','소 재 지','T E L','홈페이지']
      .forEach((lbl, i) => {
        const cell = ws.getCell(`E${5 + i}`);
        cell.value = lbl;
        cell.style = text;
      });

    // 6) F5:I9 값 (회사 정보)
    this.safeMergeCells('F5:I5'); ws.getCell('F5').value = '123-45-67890'; ws.getCell('F5').style = text;
    ws.getCell('F6').value = '삼미앵글랙산업';    ws.getCell('F6').style = text;
    ws.getCell('G6').value = '대표자';             ws.getCell('G6').style = text;
    this.safeMergeCells('H6:I6'); ws.getCell('H6').value = '박이삭';        ws.getCell('H6').style = text;

    this.safeMergeCells('F7:I7'); ws.getCell('F7').value = '경기도 광명시 원노온사로 39, 철제 스틸하우스 1'; ws.getCell('F7').style = text;
    ws.getCell('F8').value = '010-9548-9578';     ws.getCell('F8').style = text;
    ws.getCell('G8').value = 'FAX';               ws.getCell('G8').style = text;
    this.safeMergeCells('H8:I8'); ws.getCell('H8').value = '(02)2611-4595'; ws.getCell('H8').style = text;

    this.safeMergeCells('F9:I9'); ws.getCell('F9').value = 'http://www.ssmake.com'; ws.getCell('F9').style = text;

    // 7) 합계 영역
    this.safeMergeCells('A10:C10'); ws.getCell('A10').value = '발주금액(부가세포함)';   ws.getCell('A10').style = header;

    // 8) 발주 명세 테이블 헤더
    ws.getCell('A17').value = 'NO';       ws.getCell('A17').style = header;
    ws.getCell('B17').value = '품명';     ws.getCell('B17').style = header;
    ws.getCell('C17').value = '단위';     ws.getCell('C17').style = header;
    ws.getCell('D17').value = '수량';     ws.getCell('D17').style = header;
    ws.getCell('E17').value = '단가';     ws.getCell('E17').style = header;
    ws.getCell('F17').value = '공급가';   ws.getCell('F17').style = header;
    ws.getCell('G17').value = '비고';     ws.getCell('G17').style = header;

    // 9) 발주 아이템 데이터
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, idx) => {
        const row = 18 + idx;
        ws.getCell(`A${row}`).value = idx + 1;           ws.getCell(`A${row}`).style = text;
        ws.getCell(`B${row}`).value = item.name || '';   ws.getCell(`B${row}`).style = text;
        ws.getCell(`C${row}`).value = item.unit || '';   ws.getCell(`C${row}`).style = text;
        ws.getCell(`D${row}`).value = item.quantity || 0; ws.getCell(`D${row}`).style = number;
        ws.getCell(`E${row}`).value = item.unitPrice || 0; ws.getCell(`E${row}`).style = number;
        ws.getCell(`F${row}`).value = item.totalPrice || 0; ws.getCell(`F${row}`).style = number;
        ws.getCell(`G${row}`).value = item.note || '';   ws.getCell(`G${row}`).style = text;
      });
    }

    // 10) 원자재 명세서 헤더 (아이템 테이블 아래)
    const materialStartRow = 25; // 아이템이 끝나는 지점 + 여백
    this.safeMergeCells(`A${materialStartRow}:H${materialStartRow}`); 
    ws.getCell(`A${materialStartRow}`).value = '원자재 명세서'; 
    ws.getCell(`A${materialStartRow}`).style = header;

    const materialHeaderRow = materialStartRow + 1;
    ws.getCell(`A${materialHeaderRow}`).value = 'NO';       ws.getCell(`A${materialHeaderRow}`).style = header;
    ws.getCell(`B${materialHeaderRow}`).value = '부품명';   ws.getCell(`B${materialHeaderRow}`).style = header;
    ws.getCell(`C${materialHeaderRow}`).value = '수량';     ws.getCell(`C${materialHeaderRow}`).style = header;
    ws.getCell(`D${materialHeaderRow}`).value = '단가';     ws.getCell(`D${materialHeaderRow}`).style = header;
    ws.getCell(`E${materialHeaderRow}`).value = '금액';     ws.getCell(`E${materialHeaderRow}`).style = header;
    ws.getCell(`F${materialHeaderRow}`).value = '비고';     ws.getCell(`F${materialHeaderRow}`).style = header;

    // 11) 원자재 데이터
    if (data.materials && data.materials.length > 0) {
      data.materials.forEach((material, idx) => {
        const row = materialHeaderRow + 1 + idx;
        ws.getCell(`A${row}`).value = idx + 1;                    ws.getCell(`A${row}`).style = text;
        ws.getCell(`B${row}`).value = material.name || '';        ws.getCell(`B${row}`).style = text;
        ws.getCell(`C${row}`).value = material.quantity || 0;     ws.getCell(`C${row}`).style = number;
        ws.getCell(`D${row}`).value = material.unitPrice || 0;    ws.getCell(`D${row}`).style = number;
        ws.getCell(`E${row}`).value = material.totalPrice || 0;   ws.getCell(`E${row}`).style = number;
        ws.getCell(`F${row}`).value = material.note || '';        ws.getCell(`F${row}`).style = text;
      });
    }

    // 12) 소계/부가세/합계 영역
    const totalStartRow = 35;
    this.safeMergeCells(`A${totalStartRow}:F${totalStartRow}`); 
    ws.getCell(`A${totalStartRow}`).value = '소계';     
    ws.getCell(`A${totalStartRow}`).style = text;
    ws.getCell(`G${totalStartRow}`).value = data.subtotal || 0; 
    ws.getCell(`G${totalStartRow}`).style = number;

    this.safeMergeCells(`A${totalStartRow + 1}:F${totalStartRow + 1}`); 
    ws.getCell(`A${totalStartRow + 1}`).value = '부가가치세'; 
    ws.getCell(`A${totalStartRow + 1}`).style = text;
    ws.getCell(`G${totalStartRow + 1}`).value = data.tax || 0; 
    ws.getCell(`G${totalStartRow + 1}`).style = number;

    this.safeMergeCells(`A${totalStartRow + 2}:F${totalStartRow + 2}`); 
    ws.getCell(`A${totalStartRow + 2}`).value = '합계'; 
    ws.getCell(`A${totalStartRow + 2}`).style = header;
    ws.getCell(`G${totalStartRow + 2}`).value = data.totalAmount || 0; 
    ws.getCell(`G${totalStartRow + 2}`).style = number;

    // 13) 전체 테두리 적용
    for (let r = 5; r <= 40; r++) {
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
