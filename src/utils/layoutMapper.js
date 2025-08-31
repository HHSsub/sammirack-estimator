// layoutMapper.js

const styles = require('./excelStyles');
const { insertImage } = require('./excelImageHandler');

function setupEstimateLayout(ws, data) {
  // 1. A1~A16 각 행을 오른쪽(B열)과 병합
  for (let r = 1; r <= 16; r++) {
    ws.mergeCells(`A${r}:B${r}`);
  }

  // 2. 상단 이미지(로고/도장) 삽입
  // (기존 로직 유지)
  insertImage(ws, data.logo, 'A1', { width: 150, height: 60 });
  insertImage(ws, data.stamp, 'F1', { width: 80, height: 80 });

  // 3. 견적일자 라벨 및 날짜
  ws.getCell('A5').value = '견적일자';
  ws.getCell('A5').style = styles.header;
  ws.mergeCells('C5:D5');
  ws.getCell('C5').value = data.estimateDate;
  ws.getCell('C5').style = styles.text;

  // 4. 상호명, 담당자 레이블
  ws.getCell('A6').value = '상호명';
  ws.getCell('A6').style = styles.text;
  ws.getCell('A7').value = '담당자';
  ws.getCell('A7').style = styles.text;

  // 5. “아래와 같이 견적합니다” 문구
  ws.mergeCells('D5:D9');
  ws.getCell('D5').value = '아래와 같이 견적합니다';
  ws.getCell('D5').style = styles.text;
  for (let r = 6; r <= 9; r++) {
    ws.getCell(`D${r}`).style = styles.text;
  }

  // 6. 왼쪽 레이블 (사업자등록번호, 상 호, 소 재 지, T E L, 홈페이지)
  const labels = ['사업자등록번호', '상 호', '소 재 지', 'T E L', '홈페이지'];
  labels.forEach((txt, idx) => {
    const cell = ws.getCell(`E${5 + idx}`);
    cell.value = txt;
    cell.style = styles.text;
  });

  // 7. 우측 값 영역
  ws.mergeCells('F5:I5');
  ws.getCell('F5').value = data.companyRegistrationNumber;
  ws.getCell('F5').style = styles.text;

  // 상호명
  ws.getCell('F6').value = data.companyName;
  ws.getCell('F6').style = styles.text;

  // 대표자
  ws.getCell('G6').value = '대표자';
  ws.getCell('G6').style = styles.text;
  ws.mergeCells('H6:I6');
  ws.getCell('H6').value = data.representative;
  ws.getCell('H6').style = styles.text;

  // 주소
  ws.mergeCells('F7:I7');
  ws.getCell('F7').value = data.address;
  ws.getCell('F7').style = styles.text;

  // T E L / FAX 레이블
  ws.getCell('F8').value = data.phone;
  ws.getCell('F8').style = styles.text;
  ws.getCell('G8').value = 'FAX';
  ws.getCell('G8').style = styles.text;

  // FAX 번호
  ws.mergeCells('H8:I8');
  ws.getCell('H8').value = data.fax;
  ws.getCell('H8').style = styles.text;

  // 홈페이지
  ws.mergeCells('F9:I9');
  ws.getCell('F9').value = data.website;
  ws.getCell('F9').style = styles.text;

  // 8. “견적금액(부가세포함)” 영역
  ws.mergeCells('A10:C10');
  ws.getCell('A10').value = '견적금액(부가세포함)';
  ws.getCell('A10').style = styles.header;

  // 9. 표 머릿글: NO, 품목명, 규격, 수량, 단가, 공급가
  // A17에 NO 배치
  ws.getCell('A17').value = 'NO';
  ws.getCell('A17').style = styles.header;
  // B16:G16 병합 및 “견적명세” 타이틀
  ws.mergeCells('B16:G16');
  ws.getCell('B16').value = '견적명세';
  ws.getCell('B16').style = styles.header;

  // 10. 컬럼 너비 조정
  ws.getColumn('B').width = 32;  // 품목명 넉넉히

  // 11. 데이터 영역: items 삽입
  data.items.forEach((item, idx) => {
    const row = 17 + idx;
    ws.getCell(`A${row}`).value = idx + 1;
    ws.getCell(`A${row}`).style = styles.text;

    ws.getCell(`B${row}`).value = item.name;
    ws.getCell(`B${row}`).style = styles.text;

    ws.getCell(`C${row}`).value = item.spec;
    ws.getCell(`C${row}`).style = styles.text;

    ws.getCell(`D${row}`).value = item.quantity;
    ws.getCell(`D${row}`).style = styles.number;

    ws.getCell(`E${row}`).value = item.unitPrice;
    ws.getCell(`E${row}`).style = styles.number;

    ws.getCell(`F${row}`).value = item.supplyAmount;
    ws.getCell(`F${row}`).style = styles.number;

    ws.getCell(`G${row}`).value = item.remarks || '';
    ws.getCell(`G${row}`).style = styles.text;
  });

  // 12. 전체 테두리 적용 (A5:G35)
  for (let r = 5; r <= 35; r++) {
    for (let c = 1; c <= 7; c++) {
      ws.getCell(r, c).style = {
        ...ws.getCell(r, c).style,
        ...styles.allBorders
      };
    }
  }
}

module.exports.setupEstimateLayout = setupEstimateLayout;

// layoutMapper.js (continued)

