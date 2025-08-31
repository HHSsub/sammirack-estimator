// Excel 스타일 정의 - 웹 CSS를 ExcelJS 스타일로 매핑
export const EXCEL_STYLES = {
  // 헤더 스타일 (견적서/발주서/거래명세서 제목)
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
      fgColor: { argb: 'FFF0F0F0' } // 연한 회색 배경
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

  // 기본 텍스트 스타일
  text: {
    font: {
      name: 'Arial',
      size: 10
    },
    alignment: {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true
    }
  },

  // 숫자 스타일 (천 단위 쉼표, 우측 정렬)
  number: {
    font: {
      name: 'Arial',
      size: 10
    },
    alignment: {
      horizontal: 'right',
      vertical: 'middle'
    },
    numFmt: '#,##0'
  },

  // 헤더 셀 스타일 (테이블 헤더 등)
  headerCell: {
    font: {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FF000000' }
    },
    alignment: {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' } // 회색 배경
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 일반 셀 스타일 (테두리 포함)
  dataCell: {
    font: {
      name: 'Arial',
      size: 10
    },
    alignment: {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 금액 합계 스타일
  totalAmount: {
    font: {
      name: 'Arial',
      size: 12,
      bold: true,
      color: { argb: 'FF000000' }
    },
    alignment: {
      horizontal: 'right',
      vertical: 'middle'
    },
    numFmt: '#,##0',
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' } // 노란색 배경
    },
    border: {
      top: { style: 'medium' },
      left: { style: 'medium' },
      bottom: { style: 'medium' },
      right: { style: 'medium' }
    }
  },

  // 서명/도장 영역 스타일
  signatureArea: {
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  },

  // 모든 테두리 스타일
  allBorders: {
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
};
