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
        프린트 시 이 메시지는 표시되지 않습니다
      </div>

      <div className="print-header">
        <h1>거래명세서(발&nbsp;주&nbsp;서)</h1>
        <img className="stamp" src={stampImage} alt="도장" />

        {/* 상단 info-table: 좌측 3칸, 아래 병합, 우측 7항목 (상호 포함) */}
        <table className="print-table info-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: 13, marginBottom: 10 }}>
          <colgroup>
            <col style={{ width: '25%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '25%' }} />
          </colgroup>
          <tbody>
            {/* 1행: 발주일자 / 상호 */}
            <tr>
              <td className="label" style={{ fontWeight: 600, background: '#f8f9fa', border: '1px solid #ddd', textAlign: 'center' }}>발주일자</td>
              <td style={{ border: '1px solid #ddd', textAlign: 'center' }}>{data?.date || ''}</td>
              <td className="label" style={{ fontWeight: 600, background: '#f8f9fa', border: '1px solid #ddd', textAlign: 'center' }}>상호</td>
              <td style={{ border: '1px solid #ddd', textAlign: 'left' }}>삼미앵글랙산업</td>
            </tr>
            {/* 2행: 상호명(주문자) / 대표자 */}
            <tr>
              <td className="label" style={{ fontWeight: 600, background: '#f8f9fa', border: '1px solid #ddd', textAlign: 'center' }}>상호명</td>
              <td style={{ border: '1px solid #ddd', textAlign: 'center' }}>{data?.companyName || ''}</td>
              <td className="label" style={{ fontWeight: 600, background: '#f8f9fa', border: '1px solid #ddd', textAlign: 'center' }}>대표자</td>
              <td style={{ border: '1px solid #ddd', textAlign: 'left' }}>박이삭</td>
            </tr>
            {/* 3행: 담당자 / 사업자번호 */}
            <tr>
              <td className="label" style={{ fontWeight: 600, background: '#f8f9fa', border: '1px solid #ddd', textAlign: 'center' }}>담당자</td>
              <td style={{ border: '1px solid #ddd', textAlign: 'center' }}>{data?.contactPerson || ''}</td>
              <td className="label" style={{ fontWeight: 600, background: '#f8f9fa', border: '1px solid #ddd', textAlign: 'center' }}>사업자번호</td>
              <td style={{ border: '1px solid #ddd', textAlign: 'left' }}>232-81-01750</td>
            </tr>
            {/* 4행: 좌측 병합 문구, 우측 소재지~홈페이지 */}
            <tr>
              <td colSpan={3} rowSpan={4} style={{
                border: '1px solid #ddd',
                borderTop: 'none',
                background: '#fff',
                textAlign: 'center',
                verticalAlign: 'middle',
                padding: '22px 0 18px',
                fontWeight: 600,
                fontSize: 15,
              }}>
                아래와 같이 발주합니다
              </td>
              <td style={{ border: '1px solid #ddd', padding: 0, verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td className="label" style={{ width: '35%', background: '#f8f9fa', fontWeight: 600, border: 'none', textAlign: 'center', padding: '4px 7px', borderBottom: '1px solid #ddd'}}>소재지</td>
                      <td style={{ border: 'none', borderBottom: '1px solid #ddd', textAlign: 'left', padding: '4px 7px'}}>경기도 광명시 원노온사로 39, 제1동</td>
                    </tr>
                    <tr>
                      <td className="label" style={{ background: '#f8f9fa', fontWeight: 600, border: 'none', textAlign: 'center', padding: '4px 7px', borderBottom: '1px solid #ddd'}}>TEL</td>
                      <td style={{ border: 'none', borderBottom: '1px solid #ddd', textAlign: 'left', padding: '4px 7px'}}>(02)2611-4597</td>
                    </tr>
                    <tr>
                      <td className="label" style={{ background: '#f8f9fa', fontWeight: 600, border: 'none', textAlign: 'center', padding: '4px 7px', borderBottom: '1px solid #ddd'}}>FAX</td>
                      <td style={{ border: 'none', borderBottom: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>(02)2611-4595</td>
                    </tr>
                    {data?.email && (
                      <tr>
                        <td className="label" style={{ background: '#f8f9fa', fontWeight: 600, border: 'none', textAlign: 'center', padding: '4px 7px', borderBottom: '1px solid #ddd'}}>이메일</td>
                        <td style={{ border: 'none', borderBottom: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>{data.email}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="label" style={{ background: '#f8f9fa', fontWeight: 600, border: 'none', textAlign: 'center', padding: '4px 7px' }}>홈페이지</td>
                      <td style={{ border: 'none', textAlign: 'left', padding: '4px 7px' }}>http://www.ssmake.com</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 이하 기존 코드 유지 */}
        <table className="print-table order-table">
          <thead>
            <tr>
              <th style={{ width: '8%' }}>NO</th>
              <th style={{ width: '25%' }}>품명</th>
              <th style={{ width: '18%' }}>규격</th>
              <th style={{ width: '8%' }}>단위</th>
              <th style={{ width: '8%' }}>수량</th>
              <th style={{ width: '12%' }}>단가</th>
              <th style={{ width: '12%' }}>공급가</th>
              <th style={{ width: '9%' }}>비고</th>
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
                <td className="right">{item.unitPrice?.toLocaleString() || ''}</td>
                <td className="right">{item.totalPrice?.toLocaleString() || ''}</td>
                <td>{item.note || ''}</td>
              </tr>
            ))}
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

      {/* 원자재 명세서 */}
      {shouldShowMaterials && (
        <div className="print-materials">
          <h2>원자재 명세서</h2>
          <table className="print-table material-table">
            <thead>
              <tr>
                <th style={{ width: '8%' }}>NO</th>
                <th style={{ width: '30%' }}>원자재명</th>
                <th style={{ width: '20%' }}>규격</th>
                <th style={{ width: '8%' }}>단위</th>
                <th style={{ width: '10%' }}>수량</th>
                <th style={{ width: '12%' }}>단가</th>
                <th style={{ width: '12%' }}>공급가</th>
              </tr>
            </thead>
            <tbody>
              {materialData.slice(0, maxMaterialRows).map((material, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td className="left">{material.name || ''}</td>
                  <td>{material.specification || ''}</td>
                  <td>{material.unit || ''}</td>
                  <td>{material.quantity || ''}</td>
                  <td className="right">{material.unitPrice?.toLocaleString() || ''}</td>
                  <td className="right">{material.totalPrice?.toLocaleString() || ''}</td>
                </tr>
              ))}
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
        <table className="print-table">
          <tbody>
            <tr>
              <td className="label" style={{ width: '20%' }}>소계</td>
              <td className="right" style={{ width: '80%' }}>{data?.subtotal?.toLocaleString() || '0'}</td>
            </tr>
            <tr>
              <td className="label">부가세</td>
              <td className="right">{data?.tax?.toLocaleString() || '0'}</td>
            </tr>
            <tr>
              <td className="label"><strong>합계</strong></td>
              <td className="right"><strong>{data?.totalAmount?.toLocaleString() || '0'}</strong></td>
            </tr>
          </tbody>
        </table>
        {data?.notes?.trim() && (
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
