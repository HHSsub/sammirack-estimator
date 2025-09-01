// -----------------------------------------------
// src/utils/layoutMapper.js
// -----------------------------------------------

import { EXCEL_STYLES as styles } from './excelStyles';

const { header, text, number, allBorders } = styles;

/**
 * LayoutMapper 클래스
 * - setupEstimateLayout: 견적서 + 거래명세서 + 거래내역 레이아웃 구성
 * - setupPurchaseOrderLayout: 발주서 레이아웃 구성
 * - setupTransactionStatementLayout: 거래명세서만의 레이아웃 구성
 */
export class LayoutMapper {
  constructor(worksheet, documentType) {
    this.ws = worksheet;
    this.type = documentType; // 'estimate' | 'purchaseOrder' | 'transactionStatement'
    this.mergedRanges = new Set(); // 병합된 범위 추적
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
      console.error(`Failed to merge cells ${range}:`, error);
      return false;
    }
  }

  // 컬럼 너비 설정
  setupColumnWidths() {
    if (this.type === 'estimate') {
      // 견적서 컬럼 너비
      this.ws.getColumn('A').width = 5.0;
      this.ws.getColumn('B').width = 32.0;
      this.ws.getColumn('C').width = 15.0;
      this.ws.getColumn('D').width = 10.0;
      this.ws.getColumn('E').width = 15.0;
      // F~H열은 기본값
    } else if (this.type === 'purchaseOrder') {
      // 발주서 컬럼 너비
      this.ws.getColumn('A').width = 5.0;
      this.ws.getColumn('B').width = 30.0;
      this.ws.getColumn('C').width = 15.0;
      this.ws.getColumn('D').width = 10.0;
      this.ws.getColumn('E').width = 15.0;
      // F~H열은 기본값
    }
  }

  // 견적서 레이아웃 설정
  async setupEstimateLayout(data) {
    this.setupColumnWidths();
    
    // 행 높이 설정
    this.ws.getRow(9).height = 25.5;
    for (let i = 13; i <= 28; i++) {
      this.ws.getRow(i).height = 24.95;
    }
    this.ws.getRow(29).height = 30.0;
    this.ws.getRow(30).height = 30.0;
    this.ws.getRow(31).height = 30.0;

    // 헤더 영역 병합 및 설정
    this.setupEstimateHeader(data);
    
    // 견적 내역 테이블 설정
    this.setupEstimateTable(data);
    
    // 합계 영역 설정
    this.setupEstimateSummary(data);
    
    // 특기사항 설정
    this.setupEstimateNotes(data);
  }

  // 발주서 레이아웃 설정
  async setupPurchaseOrderLayout(data) {
    this.setupColumnWidths();
    
    // 행 높이 설정
    this.ws.getRow(7).height = 16.5;
    this.ws.getRow(8).height = 25.5;
    this.ws.getRow(9).height = 16.5;
    this.ws.getRow(56).height = 16.5;

    // 헤더 영역 설정
    this.setupPurchaseOrderHeader(data);
    
    // 발주 내역 테이블 설정
    this.setupPurchaseOrderTable(data);
    
    // 원자재 명세서 설정
    this.setupMaterialSpecification(data);
    
    // 특기사항 설정
    this.setupPurchaseOrderNotes(data);
  }

  // 거래명세서 레이아웃 설정
  async setupTransactionStatementLayout(data) {
    // 거래명세서 전용 레이아웃 구성
    // 기본적으로 견적서와 유사하지만 일부 차이점 있음
    
    this.setupColumnWidths();
    
    // 헤더 설정
    this.setupTransactionStatementHeader(data);
    
    // 거래 내역 테이블 설정
    this.setupTransactionTable(data);
    
    // 합계 및 특기사항 설정
    this.setupTransactionSummary(data);
  }

  // 견적서 헤더 설정
  setupEstimateHeader(data) {
    // A1:B1, A2:B2, A3:B3, A4:B4 병합
    this.safeMergeCells('A1:B1');
    this.safeMergeCells('A2:B2');
    this.safeMergeCells('A3:B3');
    this.safeMergeCells('A4:B4');
    
    // A5:H5 병합 (견적서 제목)
    this.safeMergeCells('A5:H5');
    this.ws.getCell('A5').value = '견적서';
    this.ws.getCell('A5').style = {
      ...styles.documentTitle,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
    };
    
    // A6:B6, A7:B7, A8:B8 병합
    this.safeMergeCells('A6:B6');
    this.safeMergeCells('A7:B7');
    this.safeMergeCells('A8:B8');
    
    // 발주업체 정보 (사용자 입력 데이터 활용)
    this.ws.getCell('A6').value = '발주업체';
    this.ws.getCell('A6').style = styles.companyInfo;
    this.ws.getCell('C6').value = data.companyName || '';
    
    this.ws.getCell('A7').value = '상호명';
    this.ws.getCell('A7').style = styles.companyInfo;
    this.ws.getCell('C7').value = data.companyName || '';
    
    this.ws.getCell('A8').value = '담당자';
    this.ws.getCell('A8').style = styles.companyInfo;
    this.ws.getCell('C8').value = data.manager || data.contactInfo || '';
    
    // D6:D10 병합
    this.safeMergeCells('D6:D10');
    
    // 우측 회사 정보 (고정 정보)
    this.ws.getCell('F6').value = '사업자등록번호';
    this.ws.getCell('G6').value = '232-81-01750';
    
    this.ws.getCell('F7').value = '상 호';
    this.ws.getCell('G7').value = '삼미랙특수산업';
    
    this.ws.getCell('F8').value = '소 재 지';
    this.ws.getCell('G8').value = '경기도 광명시 하안로 39 광명테크노파크 B동 1층';
    
    this.ws.getCell('F9').value = 'TEL';
    this.ws.getCell('G9').value = '010-9548-9578\n010-4311-7733';
    
    this.ws.getCell('F10').value = 'FAX';
    this.ws.getCell('G10').value = '(02)2611-4595';
    
    this.ws.getCell('F11').value = '홈페이지';
    this.ws.getCell('G11').value = 'http://www.ssmake.com';
    
    // A9:C10 병합 (인사말)
    this.safeMergeCells('A9:C10');
    this.ws.getCell('A9').value = '아래와 같이 발주합니다';
    this.ws.getCell('A9').style = styles.greeting;
  }

  // 견적서 테이블 설정
  setupEstimateTable(data) {
    // A11:H11 병합 (견적내역 제목)
    this.safeMergeCells('A11:H11');
    this.ws.getCell('A11').value = '견적내역';
    this.ws.getCell('A11').style = {
      ...styles.sectionTitle,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
    };
    
    // A11:H12 영역에 배경색 적용
    this.safeMergeCells('A12:H12');
    this.ws.getCell('A12').style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
    };
    
    // 테이블 헤더 (13행)
    this.ws.getCell('A13').value = 'NO';
    this.ws.getCell('B13').value = '품목';
    this.ws.getCell('C13').value = '단위';
    this.ws.getCell('D13').value = '수량';
    this.ws.getCell('E13').value = '단가';
    this.ws.getCell('F13').value = '공급가';
    
    // G13:H13 병합
    this.safeMergeCells('G13:H13');
    this.ws.getCell('G13').value = '비고';
    
    // 헤더 스타일 적용
    for (let col = 1; col <= 8; col++) {
      const cell = this.ws.getCell(13, col);
      cell.style = styles.header;
    }
    
    // 데이터 행 (14-25행) - 사용자 입력 데이터 활용
    const items = data.items || [];
    let totalAmount = 0;
    
    for (let i = 0; i < 12; i++) {
      const rowNum = 14 + i;
      const item = items[i];
      
      if (item) {
        this.ws.getCell(`A${rowNum}`).value = i + 1;
        this.ws.getCell(`B${rowNum}`).value = item.name || '';
        this.ws.getCell(`C${rowNum}`).value = item.unit || '개';
        this.ws.getCell(`D${rowNum}`).value = parseInt(item.quantity) || 1;
        this.ws.getCell(`E${rowNum}`).value = parseInt(item.unitPrice) || 0;
        this.ws.getCell(`F${rowNum}`).value = parseInt(item.totalPrice) || ((parseInt(item.quantity) || 1) * (parseInt(item.unitPrice) || 0));
        
        totalAmount += parseInt(item.totalPrice) || ((parseInt(item.quantity) || 1) * (parseInt(item.unitPrice) || 0));
      }
      
      // G행:H행 병합
      this.safeMergeCells(`G${rowNum}:H${rowNum}`);
      if (item && item.note) {
        this.ws.getCell(`G${rowNum}`).value = item.note;
      }
      
      // 테두리 적용
      for (let col = 1; col <= 8; col++) {
        const cell = this.ws.getCell(rowNum, col);
        cell.style = {
          ...styles.dataCell,
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

  // 견적서 합계 설정
  setupEstimateSummary(data) {
    // 사용자 입력 데이터에서 합계 정보 가져오기
    const totalAmount = data.subtotal || this.calculateTotalAmount(data.items || []);
    const vat = data.tax || Math.round(totalAmount * 0.1);
    const grandTotal = data.totalAmount || (totalAmount + vat);
    
    // A26:F26, A27:F27, A28:F28 병합
    this.safeMergeCells('A26:F26');
    this.safeMergeCells('A27:F27');
    this.safeMergeCells('A28:F28');
    
    // G26:H26, G27:H27, G28:H28 병합
    this.safeMergeCells('G26:H26');
    this.safeMergeCells('G27:H27');
    this.safeMergeCells('G28:H28');
    
    // 소계
    this.ws.getCell('A26').value = '소계';
    this.ws.getCell('A26').style = styles.totalRow;
    this.ws.getCell('G26').value = totalAmount;
    this.ws.getCell('G26').style = styles.totalAmount;
    
    // 부가가치세
    this.ws.getCell('A27').value = '부가가치세';
    this.ws.getCell('A27').style = styles.totalRow;
    this.ws.getCell('G27').value = vat;
    this.ws.getCell('G27').style = styles.totalAmount;
    
    // 합계
    this.ws.getCell('A28').value = '합계';
    this.ws.getCell('A28').style = styles.totalRow;
    this.ws.getCell('G28').value = grandTotal;
    this.ws.getCell('G28').style = styles.totalAmount;
  }

  // 견적서 특기사항 설정
  setupEstimateNotes(data) {
    // A29:H29, A30:H30, A31:H31 병합
    this.safeMergeCells('A29:H29');
    this.safeMergeCells('A30:H30');
    this.safeMergeCells('A31:H31');
    
    this.ws.getCell('A29').value = '특기사항';
    this.ws.getCell('A29').style = styles.notesTitle;
    
    this.ws.getCell('A30').value = data.notes || '';
    this.ws.getCell('A30').style = styles.notesContent;
    
    this.ws.getCell('A31').value = '(주)삼미랙특수산업';
    this.ws.getCell('A31').style = styles.companyName;
  }

  // 발주서 헤더 설정
  setupPurchaseOrderHeader(data) {
    // A1:B1, A2:B2, A3:B3 병합
    this.safeMergeCells('A1:B1');
    this.safeMergeCells('A2:B2');
    this.safeMergeCells('A3:B3');
    
    // A4:H4 병합 (발주서 제목)
    this.safeMergeCells('A4:H4');
    this.ws.getCell('A4').value = '발주서';
    this.ws.getCell('A4').style = {
      ...styles.documentTitle,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
    };
    
    // A5:B5, A6:B6, A7:B7 병합
    this.safeMergeCells('A5:B5');
    this.safeMergeCells('A6:B6');
    this.safeMergeCells('A7:B7');
    
    // A8:C9 병합 (인사말)
    this.safeMergeCells('A8:C9');
    this.ws.getCell('A8').value = '아래와 같이 발주합니다';
    this.ws.getCell('A8').style = styles.greeting;
    
    // D5:D9 병합
    this.safeMergeCells('D5:D9');
    
    // 발주업체 정보 (사용자 입력 데이터 활용)
    this.ws.getCell('A5').value = '발주업체';
    this.ws.getCell('A5').style = styles.companyInfo;
    this.ws.getCell('E5').value = data.companyName || '';
    
    this.ws.getCell('A6').value = '상호명';
    this.ws.getCell('A6').style = styles.companyInfo;
    this.ws.getCell('E6').value = data.companyName || '';
    
    this.ws.getCell('A7').value = '담당자';
    this.ws.getCell('A7').style = styles.companyInfo;
    this.ws.getCell('E7').value = data.manager || data.contactInfo || '';
    
    // F5:H5부터 F10:H10까지 우측 회사 정보 영역 병합
    for (let i = 5; i <= 10; i++) {
      this.safeMergeCells(`F${i}:H${i}`);
    }
    
    // 우측 회사 정보 (고정 정보)
    this.ws.getCell('F5').value = '사업자등록번호: 232-81-01750';
    this.ws.getCell('F6').value = '상 호: 삼미랙특수산업';
    this.ws.getCell('F7').value = '소 재 지: 경기도 광명시 하안로 39 광명테크노파크 B동 1층';
    this.ws.getCell('F8').value = 'TEL: 010-9548-9578 / 010-4311-7733';
    this.ws.getCell('F9').value = 'FAX: (02)2611-4595';
    this.ws.getCell('F10').value = '홈페이지: http://www.ssmake.com';
  }

  // 발주서 테이블 설정
  setupPurchaseOrderTable(data) {
    // A10:H10 병합 (발주내역 제목)
    this.safeMergeCells('A10:H10');
    this.ws.getCell('A10').value = '발주내역';
    this.ws.getCell('A10').style = styles.sectionTitle;
    
    // 테이블 헤더 (11행)
    this.ws.getCell('A11').value = 'NO';
    this.ws.getCell('B11').value = '품목';
    this.ws.getCell('C11').value = '단위';
    this.ws.getCell('D11').value = '수량';
    this.ws.getCell('E11').value = '단가';
    this.ws.getCell('F11').value = '공급가';
    
    // G11:H11 병합
    this.safeMergeCells('G11:H11');
    this.ws.getCell('G11').value = '비고';
    
    // A11:H12 영역에 배경색 적용
    this.safeMergeCells('A12:H12');
    this.ws.getCell('A12').style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
    };
    
    // 헤더 스타일 적용
    for (let col = 1; col <= 8; col++) {
      const cell = this.ws.getCell(11, col);
      cell.style = styles.header;
    }
    
    // 데이터 행 및 합계 설정 - 사용자 입력 데이터 활용
    const items = data.items || [];
    let totalAmount = 0;
    
    // 데이터 행 (12-19행)
    for (let i = 0; i < 8; i++) {
      const rowNum = 12 + i;
      const item = items[i];
      
      if (item) {
        this.ws.getCell(`A${rowNum}`).value = i + 1;
        this.ws.getCell(`B${rowNum}`).value = item.name || '';
        this.ws.getCell(`C${rowNum}`).value = item.unit || '개';
        this.ws.getCell(`D${rowNum}`).value = parseInt(item.quantity) || 1;
        this.ws.getCell(`E${rowNum}`).value = parseInt(item.unitPrice) || 0;
        this.ws.getCell(`F${rowNum}`).value = parseInt(item.totalPrice) || ((parseInt(item.quantity) || 1) * (parseInt(item.unitPrice) || 0));
        
        totalAmount += parseInt(item.totalPrice) || ((parseInt(item.quantity) || 1) * (parseInt(item.unitPrice) || 0));
      }
      
      // G행:H행 병합
      this.safeMergeCells(`G${rowNum}:H${rowNum}`);
      if (item && item.note) {
        this.ws.getCell(`G${rowNum}`).value = item.note;
      }
    }
    
    // 합계 행 (20-22행) - 사용자 입력 데이터 활용
    const vat = data.tax || Math.round(totalAmount * 0.1);
    const grandTotal = data.totalAmount || (totalAmount + vat);
    
    // A20:F20, A21:F21, A22:F22 병합
    this.safeMergeCells('A20:F20');
    this.safeMergeCells('A21:F21');
    this.safeMergeCells('A22:F22');
    
    // G20:H20, G21:H21, G22:H22 병합
    this.safeMergeCells('G20:H20');
    this.safeMergeCells('G21:H21');
    this.safeMergeCells('G22:H22');
    
    this.ws.getCell('A20').value = '소계';
    this.ws.getCell('A20').style = styles.totalRow;
    this.ws.getCell('G20').value = totalAmount;
    this.ws.getCell('G20').style = styles.totalAmount;
    
    this.ws.getCell('A21').value = '부가가치세';
    this.ws.getCell('A21').style = styles.totalRow;
    this.ws.getCell('G21').value = vat;
    this.ws.getCell('G21').style = styles.totalAmount;
    
    this.ws.getCell('A22').value = '합계';
    this.ws.getCell('A22').style = styles.totalRow;
    this.ws.getCell('G22').value = grandTotal;
    this.ws.getCell('G22').style = styles.totalAmount;
  }

  // 원자재 명세서 설정
  setupMaterialSpecification(data) {
    // 원자재 명세서 제목
    this.safeMergeCells('A23:H23');
    this.ws.getCell('A23').value = '원자재 명세서';
    this.ws.getCell('A23').style = {
      ...styles.documentTitle,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
    };
    
    // 테이블 헤더 (24행)
    this.ws.getCell('A24').value = 'NO';
    this.ws.getCell('B24').value = '품목명';
    this.ws.getCell('C24').value = '규격';
    this.ws.getCell('D24').value = '단위';
    this.ws.getCell('E24').value = '수량';
    this.ws.getCell('F24').value = '공급가';
    
    // G24:H24 병합
    this.safeMergeCells('G24:H24');
    this.ws.getCell('G24').value = '비고';
    
    // 헤더 스타일 적용
    for (let col = 1; col <= 8; col++) {
      const cell = this.ws.getCell(24, col);
      cell.style = styles.header;
    }
    
    // 원자재 데이터 (25-54행) - 기본 템플릿 사용
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
        this.ws.getCell(`A${rowNum}`).value = i + 1;
        this.ws.getCell(`B${rowNum}`).value = material.name;
        this.ws.getCell(`C${rowNum}`).value = material.spec;
        this.ws.getCell(`D${rowNum}`).value = material.unit;
        this.ws.getCell(`E${rowNum}`).value = material.quantity;
        this.ws.getCell(`F${rowNum}`).value = material.price;
      }
      
      // G행:H행 병합
      this.safeMergeCells(`G${rowNum}:H${rowNum}`);
    }
  }

  // 발주서 특기사항 설정
  setupPurchaseOrderNotes(data) {
    // A55:H55, A56:H56, A57:H57 병합
    this.safeMergeCells('A55:H55');
    this.safeMergeCells('A56:H56');
    this.safeMergeCells('A57:H57');
    
    this.ws.getCell('A55').value = '특기사항';
    this.ws.getCell('A55').style = styles.notesTitle;
    
    this.ws.getCell('A56').value = data.notes || '';
    this.ws.getCell('A56').style = styles.notesContent;
    
    this.ws.getCell('A57').value = '(주)삼미랙특수산업';
    this.ws.getCell('A57').style = styles.companyName;
  }

  // 거래명세서 헤더 설정
  setupTransactionStatementHeader(data) {
    // 거래명세서 전용 헤더 구성
    this.safeMergeCells('A1:H1');
    this.ws.getCell('A1').value = '거래명세서';
    this.ws.getCell('A1').style = styles.documentTitle;
    
    // 기본 회사 정보 설정 (사용자 입력 데이터 활용)
    this.ws.getCell('A2').value = '거래업체';
    this.ws.getCell('C2').value = data.companyName || '';
    
    this.ws.getCell('A3').value = '거래일자';
    this.ws.getCell('C3').value = data.date || new Date().toISOString().split('T')[0];
  }

  // 거래 테이블 설정
  setupTransactionTable(data) {
    // 거래 내역 테이블 구성
    this.safeMergeCells('A5:H5');
    this.ws.getCell('A5').value = '거래내역';
    this.ws.getCell('A5').style = styles.sectionTitle;
    
    // 테이블 헤더
    this.ws.getCell('A6').value = 'NO';
    this.ws.getCell('B6').value = '품목';
    this.ws.getCell('C6').value = '단위';
    this.ws.getCell('D6').value = '수량';
    this.ws.getCell('E6').value = '단가';
    this.ws.getCell('F6').value = '금액';
    this.safeMergeCells('G6:H6');
    this.ws.getCell('G6').value = '비고';
    
    // 헤더 스타일 적용
    for (let col = 1; col <= 8; col++) {
      const cell = this.ws.getCell(6, col);
      cell.style = styles.header;
    }
    
    // 데이터 행 설정 (사용자 입력 데이터 활용)
    const items = data.items || [];
    for (let i = 0; i < Math.max(items.length, 10); i++) {
      const rowNum = 7 + i;
      const item = items[i];
      
      if (item) {
        this.ws.getCell(`A${rowNum}`).value = i + 1;
        this.ws.getCell(`B${rowNum}`).value = item.name || '';
        this.ws.getCell(`C${rowNum}`).value = item.unit || '개';
        this.ws.getCell(`D${rowNum}`).value = parseInt(item.quantity) || 1;
        this.ws.getCell(`E${rowNum}`).value = parseInt(item.unitPrice) || 0;
        this.ws.getCell(`F${rowNum}`).value = parseInt(item.totalPrice) || ((parseInt(item.quantity) || 1) * (parseInt(item.unitPrice) || 0));
      }
      
      this.safeMergeCells(`G${rowNum}:H${rowNum}`);
      if (item && item.note) {
        this.ws.getCell(`G${rowNum}`).value = item.note;
      }
    }
  }

  // 거래명세서 합계 설정
  setupTransactionSummary(data) {
    // 사용자 입력 데이터에서 합계 정보 가져오기
    const totalAmount = data.subtotal || this.calculateTotalAmount(data.items || []);
    const vat = data.tax || Math.round(totalAmount * 0.1);
    const grandTotal = data.totalAmount || (totalAmount + vat);
    
    const summaryRow = 17; // 거래명세서 합계 시작 행
    
    this.safeMergeCells(`A${summaryRow}:E${summaryRow}`);
    this.ws.getCell(`A${summaryRow}`).value = '합계';
    this.ws.getCell(`A${summaryRow}`).style = styles.totalRow;
    
    this.safeMergeCells(`F${summaryRow}:H${summaryRow}`);
    this.ws.getCell(`F${summaryRow}`).value = grandTotal;
    this.ws.getCell(`F${summaryRow}`).style = styles.totalAmount;
    
    // 특기사항 (사용자 입력 데이터 활용)
    this.safeMergeCells(`A${summaryRow + 2}:H${summaryRow + 2}`);
    this.ws.getCell(`A${summaryRow + 2}`).value = '특기사항';
    this.ws.getCell(`A${summaryRow + 2}`).style = styles.notesTitle;
    
    this.safeMergeCells(`A${summaryRow + 3}:H${summaryRow + 3}`);
    this.ws.getCell(`A${summaryRow + 3}`).value = data.notes || '';
    this.ws.getCell(`A${summaryRow + 3}`).style = styles.notesContent;
  }

  // 총 금액 계산
  calculateTotalAmount(items) {
    return items.reduce((total, item) => {
      return total + (parseInt(item.totalPrice) || ((parseInt(item.quantity) || 1) * (parseInt(item.unitPrice) || 0)));
    }, 0);
  }
}
