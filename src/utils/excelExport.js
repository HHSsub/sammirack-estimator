import ExcelJS from 'exceljs';

// 파일명 자동 생성
export const generateFileName = (type = 'estimate') => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${type}_${y}${m}${d}.xlsx`;
};

// 엑셀 내보내기 함수
export const exportToExcel = async (data, type = 'estimate') => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type === 'purchase' ? '발주서' : '견적서');

  // 컬럼 너비 설정
  sheet.columns = [
    { width: 5 },  // A: NO
    { width: 39 }, // B: 품명
    { width: 8 },  // C: 단위
    { width: 8 },  // D: 수량
    { width: 12 }, // E: 단가
    { width: 12 }, // F: 공급가/금액
    { width: 15 }, // G: 비고
    { width: 15 }  // H: 비고 확장
  ];

  // 행 높이 설정
  sheet.getRow(5).height = 45;  // 문서 제목
  sheet.getRow(9).height = 40;  // 특이사항 / 안내문

  // 문서제목
  sheet.mergeCells('A5:H5');
  const titleCell = sheet.getCell('A5');
  titleCell.value = type === 'purchase' ? '발주서' : (data.type === 'estimate' ? '견적서' : '거래명세서');
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '595959' } }; // 어두운 회색 35%

  // 상단 정보
  sheet.mergeCells('A6:B6');
  sheet.getCell('A6').value = '거래일자';
  sheet.mergeCells('A7:B7');
  sheet.getCell('A7').value = '상호명';
  sheet.mergeCells('A8:B8');
  sheet.getCell('A8').value = '담당자';
  sheet.mergeCells('A9:C10');
  sheet.getCell('A9').value = type === 'purchase' ? '아래와 같이 발주합니다' : '아래와 같이 견적합니다';

  sheet.mergeCells('D6:D10');
  sheet.getCell('D6').value = '공급자';
  sheet.getCell('E6').value = '사업자등록번호';
  sheet.mergeCells('F6:H6');
  sheet.getCell('F6').value = '232-81-01750';
  sheet.getCell('E7').value = '상호';
  sheet.getCell('F7').value = '삼미앵글랙산업';
  sheet.getCell('G7').value = '대표자';
  sheet.getCell('H7').value = '박이삭';
  sheet.getCell('E8').value = '소재지';
  sheet.mergeCells('F8:H8');
  sheet.getCell('F8').value = '경기도 광명시 원노온사로 39, 철제 스틸하우스 1';
  sheet.getCell('E9').value = 'TEL';
  sheet.getCell('F9').value = '010-9548-9578  010-4311-7733';
  sheet.getCell('G9').value = 'FAX';
  sheet.getCell('H9').value = '(02)2611-4595';
  sheet.getCell('E10').value = '홈페이지';
  sheet.mergeCells('F10:H10');
  sheet.getCell('F10').value = 'http://www.ssmake.com';

  // 견적/발주/거래명세서 표 헤더
  sheet.mergeCells('A11:H11');
  sheet.getCell('A11').value = type === 'purchase' ? '발주 명세' : '견적명세';
  sheet.getCell('A11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }; // 옅은 회색
  sheet.getCell('A11').alignment = { horizontal: 'center', vertical: 'middle' };

  // 컬럼 헤더
  const headerRow = sheet.getRow(12);
  headerRow.values = ['NO','품명','단위','수량','단가','공급가','비고','비고'];
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E5E5E5' } };
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // 아이템 데이터 삽입
  (data.items || []).forEach((item, index) => {
    const rowIndex = 13 + index;
    sheet.getCell(`A${rowIndex}`).value = index + 1;
    sheet.getCell(`B${rowIndex}`).value = item.name || '';
    sheet.getCell(`C${rowIndex}`).value = item.unit || '';
    sheet.getCell(`D${rowIndex}`).value = item.quantity || 0;
    sheet.getCell(`E${rowIndex}`).value = item.unitPrice || 0;
    sheet.getCell(`F${rowIndex}`).value = item.totalPrice || 0;
    sheet.mergeCells(`G${rowIndex}:H${rowIndex}`);
    sheet.getCell(`G${rowIndex}`).value = item.note || '';
  });

  // 발주서 전용 원자재 명세
  if (type === 'purchase' && data.materials) {
    const matStartRow = 26;
    sheet.mergeCells(`A24:H24`);
    sheet.getCell('A24').value = '원자재 명세서';
    sheet.getCell('A24').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BFBFBF' } };
    sheet.getCell('A24').alignment = { horizontal: 'center', vertical: 'middle' };

    const matHeaderRow = sheet.getRow(25);
    matHeaderRow.values = ['NO','부품명','수량','단가','금액','비고','비고','비고'];
    matHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E5E5E5' } };
    matHeaderRow.font = { bold: true };
    matHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

    (data.materials || []).forEach((mat, idx) => {
      const r = matStartRow + idx;
      sheet.getCell(`A${r}`).value = idx + 1;
      sheet.getCell(`B${r}`).value = mat.name || '';
      sheet.getCell(`C${r}`).value = mat.quantity || 0;
      sheet.getCell(`D${r}`).value = mat.unitPrice || 0;
      sheet.getCell(`E${r}`).value = mat.totalPrice || 0;
      sheet.mergeCells(`F${r}:H${r}`);
      sheet.getCell(`F${r}`).value = mat.note || '';
    });
  }

  // 합계
  const lastItemRow = 12 + (data.items?.length || 0);
  sheet.mergeCells(`A${lastItemRow+1}:F${lastItemRow+1}`);
  sheet.getCell(`A${lastItemRow+1}`).value = '소계';
  sheet.getCell(`G${lastItemRow+1}`).value = data.subtotal || 0;

  sheet.mergeCells(`A${lastItemRow+2}:F${lastItemRow+2}`);
  sheet.getCell(`A${lastItemRow+2}`).value = '부가가치세';
  sheet.getCell(`G${lastItemRow+2}`).value = data.tax || 0;

  sheet.mergeCells(`A${lastItemRow+3}:F${lastItemRow+3}`);
  sheet.getCell(`A${lastItemRow+3}`).value = '합계';
  sheet.getCell(`G${lastItemRow+3}`).value = data.totalAmount || 0;

  // 특기사항
  const specialRow = lastItemRow+4;
  sheet.mergeCells(`A${specialRow}:H${specialRow+2}`);
  sheet.getCell(`A${specialRow}`).value = data.notes || '';

  // 하단 회사명
  sheet.getCell(`H${specialRow+3}`).value = '(주)삼미앵글랙산업';
  sheet.getCell(`H${specialRow+3}`).font = { bold: true };

  // 이미지 삽입 (BASE_URL 기준)
  if (type === 'purchase') {
    const imageId = workbook.addImage({
      filename: `${import.meta.env.BASE_URL}images/도장.png`,
      extension: 'png'
    });
    sheet.addImage(imageId, 'G7:H9'); // 대표자 도장 위치
  }

  // 브라우저에서 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = generateFileName(type);
  link.click();
};
