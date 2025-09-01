// Excel 스타일 정의 - 웹 CSS를 ExcelJS 스타일로 매핑

export const EXCEL_STYLES = {
  // 문서 제목 스타일 (견적서/발주서/거래명세서 제목)
  documentTitle: {
    font: {
      name: 'Arial',
      size: 18,
      bold: true,
      color: { argb: 'FF000000' } // 검정색
    },
    alignment: {
      horizontal: 'center',
      vertical: 'middle'
    },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' } // 연한 회색 배경
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
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
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 테이블 헤더 스타일
  header: {
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
      fgColor: { argb: 'FFE6E6E6' } // 연한 회색 배경
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 일반 데이터 셀 스타일
  dataCell: {
    font: {
      name: 'Arial',
      size: 10
    },
    alignment: {
      horizontal: 'center',
      vertical: 'middle'
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 텍스트 데이터 셀 스타일 (좌측 정렬)
  textCell: {
    font: {
      name: 'Arial',
      size: 10
    },
    alignment: {
      horizontal: 'left',
      vertical: 'middle'
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 숫자 데이터 셀 스타일 (우측 정렬)
  numberCell: {
    font: {
      name: 'Arial',
      size: 10
    },
    alignment: {
      horizontal: 'right',
      vertical: 'middle'
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    },
    numFmt: '#,##0' // 천단위 구분자
  },

  // 금액 셀 스타일
  currencyCell: {
    font: {
      name: 'Arial',
      size: 10
    },
    alignment: {
      horizontal: 'right',
      vertical: 'middle'
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    },
    numFmt: '#,##0' // 천단위 구분자
  },

  // 합계 행 스타일
  totalRow: {
    font: {
      name: 'Arial',
      size: 11,
      bold: true
    },
    alignment: {
      horizontal: 'center',
      vertical: 'middle'
    },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' } // 매우 연한 회색
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 합계 금액 스타일
  totalAmount: {
    font: {
      name: 'Arial',
      size: 11,
      bold: true
    },
    alignment: {
      horizontal: 'right',
      vertical: 'middle'
    },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' } // 매우 연한 회색
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    },
    numFmt: '#,##0' // 천단위 구분자
  },

  // 특기사항 제목 스타일
  notesTitle: {
    font: {
      name: 'Arial',
      size: 11,
      bold: true
    },
    alignment: {
      horizontal: 'left',
      vertical: 'middle'
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 특기사항 내용 스타일
  notesContent: {
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
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 회사명 스타일 (우측 하단)
  companyName: {
    font: {
      name: 'Arial',
      size: 11,
      bold: true
    },
    alignment: {
      horizontal: 'right',
      vertical: 'middle'
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 인사말 스타일
  greeting: {
    font: {
      name: 'Arial',
      size: 12,
      bold: true
    },
    alignment: {
      horizontal: 'center',
      vertical: 'middle'
    }
  },

  // 섹션 제목 스타일 (견적내역, 발주내역, 원자재 명세서 등)
  sectionTitle: {
    font: {
      name: 'Arial',
      size: 14,
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
      fgColor: { argb: 'FFE6E6E6' } // 연한 회색 배경
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
};
