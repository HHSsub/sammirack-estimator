// 웹 레이아웃을 Excel 레이아웃으로 매핑하는 유틸리티

import { EXCEL_STYLES, COLUMN_WIDTHS, ROW_HEIGHTS } from './excelStyles.js';

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
   * 문서 제목 추가 (견적서/발주서/거래명세서)
   */
  addDocumentTitle(title, logoSpace = true) {
    const startRow = logoSpace ? 5 : 1;
    this.currentRow = startRow;

    // 제목 행 병합
    this.worksheet.mergeCells(`A${startRow}:H${startRow}`);
    
    const titleCell = this.worksheet.getCell(`A${startRow}`);
    titleCell.value = title;
    Object.assign(titleCell, EXCEL_STYLES.documentTitle);
    
    // 행 높이 설정
    this.worksheet.getRow(startRow).height = ROW_HEIGHTS.title;
    
    this.currentRow++;
    return startRow;
  }

  /**
   * 회사 정보 섹션 추가
   */
  addCompanyInfo(companyData) {
    this.currentRow++; // 빈 행 추가
    
    const infoStartRow = this.currentRow;
    
    // 회사명
    this.worksheet.getCell(`A${this.currentRow}`).value = '회사명:';
    this.worksheet.getCell(`B${this.currentRow}`).value = companyData.name || '';
    Object.assign(this.worksheet.getCell(`A${this.currentRow}`), EXCEL_STYLES.companyInfo);
    
    this.currentRow++;
    
    // 주소
    this.worksheet.getCell(`A${this.currentRow}`).value = '주소:';
    this.worksheet.getCell(`B${this.currentRow}`).value = companyData.address || '';
    Object.assign(this.worksheet.getCell(`A${this.currentRow}`), EXCEL_STYLES.companyInfo);
    
    this.currentRow++;
    
    // 연락처
    this.worksheet.getCell(`A${this.currentRow}`).value = '연락처:';
    this.worksheet.getCell(`B${this.currentRow}`).value = companyData.phone || '';
    Object.assign(this.worksheet.getCell(`A${this.currentRow}`), EXCEL_STYLES.companyInfo);
    
    this.currentRow++;
    
    // 날짜 (우측 상단)
    this.worksheet.getCell(`F${infoStartRow}`).value = '작성일:';
    this.worksheet.getCell(`G${infoStartRow}`).value = new Date();
    Object.assign(this.worksheet.getCell(`G${infoStartRow}`), EXCEL_STYLES.date);
    
    return infoStartRow;
  }

  /**
   * 고객 정보 섹션 추가
   */
  addClientInfo(clientData) {
    this.currentRow++; // 빈 행 추가
    
    // 고객 정보 제목
    this.worksheet.mergeCells(`A${this.currentRow}:H${this.currentRow}`);
    const clientTitleCell = this.worksheet.getCell(`A${this.currentRow}`);
    clientTitleCell.value = '▣ 고객 정보';
    Object.assign(clientTitleCell, EXCEL_STYLES.companyInfo);
    
    this.currentRow++;
    
    // 고객명
    this.worksheet.getCell(`A${this.currentRow}`).value = '고객명:';
    this.worksheet.getCell(`B${this.currentRow}`).value = clientData.name || '';
    
    this.currentRow++;
    
    // 고객 주소
    this.worksheet.getCell(`A${this.currentRow}`).value = '주소:';
    this.worksheet.getCell(`B${this.currentRow}`).value = clientData.address || '';
    
    this.currentRow++;
    
    return this.currentRow - 3;
  }

  /**
   * 테이블 헤더 추가
   */
  addTableHeader(headers) {
    this.currentRow++; // 빈 행 추가
    
    const headerRow = this.currentRow;
    
    headers.forEach((header, index) => {
      const column = String.fromCharCode(65 + index); // A, B, C, ...
      const cell = this.worksheet.getCell(`${column}${headerRow}`);
      cell.value = header;
      Object.assign(cell, EXCEL_STYLES.tableHeader);
    });
    
    // 헤더 행 높이 설정
    this.worksheet.getRow(headerRow).height = ROW_HEIGHTS.header;
    
    this.currentRow++;
    return headerRow;
  }

  /**
   * 테이블 데이터 행 추가
   */
  addTableRow(rowData, isTotal = false) {
    const row = this.currentRow;
    
    rowData.forEach((cellData, index) => {
      const column = String.fromCharCode(65 + index);
      const cell = this.worksheet.getCell(`${column}${row}`);
      
      cell.value = cellData;
      
      if (isTotal) {
        Object.assign(cell, EXCEL_STYLES.totalRow);
      } else {
        // 숫자인지 확인하여 통화 스타일 적용
        if (typeof cellData === 'number' || (typeof cellData === 'string' && /^\d+$/.test(cellData.replace(/,/g, '')))) {
          Object.assign(cell, EXCEL_STYLES.currency);
        } else {
          Object.assign(cell, EXCEL_STYLES.tableData);
        }
      }
    });
    
    // 행 높이 설정
    this.worksheet.getRow(row).height = isTotal ? ROW_HEIGHTS.total : ROW_HEIGHTS.data;
    
    this.currentRow++;
    return row;
  }

  /**
   * 합계 행 추가
   */
  addTotalRow(totalData, mergeColumns = 3) {
    // 합계 라벨 셀 병합
    const totalRow = this.currentRow;
    
    if (mergeColumns > 1) {
      this.worksheet.mergeCells(`A${totalRow}:${String.fromCharCode(64 + mergeColumns)}${totalRow}`);
    }
    
    const labelCell = this.worksheet.getCell(`A${totalRow}`);
    labelCell.value = '합계';
    Object.assign(labelCell, EXCEL_STYLES.totalRow);
    
    // 합계 금액
    const totalCell = this.worksheet.getCell(`${String.fromCharCode(65 + mergeColumns)}${totalRow}`);
    totalCell.value = totalData.total || 0;
    Object.assign(totalCell, { ...EXCEL_STYLES.totalRow, ...EXCEL_STYLES.currency });
    
    // 행 높이 설정
    this.worksheet.getRow(totalRow).height = ROW_HEIGHTS.total;
    
    this.currentRow++;
    return totalRow;
  }

  /**
   * 비고란 추가
   */
  addRemarksSection(remarks) {
    this.currentRow++; // 빈 행 추가
    
    // 비고 제목
    this.worksheet.getCell(`A${this.currentRow}`).value = '비고:';
    Object.assign(this.worksheet.getCell(`A${this.currentRow}`), EXCEL_STYLES.companyInfo);
    
    this.currentRow++;
    
    // 비고 내용 (여러 행에 걸쳐 병합)
    const remarksStartRow = this.currentRow;
    const remarksEndRow = this.currentRow + 2;
    
    this.worksheet.mergeCells(`A${remarksStartRow}:H${remarksEndRow}`);
    const remarksCell = this.worksheet.getCell(`A${remarksStartRow}`);
    remarksCell.value = remarks || '';
    Object.assign(remarksCell, EXCEL_STYLES.remarks);
    
    // 비고란 행 높이 설정
    for (let i = remarksStartRow; i <= remarksEndRow; i++) {
      this.worksheet.getRow(i).height = ROW_HEIGHTS.remarks / 3;
    }
    
    this.currentRow = remarksEndRow + 1;
    return remarksStartRow;
  }

  /**
   * 현재 행 번호 반환
   */
  getCurrentRow() {
    return this.currentRow;
  }

  /**
   * 빈 행 추가
   */
  addEmptyRow(count = 1) {
    this.currentRow += count;
  }
}