import React from 'react';

const BaljuPrint = ({ data }) => {
  // 원자재 데이터 균형잡힌 처리
  const materialData = data?.materials || [];
  const shouldShowMaterials = materialData.length > 0;
  const maxMaterialRows = Math.min(materialData.length, 10); // 15행에서 10행으로 축소
  const emptyMaterialRows = Math.max(0, 10 - materialData.length); // 항상 10행 유지
  
  return (
    <div className="print-container balju-print print-only">
      <div className="print-preview-notice">
        프실제 인쇄 시 이 메시지는 표시되지 않습니다
      </div>
      
      {/* flexbox 스타일 제거하고 일반 div 구조로 변경 */}
      <div className="print-header">
        <h1>거래명세서(발&nbsp;&nbsp;&nbsp;&nbsp;주&nbsp;&nbsp;&nbsp;&nbsp;서)</h1>
        <img className="stamp" src="/images/도장.png" alt="도장" />

        {/* 상단 정보 */}
        <table className="print-table info-table">
          <tbody>
            <tr>
              <td className="label" style={{width: '15%'}}>발주일자</td>
              <td style={{width: '35%'}}>{data?.date || ''}</td>
              <td className="label" style={{width: '15%'}}>발주번호</td>
              <td style={{width: '35%'}}>{data?.orderNumber || ''}</td>
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

        {/* 발주 명세 - 6행으로 설정 */}
        <table className="print-table order-table">
          <thead>
            <tr>
              <th style={{width: '8%'}}>NO</th>
              <th style={{width: '25%'}}>품명</th>
              <th style={{width: '18%'}}>규격</th>
              <th style={{width: '8%'}}>단위</th>
              <th style={{width: '8%'}}>수량</th>
              <th style={{width: '12%'}}>단가</th>
              <th style={{width: '12%'}}>공급가</th>
              <th style={{width: '9%'}}>비고</th>
            </tr>
          </thead>
          <tbody>
            {/* 발주 품목 데이터 */}
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
            
            {/* 빈 행들로 6행 채우기 */}
            {Array.from({ length: Math.max(0, 6 - (data?.items?.length || 0)) }, (_, index) => (
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
      </div>

      {/* 원자재 명세서 - flexbox 제거 */}
      {shouldShowMaterials && (
        <div className="print-materials">
          <h2>원자재 명세서</h2>
          <table className="print-table material-table">
            <thead>
              <tr>
                <th style={{width: '8%'}}>NO</th>
                <th style={{width: '30%'}}>원자재명</th>
                <th style={{width: '20%'}}>규격</th>
                <th style={{width: '8%'}}>단위</th>
                <th style={{width: '10%'}}>수량</th>
                <th style={{width: '12%'}}>단가</th>
                <th style={{width: '12%'}}>공급가</th>
              </tr>
            </thead>
            <tbody>
              {/* 실제 원자재 데이터 */}
              {materialData.slice(0, maxMaterialRows).map((material, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td className="left">{material.name || ''}</td>
                  <td>{material.specification || ''}</td>
                  <td>{material.unit || ''}</td>
                  <td>{material.quantity || ''}</td>
                  <td className="right">{material.unitPrice ? material.unitPrice.toLocaleString() : ''}</td>
                  <td className="right">{material.totalPrice ? material.totalPrice.toLocaleString() : ''}</td>
                </tr>
              ))}
              
              {/* 빈 행들로 페이지 채우기 */}
              {Array.from({ length: emptyMaterialRows }, (_, index) => (
                <tr key={`empty-${index}`}>
                  <td>{materialData.length + index + 1}</td>
                  <td className="left">&nbsp;</td>
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
      )}

      <div className="print-footer">
        {/* 합계 */}
        <table className="print-table">
          <tbody>
            <tr>
              <td className="label" style={{width: '20%'}}>소계</td>
              <td className="right" style={{width: '80%'}}>{data?.subtotal ? data.subtotal.toLocaleString() : '0'}</td>
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
        {data?.notes && data.notes.trim() && (
          <div className="print-notes">
            <strong>비고:</strong> {data.notes}
          </div>
        )}

        {/* 하단 회사명 */}
        <div className="print-company">(주)삼미앵글랙산업</div>
      </div>
    </div>
  );
};

export default BaljuPrint;
