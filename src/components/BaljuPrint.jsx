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

        {/* 상단 정보 테이블 좌/우 이분할 개편 */}
        <table className="print-table info-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: 13, marginBottom: 10 }}>
          <colgroup>
            <col style={{ width: '60%' }} />
            <col style={{ width: '40%' }} />
          </colgroup>
          <tbody>
            <tr>
              {/* 좌측: 발주일자, 상호명, 담당자, 문구 */}
              <td style={{ border: 'none', padding: 0, verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td className="label" style={{
                        width: '23%', fontWeight: 600, border: '1px solid #ddd', background: '#f8f9fa', textAlign: 'center', padding: '4px 7px'
                      }}>발주일자</td>
                      <td style={{
                        width: '23%', border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>{data?.date || ''}</td>
                      <td className="label" style={{
                        width: '23%', fontWeight: 600, border: '1px solid #ddd', background: '#f8f9fa', textAlign: 'center', padding: '4px 7px'
                      }}>상호명</td>
                      <td style={{
                        width: '23%', border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>{data?.companyName || ''}</td>
                      <td className="label" style={{
                        width: '15%', fontWeight: 600, border: '1px solid #ddd', background: '#f8f9fa', textAlign: 'center', padding: '4px 7px'
                      }}>담당자</td>
                      <td style={{
                        border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>{data?.contactPerson || ''}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} style={{
                        border: '1px solid #ddd',
                        borderTop: 'none',
                        background: '#fff',
                        textAlign: 'center',
                        padding: '11px 0 8px',
                        fontWeight: 600,
                        fontSize: 15,
                      }}>
                        아래와 같이 발주합니다
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              {/* 우측: 대표자, 사업자번호, 소재지, TEL, FAX, (이메일), 홈페이지 */}
              <td style={{ border: 'none', padding: 0, verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td className="label" style={{
                        width: '34%', background: '#f8f9fa', fontWeight: 600, border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>대표자</td>
                      <td style={{ border: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>박이삭</td>
                    </tr>
                    <tr>
                      <td className="label" style={{
                        background: '#f8f9fa', fontWeight: 600, border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>사업자번호</td>
                      <td style={{ border: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>232-81-01750</td>
                    </tr>
                    <tr>
                      <td className="label" style={{
                        background: '#f8f9fa', fontWeight: 600, border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>소재지</td>
                      <td style={{ border: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>경기도 광명시 원노온사로 39, 제1동</td>
                    </tr>
                    <tr>
                      <td className="label" style={{
                        background: '#f8f9fa', fontWeight: 600, border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>TEL</td>
                      <td style={{ border: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>(02)2611-4597</td>
                    </tr>
                    <tr>
                      <td className="label" style={{
                        background: '#f8f9fa', fontWeight: 600, border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>FAX</td>
                      <td style={{ border: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>(02)2611-4595</td>
                    </tr>
                    {data?.email && (
                      <tr>
                        <td className="label" style={{
                          background: '#f8f9fa', fontWeight: 600, border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                        }}>이메일</td>
                        <td style={{ border: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>{data.email}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="label" style={{
                        background: '#f8f9fa', fontWeight: 600, border: '1px solid #ddd', textAlign: 'center', padding: '4px 7px'
                      }}>홈페이지</td>
                      <td style={{ border: '1px solid #ddd', textAlign: 'left', padding: '4px 7px' }}>http://www.ssmake.com</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        {/* ===== info-table 개편 끝 ===== */}

        {/* 발주 품목 테이블 */}
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
