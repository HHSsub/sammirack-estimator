import React from 'react';

const BaljuPrint = ({ data }) => {
  // 원자재 데이터 극단적 처리 - 최대 5행으로 제한하고 조건부 표시
  const materialData = data?.materials || [];
  const shouldShowMaterials = materialData.length > 0 && materialData.length <= 15; // 15개 이하일 때만 표시
  const maxMaterialRows = shouldShowMaterials ? Math.min(materialData.length, 5) : 0; // 최대 5행으로 제한
  
  return (
    <div className="print-container balju-print print-only">
      <div className="print-preview-notice">
        프린트 미리보기 - 실제 인쇄 시 이 메시지는 표시되지 않습니다
      </div>
      
      <h1>발&nbsp;&nbsp;&nbsp;&nbsp;주&nbsp;&nbsp;&nbsp;&nbsp;서</h1>
      <img className="stamp" src="/images/도장.png" alt="도장" />

      {/* 상단 정보 - 행 수 축소 */}
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
            <td className="label">연락처</td>
            <td>(02)2611-4597 / (02)2611-4595</td>
            <td className="label">홈페이지</td>
            <td>http://www.ssmake.com</td>
          </tr>
        </tbody>
      </table>

      {/* 발주 명세 - 4행으로 축소 */}
      <table className="print-table order-table">
        <thead>
          <tr>
            <th style={{width: '8%'}}>NO</th>
            <th style={{width: '25%'}}>품명</th>
            <th style={{width: '20%'}}>규격</th>
            <th style={{width: '8%'}}>단위</th>
            <th style={{width: '8%'}}>수량</th>
            <th style={{width: '12%'}}>단가</th>
            <th style={{width: '12%'}}>공급가</th>
            <th style={{width: '7%'}}>비고</th>
          </tr>
        </thead>
        <tbody>
          {/* 발주 품목 데이터 - 4행으로 축소 */}
          {data?.items?.slice(0, 4).map((item, index) => (
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
          
          {/* 빈 행들로 4행 채우기 */}
          {Array.from({ length: Math.max(0, 4 - (data?.items?.length || 0)) }, (_, index) => (
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

      {/* 원자재 명세서 - 극단적 조건부 렌더링 */}
      {shouldShowMaterials && (
        <>
          <h2>원자재 명세서</h2>
          <table className="print-table material-table show-materials">
            <thead>
              <tr>
                <th style={{width: '10%'}}>NO</th>
                <th style={{width: '35%'}}>원자재명</th>
                <th style={{width: '20%'}}>규격</th>
                <th style={{width: '10%'}}>수량</th>
                <th style={{width: '15%'}}>단가</th>
                <th style={{width: '10%'}}>비고</th>
              </tr>
            </thead>
            <tbody>
              {/* 실제 원자재 데이터 - 최대 3행만 */}
              {materialData.slice(0, maxMaterialRows).map((material, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td className="left">{material.name || ''}</td>
                  <td>{material.specification || ''}</td>
                  <td>{material.quantity || ''}</td>
                  <td className="right">{material.unitPrice ? material.unitPrice.toLocaleString() : ''}</td>
                  <td>{material.note || ''}</td>
                </tr>
              ))}
              
              {/* 빈 행 없음 - 공간 절약 */}
            </tbody>
          </table>
        </>
      )}

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

      {/* 비고 - 매우 간소화 */}
      {data?.notes && data.notes.trim() && data.notes.length < 50 && (
        <div className="print-notes">
          <strong>비고:</strong> {data.notes.substring(0, 30)}
        </div>
      )}

      {/* 하단 회사명 */}
      <div className="print-company">(주)삼미앵글랙산업</div>
    </div>
  );
};

export default BaljuPrint;
