import React from 'react';
import stampImage from '/images/도장.png';

// 무게명칭 변환
function kgLabelFix(str) {
  if (!str) return '';
  return String(str).replace(/200kg/g, '270kg').replace(/350kg/g, '450kg');
}

const BaljuPrint = ({ data }) => {
  const itemData = data?.items || [];
  const materialDataRaw = data?.materials || [];

  const materialData = materialDataRaw.map(mat => ({
    ...mat,
    unitPrice: mat.unitPrice ?? mat.unit_price ?? 0,
    totalPrice:
      mat.totalPrice ??
      mat.total_price ??
      (mat.unitPrice ?? mat.unit_price ?? 0) * (mat.quantity ?? 0)
  }));

  const filledItemRows = [
    ...itemData,
    ...Array.from({ length: Math.max(0, 8 - itemData.length) }, () => ({
      name: '',
      specification: '',
      unit: '',
      quantity: '',
      unitPrice: '',
      totalPrice: '',
      note: ''
    }))
  ];

  const filledMaterialRows = [
    ...materialData,
    ...Array.from({ length: Math.max(0, 30 - materialData.length) }, () => ({
      name: '',
      specification: '',
      quantity: '',
      unitPrice: '',
      totalPrice: '',
      note: ''
    }))
  ];

  return (
    <div className="print-container balju-print print-only">
      <div className="print-preview-notice">
        프린트 미리보기 - 실제 인쇄 시 이 메시지는 표시되지 않습니다
      </div>
      <div className="print-header">
        <h1>발&nbsp;주&nbsp;서</h1>
        <img className="stamp" src={stampImage} alt="도장" />
        <table className="print-table info-table">
          <tbody>
            <tr>
              <td className="label" style={{ width: '12.5%' }}>거래일자</td>
              <td style={{ width: '12.5%' }}>{data?.date || ''}</td>
              <td className="label" style={{ width: '12.5%' }}>거래번호</td>
              <td style={{ width: '12.5%' }}>{data?.orderNumber || ''}</td>
            </tr>
            <tr>
              <td className="label">상호명</td>
              <td>{data?.companyName || ''}</td>
              <td className="label">상호</td>
              <td>삼미앵글랙산업</td>
            </tr>
            <tr>
              <td colSpan={2} rowSpan={4} style={{
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '15px',
                verticalAlign: 'middle',
                padding: '18px 0',
                background: '#fff',
                border: '1px solid #ddd'
              }}>
                아래와 같이 발주합니다 (부가세, 운임비 별도)
              </td>
              <td className="label">대표자</td>
              <td>박이삭</td>
            </tr>
            <tr>
              <td className="label">소재지</td>
              <td>경기도 광명시 원노온사로 39, 제1동</td>
            </tr>
            <tr>
              <td className="label">TEL</td>
              <td>(02)2611-4597</td>
            </tr>
            <tr>
              <td className="label">FAX</td>
              <td>(02)2611-4595</td>
            </tr>
            <tr>
              <td className="label">홈페이지</td>
              <td>http://www.ssmake.com</td>
            </tr>
          </tbody>
        </table>
        <h3 style={{ marginTop: '12px', fontWeight: 'bold' }}>발주 명세</h3>
        <table className="print-table order-table">
          <thead>
            <tr>
              <th style={{ width: '8%' }}>NO</th>
              <th style={{ width: '25%' }}>품명</th>
              <th style={{ width: '18%' }}>규격</th>
              <th style={{ width: '8%' }}>단위</th>
              <th style={{ width: '10%' }}>수량</th>
              <th style={{ width: '12%' }}>단가</th>
              <th style={{ width: '12%' }}>공급가</th>
              <th style={{ width: '9%' }}>비고</th>
            </tr>
          </thead>
          <tbody>
            {filledItemRows.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td className="left">{kgLabelFix(item.name || '')}</td>
                <td>{kgLabelFix(item.specification || '')}</td>
                <td>{kgLabelFix(item.unit || '')}</td>
                <td className="right">{item.quantity || ''}</td>
                <td className="right">{item.unitPrice ? Number(item.unitPrice).toLocaleString() : ''}</td>
                <td className="right">{item.totalPrice ? Number(item.totalPrice).toLocaleString() : ''}</td>
                <td>{item.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ marginTop: '24px', fontWeight: 'bold' }}>원자재 명세서</h3>
        <table className="print-table material-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '7%' }}>NO</th>
              <th style={{ width: '24%' }}>부품명</th>
              <th style={{ width: '17%' }}>규격/설명</th>
              <th style={{ width: '8%' }}>수량</th>
              <th style={{ width: '14%' }}>단가</th>
              <th style={{ width: '13%' }}>금액</th>
              <th style={{ width: '7%' }}>비고</th>
            </tr>
          </thead>
          <tbody>
            {filledMaterialRows.map((row, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td style={{ textAlign: 'left' }}>{kgLabelFix(row.name || '')}</td>
                <td>{kgLabelFix(row.specification || '')}</td>
                <td className="right">{row.quantity || ''}</td>
                <td className="right">{row.unitPrice ? Number(row.unitPrice).toLocaleString() : ''}</td>
                <td className="right">{row.totalPrice ? Number(row.totalPrice).toLocaleString() : ''}</td>
                <td>{row.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="print-footer">
        <table className="print-table">
          <tbody>
            <tr>
              <td className="label">소계</td>
              <td className="right">{data?.subtotal ? data.subtotal.toLocaleString() : '0'}</td>
            </tr>
            <tr>
              <td className="label">부가세</td>
              <td className="right">{data?.tax ? data.tax.toLocaleString() : '0'}</td>
            </tr>
            <tr>
              <td className="label"><strong>합계</strong></td>
              <td className="right"><strong>{data?.totalAmount ? data.totalAmount.toLocaleString() : '0'}</strong></td>
            </tr>
          </tbody>
        </table>
        {data?.notes && data.notes.trim() && (
          <div className="print-notes">
            <strong>비고:</strong> {data.notes}
          </div>
        )}
        <div className="print-company">(주)삼미앵글랙산업</div>
      </div>
    </div>
  );
};

export default BaljuPrint;
