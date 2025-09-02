import { getEstimateStyles, getPurchaseOrderStyles } from './excelStyles.js';

// 소계 계산 함수 - 더 안전한 처리
const calculateSubtotal = (products) => {
  if (!products || !Array.isArray(products) || products.length === 0) return 0;
  
  return products.reduce((sum, product) => {
    if (!product || typeof product !== 'object') return sum;
    
    const quantity = parseFloat(product.quantity) || 1;
    const price = parseFloat(product.price) || parseFloat(product.unitPrice) || 0;
    
    // 음수 방지
    const safeQuantity = Math.max(0, quantity);
    const safePrice = Math.max(0, price);
    
    return sum + (safeQuantity * safePrice);
  }, 0);
};

// 견적서/거래명세서 레이아웃 생성
export const createEstimateLayout = (data, type = 'estimate') => {
  // 안전한 데이터 처리
  const safeData = data || {};
  const documentTitle = type === 'estimate' ? '견적서' : '거래명세서';
  const actionText = type === 'estimate' ? '아래와 같이 견적합니다' : '아래와 같이 거래합니다';
  
  // 2차원 배열로 엑셀 데이터 구성 (35행 x 8열)
  const layout = Array.from({ length: 35 }, () => Array(8).fill(''));
  
  // 문서 제목 (A5:H5)
  layout[4][0] = documentTitle;
  
  // 고객 정보 섹션
  layout[5][0] = '거래일자';
  layout[5][1] = safeData.date || new Date().toISOString().slice(0, 10);
  
  layout[6][0] = '상호명';
  layout[6][1] = safeData.customerName || '';
  
  layout[7][0] = '담당자';
  layout[7][1] = safeData.contactPerson || '';
  
  layout[8][0] = actionText;
  
  // 공급자 정보 섹션
  layout[5][3] = '공급자';
  layout[5][4] = '사업자등록번호';
  layout[5][5] = '232-81-01750';
  
  layout[6][4] = '상호';
  layout[6][5] = '삼미앵글랙산업';
  layout[6][6] = '대표자';
  layout[6][7] = '박이삭';
  
  layout[7][4] = '소재지';
  layout[7][5] = '경기도 광명시 원노온사로 39, 철제 스틸하우스 1';
  
  layout[8][4] = 'TEL';
  layout[8][5] = '010-9548-9578        010-4311-7733';
  layout[8][6] = 'FAX';
  layout[8][7] = '(02)2611-4595';
  
  layout[9][4] = '홈페이지';
  layout[9][5] = 'http://www.ssmake.com';
  
  // 견적명세 헤더
  layout[10][0] = '견적명세';
  
  // 명세 컬럼 헤더
  layout[11][0] = 'NO';
  layout[11][1] = '품명';
  layout[11][2] = '단위';
  layout[11][3] = '수량';
  layout[11][4] = '단가';
  layout[11][5] = '공급가';
  layout[11][6] = '비고';
  
  // 실제 선택된 제품 데이터 사용
  const products = safeData.selectedProducts || safeData.items || [];
  if (products.length > 0) {
    products.forEach((product, index) => {
      if (index < 13) { // 최대 13개 항목 (A13~A25)
        const rowIndex = 12 + index;
        layout[rowIndex][0] = index + 1; // NO
        layout[rowIndex][1] = product.name || product.title || product.productName || ''; // 품명
        layout[rowIndex][2] = 'EA'; // 단위
        layout[rowIndex][3] = product.quantity || 1; // 수량
        layout[rowIndex][4] = product.price || product.unitPrice || 0; // 단가
        layout[rowIndex][5] = (product.quantity || 1) * (product.price || product.unitPrice || 0); // 공급가
        layout[rowIndex][6] = product.description || product.note || product.remarks || ''; // 비고
      }
    });
  } else {
    // 기본 번호만 입력 (1~13)
    for (let i = 0; i < 13; i++) {
      layout[12 + i][0] = i + 1;
    }
  }
  
  // 합계 섹션 (A26~A28)
  layout[25][0] = '소계';
  layout[26][0] = '부가가치세';
  layout[27][0] = '합계';
  
  // 실제 계산된 값들
  const subtotal = calculateSubtotal(products);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;
  
  layout[25][6] = subtotal;
  layout[26][6] = vat;
  layout[27][6] = total;
  
  // 특기사항
  layout[28][0] = '특기사항';
  layout[28][1] = safeData.specialNotes || '';
  
  // 회사명 푸터
  layout[31][7] = '(주)삼미앵글산업';
  
  // 병합 정보
  const merges = [
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },   // 문서제목 A5:H5
    { s: { r: 5, c: 1 }, e: { r: 5, c: 2 } },   // 거래일자 값 B6:C6
    { s: { r: 6, c: 1 }, e: { r: 6, c: 2 } },   // 상호명 값 B7:C7
    { s: { r: 7, c: 1 }, e: { r: 7, c: 2 } },   // 담당자 값 B8:C8
    { s: { r: 8, c: 0 }, e: { r: 9, c: 2 } },   // 아래와 같이 견적합니다 A9:C10
    { s: { r: 5, c: 3 }, e: { r: 9, c: 3 } },   // 공급자 D6:D10
    { s: { r: 5, c: 5 }, e: { r: 5, c: 7 } },   // 사업자등록번호 F6:H6
    { s: { r: 7, c: 5 }, e: { r: 7, c: 7 } },   // 소재지 F8:H8
    { s: { r: 9, c: 5 }, e: { r: 9, c: 7 } },   // 홈페이지 F10:H10
    { s: { r: 10, c: 0 }, e: { r: 10, c: 7 } }, // 견적명세 A11:H11
    { s: { r: 11, c: 6 }, e: { r: 11, c: 7 } }, // 비고 G12:H12
  ];
  
  // 명세 데이터 행의 비고 병합 (A13~A25)
  for (let row = 12; row < 25; row++) {
    merges.push({ s: { r: row, c: 6 }, e: { r: row, c: 7 } });
  }
  
  // 합계 섹션 병합 (A26~A28)
  for (let row = 25; row <= 27; row++) {
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 5 } }); // A26:F26 등
    merges.push({ s: { r: row, c: 6 }, e: { r: row, c: 7 } }); // G26:H26 등
  }
  
  // 특기사항 병합
  merges.push({ s: { r: 28, c: 0 }, e: { r: 30, c: 7 } }); // A29:H31
  
  return {
    data: layout,
    merges: merges,
    styles: getEstimateStyles(),
    borders: { start: 'A5', end: 'H31' }
  };
};

