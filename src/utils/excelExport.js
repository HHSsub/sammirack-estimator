import * as XLSX from 'xlsx';

/**
 * 폼 데이터를 엑셀 파일로 내보내는 함수
 * @param {Object} formData - 폼 데이터
 * @param {string} fileName - 저장할 파일명
 * @param {string} formType - 폼 타입 ('estimate', 'purchase', 'delivery')
 */
export const exportToExcel = (formData, fileName, formType) => {
  try {
    // 워크북 생성
    const workbook = XLSX.utils.book_new();
    
    // 폼 타입에 따른 제목 설정
    const titles = {
      estimate: '견적서',
      purchase: '발주서',
      delivery: '거래명세서'
    };
    
    const title = titles[formType] || '문서';
    
    // 헤더 정보 생성
    const headerData = [
      [title],
      [''],
      ['문서번호', formData.documentNumber || ''],
      ['작성일자', formData.date || ''],
      ['회사명', formData.companyName || ''],
      [''],
      ['품목', '단위', '수량', '단가', '금액', '비고']
    ];
    
    // 품목 데이터 추가
    const itemsData = formData.items?.map(item => [
      item.name || '',
      item.unit || '',
      item.quantity || 0,
      item.unitPrice || 0,
      item.totalPrice || 0,
      item.note || ''
    ]) || [];
    
    // 합계 정보
    const summaryData = [
      [''],
      ['소계', '', '', '', formData.subtotal || 0, ''],
      ['세액', '', '', '', formData.tax || 0, ''],
      ['총액', '', '', '', formData.totalAmount || 0, '']
    ];
    
    // 발주서의 경우 자재 정보 추가
    if (formType === 'purchase' && formData.materials) {
      const materialsHeader = [
        [''],
        ['자재 정보'],
        ['품명', '규격', '수량', '단가', '금액', '비고']
      ];
      
      const materialsData = formData.materials.map(material => [
        material.name || '',
        material.specification || '',
        material.quantity || 0,
        material.unitPrice || 0,
        material.totalPrice || 0,
        material.note || ''
      ]);
      
      headerData.push(...materialsHeader, ...materialsData);
    }
    
    // 모든 데이터 결합
    const allData = [...headerData, ...itemsData, ...summaryData];
    
    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(allData);
    
    // 열 너비 설정
    const columnWidths = [
      { wch: 20 }, // 품목
      { wch: 10 }, // 단위
      { wch: 10 }, // 수량
      { wch: 15 }, // 단가
      { wch: 15 }, // 금액
      { wch: 20 }  // 비고
    ];
    worksheet['!cols'] = columnWidths;
    
    // 셀 스타일 설정 (제목)
    if (worksheet['A1']) {
      worksheet['A1'].s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center' }
      };
    }
    
    // 헤더 행 스타일 설정
    const headerRowIndex = headerData.findIndex(row => row[0] === '품목');
    if (headerRowIndex !== -1) {
      const headerRow = headerRowIndex + 1;
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
        const cellRef = col + headerRow;
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'E6E6FA' } },
            alignment: { horizontal: 'center' }
          };
        }
      });
    }
    
    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, title);
    
    // 파일 다운로드
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('엑셀 내보내기 오류:', error);
    alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    return false;
  }
};

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 반환
 */
export const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

/**
 * 파일명에 현재 날짜 추가
 */
export const generateFileName = (baseName, formData) => {
  const date = getCurrentDate();
  const docNumber = formData.documentNumber || '';
  return `${baseName}_${docNumber}_${date}`;
};