function setupPurchaseOrderLayout(ws, data) {
  // 1. A1~A16 각 행을 오른쪽(B열)과 병합
  for (let r = 1; r <= 16; r++) {
    ws.mergeCells(`A${r}:B${r}`);
  }

  // 2. 이미지 삽입 (기존 로직)
  insertImage(ws, data.logo, 'A1', { width: 150, height: 60 });
  insertImage(ws, data.stamp, 'F1', { width: 80, height: 80 });

  // 3. 발주일자
  ws.getCell('A5').value = '견적일자';
  ws.getCell('A5').style = styles.header;
  ws.mergeCells('C5:D5');
  ws.getCell('C5').value = data.orderDate;
  ws.getCell('C5').style = styles.text;

  // 4. 상호명, 담당자
  ws.getCell('A6').value = '상호명';
  ws.getCell('A6').style = styles.text;
  ws.getCell('A7').value = '담당자';
  ws.getCell('A7').style = styles.text;

  // 5. “아래와 같이 견적합니다” 문구
  ws.mergeCells('D5:D9');
  ws.getCell('D5').value = '아래와 같이 견적합니다';
  ws.getCell('D5').style = styles.text;
  for (let r = 6; r <= 9; r++) {
    ws.getCell(`D${r}`).style = styles.text;
  }

  // 6. 왼쪽 레이블
  const labels = ['사업자등록번호', '상 호', '소 재 지', 'T E L', '홈페이지'];
  labels.forEach((txt, idx) => {
    const cell = ws.getCell(`E${5 + idx}`);
    cell.value = txt;
    cell.style = styles.text;
  });

  // 7. 우측 값
  ws.mergeCells('F5:I5');
  ws.getCell('F5').value = data.companyRegistrationNumber;
  ws.getCell('F5').style = styles.text;
  ws.getCell('F6').value = data.companyName;
  ws.getCell('F6').style = styles.text;

  ws.getCell('G6').value = '대표자';
  ws.getCell('G6').style = styles.text;
  ws.mergeCells('H6:I6');
  ws.getCell('H6').value = data.representative;
  ws.getCell('H6').style = styles.text;

  ws.mergeCells('F7:I7');
  ws.getCell('F7').value = data.address;
  ws.getCell('F7').style = styles.text;

  ws.getCell('F8').value = data.phone;
  ws.getCell('F8').style = styles.text;
  ws.getCell('G8').value = 'FAX';
  ws.getCell('G8').style = styles.text;
  ws.mergeCells('H8:I8');
  ws.getCell('H8').value = data.fax;
  ws.getCell('H8').style = styles.text;

  ws.mergeCells('F9:I9');
  ws.getCell('F9').value = data.website;
  ws.getCell('F9').style = styles.text;

  // 8. “견적금액(부가세포함)” 영역
  ws.mergeCells('A10:C10');
  ws.getCell('A10').value = '견적금액(부가세포함)';
  ws.getCell('A10').style = styles.header;

  // 9. “납기” 칸 제거 → 비고 칸을 왼쪽으로 당김
  // (기존 purchase 헤더 영역에서 납기 로직이 있다면 삭제)

  // 10. 표 머릿글: NO, 품목명, 규격, 수량, 단가, 공급가, 비고
  ws.getCell('A17').value = 'NO';
  ws.getCell('A17').style = styles.header;
  ws.mergeCells('B16:G16');
  ws.getCell('B16').value = '견적명세';
  ws.getCell('B16').style = styles.header;

  // G17: “공급가”
  ws.getCell('G17').value = '공급가';
  ws.getCell('G17').style = styles.header;

  // 비고는 H17으로
  ws.getCell('H17').value = '비고';
  ws.getCell('H17').style = styles.header;

  // 11. 아이템 데이터 삽입
  data.items.forEach((item, idx) => {
    const row = 17 + idx;
    ws.getCell(`A${row}`).value = idx + 1;
    ws.getCell(`A${row}`).style = styles.text;

    ws.getCell(`B${row}`).value = item.name;
    ws.getCell(`B${row}`).style = styles.text;

    ws.getCell(`C${row}`).value = item.spec;
    ws.getCell(`C${row}`).style = styles.text;

    ws.getCell(`D${row}`).value = item.quantity;
    ws.getCell(`D${row}`).style = styles.number;

    ws.getCell(`E${row}`).value = item.unitPrice;
    ws.getCell(`E${row}`).style = styles.number;

    ws.getCell(`F${row}`).value = item.amount;
    ws.getCell(`F${row}`).style = styles.number;

    ws.getCell(`G${row}`).value = item.supplyPrice;
    ws.getCell(`G${row}`).style = styles.number;

    ws.getCell(`H${row}`).value = item.remarks || '';
    ws.getCell(`H${row}`).style = styles.text;
  });

  // 12. 소계/부가가치세/합계 병합
  ws.mergeCells('C31:G31');
  ws.getCell('C31').value = '소계';
  ws.getCell('C31').style = styles.text;
  ws.mergeCells('C32:G32');
  ws.getCell('C32').value = '부가가치세';
  ws.getCell('C32').style = styles.text;
  ws.mergeCells('C33:G33');
  ws.getCell('C33').value = '합계';
  ws.getCell('C33').style = styles.text;

  // 13. 전체 테두리 적용 (A5:H62)
  for (let r = 5; r <= 62; r++) {
    for (let c = 1; c <= 8; c++) {
      ws.getCell(r, c).style = {
        ...ws.getCell(r, c).style,
        ...styles.allBorders
      };
    }
  }
}

module.exports.setupPurchaseOrderLayout = setupPurchaseOrderLayout;
