import React from 'react';
import stampImage from '/public/images/도장.png';

const GyeonjukPrint = ({ data }) => {
  return (
    <div className="print-container gyeonjuk-print print-only">
      <div className="print-preview-notice">
        프린트 미리보기 - 실제 인쇄 시 이 메시지는 표시되지 않습니다
      </div>
      
      <h1>견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
      <img className="stamp" src={stampImage} alt="도장" />

      {/* 상단 정보 - 엑셀 양식과 동일한 구조 */}
      <table className="print-table info-table">
        <tbody>
          <tr>
            <td className="label" style={{width: '15%'}}>견적일자</td>
            <td style={{width: '20%'}}>{data?.date || ''}</td>
            <td className="label" style={{width: '15%'}}>사업자등록번호</td>
            <td style={{width: '20%'}}>232-81-01750</td>
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
            <td className="label"></td>
            <td></td>
            <td className="label">소재지</td>
            <td>경기도 광명시 원노온사로 39, 제1동</td>
          </tr>
          <tr>
            <td className="label"></td>
            <td></td>
            <td className="label">TEL</td>
            <td>(02)2611-4597</td>
          </tr>
          <tr>
            <td className="label"></td>
            <td></td>
            <td className="label">FAX</td>
            <td>(02)2611-4595</td>
          </tr>
          <tr>
            <td className="label"></td>
            <td></td>
            <td className="label">홈페이지</td>
            <td>http://www.ssmake.com</td>
          </tr>
        </tbody>
      </table>

      {/* 견적 명세 */}
      <table className="print-table quote-table">
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
          {/* 데이터 행들 */}
          {data?.items?.map((item, index) => (
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
          
          {/* 빈 행들로 15행 채우기 */}
          {Array.from({ length: Math.max(0, 15 - (data?.items?.length || 0)) }, (_, index) => (
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

export default GyeonjukPrint;
