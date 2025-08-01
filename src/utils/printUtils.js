// 견적서 데이터 포맷팅
export const formatEstimateData = (formData, cart, cartTotal) => {
  const currentDate = new Date().toISOString().split('T')[0];
  const estimateNumber = `EST-${currentDate.replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  // cart 데이터를 올바르게 매핑
  const items = cart.map((cartItem, index) => {
    const { selections } = cartItem;
    
    // 제품명 생성
    let productName = selections.type || '';
    if (selections.version) productName += ` (${selections.version})`;
    if (selections.color) productName += ` (${selections.color})`;
    
    // 규격 생성
    let specification = '';
    if (selections.size) specification += selections.size;
    if (selections.height) specification += ` × ${selections.height}`;
    if (selections.level) specification += ` × ${selections.level}`;
    
    // 단가 계산 (총 가격을 수량으로 나눔)
    const quantity = selections.quantity || 1;
    const unitPrice = Math.floor(cartItem.price / quantity);
    
    return {
      name: productName,
      specification: specification,
      unit: 'set',
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: cartItem.price,
      note: ''
    };
  });

  const subtotal = cartTotal || 0;
  const tax = Math.floor(subtotal * 0.1);
  const totalAmount = subtotal + tax;

  return {
    date: currentDate,
    estimateNumber,
    companyName: formData?.companyName || '', // 공급받는 쪽 상호명
    contactPerson: formData?.contactPerson || '', // 공급받는 쪽 담당자
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
  const orderNumber = formData?.orderNumber || `PO-${currentDate.replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  // cart 데이터를 올바르게 매핑
  const items = cart.map((cartItem, index) => {
    const { selections } = cartItem;
    
    // 제품명 생성
    let productName = selections.type || '';
    if (selections.version) productName += ` (${selections.version})`;
    if (selections.color) productName += ` (${selections.color})`;
    
    // 규격 생성
    let specification = '';
    if (selections.size) specification += selections.size;
    if (selections.height) specification += ` × ${selections.height}`;
    if (selections.level) specification += ` × ${selections.level}`;
    
    // 단가 계산 (총 가격을 수량으로 나눔)
    const quantity = selections.quantity || 1;
    const unitPrice = Math.floor(cartItem.price / quantity);
    
    return {
      name: productName,
      specification: specification,
      unit: 'set',
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: cartItem.price,
      note: ''
    };
  });

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
    date: formData?.date || currentDate,
    orderNumber,
    companyName: formData?.companyName || '', // 공급받는 쪽 상호명
    contactPerson: formData?.contactPerson || '', // 공급받는 쪽 담당자
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
