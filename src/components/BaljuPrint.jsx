import React from 'react';

const BaljuPrint = ({ data }) => {
  return (
    <div className="print-container balju-print print-only">
      <div className="print-preview-notice">
        프린트 미리보기 - 실제 인쇄 시 이 메시지는 표시되지 않습니다
      </div>
      
      <h1>발&nbsp;&nbsp;&nbsp;&nbsp;주&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
      <img className="stamp" src="/images/도장.png" alt="도장" />

      {/* 상단 정보 */}
      <table className="print-table info-table">
        <tbody>
          <tr>
            <td className="label">발주일자</td>
            <td>{data?.date || ''}</td>
            <td className="label">발주번호</td>
            <td>{data?.orderNumber || ''}</td>
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

      {/* 발주 명세 */}
      <table className="print-table order-table">
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
          {/* 발주 품목 데이터 */}
          {data?.items?.slice(0, 8).map((item, index) => (
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
          
          {/* 빈 행들로 8행 채우기 */}
          {Array.from({ length: Math.max(0, 8 - (data?.items?.length || 0)) }, (_, index) => (
            <tr key={`empty-${index}`}>
              <td>{(data?.items?.length || 0) + index + 1}</td>
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

      {/* 원자재 명세서 */}
      <h2>원자재 명세서</h2>
      <table className="print-table material-table">
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
          {/* 원자재 데이터 */}
          {data?.materials?.slice(0, 30).map((material, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td className="left">{material.name || ''}</td>
              <td>{material.specification || ''}</td>
              <td>{material.unit || ''}</td>
              <td>{material.quantity || ''}</td>
              <td className="right">{material.unitPrice ? material.unitPrice.toLocaleString() : ''}</td>
              <td className="right">{material.totalPrice ? material.totalPrice.toLocaleString() : ''}</td>
              <td>{material.note || ''}</td>
            </tr>
          )) || []}
          
          {/* 빈 행들로 30행 채우기 */}
          {Array.from({ length: Math.max(0, 30 - (data?.materials?.length || 0)) }, (_, index) => (
            <tr key={`empty-${index}`}>
              <td>{(data?.materials?.length || 0) + index + 1}</td>
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

      {/* 합계 */}
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

      {/* 비고 */}
      <div className="print-notes">
        {data?.notes || ''}
      </div>

      {/* 하단 회사명 */}
      <div className="print-company">(주)삼미앵글랙산업</div>
    </div>
  );
};

export default BaljuPrint;