// 거래명세서 레이아웃 생성 (견적서와 동일)
export const createTransactionLayout = (data) => {
  return createEstimateLayout(data, 'transaction');
};

// 발주서 레이아웃 생성
export const createPurchaseOrderLayout = (data) => {
  // 안전한 데이터 처리
  const safeData = data || {};
  
  // 2차원 배열로 엑셀 데이터 구성 (62행 x 8열)
  const layout = Array.from({ length: 62 }, () => Array(8).fill(''));
  
  // 문서 제목 (A5:H5)
  layout[4][0] = '발주서';
  
  // 고객 정보 섹션
  layout[5][0] = '거래일자';
  layout[5][1] = safeData.date || new Date().toISOString().slice(0, 10);
  
  layout[6][0] = '상호명';
  layout[6][1] = safeData.customerName || '';
  
  layout[7][0] = '담당자';
  layout[7][1] = safeData.contactPerson || '';
  
  layout[8][0] = '아래와 같이 발주합니다';
  
  // 공급자 정보 섹션
  layout[5][3] = '공급자';
  layout[5][4] = '사업자등록번호';
  layout[5][5] = '232-81-01750';
  
  layout[6][4] = '상호';
  layout[6][5] = '삼미앵글랙산업';
  layout[6][6] = '대표자';
  layout[6][7] = '박이삭';
  
  layout[7][4] = '소재지';
  layout[7][5] = '경기도 광명시 원노온사로 39, 철제 스틸하우스 1';
  
  layout[8][4] = 'TEL';
  layout[8][5] = '010-9548-9578        010-4311-7733';
  layout[8][6] = 'FAX';
  layout[8][7] = '(02)2611-4595';
  
  layout[9][4] = '홈페이지';
  layout[9][5] = 'http://www.ssmake.com';
  
  // 견적명세 헤더
  layout[10][0] = '견적명세';
  
  // 명세 컬럼 헤더
  layout[11][0] = 'NO';
  layout[11][1] = '품명';
  layout[11][2] = '단위';
  layout[11][3] = '수량';
  layout[11][4] = '단가';
  layout[11][5] = '공급가';
  layout[11][6] = '비고';
  
  // 실제 선택된 제품 데이터 사용
  const products = safeData.selectedProducts || safeData.items || [];
  if (products.length > 0) {
    products.forEach((product, index) => {
      if (index < 8) { // 최대 8개 항목 (A13~A20)
        const rowIndex = 12 + index;
        layout[rowIndex][0] = index + 1; // NO
        layout[rowIndex][1] = product.name || product.title || product.productName || ''; // 품명
        layout[rowIndex][2] = 'EA'; // 단위
        layout[rowIndex][3] = product.quantity || 1; // 수량
        layout[rowIndex][4] = product.price || product.unitPrice || 0; // 단가
        layout[rowIndex][5] = (product.quantity || 1) * (product.price || product.unitPrice || 0); // 공급가
        layout[rowIndex][6] = product.description || product.note || product.remarks || ''; // 비고
      }
    });
  } else {
    // 기본 번호만 입력 (1~8)
    for (let i = 0; i < 8; i++) {
      layout[12 + i][0] = i + 1;
    }
  }
  
  // 합계 섹션 (A21~A23)
  layout[20][0] = '소계';
  layout[21][0] = '부가가치세';
  layout[22][0] = '합계';
  
  // 실제 계산된 값들
  const subtotal = calculateSubtotal(products);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;
  
  layout[20][6] = subtotal;
  layout[21][6] = vat;
  layout[22][6] = total;
  
  // 원자재 명세서 헤더
  layout[23][0] = '원자재 명세서';
  
  // 원자재 컬럼 헤더
  layout[24][0] = 'NO';
  layout[24][1] = '부품명';
  layout[24][2] = '수량';
  layout[24][3] = '단가';
  layout[24][4] = '금액';
  layout[24][5] = '비고';
  
  // 원자재 데이터 입력 (실제 연동된 materials 데이터 사용)
  const materials = safeData.materials || [];
  if (materials.length > 0) {
    materials.forEach((material, index) => {
      if (index < 30) { // 최대 30개 항목 (A26~A55)
        const rowIndex = 25 + index;
        layout[rowIndex][0] = index + 1; // NO
        layout[rowIndex][1] = material.name || material.partName || ''; // 부품명
        layout[rowIndex][2] = material.quantity || 0; // 수량
        layout[rowIndex][3] = material.price || material.unitPrice || 0; // 단가
        layout[rowIndex][4] = (material.quantity || 0) * (material.price || material.unitPrice || 0); // 금액
        layout[rowIndex][5] = material.note || material.remarks || ''; // 비고
      }
    });
  } else {
    // 기본 번호만 입력 (1~30)
    for (let i = 0; i < 30; i++) {
      layout[25 + i][0] = i + 1;
    }
  }
  
  // 특기사항
  layout[55][0] = '특기사항';
  layout[55][1] = safeData.specialNotes || '';
  
  // 회사명 푸터
  layout[58][7] = '(주)삼미앵글산업';
  
  // 병합 정보
  const merges = [
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },   // 문서제목 A5:H5
    { s: { r: 5, c: 1 }, e: { r: 5, c: 2 } },   // 거래일자 값 B6:C6
    { s: { r: 6, c: 1 }, e: { r: 6, c: 2 } },   // 상호명 값 B7:C7
    { s: { r: 7, c: 1 }, e: { r: 7, c: 2 } },   // 담당자 값 B8:C8
    { s: { r: 8, c: 0 }, e: { r: 9, c: 2 } },   // 아래와 같이 발주합니다 A9:C10
    { s: { r: 5, c: 3 }, e: { r: 9, c: 3 } },   // 공급자 D6:D10
    { s: { r: 5, c: 5 }, e: { r: 5, c: 7 } },   // 사업자등록번호 F6:H6
    { s: { r: 7, c: 5 }, e: { r: 7, c: 7 } },   // 소재지 F8:H8
    { s: { r: 9, c: 5 }, e: { r: 9, c: 7 } },   // 홈페이지 F10:H10
    { s: { r: 10, c: 0 }, e: { r: 10, c: 7 } }, // 견적명세 A11:H11
    { s: { r: 11, c: 6 }, e: { r: 11, c: 7 } }, // 비고 G12:H12
    { s: { r: 23, c: 0 }, e: { r: 23, c: 7 } }, // 원자재 명세서 A24:H24
    { s: { r: 24, c: 5 }, e: { r: 24, c: 7 } }, // 원자재 비고 F25:H25
  ];
  
  // 명세 데이터 행의 비고 병합 (A13~A20)
  for (let row = 12; row < 20; row++) {
    merges.push({ s: { r: row, c: 6 }, e: { r: row, c: 7 } });
  }
  
  // 합계 섹션 병합 (A21~A23)
  for (let row = 20; row <= 22; row++) {
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 5 } }); // A21:F21 등
    merges.push({ s: { r: row, c: 6 }, e: { r: row, c: 7 } }); // G21:H21 등
  }
  
  // 원자재 데이터 행의 비고 병합 (A26~A55)
  for (let row = 25; row < 55; row++) {
    merges.push({ s: { r: row, c: 5 }, e: { r: row, c: 7 } });
  }
  
  // 특기사항 병합
  merges.push({ s: { r: 55, c: 0 }, e: { r: 57, c: 7 } }); // A56:H58
  
  return {
    data: layout,
    merges: merges,
    styles: getPurchaseOrderStyles(),
    borders: { start: 'A5', end: 'H58' }
  };
};

