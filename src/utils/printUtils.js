// 견적서 데이터 포맷팅
export const formatEstimateData = (formData, cart, cartTotal) => {
  const currentDate = new Date().toISOString().split('T')[0];
  const estimateNumber = `EST-${currentDate.replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  const items = cart.map(item => ({
    name: item.name || '',
    specification: item.specification || '',
    unit: item.unit || 'set',
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    totalPrice: (item.unitPrice || 0) * (item.quantity || 1),
    note: item.note || ''
  }));

  const subtotal = cartTotal || 0;
  const tax = Math.floor(subtotal * 0.1);
  const totalAmount = subtotal + tax;

  return {
    date: currentDate,
    estimateNumber,
    customerName: formData?.customerName || '',
    contactInfo: formData?.contactInfo || '',
    items,
    notes: formData?.notes || '',
    subtotal,
    tax,
    totalAmount
  };
};

// 발주서 데이터 포맷팅
export const formatPurchaseOrderData = (formData, cart, materials, cartTotal) => {
  const currentDate = new Date().toISOString().split('T')[0];
  const orderNumber = `PO-${currentDate.replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  const items = cart.map(item => ({
    name: item.name || '',
    specification: item.specification || '',
    unit: item.unit || 'set',
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    totalPrice: (item.unitPrice || 0) * (item.quantity || 1),
    note: item.note || ''
  }));

  const materialItems = (materials || []).map(material => ({
    name: material.name || '',
    specification: material.specification || '',
    unit: material.unit || 'ea',
    quantity: material.quantity || 0,
    unitPrice: material.unitPrice || 0,
    totalPrice: (material.unitPrice || 0) * (material.quantity || 0),
    note: material.note || ''
  }));

  const subtotal = cartTotal || 0;
  const tax = Math.floor(subtotal * 0.1);
  const totalAmount = subtotal + tax;

  return {
    date: currentDate,
    orderNumber,
    customerName: formData?.customerName || '',
    contactInfo: formData?.contactInfo || '',
    items,
    materials: materialItems,
    notes: formData?.notes || '',
    subtotal,
    tax,
    totalAmount
  };
};

// 프린트 페이지로 이동
export const navigateToPrintPage = (type, data, navigate) => {
  try {
    const encodedData = encodeURIComponent(JSON.stringify(data));
    const printUrl = `/print?type=${type}&data=${encodedData}`;
    
    // 새 창에서 프린트 페이지 열기 (선택사항)
    const openInNewWindow = false; // 필요에 따라 true로 변경
    
    if (openInNewWindow) {
      const printWindow = window.open(printUrl, '_blank', 'width=800,height=600');
      if (!printWindow) {
        // 팝업 차단 시 현재 창에서 이동
        navigate(printUrl);
      }
    } else {
      navigate(printUrl);
    }
  } catch (error) {
    console.error('프린트 페이지 이동 오류:', error);
    alert('프린트 페이지로 이동하는 중 오류가 발생했습니다.');
  }
};

// 프린트 가능 여부 확인
export const checkPrintSupport = () => {
  return typeof window !== 'undefined' && 'print' in window;
};

// 브라우저별 프린트 최적화 설정
export const optimizePrintSettings = () => {
  // Chrome/Edge에서 배경 그래픽 인쇄 활성화
  if (typeof window !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
};
