import React from 'react';
import stampImage from '/public/images/도장.png'; 

const BaljuPrint = ({ data }) => {
  const materialData = data?.materials || [];
  const shouldShowMaterials = materialData.length > 0;
  const maxMaterialRows = Math.min(materialData.length, 30);
  const emptyMaterialRows = Math.max(0, 30 - materialData.length);

  return (
    <div className="print-container balju-print print-only">
      <div className="print-preview-notice">
        프린트 미리보기 - 실제 인쇄 시 이 메시지는 표시되지 않습니다
      </div>

      <div className="print-header">
        <h1>거래명세서(발&nbsp;주&nbsp;서)</h1>
        <img className="stamp" src={stampImage} alt="도장" />

        <table className="print-table info-table">
          <tbody>
            <tr>
              <td className="label" style={{width: '12.5%'}}>발주일자</td>
              <td style={{width: '12.5%'}}>{data?.date || ''}</td>
              <td className="label" style={{width: '12.5%'}}>발주번호</td>
              <td style={{width: '12.5%'}}>{data?.orderNumber || ''}</td>
            </tr>
            <tr>
              <td className="label">상호명</td>
              <td>{data?.companyName || ''}</td>
              <td className="label">상호</td>
              <td>삼미앵글랙산업</td>
            </tr>
            <tr>
              <td className="label">담당자</td>
              <td>{data?.contactPerson || ''}</td>
              <td className="label">대표자</td>
              <td>박이삭</td>
            </tr>
            <tr>
              <td colSpan={2} rowSpan={4} style={{
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 15,
                verticalAlign: 'middle',
                padding: '18px 0',
                background: '#fff',
                border: '1px solid #ddd'
              }}>
                아래와 같이 발주합니다 (부가세, 운임비 별도)
              </td>
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

        <table className="print-table order-table">
          <thead>
            <tr>
              <th style={{width: '8%'}}>NO</th>
              <th style={{width: '25%'}}>품명</th>
              <th style={{width: '18%'}}>규격</th>
              <th style={{width: '8%'}}>단위</th>
              <th style={{width: '10%'}}>수량</th>
              <th style={{width: '12%'}}>단가</th>
              <th style={{width: '12%'}}>공급가</th>
              <th style={{width: '9%'}}>비고</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.slice(0, 6).map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td className="left">{item.name || ''}</td>
                <td>{item.specification || ''}</td>
                <td>{item.unit || ''}</td>
                <td>{item.quantity || ''}</td>
                <td className="right">{item.unitPrice ? item.unitPrice.toLocaleString() : ''}</td>
                <td className="right">{item.totalPrice ? item.totalPrice.toLocaleString() : ''}</td>
                <td>{item.note || ''}</td>
              </tr>
            )) || []}

            {Array.from({ length: emptyMaterialRows }, (_, index) => (
              <tr key={`empty-${index}`}>
                <td>{materialData.length + index + 1}</td>
                <td className="left">&nbsp;</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
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
