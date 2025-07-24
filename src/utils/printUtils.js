/**
 * Print utility functions for handling document printing
 */

/**
 * Open print page in new window or tab
 * @param {string} type - 'gyeonjuk' or 'balju'
 * @param {Object} data - Document data to print
 */
export const openPrintPage = (type, data) => {
  const encodedData = encodeURIComponent(JSON.stringify(data));
  const printUrl = `/print?type=${type}&data=${encodedData}`;
  
  // Open in new window for better print experience
  const printWindow = window.open(printUrl, '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    // Fallback: navigate in same window if popup blocked
    window.location.href = printUrl;
  }
};

/**
 * Navigate to print page in same window
 * @param {string} type - 'gyeonjuk' or 'balju'
 * @param {Object} data - Document data to print
 * @param {Function} navigate - React Router navigate function
 */
export const navigateToPrintPage = (type, data, navigate) => {
  const encodedData = encodeURIComponent(JSON.stringify(data));
  navigate(`/print?type=${type}&data=${encodedData}`);
};

/**
 * Convert cart data to print format for estimate (견적서)
 * @param {Object} formData - Form data from EstimateForm
 * @param {Array} cart - Cart items
 * @param {number} cartTotal - Cart total amount
 * @returns {Object} Formatted data for GyeonjukPrint component
 */
export const formatEstimateData = (formData, cart = [], cartTotal = 0) => {
  const items = cart.map((item, index) => ({
    name: item.productType || item.selections?.type || '',
    specification: generateSpecification(item.selectedOptions || item.selections),
    unit: 'set',
    quantity: item.quantity || item.selections?.quantity || 1,
    unitPrice: item.price || 0,
    totalPrice: item.price || 0,
    note: ''
  }));

  return {
    date: formData.date || new Date().toISOString(),
    estimateNumber: formData.estimateNumber || generateEstimateNumber(),
    customerName: formData.customerName || '',
    contactInfo: formData.contactInfo || '',
    items: items,
    notes: formData.notes || '',
    totalAmount: cartTotal
  };
};

/**
 * Convert cart data to print format for purchase order (발주서)
 * @param {Object} formData - Form data from PurchaseOrderForm
 * @param {Array} cart - Cart items
 * @param {Array} totalBom - Total BOM data
 * @param {number} cartTotal - Cart total amount
 * @returns {Object} Formatted data for BaljuPrint component
 */
export const formatPurchaseOrderData = (formData, cart = [], totalBom = [], cartTotal = 0) => {
  const items = cart.map((item, index) => ({
    name: item.productType || item.selections?.type || '',
    specification: generateSpecification(item.selectedOptions || item.selections),
    unit: 'set',
    quantity: item.quantity || item.selections?.quantity || 1,
    unitPrice: item.price || 0,
    totalPrice: item.price || 0,
    note: ''
  }));

  const materials = totalBom.map((bomItem, index) => ({
    name: bomItem.name || '',
    specification: bomItem.specification || '',
    unit: bomItem.unit || 'ea',
    quantity: bomItem.quantity || 0,
    unitPrice: bomItem.unitPrice || 0,
    totalPrice: (bomItem.unitPrice || 0) * (bomItem.quantity || 0),
    note: ''
  }));

  return {
    date: formData.date || new Date().toISOString(),
    orderNumber: formData.orderNumber || generateOrderNumber(),
    customerName: formData.customerName || '',
    contactInfo: formData.contactInfo || '',
    items: items,
    materials: materials,
    notes: formData.notes || '',
    totalAmount: cartTotal
  };
};

/**
 * Generate specification string from selected options
 * @param {Object} selectedOptions - Selected product options
 * @returns {string} Formatted specification string
 */
const generateSpecification = (selectedOptions) => {
  if (!selectedOptions) return '';
  
  const specs = [];
  
  if (selectedOptions.size) specs.push(selectedOptions.size);
  if (selectedOptions.height) specs.push(`높이: ${selectedOptions.height}cm`);
  if (selectedOptions.level) specs.push(`${selectedOptions.level}단`);
  if (selectedOptions.color) specs.push(`색상: ${selectedOptions.color}`);
  if (selectedOptions.version) specs.push(`버전: ${selectedOptions.version}`);
  
  return specs.join(' / ');
};

/**
 * Generate estimate number
 * @returns {string} Generated estimate number
 */
const generateEstimateNumber = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0');
  const timeStr = date.getHours().toString().padStart(2, '0') + 
                  date.getMinutes().toString().padStart(2, '0');
  return `EST-${dateStr}-${timeStr}`;
};

/**
 * Generate order number
 * @returns {string} Generated order number
 */
const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0');
  const timeStr = date.getHours().toString().padStart(2, '0') + 
                  date.getMinutes().toString().padStart(2, '0');
  return `PO-${dateStr}-${timeStr}`;
};
