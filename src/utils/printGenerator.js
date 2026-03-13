/**
 * Unified Print Generation Utility
 * This utility centralizes the HTML and CSS generation for various document types
 * to ensure 100% design consistency across the application.
 */

export const PROVIDER = {
  bizNumber: '232-81-01750',
  companyName: '삼미앵글랙산업',
  ceo: '박이삭',
  address: '경기도 광명시 원노온사로 39, 철제 스틸하우스 1',
  website: 'http://www.ssmake.com',
  tel: '010-9548-9578\n010-4311-7733',
  fax: '(02)2611-4595',
  stampImage: 'images/도장.png' // Base URL handled below
};

/**
 * Format date for display (Internal)
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return `${date.getFullYear()} - ${String(date.getMonth() + 1).padStart(2, '0')} - ${String(date.getDate()).padStart(2, '0')}`;
  } catch {
    return dateString;
  }
};

/**
 * Generates the shared CSS for print documents
 */
const getPrintStyles = () => `
  @media print {
    @page { size: A4; margin: 10mm 8mm; }
    body { margin: 0; padding: 0; font-family: 'Malgun Gothic', Arial, sans-serif; -webkit-print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  body { font-family: 'Malgun Gothic', Arial, sans-serif; padding: 20px; color: #000; }
  .print-page-container { page-break-after: always; min-height: 280mm; position: relative; }
  .form-header { text-align: center; border-bottom: 2px solid #222; margin-bottom: 12px; padding-bottom: 6px; }
  .form-header h1 { font-size: 28px; margin: 0; letter-spacing: 10px; }
  .form-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
  .form-table th, .form-table td { border: 1px solid #333; padding: 6px; text-align: center; height: 24px; }
  .form-table th { background: #f8f9fa !important; font-weight: bold; }
  .form-table .label { background: #f0f0f0 !important; font-weight: bold; width: 120px; }
  .rep-cell { position: relative; }
  .ceo-inline { position: relative; display: inline-block; padding-right: 60px; min-width: 100px; text-align: left; }
  .ceo-name { position: relative; z-index: 2; }
  .stamp-inline { position: absolute; top: -12px; right: 0; width: 60px; opacity: 0.8; z-index: 1; }
  .order-table th, .bom-table th { background: #f0f0f0 !important; }
  .total-table { width: 300px; margin-left: auto; margin-top: 20px; }
  .total-table .label { width: 100px; }
  .notes-section { margin-top: 20px; text-align: left; border: 1px solid #333; padding: 10px; font-size: 13px; min-height: 60px; }
  .form-company { text-align: center; font-size: 18px; font-weight: bold; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
  .right { text-align: right !important; }
  .left { text-align: left !important; }
`;

/**
 * Generates the HTML for a single document
 * @param {Object} item Document data
 * @param {Object} options Configuration (e.g., baseURL for images)
 */