// 데이터 검증 및 정제 함수 - 더 강화된 안전성
export const validateAndCleanData = (rawData, type) => {
  // rawData가 null이거나 undefined인 경우 기본값 사용
  const safeData = rawData || {};
  
  const cleanData = {
    date: (safeData.date && typeof safeData.date === 'string') ? safeData.date : new Date().toISOString().slice(0, 10),
    customerName: String(safeData.customerName || safeData.customer || '').trim(),
    contactPerson: String(safeData.contactPerson || safeData.contact || '').trim(),
    specialNotes: String(safeData.specialNotes || safeData.notes || '').trim(),
    transactionNumber: String(safeData.transactionNumber || safeData.orderNumber || safeData.estimateNumber || '').trim(),
    selectedProducts: [], // OptionSelector에서 온 실제 제품 데이터
    materials: [] // 발주서용 원자재 데이터
  };
  
  // 실제 제품 데이터 정제 - 여러 필드명 지원
  const productSources = [
    safeData.selectedProducts,
    safeData.items,
    safeData.products,
    safeData.estimateItems
  ];
  
  for (const source of productSources) {
    if (source && Array.isArray(source) && source.length > 0) {
      cleanData.selectedProducts = source
        .filter(product => product && typeof product === 'object') // null/undefined 제품 필터링
        .map(product => ({
          name: String(product.name || product.title || product.productName || product.itemName || '').trim(),
          quantity: Math.max(0, parseFloat(product.quantity) || 1),
          price: Math.max(0, parseFloat(product.price) || parseFloat(product.unitPrice) || 0),
          description: String(product.description || product.note || product.remarks || product.memo || '').trim()
        }))
        .filter(product => product.name); // 빈 이름 제품 제거
      break; // 첫 번째로 찾은 유효한 배열 사용
    }
  }
  
  // materials 데이터 정제 (발주서용) - 여러 필드명 지원
  const materialSources = [
    safeData.materials,
    safeData.rawMaterials,
    safeData.parts,
    safeData.components
  ];
  
  for (const source of materialSources) {
    if (source && Array.isArray(source) && source.length > 0) {
      cleanData.materials = source
        .filter(material => material && typeof material === 'object')
        .map(material => ({
          name: String(material.name || material.partName || material.materialName || material.componentName || '').trim(),
          quantity: Math.max(0, parseFloat(material.quantity) || 0),
          price: Math.max(0, parseFloat(material.price) || parseFloat(material.unitPrice) || 0),
          note: String(material.note || material.remarks || material.memo || '').trim()
        }))
        .filter(material => material.name); // 빈 이름 재료 제거
      break;
    }
  }
  
  return cleanData;
};

