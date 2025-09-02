// src/utils/excelExport.js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// 이미지 로드 (브라우저용 base64)
async function loadImageAsBase64(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

// 파일명 생성
export const generateFileName = (type = 'estimate') => {
  const d = new Date();
  return `${type}_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.xlsx`;
};

// 컬럼 너비
const columnsWidth = [
  { wch: 5 },  // A: NO
  { wch: 39 }, // B: 품명/부품명
  { wch: 8 },  // C: 단위
  { wch: 8 },  // D: 수량
  { wch: 18 }, // E: 단가 (좀 더 넓게)
  { wch: 18 }, // F: 공급가/금액
  { wch: 15 }, // G: 비고
  { wch: 15 }, // H: 비고 확장
];

const centerAlign = { vertical: 'middle', horizontal: 'center', wrapText: true };
const leftAlign = { vertical: 'top', horizontal: 'left', wrapText: true };
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
const lightGrayFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
const docTitleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } }; // 덜 어두운 회색

export const exportExcel = async (data, type = 'estimate') => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(
    type === 'purchase' ? '발주서' : type === 'transaction' ? '거래명세서' : '견적서'
  );
  ws.columns = columnsWidth;

  // 문서 제목
  ws.mergeCells('A5:H5');
  const titleCell = ws.getCell('A5');
  titleCell.value =
    type === 'purchase' ? '발주서' : type === 'transaction' ? '거래명세서' : '견적서';
  titleCell.fill = docTitleFill;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = centerAlign;
  ws.getRow(5).height = 45;

  // 거래일자~아래와 같이 견적/발주합니다
  ws.mergeCells('A6:B6'); ws.getCell('A6').value='거래일자'; ws.getCell('A6').alignment=centerAlign;
  ws.mergeCells('A7:B7'); ws.getCell('A7').value='상호명'; ws.getCell('A7').alignment=centerAlign;
  ws.mergeCells('A8:B8'); ws.getCell('A8').value='담당자'; ws.getCell('A8').alignment=centerAlign;
  ws.mergeCells('A9:C10'); ws.getCell('A9').value=
    type==='purchase'? '아래와 같이 발주합니다':'아래와 같이 견적합니다';
  ws.getCell('A9').alignment=centerAlign; ws.getRow(9).height=40;

  // 공급자/사업자등록번호/상호/대표자/소재지/TEL/FAX/홈페이지
  ws.mergeCells('D6:D10'); ws.getCell('D6').value='삼미앵글랙'; ws.getCell('D6').alignment=centerAlign;
  ws.getCell('E6').value='사업자등록번호';
  ws.mergeCells('F6:H6'); ws.getCell('F6').value='232-81-01750'; ws.getCell('F6').alignment=centerAlign;
  ws.getCell('E7').value='상호'; ws.getCell('F7').value='삼미앵글랙산업';
  ws.getCell('G7').value='대표자'; ws.getCell('H7').value='박이삭';
  ws.getCell('E8').value='소재지'; ws.mergeCells('F8:H8'); ws.getCell('F8').value='경기도 광명시 원노온사로 39, 철제 스틸하우스 1'; ws.getCell('F8').alignment=centerAlign;
  ws.getCell('E9').value='TEL'; ws.getCell('F9').value='010-9548-9578 010-4311-7733';
  ws.getCell('G9').value='FAX'; ws.getCell('H9').value='(02)2611-4595';
  ws.getCell('E10').value='홈페이지'; ws.mergeCells('F10:H10'); ws.getCell('F10').value='http://www.ssmake.com'; ws.getCell('F10').alignment=centerAlign;

  // 견적/발주 명세 제목
  ws.mergeCells('A11:H11'); ws.getCell('A11').value= type==='purchase'? '발주 명세':'견적명세'; ws.getCell('A11').fill=lightGrayFill; ws.getCell('A11').alignment=centerAlign;

  // 테이블 헤더
  ws.getRow(12).values = ['NO','품명','단위','수량','단가','공급가','비고','비고'];
  ws.getRow(12).fill = lightGrayFill; ws.getRow(12).alignment=centerAlign;

  // 아이템 최소 13행 확보 (견적서/거래명세서)
  const minItemRows = type==='purchase'? Math.max(data.items?.length||0, 8) : 13;
  const items = data.items && data.items.length>0 ? data.items : Array.from({length:minItemRows},()=>({name:'',unit:'',quantity:'',unitPrice:'',totalPrice:'',note:''}));
  items.forEach((item,idx)=>{
    const r=13+idx;
    ws.getCell(`A${r}`).value=idx+1;
    ws.getCell(`B${r}`).value=item.name;
    ws.getCell(`C${r}`).value=item.unit;
    ws.getCell(`D${r}`).value=item.quantity;
    ws.getCell(`E${r}`).value=item.unitPrice;
    ws.getCell(`F${r}`).value=item.totalPrice;
    ws.mergeCells(`G${r}:H${r}`);
    ws.getCell(`G${r}`).value=item.note;
    ws.getCell(`G${r}`).alignment=centerAlign;
  });

  // 발주서 원자재 명세
  let materialStartRow = type==='purchase' ? 26 : 0;
  if(type==='purchase'){
    ws.mergeCells(`A24:H24`); ws.getCell('A24').value='원자재 명세서'; ws.getCell('A24').fill=headerFill; ws.getCell('A24').alignment=centerAlign;
    ws.getRow(25).values=['NO','부품명','수량','단가','금액','비고','비고','비고'];
    ws.getRow(25).fill=lightGrayFill; ws.getRow(25).alignment=centerAlign;

    const minMaterialRows = Math.max(data.materials?.length||0,30);
    const materials = data.materials && data.materials.length>0 ? data.materials : Array.from({length:minMaterialRows},()=>({name:'',quantity:'',unitPrice:'',totalPrice:'',note:''}));
    materials.forEach((mat,idx)=>{
      const r=26+idx;
      ws.getCell(`A${r}`).value=idx+1;
      ws.getCell(`B${r}`).value=mat.name;
      ws.getCell(`C${r}`).value=mat.unit||'';
      ws.getCell(`D${r}`).value=mat.quantity;
      ws.getCell(`E${r}`).value=mat.unitPrice;
      ws.getCell(`F${r}`).value=mat.totalPrice;
      ws.mergeCells(`F${r}:H${r}`);
      ws.getCell(`F${r}`).value=mat.note;
      ws.getCell(`F${r}`).alignment=centerAlign;
    });
    materialStartRow += 30;
  }

  // 합계
  const totalRow = (type==='purchase'? materialStartRow+1 : 13+items.length);
  ['소계','부가세','합계'].forEach((label,i)=>{
    ws.mergeCells(`A${totalRow+i}:F${totalRow+i}`); ws.getCell(`A${totalRow+i}`).value=label; ws.getCell(`A${totalRow+i}`).alignment=centerAlign;
    ws.mergeCells(`G${totalRow+i}:H${totalRow+i}`);
    ws.getCell(`G${totalRow+i}`).value=data[label.toLowerCase()]||0; ws.getCell(`G${totalRow+i}`).alignment=centerAlign;
  });

  // 특기사항
  const noteRow = totalRow+3;
  ws.mergeCells(`A${noteRow}:H${noteRow+2}`); ws.getCell(`A${noteRow}`).value=data.notes||''; ws.getCell(`A${noteRow}`).alignment=leftAlign;
  ws.getCell(`H${noteRow+3}`).value='(주)삼미앵글랙산업'; ws.getCell(`H${noteRow+3}`).alignment=centerAlign; ws.getCell(`H${noteRow+3}`).font={bold:true};

  // 도장 이미지
  try{
    const base64 = await loadImageAsBase64('/images/도장.png');
    const imageId = workbook.addImage({base64,extension:'png'});
    ws.addImage(imageId,'H7:H7');
  }catch(e){console.warn('도장 로드 실패',e);}

  // 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer],{type:'application/octet-stream'}),generateFileName(type));
};
