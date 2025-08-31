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
   * 견적서 레이아웃 구현
   */
  setupEstimateLayout(data) {
    // 1. 제목(견적서): 병합 셀 B4:G4, 중앙 정렬, 큰 글씨, 굵은 글씨, 연회색 배경
    this.worksheet.mergeCells('B4:G4');
    const titleCell = this.worksheet.getCell('B4');
    titleCell.value = '견 적 서';
    Object.assign(titleCell, EXCEL_STYLES.documentTitle);

    // 2. 견적일자: C6
    this.worksheet.getCell('C6').value = data.date || new Date().toISOString().split('T')[0];
    Object.assign(this.worksheet.getCell('C6'), EXCEL_STYLES.date);

    // 3. 사업자등록번호: F6:G6 병합
    this.worksheet.mergeCells('F6:G6');
    this.worksheet.getCell('F6').value = data.businessNumber || '';

    // 4. 공급자 상호명 텍스트 및 값: F7 / F8 (Bold)
    this.worksheet.getCell('F7').value = '상호명';
    this.worksheet.getCell('F8').value = data.companyName || '';
    Object.assign(this.worksheet.getCell('F8'), EXCEL_STYLES.companyInfoValue);

    // 5. 대표자 텍스트 및 값: H7 / H8 (Bold)
    this.worksheet.getCell('H7').value = '대표자';
    this.worksheet.getCell('H8').value = data.representative || '';
    Object.assign(this.worksheet.getCell('H8'), EXCEL_STYLES.companyInfoValue);

    // 6. 담당자: C10
    this.worksheet.getCell('C10').value = data.manager || '';

    // 7. 소재지 텍스트 및 값: F9 / F10
    this.worksheet.getCell('F9').value = '소재지';
    this.worksheet.getCell('F10').value = data.address || '';

    // 8. 연락처 TEL/FAX 텍스트 및 값: F11/F12, H11/H12
    this.worksheet.getCell('F11').value = 'TEL';
    this.worksheet.getCell('F12').value = data.tel || '';
    this.worksheet.getCell('H11').value = 'FAX';
    this.worksheet.getCell('H12').value = data.fax || '';

    // 9. 홈페이지: F13
    this.worksheet.getCell('F13').value = data.homepage || '';

    // 10. 견적금액(한글/숫자): F14 / G14 (숫자 우측 정렬, Bold)
    this.worksheet.getCell('F14').value = data.totalAmountKorean || '';
    this.worksheet.getCell('G14').value = data.totalAmount || 0;
    Object.assign(this.worksheet.getCell('G14'), EXCEL_STYLES.currency);

    // 11. 금액명세 타이틀: 병합 셀 B16:G16, 배경 회색, 중앙 정렬, Bold
    this.worksheet.mergeCells('B16:G16');
    const amountTitleCell = this.worksheet.getCell('B16');
    amountTitleCell.value = '금액명세';
    Object.assign(amountTitleCell, EXCEL_STYLES.amountTitle);

    // 12. 테이블 헤더: B17:I17, 배경 밝은 회색, 폰트 Bold, 테두리 완성
    const headers = ['품목명', '단위', '수량', '단가', '금액', '비고'];
    for (let i = 0; i < headers.length; i++) {
      const col = String.fromCharCode(66 + i); // B, C, D, E, F, G
      const cell = this.worksheet.getCell(`${col}17`);
      cell.value = headers[i];
      Object.assign(cell, EXCEL_STYLES.tableHeader);
    }

    // 13. 테이블 품목 행: B18:I30, 중앙 또는 왼쪽 정렬, 테두리 완전
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        const row = 18 + index;
        if (row <= 30) { // 최대 13개 품목
          this.worksheet.getCell(`B${row}`).value = item.name || '';
          Object.assign(this.worksheet.getCell(`B${row}`), EXCEL_STYLES.tableDataLeft);
          
          this.worksheet.getCell(`C${row}`).value = item.unit || '';
          Object.assign(this.worksheet.getCell(`C${row}`), EXCEL_STYLES.tableData);
          
          this.worksheet.getCell(`D${row}`).value = item.quantity || 0;
          Object.assign(this.worksheet.getCell(`D${row}`), EXCEL_STYLES.tableData);
          
          this.worksheet.getCell(`E${row}`).value = item.unitPrice || 0;
          Object.assign(this.worksheet.getCell(`E${row}`), EXCEL_STYLES.currency);
          
          const amount = (item.quantity || 0) * (item.unitPrice || 0);
          this.worksheet.getCell(`F${row}`).value = amount;
          Object.assign(this.worksheet.getCell(`F${row}`), EXCEL_STYLES.currency);
          
          this.worksheet.getCell(`G${row}`).value = item.note || '';
          Object.assign(this.worksheet.getCell(`G${row}`), EXCEL_STYLES.tableDataLeft);
        }
      });
    }

    // 14. 소계/부가가치세/합계: 각각 F31/G31, F32/G32, F33/G33 스타일 구분 명확히
    this.worksheet.getCell('F31').value = '소계';
    this.worksheet.getCell('G31').value = data.subtotal || 0;
    Object.assign(this.worksheet.getCell('F31'), EXCEL_STYLES.subtotalRow);
    Object.assign(this.worksheet.getCell('G31'), EXCEL_STYLES.currency);

    this.worksheet.getCell('F32').value = '부가가치세';
    this.worksheet.getCell('G32').value = data.tax || 0;
    Object.assign(this.worksheet.getCell('F32'), EXCEL_STYLES.taxRow);
    Object.assign(this.worksheet.getCell('G32'), EXCEL_STYLES.currency);

    this.worksheet.getCell('F33').value = '합계';
    this.worksheet.getCell('G33').value = data.totalAmount || 0;
    Object.assign(this.worksheet.getCell('F33'), EXCEL_STYLES.totalRow);
    Object.assign(this.worksheet.getCell('G33'), EXCEL_STYLES.currency);

    // 15. 특기사항: 병합 셀 B35:I35, 왼쪽 정렬, 텍스트 감싸기
    this.worksheet.mergeCells('B35:I35');
    const remarksCell = this.worksheet.getCell('B35');
    remarksCell.value = data.remarks || '';
    Object.assign(remarksCell, EXCEL_STYLES.remarks);

    // 16. 회사 정보 푸터: B38:I38 병합, 작고 중앙 정렬된 회색 글씨
    this.worksheet.mergeCells('B38:I38');
    const footerCell = this.worksheet.getCell('B38');
    footerCell.value = data.companyFooter || '';
    Object.assign(footerCell, EXCEL_STYLES.companyFooter);

    this.currentRow = 39; // 다음 작업을 위한 현재 행 설정
  }

  /**
   * 발주서 레이아웃 구현
   */
  setupPurchaseOrderLayout(data) {
    // 1. 제목(발주서): 병합 셀 C4:H4, 중앙 정렬, Bold, 연회색 배경
    this.worksheet.mergeCells('C4:H4');
    const titleCell = this.worksheet.getCell('C4');
    titleCell.value = '발 주 서';
    Object.assign(titleCell, EXCEL_STYLES.documentTitle);

    // 2. 견적일자: D6
    this.worksheet.getCell('D6').value = data.date || new Date().toISOString().split('T')[0];
    Object.assign(this.worksheet.getCell('D6'), EXCEL_STYLES.date);

    // 3. 사업자등록번호: G6:H6 병합
    this.worksheet.mergeCells('G6:H6');
    this.worksheet.getCell('G6').value = data.businessNumber || '';

    // 4. 공급자 상호명/대표자 텍스트 및 값: G7/G8, H7/H8
    this.worksheet.getCell('G7').value = '상호명';
    this.worksheet.getCell('G8').value = data.companyName || '';
    Object.assign(this.worksheet.getCell('G8'), EXCEL_STYLES.companyInfoValue);
    
    this.worksheet.getCell('H7').value = '대표자';
    this.worksheet.getCell('H8').value = data.representative || '';
    Object.assign(this.worksheet.getCell('H8'), EXCEL_STYLES.companyInfoValue);

    // 5. 담당자: D10
    this.worksheet.getCell('D10').value = data.manager || '';

    // 6. 소재지: G9/G10
    this.worksheet.getCell('G9').value = '소재지';
    this.worksheet.getCell('G10').value = data.address || '';

    // 7. 연락처 TEL/FAX: G11/G12, H11/H12
    this.worksheet.getCell('G11').value = 'TEL';
    this.worksheet.getCell('G12').value = data.tel || '';
    this.worksheet.getCell('H11').value = 'FAX';
    this.worksheet.getCell('H12').value = data.fax || '';

    // 8. 홈페이지: G13
    this.worksheet.getCell('G13').value = data.homepage || '';

    // 9. 견적금액(한글/숫자): G14 / H14
    this.worksheet.getCell('G14').value = data.totalAmountKorean || '';
    this.worksheet.getCell('H14').value = data.totalAmount || 0;
    Object.assign(this.worksheet.getCell('H14'), EXCEL_STYLES.currency);

    // 10. 발주명세 타이틀: 병합 셀 C16:H16
    this.worksheet.mergeCells('C16:H16');
    const orderTitleCell = this.worksheet.getCell('C16');
    orderTitleCell.value = '발주명세';
    Object.assign(orderTitleCell, EXCEL_STYLES.amountTitle);

    // 11. 테이블 헤더: C17:J17, Bold, 테두리 완전
    const headers = ['품목명', '규격', '수량', '단가', '금액', '납기', '비고'];
    for (let i = 0; i < headers.length; i++) {
      const col = String.fromCharCode(67 + i); // C, D, E, F, G, H, I
      const cell = this.worksheet.getCell(`${col}17`);
      cell.value = headers[i];
      Object.assign(cell, EXCEL_STYLES.tableHeader);
    }

    // 12. 테이블 품목 행: C18:J30
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        const row = 18 + index;
        if (row <= 30) { // 최대 13개 품목
          this.worksheet.getCell(`C${row}`).value = item.name || '';
          Object.assign(this.worksheet.getCell(`C${row}`), EXCEL_STYLES.tableDataLeft);
          
          this.worksheet.getCell(`D${row}`).value = item.specification || '';
          Object.assign(this.worksheet.getCell(`D${row}`), EXCEL_STYLES.tableData);
          
          this.worksheet.getCell(`E${row}`).value = item.quantity || 0;
          Object.assign(this.worksheet.getCell(`E${row}`), EXCEL_STYLES.tableData);
          
          this.worksheet.getCell(`F${row}`).value = item.unitPrice || 0;
          Object.assign(this.worksheet.getCell(`F${row}`), EXCEL_STYLES.currency);
          
          const amount = (item.quantity || 0) * (item.unitPrice || 0);
          this.worksheet.getCell(`G${row}`).value = amount;
          Object.assign(this.worksheet.getCell(`G${row}`), EXCEL_STYLES.currency);
          
          this.worksheet.getCell(`H${row}`).value = item.deliveryDate || '';
          Object.assign(this.worksheet.getCell(`H${row}`), EXCEL_STYLES.tableData);
          
          this.worksheet.getCell(`I${row}`).value = item.note || '';
          Object.assign(this.worksheet.getCell(`I${row}`), EXCEL_STYLES.tableDataLeft);
        }
      });
    }

    // 13. 소계/부가가치세/합계: G31/H31, G32/H32, G33/H33
    this.worksheet.getCell('G31').value = '소계';
    this.worksheet.getCell('H31').value = data.subtotal || 0;
    Object.assign(this.worksheet.getCell('G31'), EXCEL_STYLES.subtotalRow);
    Object.assign(this.worksheet.getCell('H31'), EXCEL_STYLES.currency);

    this.worksheet.getCell('G32').value = '부가가치세';
    this.worksheet.getCell('H32').value = data.tax || 0;
    Object.assign(this.worksheet.getCell('G32'), EXCEL_STYLES.taxRow);
    Object.assign(this.worksheet.getCell('H32'), EXCEL_STYLES.currency);

    this.worksheet.getCell('G33').value = '합계';
    this.worksheet.getCell('H33').value = data.totalAmount || 0;
    Object.assign(this.worksheet.getCell('G33'), EXCEL_STYLES.totalRow);
    Object.assign(this.worksheet.getCell('H33'), EXCEL_STYLES.currency);

    // 14. 원자재명세 타이틀: 병합 셀 C35:J35
    this.worksheet.mergeCells('C35:J35');
    const materialTitleCell = this.worksheet.getCell('C35');
    materialTitleCell.value = '원자재명세';
    Object.assign(materialTitleCell, EXCEL_STYLES.materialTitle);

    // 15. 원자재명세 테이블 헤더: C36:I36
    const materialHeaders = ['품목명', '규격', '수량', '단가', '금액', '비고'];
    for (let i = 0; i < materialHeaders.length; i++) {
      const col = String.fromCharCode(67 + i); // C, D, E, F, G, H
      const cell = this.worksheet.getCell(`${col}36`);
      cell.value = materialHeaders[i];
      Object.assign(cell, EXCEL_STYLES.tableHeader);
    }

    // 16. 원자재명세 행: C37:I60
    if (data.materials && data.materials.length > 0) {
      data.materials.forEach((material, index) => {
        const row = 37 + index;
        if (row <= 60) { // 최대 24개 원자재
          this.worksheet.getCell(`C${row}`).value = material.name || '';
          Object.assign(this.worksheet.getCell(`C${row}`), EXCEL_STYLES.tableDataLeft);
          
          this.worksheet.getCell(`D${row}`).value = material.specification || '';
          Object.assign(this.worksheet.getCell(`D${row}`), EXCEL_STYLES.tableData);
          
          this.worksheet.getCell(`E${row}`).value = material.quantity || 0;
          Object.assign(this.worksheet.getCell(`E${row}`), EXCEL_STYLES.tableData);
          
          this.worksheet.getCell(`F${row}`).value = material.unitPrice || 0;
          Object.assign(this.worksheet.getCell(`F${row}`), EXCEL_STYLES.currency);
          
          const amount = (material.quantity || 0) * (material.unitPrice || 0);
          this.worksheet.getCell(`G${row}`).value = amount;
          Object.assign(this.worksheet.getCell(`G${row}`), EXCEL_STYLES.currency);
          
          this.worksheet.getCell(`H${row}`).value = material.note || '';
          Object.assign(this.worksheet.getCell(`H${row}`), EXCEL_STYLES.tableDataLeft);
        }
      });
    }

    // 17. 특기사항: 병합 셀 C62:J62
    this.worksheet.mergeCells('C62:J62');
    const remarksCell = this.worksheet.getCell('C62');
    remarksCell.value = data.remarks || '';
    Object.assign(remarksCell, EXCEL_STYLES.remarks);

    // 18. 회사 정보 푸터: C65:J65 병합, 중앙 정렬, 연한 회색
    this.worksheet.mergeCells('C65:J65');
    const footerCell = this.worksheet.getCell('C65');
    footerCell.value = data.companyFooter || '';
    Object.assign(footerCell, EXCEL_STYLES.companyFooter);

    this.currentRow = 66; // 다음 작업을 위한 현재 행 설정
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

  // 기존 메서드들은 호환성을 위해 유지하되, 새로운 레이아웃 메서드를 우선 사용
  /**
   * 문서 제목 추가 (견적서/발주서/거래명세서) - 호환성 유지
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
   * 회사 정보 섹션 추가 - 호환성 유지
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
   * 고객 정보 섹션 추가 - 호환성 유지
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
   * 테이블 헤더 추가 - 호환성 유지
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
   * 테이블 데이터 행 추가 - 호환성 유지
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
   * 합계 행 추가 - 호환성 유지
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
   * 비고란 추가 - 호환성 유지
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
}