// 파일명 생성 함수 (거래번호 기반)
export const generateFileName = (type, data) => {
  const typeNames = {
    'estimate': '견적서',
    'transaction': '거래명세서',
    'purchase': '발주서',
    'purchaseOrder': '발주서'
  };
  
  const documentType = typeNames[type] || '견적서';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  // 거래번호 추출 - 다양한 필드명 시도
  let transactionNumber = '';
  if (data && typeof data === 'object') {
    transactionNumber = data.transactionNumber || 
                       data.orderNumber || 
                       data.estimateNumber || 
                       data.documentNumber || 
                       data.number ||
                       '';
  }
  
  // 거래번호가 없으면 현재 시간 기반으로 생성
  if (!transactionNumber || transactionNumber === '') {
    const now = new Date();
    transactionNumber = `${today}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 거래번호에서 특수문자 제거
  transactionNumber = String(transactionNumber).replace(/[<>:"/\\|?*]/g, '');
  
  return `${documentType}_${transactionNumber}.xlsx`;
};

// 엑셀 셀 주소 변환 유틸리티
export const getCellAddress = (row, col) => {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
};

// 범위 주소 변환 유틸리티
export const getRangeAddress = (startRow, startCol, endRow, endCol) => {
  return `${getCellAddress(startRow, startCol)}:${getCellAddress(endRow, endCol)}`;
};
