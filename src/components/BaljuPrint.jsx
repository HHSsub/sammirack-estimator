import React from 'react';

/**
 * BaljuPrint component for rendering printable purchase order documents
 * Based on the original balju.html template
 */
const BaljuPrint = ({ data }) => {
  if (!data) {
    return null;
  }

  // Format date strings
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  // Format number with commas
  const formatNumber = (num) => {
    if (!num) return '';
    return num.toLocaleString();
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = data.items?.reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;
    const vat = Math.round(subtotal * 0.1);
    const total = subtotal + vat;
    
    return { subtotal, vat, total };
  };

  const { subtotal, vat, total } = calculateTotals();

  // Render order table rows (8 rows total)
  const renderOrderTableRows = () => {
    const rows = [];
    const maxRows = 8;
    
    // Add data rows
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        if (index < maxRows) {
          rows.push(
            <tr key={index}>
              <td>{index + 1}</td>
              <td className="left">{item.name || ''}</td>
              <td>{item.specification || ''}</td>
              <td>{item.unit || ''}</td>
              <td>{item.quantity || ''}</td>
              <td className="right">{formatNumber(item.unitPrice)}</td>
              <td className="right">{formatNumber(item.totalPrice)}</td>
              <td>{item.note || ''}</td>
            </tr>
          );
        }
      });
    }
    
    // Add empty rows to fill up to 8 rows
    for (let i = rows.length; i < maxRows; i++) {
      rows.push(
        <tr key={i}>
          <td>{i + 1}</td>
          <td className="left">&nbsp;</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      );
    }
    
    return rows;
  };

  // Render material table rows (30 rows total)
  const renderMaterialTableRows = () => {
    const rows = [];
    const maxRows = 30;
    
    // Add data rows
    if (data.materials && data.materials.length > 0) {
      data.materials.forEach((material, index) => {
        if (index < maxRows) {
          rows.push(
            <tr key={index}>
              <td>{index + 1}</td>
              <td className="left">{material.name || ''}</td>
              <td>{material.specification || ''}</td>
              <td>{material.unit || ''}</td>
              <td>{material.quantity || ''}</td>
              <td className="right">{formatNumber(material.unitPrice)}</td>
              <td className="right">{formatNumber(material.totalPrice)}</td>
              <td>{material.note || ''}</td>
            </tr>
          );
        }
      });
    }
    
    // Add empty rows to fill up to 30 rows
    for (let i = rows.length; i < maxRows; i++) {
      rows.push(
        <tr key={i}>
          <td>{i + 1}</td>
          <td className="left">&nbsp;</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      );
    }
    
    return rows;
  };

  return (
    <div className="balju-print">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        .balju-print {
          font-family: "Malgun Gothic", "맑은 고딕", Arial, sans-serif;
          margin: 0;
          padding: 0;
          font-size: 10px;
          line-height: 1.0;
        }

        .container {
          width: 194mm;
          height: 281mm;
          padding: 0;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        h1 {
          text-align: center;
          font-size: 16px;
          margin: 6px 0;
          font-weight: bold;
          letter-spacing: 1px;
        }

        h2 {
          font-size: 12px;
          margin: 8px 0 4px 0;
          font-weight: bold;
        }

        .stamp {
          position: absolute;
          top: 18mm;
          right: 25mm;
          width: 50px;
          opacity: 0.6;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 4px;
        }

        td, th {
          border: 1px solid #000;
          padding: 2px 3px;
          text-align: center;
          font-size: 9px;
          line-height: 1.0;
          vertical-align: middle;
        }

        .info-table td {
          text-align: left;
          padding: 3px 4px;
          font-size: 10px;
        }

        .label {
          background-color: #f0f0f0;
          font-weight: bold;
          width: 70px;
        }

        .order-table th, .material-table th {
          background-color: #d9d9d9;
          font-weight: bold;
          padding: 3px 1px;
          font-size: 8px;
        }

        .order-table td, .material-table td {
          padding: 1px 2px;
          font-size: 8px;
        }

        .right { text-align: right; }
        .left { text-align: left; }

        .company {
          text-align: right;
          margin-top: 6px;
          font-weight: bold;
          font-size: 10px;
        }

        .notes {
          border: 1px solid #000;
          height: 25px;
          padding: 4px;
          font-size: 9px;
          margin-top: 4px;
        }

        /* 합계 테이블 스타일 */
        .total-table {
          width: 35%;
          margin-left: auto;
          margin-bottom: 4px;
        }

        .total-table td {
          padding: 3px 6px;
          font-size: 10px;
        }

        /* 원자재 명세서 테이블 최적화 */
        .material-table {
          margin-top: 6px;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
          }

          .balju-print {
            width: 100% !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .container {
            width: 100% !important;
            height: 100vh !important;
            max-height: 100vh !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }

        @media screen {
          .container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            padding: 8mm;
          }
        }
      `}</style>
      
      <div className="container">
        <h1>발&nbsp;&nbsp;&nbsp;&nbsp;주&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
        
        {/* 상단 정보 */}
        <table className="info-table">
          <tbody>
            <tr>
              <td className="label">발주일자</td>
              <td>{formatDate(data.date) || formatDate(new Date())}</td>
              <td className="label">발주번호</td>
              <td>{data.orderNumber || 'PO-' + formatDate(new Date()).replace(/-/g, '') + '-001'}</td>
            </tr>
            <tr>
              <td className="label">상호명</td>
              <td>삼미앵글랙산업</td>
              <td className="label">대표자</td>
              <td>박이삭</td>
            </tr>
            <tr>
              <td className="label">소재지</td>
              <td colSpan="3">경기도 광명시 원노온사로 39, 제1동</td>
            </tr>
            <tr>
              <td className="label">TEL</td>
              <td>(02)2611-4597</td>
              <td className="label">FAX</td>
              <td>(02)2611-4595</td>
            </tr>
            <tr>
              <td className="label">홈페이지</td>
              <td colSpan="3">http://www.ssmake.com</td>
            </tr>
          </tbody>
        </table>

        {/* 발주 명세 (NO 1~8) */}
        <table className="order-table">
          <thead>
            <tr>
              <th>NO</th>
              <th>품명</th>
              <th>규격</th>
              <th>단위</th>
              <th>수량</th>
              <th>단가</th>
              <th>공급가</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {renderOrderTableRows()}
          </tbody>
        </table>

        {/* 원자재 명세 (NO 1~30) */}
        <h2>원자재 명세서</h2>
        <table className="material-table">
          <thead>
            <tr>
              <th>NO</th>
              <th>원자재명</th>
              <th>규격</th>
              <th>단위</th>
              <th>수량</th>
              <th>단가</th>
              <th>공급가</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {renderMaterialTableRows()}
          </tbody>
        </table>

        {/* 합계 */}
        <table className="total-table">
          <tbody>
            <tr>
              <td className="label">소계</td>
              <td className="right">{formatNumber(subtotal)}</td>
            </tr>
            <tr>
              <td className="label">부가세</td>
              <td className="right">{formatNumber(vat)}</td>
            </tr>
            <tr>
              <td className="label"><strong>합계</strong></td>
              <td className="right"><strong>{formatNumber(total)}</strong></td>
            </tr>
          </tbody>
        </table>

        {/* 비고 */}
        <div className="notes">
          {data.notes || '비고사항'}
        </div>

        {/* 하단 회사명 */}
        <div className="company">(주)삼미앵글랙산업</div>
      </div>
    </div>
  );
};

export default BaljuPrint;
