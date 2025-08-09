function extractLast4Digits(contactStr) {
  if (!contactStr) return '';
  const nums = String(contactStr).replace(/\D/g, '');
  return nums.slice(-4) || '';
}
function random4digits() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 견적서 데이터 포맷팅
export const formatEstimateData = (formData, cart, cartTotal) => {
  const currentDate = new Date().toISOString().split('T')[0];
  const last4 = extractLast4Digits(formData?.contactInfo);
  const estimateNumber = `EST-${currentDate.replace(/-/g, '')}-${last4 || random4digits()}`;

  const items = (cart || []).map(cartItem => {
    const { type, options, quantity, price } = cartItem;

    let productName = type || '';
    if (options?.version) productName += ` (${options.version})`;
    if (options?.color) productName += ` (${options.color})`;

    let specification = '';
    if (options?.size) specification += options.size;
    if (options?.height) specification += ` × ${options.height}`;
    if (options?.level) specification += ` × ${options.level}`;

    const qty = quantity ?? 1;
    const unitPrice = qty > 0 ? Math.floor(price / qty) : 0;

    return {
      name: productName,
      specification,
      unit: 'set',
      quantity: qty,
      unitPrice,
      totalPrice: price,
      note: ''
    };
  });

  const subtotal = Number(cartTotal) || 0;
  const tax = Math.floor(subtotal * 0.1);
  const totalAmount = subtotal + tax;

  return {
    date: formData?.date || currentDate,
    estimateNumber,
    companyName: formData?.companyName || '',
    contactPerson: formData?.contactPerson || '',
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
  const last4 = extractLast4Digits(formData?.contactInfo);
  const orderNumber = formData?.orderNumber || `PO-${currentDate.replace(/-/g, '')}-${last4 || random4digits()}`;

  const items = (cart || []).map(cartItem => {
    const { type, options, quantity, price } = cartItem;

    let productName = type || '';
    if (options?.version) productName += ` (${options.version})`;
    if (options?.color) productName += ` (${options.color})`;

    let specification = '';
    if (options?.size) specification += options.size;
    if (options?.height) specification += ` × ${options.height}`;
    if (options?.level) specification += ` × ${options.level}`;

    const qty = quantity ?? 1;
    const unitPrice = qty > 0 ? Math.floor(price / qty) : 0;

    return {
      name: productName,
      specification,
      unit: 'set',
      quantity: qty,
      unitPrice,
      totalPrice: price,
      note: ''
    };
  });

  const materialItems = (materials || []).map(material => {
    let specification = material.specification || '';
    if (!specification && typeof material.name === 'string') {
      const match = material.name.match(/\(([^)]+)\)/);
      if (match && /[\d]/.test(match[1])) {
        specification = match[1];
      }
    }
    return {
      name: material.name || '',
      specification,
      unit: material.unit || 'ea',
      quantity: material.quantity || 0,
      unitPrice: material.unitPrice || 0,
      totalPrice: (material.unitPrice || 0) * (material.quantity || 0),
      note: material.note || ''
    };
  });

  const subtotal = Number(cartTotal) || 0;
  const tax = Math.floor(subtotal * 0.1);
  const totalAmount = subtotal + tax;

  return {
    date: formData?.date || currentDate,
    orderNumber,
    companyName: formData?.companyName || '',
    contactPerson: formData?.contactPerson || '',
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

// navigateToPrintPage, checkPrintSupport 등은 기존 그대로 유지
