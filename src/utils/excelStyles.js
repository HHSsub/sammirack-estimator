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

  // 회사 정보 값 스타일 (굵은 글씨)
  companyInfoValue: {
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

  // 금액명세 타이틀 스타일
  amountTitle: {
    font: { 
      name: 'Arial', 
      size: 12, 
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
      fgColor: { argb: 'FFD3D3D3' } // 회색 배경
    }
  },

  // 테이블 헤더 스타일 (밝은 회색 배경으로 수정)
  tableHeader: {
    font: { 
      name: 'Arial', 
      size: 11, 
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
      fgColor: { argb: 'FFE0E0E0' } // 밝은 회색 배경으로 수정
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

  // 테이블 데이터 왼쪽 정렬 스타일
  tableDataLeft: {
    font: { 
      name: 'Arial', 
      size: 10 
    },
    alignment: { 
      horizontal: 'left', 
      vertical: 'middle' 
    },
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  },

  // 숫자/금액 스타일 (우측 정렬, 굵은 글씨)
  currency: {
    font: { 
      name: 'Arial', 
      size: 10,
      bold: true 
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

  // 소계 스타일
  subtotalRow: {
    font: { 
      name: 'Arial', 
      size: 11, 
      bold: false 
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

  // 부가가치세 스타일
  taxRow: {
    font: { 
      name: 'Arial', 
      size: 11, 
      bold: false 
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
  },

  // 회사 정보 푸터 스타일 (작고 중앙 정렬된 회색 글씨)
  companyFooter: {
    font: { 
      name: 'Arial', 
      size: 8, 
      color: { argb: 'FF808080' } // 회색 글씨
    },
    alignment: { 
      horizontal: 'center', 
      vertical: 'middle' 
    }
  },

  // 원자재명세 타이틀 스타일
  materialTitle: {
    font: { 
      name: 'Arial', 
      size: 12, 
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
      fgColor: { argb: 'FFE0E0E0' } // 밝은 회색 배경
    }
  }
};

// 컬럼 너비 설정
export const COLUMN_WIDTHS = {
  estimate: {
    A: 5,  // 여백
    B: 20, // 품목명
    C: 8,  // 단위
    D: 8,  // 수량
    E: 12, // 단가
    F: 12, // 금액
    G: 12, // 금액(한글)
    H: 10, // 도장/로고
    I: 10  // 도장/로고
  },
  purchaseOrder: {
    A: 5,  // 여백
    B: 5,  // 여백
    C: 20, // 품목명/품명
    D: 12, // 단위/규격
    E: 8,  // 수량
    F: 12, // 단가
    G: 12, // 금액(한글)
    H: 12, // 금액(숫자)/대표자
    I: 10, // 납기
    J: 15  // 비고
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
