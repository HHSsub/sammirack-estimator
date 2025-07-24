import React from 'react';

/**
 * GyeonjukPrint component for rendering printable estimate documents
 * Based on the original gyeonjuk.html template
 */
const GyeonjukPrint = ({ data }) => {
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

  // Render table rows (15 rows total)
  const renderTableRows = () => {
    const rows = [];
    const maxRows = 15;
    
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
    
    // Add empty rows to fill up to 15 rows
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
    <div className="gyeonjuk-print">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        .gyeonjuk-print {
          font-family: "Malgun Gothic", "맑은 고딕", Arial, sans-serif;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.1;
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
          font-size: 18px;
          margin: 8px 0;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .stamp {
          position: absolute;
          top: 20mm;
          right: 25mm;
          width: 60px;
          opacity: 0.6;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6px;
        }

        td, th {
          border: 1px solid #000;
          padding: 3px 4px;
          text-align: center;
          font-size: 10px;
          line-height: 1.1;
          vertical-align: middle;
        }

        .info-table td {
          text-align: left;
          padding: 4px 6px;
        }

        .label {
          background-color: #f0f0f0;
          font-weight: bold;
          width: 80px;
        }

        .quote-table th {
          background-color: #d9d9d9;
          font-weight: bold;
          padding: 4px 2px;
        }

        .quote-table td {
          padding: 2px 3px;
        }

        .right { text-align: right; }
        .left { text-align: left; }

        .company {
          text-align: right;
          margin-top: 8px;
          font-weight: bold;
          font-size: 11px;
        }

        .notes {
          border: 1px solid #000;
          height: 35px;
          padding: 6px;
          font-size: 10px;
          margin-top: 6px;
        }

        /* 합계 테이블 스타일 */
        .total-table {
          width: 40%;
          margin-left: auto;
          margin-bottom: 6px;
        }

        .total-table td {
          padding: 4px 8px;
          font-size: 11px;
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

          .gyeonjuk-print {
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
        <h1>견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
        
        {/* 상단 정보 */}
        <table className="info-table">
          <tbody>
            <tr>
              <td className="label">견적일자</td>
              <td>{formatDate(data.date) || formatDate(new Date())}</td>
              <td className="label">사업자등록번호</td>
              <td>232-81-01750</td>
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

        {/* 견적 명세 */}
        <table className="quote-table">
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
            {renderTableRows()}
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

export default GyeonjukPrint;
