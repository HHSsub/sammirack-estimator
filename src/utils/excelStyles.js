// Excel 스타일 정의 - 웹 CSS를 ExcelJS 스타일로 매핑

export const EXCEL_STYLES = {
  // 헤더 스타일 (견적서/발주서/거래명세서 제목)
  documentTitle: {
    font: { 
      name: 'Arial', 
      size: 18, 
      bold: true, 
      color: { argb: 'FF000000' } 
    },
    alignment: { 
      horizontal: 'center', 
      vertical: 'middle' 
    },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' }
    },
    border: {
      top: { style: 'thick', color: { argb: 'FF000000' } },
      left: { style: 'thick', color: { argb: 'FF000000' } },
      bottom: { style: 'thick', color: { argb: 'FF000000' } },
      right: { style: 'thick', color: { argb: 'FF000000' } }
    }
  },

  // 회사 정보 스타일
  companyInfo: {
    font: { 
      name: 'Arial', 
      size: 12, 
      bold: true 
    },
    alignment: { 
      horizontal: 'left', 
      vertical: 'middle' 
    }
  },

  // 테이블 헤더 스타일
  tableHeader: {
    font: { 
      name: 'Arial', 
      size: 11, 
      bold: true, 
      color: { argb: 'FFFFFFFF' } 
    },
    alignment: { 
      horizontal: 'center', 
      vertical: 'middle' 
    },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    },
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  },

  // 테이블 데이터 스타일
  tableData: {
    font: { 
      name: 'Arial', 
      size: 10 
    },
    alignment: { 
      horizontal: 'center', 
      vertical: 'middle' 
    },
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  },

  // 숫자/금액 스타일
  currency: {
    font: { 
      name: 'Arial', 
      size: 10 
    },
    alignment: { 
      horizontal: 'right', 
      vertical: 'middle' 
    },
    numFmt: '#,##0',
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  },

  // 합계 스타일
  totalRow: {
    font: { 
      name: 'Arial', 
      size: 12, 
      bold: true 
    },
    alignment: { 
      horizontal: 'center', 
      vertical: 'middle' 
    },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE699' }
    },
    border: {
      top: { style: 'thick', color: { argb: 'FF000000' } },
      left: { style: 'thick', color: { argb: 'FF000000' } },
      bottom: { style: 'thick', color: { argb: 'FF000000' } },
      right: { style: 'thick', color: { argb: 'FF000000' } }
    }
  },

  // 비고란 스타일
  remarks: {
    font: { 
      name: 'Arial', 
      size: 10 
    },
    alignment: { 
      horizontal: 'left', 
      vertical: 'top',
      wrapText: true 
    },
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  },

  // 날짜 스타일
  date: {
    font: { 
      name: 'Arial', 
      size: 10 
    },
    alignment: { 
      horizontal: 'center', 
      vertical: 'middle' 
    },
    numFmt: 'yyyy-mm-dd'
  }
};

// 컬럼 너비 설정
export const COLUMN_WIDTHS = {
  estimate: {
    A: 20, // 품목명
    B: 8,  // 단위
    C: 8,  // 수량
    D: 12, // 단가
    E: 12, // 금액
    F: 15, // 비고
    G: 10, // 여백
    H: 10  // 여백
  },
  purchaseOrder: {
    A: 20, // 품목명/품명
    B: 12, // 단위/규격
    C: 8,  // 수량
    D: 12, // 단가
    E: 12, // 금액
    F: 10, // 납기
    G: 15, // 비고
    H: 10  // 여백
  },
  transactionStatement: {
    A: 12, // 거래일자
    B: 20, // 품목명
    C: 8,  // 단위
    D: 8,  // 수량
    E: 12, // 단가
    F: 12, // 금액
    G: 15, // 비고
    H: 10  // 여백
  }
};

// 행 높이 설정
export const ROW_HEIGHTS = {
  title: 30,
  header: 25,
  data: 20,
  total: 25,
  remarks: 40
};