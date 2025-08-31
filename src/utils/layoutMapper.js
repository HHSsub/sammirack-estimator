// src/utils/layoutMapper.js

import { EXCEL_STYLES } from './excelStyles';

export class LayoutMapper {
  constructor(worksheet, documentType) {
    this.ws = worksheet;
    this.type = documentType; // 'estimate' | 'purchaseOrder' | 'transactionStatement'
  }

  /**
   * 컬럼 너비 설정
   */
  setupColumnWidths() {
    if (this.type === 'estimate') {
      this.ws.columns = [
        { header: '', key: 'A', width: 10 },
        { header: '', key: 'B', width: 15 },
        { header: '', key: 'C', width: 25 },
        { header: '', key: 'D', width: 20 },
        { header: '', key: 'E', width: 20 },
        { header: '', key: 'F', width: 20 },
        { header: '', key: 'G', width: 20 },
        { header: '', key: 'H', width: 20 },
        { header: '', key: 'I', width: 20 },
        { header: '', key: 'J', width: 20 },
      ];
    } else if (this.type === 'purchaseOrder') {
      this.ws.columns = [
        { header: '', key: 'A', width: 10 },
        { header: '', key: 'B', width: 15 },
        { header: '', key: 'C', width: 20 },
        { header: '', key: 'D', width: 20 },
        { header: '', key: 'E', width: 20 },
        { header: '', key: 'F', width: 20 },
        { header: '', key: 'G', width: 20 },
        { header: '', key: 'H', width: 20 },
      ];
    } else if (this.type === 'transactionStatement') {
      this.ws.columns = [
        { header: '', key: 'A', width: 12 },
        { header: '', key: 'B', width: 18 },
        { header: '', key: 'C', width: 25 },
        { header: '', key: 'D', width: 25 },
        { header: '', key: 'E', width: 15 },
        { header: '', key: 'F', width: 15 },
        { header: '', key: 'G', width: 15 },
        { header: '', key: 'H', width: 15 },
      ];
    }
  }

  /**
   * 내부 헬퍼: 중복 병합 방지 후 한 번에 mergeCells 실행
   */
  applyMerges(ranges) {
    ranges.forEach(range => {
      this.ws.unMergeCells(range);
      this.ws.mergeCells(range);
    });
  }

  /**
   * 견적서 레이아웃 구현
   */
  setupEstimateLayout(data) {
    const ws = this.ws;

    // 1) 상단 타이틀 & 회사 정보
    ws.getCell('A1').value = '견   적   서';
    ws.getCell('A1').style = EXCEL_STYLES.title;
    ws.getCell('A2').value = data.companyName;
    ws.getCell('A3').value = data.companyAddress;
    ws.getCell('A4').value = `전화: ${data.companyPhone}`;

    // 2) 고객 정보
    ws.getCell('H1').value = '견적일자';
    ws.getCell('I1').value = data.estimateDate;
    ws.getCell('H2').value = '고객명';
    ws.getCell('I2').value = data.clientName;
    ws.getCell('H3').value = '담당자';
    ws.getCell('I3').value = data.clientManager;
    ws.getCell('H4').value = '연락처';
    ws.getCell('I4').value = data.clientPhone;

    // 3) 항목 헤더
    ws.getCell('A6').value = 'No';
    ws.getCell('B6').value = '품명';
    ws.getCell('C6').value = '규격';
    ws.getCell('D6').value = '수량';
    ws.getCell('E6').value = '단가';
    ws.getCell('F6').value = '금액';

    // 4) 아이템 데이터 채우기
    data.items.forEach((item, idx) => {
      const r = 7 + idx;
      ws.getCell(`A${r}`).value = idx + 1;
      ws.getCell(`B${r}`).value = item.name;
      ws.getCell(`C${r}`).value = item.spec;
      ws.getCell(`D${r}`).value = item.quantity;
      ws.getCell(`E${r}`).value = item.unitPrice;
      ws.getCell(`F${r}`).value = { formula: `D${r}*E${r}` };
    });

    // 5) 합계 행
    const totalRow = 7 + data.items.length;
    ws.getCell(`E${totalRow}`).value = '합계';
    ws.getCell(`F${totalRow}`).value = { formula: `SUM(F7:F${totalRow - 1})` };

    // 6) 머지 범위 적용
    const estimateMerges = [
      'A1:F1', // 타이틀
      'A2:F2', 'A3:F3', 'A4:F4', // 회사 정보
      'H1:I1', 'H2:I2', 'H3:I3', 'H4:I4', // 고객 정보
      'A6:B6', 'C6:F6', // 헤더
      // 각 아이템 한줄당 품명/규격 영역 병합
      ...data.items.map((_, i) => `B${7 + i}:C${7 + i}`),
      // 합계 영역
      `A${totalRow}:E${totalRow}`, `F${totalRow}:F${totalRow}`,
    ];
    this.applyMerges(estimateMerges);
  }

