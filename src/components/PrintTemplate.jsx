import React from 'react';
import '../styles/PrintTemplate.css';
import { BOMCalculator } from '../utils/BOMCalculator';

/**
 * PrintTemplate component for rendering printable estimate and purchase order documents
 */
const PrintTemplate = ({
  type = 'estimate', // 'estimate' or 'order'
  data,
  showPreview = true
}) => {
  if (!data) {
    return null;
  }
  
  // Calculate BOM components if not provided
  let components = data.components || [];
  if (components.length === 0 && data.productType && data.selectedOptions) {
    try {
      components = BOMCalculator.calculateBOM(
        data.productType,
        data.selectedOptions,
        data.quantity || 1
      );
    } catch (error) {
      console.error('Error calculating BOM:', error);
    }
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
  
  // Generate product description
  const productDesc = () => {
    if (!data.selectedOptions) return '';
    
    const options = [];
    
    if (data.selectedOptions.size) options.push(`규격: ${data.selectedOptions.size}`);
    if (data.selectedOptions.height) options.push(`높이: ${data.selectedOptions.height}cm`);
    if (data.selectedOptions.level) options.push(`단수: ${data.selectedOptions.level}`);
    if (data.selectedOptions.color) options.push(`색상: ${data.selectedOptions.color}`);
    
    return options.join(' / ');
  };

  return (
    <div className={`print-template ${showPreview ? 'preview' : 'print-only'}`}>
      <div className="print-container">
        <div className="header">
          <div className="logo">
            <h1>(주)삼미앵글</h1>
          </div>
          <div className="document-title">
            <h2>{type === 'estimate' ? '견적서' : '주문서'}</h2>
          </div>
        </div>
        
        <div className="document-info">
          <table className="info-table">
            <tbody>
              <tr>
                <th>{type === 'estimate' ? '견적번호' : '주문번호'}</th>
                <td>{type === 'estimate' ? data.estimateNumber : data.orderNumber}</td>
                <th>날짜</th>
                <td>{formatDate(data.date)}</td>
              </tr>
              {type === 'order' && (
                <tr>
                  <th>견적번호</th>
                  <td>{data.estimateNumber || '해당없음'}</td>
                  <th>배송 예정일</th>
                  <td>{formatDate(data.deliveryDate) || '미정'}</td>
                </tr>
              )}
              <tr>
                <th>고객명</th>
                <td>{data.customerName || ''}</td>
                <th>연락처</th>
                <td>{data.contactInfo || ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="product-info">
          <h3>제품 정보</h3>
          <table className="product-table">
            <thead>
              <tr>
                <th>제품유형</th>
                <th>제품상세</th>
                <th>수량</th>
                <th>단가</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{data.productType || ''}</td>
                <td>{productDesc()}</td>
                <td>{data.quantity || 1}</td>
                <td>{(data.unitPrice || 0).toLocaleString()}원</td>
                <td>{(data.totalPrice || 0).toLocaleString()}원</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="bom-info">
          <h3>부품 구성 (BOM)</h3>
          {components && components.length > 0 ? (
            <table className="components-table">
              <thead>
                <tr>
                  <th>유형</th>
                  <th>설명</th>
                  <th>수량</th>
                  <th>단위</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp, index) => (
                  <tr key={index}>
                    <td>{comp.type || ''}</td>
                    <td>{comp.description || ''}</td>
                    <td>{comp.quantity || ''}</td>
                    <td>{comp.unit || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>부품 목록이 없습니다.</p>
          )}
        </div>
        
        {type === 'order' && (
          <>
            <div className="delivery-info">
              <h3>배송 정보</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <th>배송지</th>
                    <td colSpan="3">{data.deliveryAddress || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="payment-info">
              <h3>결제 정보</h3>
              <table className="info-table">
                <tbody>
                  <tr>
                    <th>결제 조건</th>
                    <td colSpan="3">{data.paymentTerms || '계약금 50%, 잔금 50% (출고 전)'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        
        <div className="notes">
          <h3>비고</h3>
          {type === 'estimate' ? (
            <ul>
              <li>견적 유효 기간: 견적일로부터 30일</li>
              <li>배송비 별도</li>
              <li>부가세 포함 가격</li>
            </ul>
          ) : (
            <p>{data.notes || ''}</p>
          )}
        </div>
        
        <div className="footer">
          <div className="company-info">
            <p>(주)삼미앵글</p>
            <p>전화: 031-123-4567 | 팩스: 031-123-4568</p>
            <p>주소: 경기도 김포시 통진읍 가현로 123</p>
            <p>사업자등록번호: 123-45-67890</p>
          </div>
          <div className="stamp-area">
            <div className="stamp-box">
              <span className="stamp-text">직인</span>
            </div>
          </div>
        </div>
      </div>
      
      {showPreview && (
        <div className="preview-actions">
          <button className="print-button" onClick={() => window.print()}>
            인쇄하기
          </button>
          <p className="preview-note">
            미리보기 모드입니다. 인쇄하기 버튼을 클릭하여 문서를 인쇄하세요.
          </p>
        </div>
      )}
    </div>
  );
};

export default PrintTemplate;