// src/utils/excelExport.js
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { addImageToWorkbook } from "./excelImageHandler.js";

// 파일명 생성
export const generateFileName = (type, date = new Date()) => {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const typeMap = {
    estimate: "견적서",
    purchase: "발주서",
    transaction: "거래명세서",
  };
  const typeName = typeMap[type] || "문서";
  return `${typeName}_${dateStr}.xlsx`;
};

// 기본 스타일
const baseFont = { name: "맑은 고딕", size: 10 };
const borderThin = {
  top: { style: "thin", color: { argb: "000000" } },
  bottom: { style: "thin", color: { argb: "000000" } },
  left: { style: "thin", color: { argb: "000000" } },
  right: { style: "thin", color: { argb: "000000" } },
};

// 컬럼 너비
const getColumnWidths = () => [
  5, // A
  39, // B
  8, // C
  8, // D
  12, // E
  12, // F
  15, // G
  15, // H
];

// 행 높이
const rowHeights = { 5: 25, 9: 40 };

// 색상
const darkGray = "BFBFBF";
const lightGray = "D9D9D9";
const white = "FFFFFF";

// 메인 엑셀 내보내기
export const exportToExcel = async (rawData, type = "estimate") => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("문서");

    // 열 너비 설정
    worksheet.columns = getColumnWidths().map((wch) => ({ width: wch }));

    // 행 높이 설정
    Object.keys(rowHeights).forEach((r) => {
      worksheet.getRow(parseInt(r)).height = rowHeights[r];
    });

    // 문서 제목
    worksheet.mergeCells("A5:H5");
    const titleCell = worksheet.getCell("A5");
    titleCell.value =
      type === "estimate"
        ? "견적서"
        : type === "purchase"
        ? "발주서"
        : "거래명세서";
    titleCell.font = { ...baseFont, bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGray } };
    titleCell.border = borderThin;

    // 고객/공급자 정보 영역
    // 예시: 거래일자, 상호명, 담당자 등
    const infoCells = [
      { ref: "A6:B6", value: rawData.date, style: "customer" },
      { ref: "A7:B7", value: rawData.customerName, style: "customer" },
      { ref: "A8:B8", value: rawData.contactPerson, style: "customer" },
      { ref: "A9:C10", value: "아래와 같이 견적합니다", style: "customer" },
      { ref: "D6:D10", value: rawData.companyName, style: "company" },
      { ref: "E6", value: rawData.companyNumber, style: "company" },
      { ref: "E7", value: rawData.companyName, style: "company" },
      { ref: "F7", value: rawData.ceoName, style: "company" },
      { ref: "G7", value: "대표자", style: "company" },
      { ref: "H7", value: rawData.ceoName, style: "company" },
      { ref: "E8", value: rawData.addressLabel, style: "company" },
      { ref: "F8:H8", value: rawData.addressValue, style: "company" },
      { ref: "E9", value: "TEL", style: "company" },
      { ref: "F9", value: rawData.tel1, style: "company" },
      { ref: "G9", value: "FAX", style: "company" },
      { ref: "H9", value: rawData.fax, style: "company" },
      { ref: "F10:H10", value: rawData.homepage, style: "company" },
    ];

    infoCells.forEach((cell) => {
      worksheet.mergeCells(cell.ref);
      const c = worksheet.getCell(cell.ref.split(":")[0]);
      c.value = cell.value;
      c.font = baseFont;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = borderThin;
      if (cell.style === "customer") c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightGray } };
      if (cell.style === "company") c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: white } };
    });

    // 견적명세 헤더
    worksheet.mergeCells("A11:H11");
    const specTitle = worksheet.getCell("A11");
    specTitle.value = type === "purchase" ? "원자재 명세서" : "견적명세";
    specTitle.font = { ...baseFont, bold: true };
    specTitle.alignment = { horizontal: "center", vertical: "middle" };
    specTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightGray } };
    specTitle.border = borderThin;

    // 명세 컬럼 헤더
    const headers = ["NO", "품명", "단위", "수량", "단가", "공급가", "비고"];
    headers.forEach((text, i) => {
      const col = String.fromCharCode(65 + i) + "12";
      const cell = worksheet.getCell(col);
      cell.value = text;
      cell.font = { ...baseFont, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightGray } };
      cell.border = borderThin;
    });
    worksheet.mergeCells("G12:H12"); // 비고 병합

    // 실제 데이터 넣기
    let startRow = 13;
    rawData.items?.forEach((item, idx) => {
      const r = startRow + idx;
      worksheet.getCell(`A${r}`).value = idx + 1;
      worksheet.getCell(`B${r}`).value = item.name;
      worksheet.getCell(`C${r}`).value = item.unit;
      worksheet.getCell(`D${r}`).value = item.qty;
      worksheet.getCell(`E${r}`).value = item.price;
      worksheet.getCell(`F${r}`).value = item.total;
      worksheet.getCell(`G${r}`).value = item.note;
      worksheet.mergeCells(`G${r}:H${r}`);

      ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
        const cell = worksheet.getCell(`${col}${r}`);
        cell.font = baseFont;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = borderThin;
        if (["E", "F"].includes(col)) cell.numFmt = "#,##0";
      });
    });

    // 소계/부가세/합계
    const totalStartRow = startRow + rawData.items.length;
    const totalLabels = ["소계", "부가가치세", "합계"];
    totalLabels.forEach((label, i) => {
      const r = totalStartRow + i;
      worksheet.mergeCells(`A${r}:F${r}`);
      worksheet.getCell(`A${r}`).value = label;
      worksheet.getCell(`G${r}`).value = rawData.totals?.[i];
      worksheet.getCell(`H${r}`).value = rawData.totals?.[i];
      worksheet.mergeCells(`G${r}:H${r}`);
      ["A","B","C","D","E","F","G","H"].forEach(col=>{
        const cell = worksheet.getCell(`${col}${r}`);
        cell.font = baseFont;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = borderThin;
        if (["G","H"].includes(col)) cell.numFmt = "#,##0";
      })
    });

    // 특기사항
    const noteStart = totalStartRow + 3;
    worksheet.mergeCells(`A${noteStart}:H${noteStart+2}`);
    const noteCell = worksheet.getCell(`A${noteStart}`);
    noteCell.value = rawData.specialNotes || "";
    noteCell.font = baseFont;
    noteCell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    noteCell.border = borderThin;
    noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: white } };

    // 회사명 푸터
    const footerRow = type === "purchase" ? noteStart + 3 : noteStart + 1;
    worksheet.getCell(`H${footerRow}`).value = rawData.companyName;
    worksheet.getCell(`H${footerRow}`).font = { ...baseFont, bold: true };
    worksheet.getCell(`H${footerRow}`).alignment = { horizontal: "center", vertical: "middle" };

    // 이미지 삽입
    if (rawData.logoImageBase64) {
      await addImageToWorkbook(workbook, worksheet, rawData.logoImageBase64, "G7:H8");
    }

    // 브라우저 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blob, generateFileName(type));
  } catch (err) {
    console.error("엑셀 내보내기 실패:", err);
  }
};
