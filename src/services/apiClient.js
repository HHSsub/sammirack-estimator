import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://139.150.11.53:3001/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 재고 API
export const inventoryAPI = {
  getAll: () => apiClient.get('/inventory'),
  update: (updates) => apiClient.post('/inventory/update', updates)
};

// 가격 API
export const pricesAPI = {
  getAll: () => apiClient.get('/prices'),
  update: (partId, priceData) => apiClient.post('/prices/update', { partId, ...priceData })
};

// 문서 API
export const documentsAPI = {
  getAll: () => apiClient.get('/documents'),
  getById: (docId) => apiClient.get(`/documents/${docId}`),
  save: (docId, data) => apiClient.post('/documents/save', { docId, ...data }),
  delete: (docId) => apiClient.delete(`/documents/${docId}`)
};

// 활동 로그 API
export const activityAPI = {
  getRecent: (limit = 100) => apiClient.get(`/activity/recent?limit=${limit}`),
  log: (action, details) => apiClient.post('/activity/log', { action, details })
};
