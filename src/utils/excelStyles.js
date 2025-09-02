// 기본 스타일 정의
const baseStyles = {
  // 문서 제목 스타일 (짙은 회색 35%, 굵은 글씨)
  documentTitle: {
    font: { bold: true, size: 14, name: "맑은 고딕" },
    fill: { fgColor: { rgb: "BFBFBF" } }, // 25% 회색
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 회사 정보 라벨 스타일
  companyLabel: {
    font: { bold: true, size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 회사 정보 값 스타일
  companyValue: {
    font: { size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 고객 정보 라벨 스타일
  customerLabel: {
    font: { bold: true, size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 고객 정보 값 스타일
  customerValue: {
    font: { size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 명세 헤더 스타일 (옅은 회색 15%)
  itemHeader: {
    font: { bold: true, size: 10, name: "맑은 고딕" },
    fill: { fgColor: { rgb: "BFBFBF" } }, // 25% 회색
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 명세 서브 헤더 스타일 (덜 어두운 회색 15%)
  itemSubHeader: {
    font: { bold: true, size: 10, name: "맑은 고딕" },
    fill: { fgColor: { rgb: "D9D9D9" } }, // 15% 회색
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 명세 데이터 스타일
  itemData: {
    font: { size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 품명 데이터 스타일 (좌측 정렬)
  itemName: {
    font: { size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 금액 데이터 스타일 (우측 정렬, 천단위 콤마)
  moneyData: {
    font: { size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    },
    numFmt: "#,##0" // 천단위 콤마
  },

  // 합계 라벨 스타일
  totalLabel: {
    font: { bold: true, size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 원자재 명세서 헤더 (회색 25%)
  materialHeader: {
    font: { bold: true, size: 10, name: "맑은 고딕" },
    fill: { fgColor: { rgb: "BFBFBF" } }, // 25% 회색
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },

  // 특기사항 스타일
  specialNote: {
    font: { size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    },
    fill: { fgColor: { rgb: "FFFFFF" } } // 흰색 배경
  },

  // 회사명 푸터 스타일
  companyFooter: {
    font: { bold: true, size: 12, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" }
  },

  // 기본 셀 스타일
  defaultCell: {
    font: { size: 10, name: "맑은 고딕" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  }
};

// 견적서/거래명세서 스타일 생성
export const getEstimateStyles = () => {
  const styles = {
    // 9번째 행 높이 2배
    "9": { hpt: 40 }, // 40 = 20 * 2 (기본 20)
    // 5번행 전체 높이 45
    "5": { hpt: 45 },
  };
  
  // 문서 제목 (A5:H5)
  for (let col = 0; col < 8; col++) {
    styles[`${String.fromCharCode(65 + col)}5`] = baseStyles.documentTitle;
  }
  
  // 고객 정보 라벨들
  styles['A6'] = baseStyles.customerLabel; // 거래일자
  styles['B6'] = baseStyles.customerLabel;
  styles['A7'] = baseStyles.customerLabel; // 상호명
  styles['B7'] = baseStyles.customerLabel;
  styles['A8'] = baseStyles.customerLabel; // 담당자
  styles['B8'] = baseStyles.customerLabel;
  styles['A9'] = baseStyles.customerLabel; // 아래와 같이 견적합니다
  styles['B9'] = baseStyles.customerLabel;
  styles['C9'] = baseStyles.customerLabel;
  styles['A10'] = baseStyles.customerLabel;
  styles['B10'] = baseStyles.customerLabel;
  styles['C10'] = baseStyles.customerLabel;
  
  // 고객 정보 값들
  styles['C6'] = baseStyles.customerValue;
  styles['C7'] = baseStyles.customerValue;
  styles['C8'] = baseStyles.customerValue;
  
  // 공급자 정보
  styles['D6'] = baseStyles.companyLabel; // 공급자
  styles['D7'] = baseStyles.companyLabel;
  styles['D8'] = baseStyles.companyLabel;
  styles['D9'] = baseStyles.companyLabel;
  styles['D10'] = baseStyles.companyLabel;
  
  styles['E6'] = baseStyles.companyLabel; // 사업자등록번호
  styles['E7'] = baseStyles.companyLabel; // 상호
  styles['E8'] = baseStyles.companyLabel; // 소재지
  styles['E9'] = baseStyles.companyLabel; // TEL
  styles['E10'] = baseStyles.companyLabel; // 홈페이지
  
  styles['F6'] = baseStyles.companyValue; // 사업자번호 값
  styles['G6'] = baseStyles.companyValue;
  styles['H6'] = baseStyles.companyValue;
  
  styles['F7'] = baseStyles.companyValue; // 삼미앵글랙산업
  styles['G7'] = baseStyles.companyLabel; // 대표자
  styles['H7'] = baseStyles.companyValue; // 박이삭
  
  styles['F8'] = baseStyles.companyValue; // 소재지 값
  styles['G8'] = baseStyles.companyValue;
  styles['H8'] = baseStyles.companyValue;
  
  styles['F9'] = baseStyles.companyValue; // TEL 값
  styles['G9'] = baseStyles.companyLabel; // FAX
  styles['H9'] = baseStyles.companyValue; // FAX 값
  
  styles['F10'] = baseStyles.companyValue; // 홈페이지 값
  styles['G10'] = baseStyles.companyValue;
  styles['H10'] = baseStyles.companyValue;
  
  // 견적명세 헤더 (A11:H11)
  for (let col = 0; col < 8; col++) {
    styles[`${String.fromCharCode(65 + col)}11`] = baseStyles.itemHeader;
  }
  
  // 명세 컬럼 헤더 (A12:H12)
  for (let col = 0; col < 8; col++) {
    styles[`${String.fromCharCode(65 + col)}12`] = baseStyles.itemSubHeader;
  }
  
  // 명세 데이터 (A13:H25)
  for (let row = 13; row <= 25; row++) {
    styles[`A${row}`] = baseStyles.itemData; // NO
    styles[`B${row}`] = baseStyles.itemName; // 품명
    styles[`C${row}`] = baseStyles.itemData; // 단위
    styles[`D${row}`] = baseStyles.itemData; // 수량
    styles[`E${row}`] = baseStyles.moneyData; // 단가
    styles[`F${row}`] = baseStyles.moneyData; // 공급가
    styles[`G${row}`] = baseStyles.itemData; // 비고
    styles[`H${row}`] = baseStyles.itemData; // 비고 확장
  }
  
  // 합계 섹션 라벨 (A26:F28)
  for (let row = 26; row <= 28; row++) {
    for (let col = 0; col < 6; col++) {
      styles[`${String.fromCharCode(65 + col)}${row}`] = baseStyles.totalLabel;
    }
  }
  
  // 합계 섹션 값 (G26:H28)
  for (let row = 26; row <= 28; row++) {
    styles[`G${row}`] = baseStyles.moneyData;
    styles[`H${row}`] = baseStyles.moneyData;
  }
  
  // 특기사항 (A29:H31)
  for (let row = 29; row <= 31; row++) {
    for (let col = 0; col < 8; col++) {
      styles[`${String.fromCharCode(65 + col)}${row}`] = baseStyles.specialNote;
    }
  }
  
  // 회사명 푸터
  styles['H32'] = baseStyles.companyFooter;
  
  return styles;
};

// 발주서 스타일 생성
export const getPurchaseOrderStyles = () => {
  const styles = {};
  
  // 기본 견적서 스타일 복사
  const estimateStyles = getEstimateStyles();
  Object.assign(styles, estimateStyles);
  
  // 발주서 특별 조정 - 합계 위치 변경 (21-23행)
  // 기존 26-28행 스타일 제거
  for (let row = 26; row <= 28; row++) {
    for (let col = 0; col < 8; col++) {
      delete styles[`${String.fromCharCode(65 + col)}${row}`];
    }
  }
  
  // 새로운 합계 위치 (21-23행) 스타일 적용
  for (let row = 21; row <= 23; row++) {
    for (let col = 0; col < 6; col++) {
      styles[`${String.fromCharCode(65 + col)}${row}`] = baseStyles.totalLabel;
    }
    styles[`G${row}`] = baseStyles.moneyData;
    styles[`H${row}`] = baseStyles.moneyData;
  }
  
  // 원자재 명세서 헤더 (A24:H24)
  for (let col = 0; col < 8; col++) {
    styles[`${String.fromCharCode(65 + col)}24`] = baseStyles.materialHeader;
  }
  
  // 원자재 컬럼 헤더 (A25:H25)
  for (let col = 0; col < 8; col++) {
    styles[`${String.fromCharCode(65 + col)}25`] = baseStyles.itemSubHeader;
  }
  
  // 원자재 데이터 (A26:H55)
  for (let row = 26; row <= 55; row++) {
    styles[`A${row}`] = baseStyles.itemData; // NO
    styles[`B${row}`] = baseStyles.itemName; // 부품명
    styles[`C${row}`] = baseStyles.itemData; // 수량
    styles[`D${row}`] = baseStyles.moneyData; // 단가
    styles[`E${row}`] = baseStyles.moneyData; // 금액
    styles[`F${row}`] = baseStyles.itemData; // 비고
    styles[`G${row}`] = baseStyles.itemData; // 비고 확장
    styles[`H${row}`] = baseStyles.itemData; // 비고 확장
  }
  
  // 특기사항 위치 조정 (A56:H58)
  for (let row = 56; row <= 58; row++) {
    for (let col = 0; col < 8; col++) {
      styles[`${String.fromCharCode(65 + col)}${row}`] = baseStyles.specialNote;
    }
  }
  
  // 회사명 푸터 위치 조정
  delete styles['H32'];
  styles['H59'] = baseStyles.companyFooter;
  
  return styles;
};

// 거래명세서 스타일 (견적서와 동일)
export const getTransactionStyles = () => {
  return getEstimateStyles();
};

// 셀 스타일 적용 헬퍼 함수
export const applyCellStyle = (worksheet, cellRef, style) => {
  if (!worksheet[cellRef]) {
    worksheet[cellRef] = { v: '', t: 's' };
  }
  worksheet[cellRef].s = style;
};

// 범위 스타일 적용 헬퍼 함수
export const applyRangeStyle = (worksheet, startRow, startCol, endRow, endCol, style) => {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cellRef = `${String.fromCharCode(65 + col)}${row}`;
      applyCellStyle(worksheet, cellRef, style);
    }
  }
};

// 컬럼별 스타일 일괄 적용
export const applyColumnStyles = (worksheet, startRow, endRow, columnStyles) => {
  for (let row = startRow; row <= endRow; row++) {
    columnStyles.forEach((style, colIndex) => {
      const cellRef = `${String.fromCharCode(65 + colIndex)}${row}`;
      applyCellStyle(worksheet, cellRef, style);
    });
  }
};

// 숫자 포맷팅 함수
export const formatNumber = (num) => {
  if (typeof num !== 'number' || isNaN(num)) return 0;
  return Math.round(num);
};

// 통화 포맷팅 함수
export const formatCurrency = (num) => {
  const formatted = formatNumber(num);
  return formatted.toLocaleString('ko-KR');
};

// 기본 export
export default {
  getEstimateStyles,
  getPurchaseOrderStyles,
  getTransactionStyles,
  baseStyles,
  applyCellStyle,
  applyRangeStyle,
  applyColumnStyles,
  formatNumber,
  formatCurrency
};