  /**
   * 발주서 레이아웃 구현
   */
  setupPurchaseOrderLayout(data) {
    const ws = this.ws;

    // 1) 상단 타이틀 & 회사 정보
    ws.getCell('A1').value = '발   주   서';
    ws.getCell('A1').style = EXCEL_STYLES.title;
    ws.getCell('A2').value = data.companyName;
    ws.getCell('A3').value = data.companyAddress;
    ws.getCell('A4').value = `전화: ${data.companyPhone}`;

    // 2) 납품처 정보
    ws.getCell('H1').value = '발주일자';
    ws.getCell('I1').value = data.orderDate;
    ws.getCell('H2').value = '납품처';
    ws.getCell('I2').value = data.clientName;
    ws.getCell('H3').value = '담당자';
    ws.getCell('I3').value = data.clientManager;
    ws.getCell('H4').value = '연락처';
    ws.getCell('I4').value = data.clientPhone;

    // 3) 항목 헤더
    ws.getCell('A6').value = 'No';
    ws.getCell('B6').value = '품명';
    ws.getCell('C6').value = '규격';
    ws.getCell('D6').value = '수량';
    ws.getCell('E6').value = '단가';
    ws.getCell('F6').value = '금액';
    ws.getCell('G6').value = '비고';

    // 4) 아이템 데이터 채우기
    data.items.forEach((item, idx) => {
      const r = 7 + idx;
      ws.getCell(`A${r}`).value = idx + 1;
      ws.getCell(`B${r}`).value = item.name;
      ws.getCell(`C${r}`).value = item.spec;
      ws.getCell(`D${r}`).value = item.quantity;
      ws.getCell(`E${r}`).value = item.unitPrice;
      ws.getCell(`F${r}`).value = { formula: `D${r}*E${r}` };
      ws.getCell(`G${r}`).value = item.note || '';
    });

    // 5) 합계 행
    const totalRowPO = 7 + data.items.length;
    ws.getCell(`F${totalRowPO}`).value = '합계';
    ws.getCell(`G${totalRowPO}`).value = { formula: `SUM(F7:F${totalRowPO - 1})` };

    // 6) 머지 범위 적용
    const purchaseMerges = [
      'A1:G1',
      'A2:G2', 'A3:G3', 'A4:G4',
      'H1:I1', 'H2:I2', 'H3:I3', 'H4:I4',
      'A6:B6', 'C6:D6', 'E6:F6', 'G6:G6',
      ...data.items.map((_, i) => `B${7 + i}:C${7 + i}`),
      `A${totalRowPO}:E${totalRowPO}`, `F${totalRowPO}:F${totalRowPO}`, `G${totalRowPO}:G${totalRowPO}`,
    ];
    this.applyMerges(purchaseMerges);
  }

  /**
   * 거래명세서 레이아웃 구현
   */
  setupTransactionStatementLayout(data) {
    const ws = this.ws;

    // 1) 상단 타이틀 & 회사 정보
    ws.getCell('A1').value = '거래 명 세 서';
    ws.getCell('A1').style = EXCEL_STYLES.title;
    ws.getCell('A2').value = data.companyName;
    ws.getCell('A3').value = data.companyAddress;
    ws.getCell('A4').value = `전화: ${data.companyPhone}`;

    // 2) 거래처 정보
    ws.getCell('H1').value = '작성일자';
    ws.getCell('I1').value = data.statementDate;
    ws.getCell('H2').value = '거래처';
    ws.getCell('I2').value = data.clientName;
    ws.getCell('H3').value = '담당자';
    ws.getCell('I3').value = data.clientManager;
    ws.getCell('H4').value = '연락처';
    ws.getCell('I4').value = data.clientPhone;

    // 3) 항목 헤더
    ws.getCell('A6').value = 'No';
    ws.getCell('B6').value = '품명';
    ws.getCell('C6').value = '규격';
    ws.getCell('D6').value = '수량';
    ws.getCell('E6').value = '단가';
    ws.getCell('F6').value = '공급가액';
    ws.getCell('G6').value = '세액';
    ws.getCell('H6').value = '합계금액';

    // 4) 아이템 데이터 채우기
    data.items.forEach((item, idx) => {
      const r = 7 + idx;
      ws.getCell(`A${r}`).value = idx + 1;
      ws.getCell(`B${r}`).value = item.name;
      ws.getCell(`C${r}`).value = item.spec;
      ws.getCell(`D${r}`).value = item.quantity;
      ws.getCell(`E${r}`).value = item.unitPrice;
      ws.getCell(`F${r}`).value = { formula: `D${r}*E${r}` };
      ws.getCell(`G${r}`).value = { formula: `F${r}*0.1` };
      ws.getCell(`H${r}`).value = { formula: `F${r}+G${r}` };
    });

    // 5) 합계 행
    const totalRowTS = 7 + data.items.length;
    ws.getCell(`F${totalRowTS}`).value = '합계';
    ws.getCell(`G${totalRowTS}`).value = { formula: `SUM(G7:G${totalRowTS - 1})` };
    ws.getCell(`H${totalRowTS}`).value = { formula: `SUM(H7:H${totalRowTS - 1})` };

    // 6) 머지 범위 적용
    const transactionMerges = [
      'A1:H1',
      'A2:H2', 'A3:H3', 'A4:H4',
      'H1:I1', 'H2:I2', 'H3:I3', 'H4:I4',
      'A6:B6', 'C6:D6', 'E6:F6', 'G6:G6', 'H6:H6',
      ...data.items.map((_, i) => `B${7 + i}:C${7 + i}`),
      `A${totalRowTS}:E${totalRowTS}`, `F${totalRowTS}:F${totalRowTS}`, `G${totalRowTS}:G${totalRowTS}`, `H${totalRowTS}:H${totalRowTS}`,
    ];
    this.applyMerges(transactionMerges);
  }
}