export const generateDocHTML = (item, options = {}) => {
  if (!item) return '';

  const { baseURL = '', globalSettings = null } = options;
  const normalizedBaseURL = baseURL.replace(/\/$/, '');
  
  // Settings precedence: document-specific > global passed in > hardcoded fallback
  const settings = item.documentSettings || globalSettings || PROVIDER;
  
  const stampImage = settings.stampImage 
    ? (settings.stampImage.startsWith('http') ? settings.stampImage : `${normalizedBaseURL}/${settings.stampImage.replace(/^\//, '')}`)
    : `${normalizedBaseURL}/images/도장.png`;

  const isEstimate = item.type === 'estimate';
  const isPurchase = item.type === 'purchase';
  const isDelivery = item.type === 'delivery';

  const title = isEstimate ? '견&nbsp;적&nbsp;서' : isPurchase ? '발&nbsp;주&nbsp;서' : '거&nbsp;래&nbsp;명&nbsp;세&nbsp;서';
  const docNumLabel = isEstimate ? '견적번호' : isPurchase ? '발주번호' : '거래번호';
  const docNum = isEstimate ? (item.estimateNumber || item.documentNumber || '') : isPurchase ? (item.purchaseNumber || item.documentNumber || '') : (item.documentNumber || '');


  // Item list (minimum 8 rows)
  const items = item.items || [];
  const filledItems = [...items];
  while (filledItems.length < 8) {
    filledItems.push({ name: '', unit: '', quantity: '', unitPrice: '', totalPrice: '', note: '', isEmpty: true });
  }

  // Materials list (Purchase Order & Delivery Note only, minimum 12 rows)
  const materials = item.materials || [];
  const showMaterials = (isPurchase || isDelivery) && materials.length > 0;
  const filledMaterials = [...materials];
  if (showMaterials) {
    while (filledMaterials.length < 12) {
      filledMaterials.push({ name: '', specification: '', quantity: '', note: '', isEmpty: true });
    }
  }

  return `
    <div class="print-page-container">
      <style>
        .form-table tr.empty-row td {
          height: 12px !important;
          padding: 0 !important;
          font-size: 0 !important;
          line-height: 0 !important;
        }
        .form-table td {
          padding: 3px 6px !important;
          height: auto !important;
          min-height: 22px !important;
        }
        .info-table td {
          padding: 2px 6px !important;
        }
        .form-header h1 {
          font-size: 24px !important;
          margin: 0 0 10px 0 !important;
        }
        .print-page-container {
          padding: 0 !important;
          margin: 0 !important;
        }
      </style>
      <div class="form-header">
        <h1>${title}</h1>
      </div>

      <div class="info-table-stamp-wrapper">
        <table class="form-table info-table compact">
          <tbody>
            <tr>
              <td class="label" style="width: 110px;">거래일자</td>
              <td class="left">${formatDate(item.date)}</td>
              <td class="label">사업자등록번호</td>
              <td>${settings.bizNumber}</td>
            </tr>
            <tr>
              <td class="label">${docNumLabel}</td>
              <td class="left" style="font-weight: bold; font-size: 16px;">${docNum}</td>
              <td class="label">상호명</td>
              <td>${settings.companyName}</td>
            </tr>
            <tr>
              <td class="label">상호명</td>
              <td class="left" style="font-weight: bold;">${item.customerName || item.companyName || ''}</td>
              <td class="label">대표자</td>
              <td class="rep-cell" style="white-space: nowrap;">
                <span class="ceo-inline">
                  <span class="ceo-name">${settings.ceo}</span>
                  <img src="${stampImage}" alt="도장" class="stamp-inline" />
                </span>
              </td>
            </tr>
            <tr>
              <td class="label" rowspan="4">메모</td>
              <td rowspan="4" class="left" style="vertical-align: top; padding: 8px; font-weight: 600; font-size: 14px; white-space: pre-wrap;">${item.topMemo || item.memo || ''}</td>
              <td class="label">소재지</td>
              <td>${settings.address}</td>
            </tr>
            <tr>
              <td class="label">TEL</td>
              <td style="white-space: pre-line;">${settings.tel}</td>
            </tr>
            <tr>
              <td class="label">홈페이지</td>
              <td>${settings.website || settings.homepage || PROVIDER.website}</td>
            </tr>
            <tr>
              <td class="label">FAX</td>
              <td>${settings.fax}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style="margin: 14px 0 6px; font-size: 16px;">품목 목록</h3>
      <table class="form-table order-table">
        <thead>
          <tr>
            <th style="width: 50px;">NO</th>
            <th>품명</th>
            <th style="width: 70px;">단위</th>
            <th style="width: 70px;">수량</th>
            <th style="width: 100px;">단가</th>
            <th style="width: 110px;">공급가</th>
            <th style="width: 110px;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${filledItems.map((it, idx) => `
            <tr class="${it.isEmpty ? 'empty-row' : ''}">
              <td>${idx + 1}</td>
              <td class="left">${it.name || ''}</td>
              <td>${it.unit || ''}</td>
              <td>${it.quantity || ''}</td>
              <td class="right">${it.unitPrice ? parseInt(it.unitPrice).toLocaleString() : ''}</td>
              <td class="right">${it.totalPrice ? parseInt(it.totalPrice).toLocaleString() : ''}</td>
              <td class="left">${it.note || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${showMaterials ? `
      <h3 style="margin: 14px 0 6px; font-size: 16px;">원자재 명세서</h3>
      <table class="form-table bom-table">
        <thead>
          <tr>
            <th style="width: 50px;">NO</th>
            <th>부품명</th>
            <th style="width: 200px;">규격</th>
            <th style="width: 80px;">수량</th>
            <th style="width: 120px;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${filledMaterials.map((m, idx) => `
            <tr class="${m.isEmpty ? 'empty-row' : ''}">
              <td>${idx + 1}</td>
              <td class="left">${m.name || ''}</td>
              <td class="left">${m.specification || ''}</td>
              <td>${m.quantity || ''}</td>
              <td class="left">${m.note || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      <table class="form-table total-table">
        <tbody>
          <tr><td class="label">소계</td><td class="right">${(item.subtotal || 0).toLocaleString()}</td></tr>
          <tr><td class="label">부가세</td><td class="right">${(item.tax || 0).toLocaleString()}</td></tr>
          <tr><td class="label"><strong>합계</strong></td><td class="right"><strong>${(item.totalAmount || 0).toLocaleString()}</strong></td></tr>
        </tbody>
      </table>

      ${(item.notes && item.notes.trim()) ? `
      <div class="notes-section">
        <strong>비고:</strong><br/>
        ${item.notes.replace(/\n/g, '<br/>')}
      </div>
      ` : ''}

      <div class="form-company">(${settings.companyName})</div>
    </div>
  `;
};

/**
 * Creates a full HTML document for printing
 * @param {Object|Array} data Single document object or array of documents
 * @param {Object} options Configuration
 */
export const getFullPrintHTML = (data, options = {}) => {
  const items = Array.isArray(data) ? data : [data];
  const { title = '인쇄', baseURL = '' } = options;
  
  const contentHTML = items.map(item => generateDocHTML(item, options)).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        ${getPrintStyles()}
      </style>
    </head>
    <body>
      ${contentHTML}
    </body>
    </html>
  `;
};
