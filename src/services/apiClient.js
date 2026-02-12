import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1200000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 재고 API
export const inventoryAPI = {
  getAll: () => apiClient.get('/inventory'),
  update: (updates) => apiClient.post('/inventory/update', updates),
  // ✅ 원자적 재고 차감 (Race Condition 방지)
  deduct: (deductions, documentId, userIp = null) =>
    apiClient.post('/inventory/deduct', { deductions, documentId, userIp }),
  // ✅ 재고 복구 (취소/롤백용)
  restore: (restorations, documentId, userIp = null) =>
    apiClient.post('/inventory/restore', { restorations, documentId, userIp })
};

// 가격 API
export const pricesAPI = {
  getAll: () => apiClient.get('/prices'),
  update: (partId, priceData) => apiClient.post('/prices/update', { partId, ...priceData })
};

// 문서 API
export const documentsAPI = {
  getAll: () => apiClient.get('/documents'),
  getById: (docId) => apiClient.get(`/documents/${docId}`),  // ✅ 괄호로 수정!
  save: (docId, data) => apiClient.post('/documents/save', { docId, ...data }),
  delete: (docId) => apiClient.delete(`/documents/${docId}`)  // ✅ 괄호로 수정!
};

// 활동 로그 API
export const activityAPI = {
  getRecent: (limit = 100) => apiClient.get(`/activity/recent?limit=${limit}`),  // ✅ 괄호로 수정!
  log: (action, details) => apiClient.post('/activity/log', { action, details })
};
