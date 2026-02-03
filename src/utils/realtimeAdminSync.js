// src/utils/realtimeAdminSync.js
/**
 * 실시간 관리자 데이터 동기화 시스템 - Gabia API 버전
 * 전 세계 모든 PC에서 실시간 동기화
 */

// 데이터 키
const INVENTORY_KEY = 'inventory_data';
const ADMIN_PRICES_KEY = 'admin_edit_prices';
const PRICE_HISTORY_KEY = 'admin_price_history';
const ACTIVITY_LOG_KEY = 'admin_activity_log';
const DOCUMENTS_KEY = 'synced_documents';

import { generatePartId } from './unifiedPriceManager';
import { inventoryAPI, pricesAPI, documentsAPI, activityAPI } from '../services/apiClient';

class RealtimeAdminSync {
  constructor() {
    this.isOnline = navigator.onLine;
    this.maxRetries = 3;

    this.saveTimeout = null;
    this.lastSaveTime = 0;
    this.pendingSave = false;
    this.debounceDelay = 1000;

    this.consecutiveFailures = 0;
    this.blockedUntil = 0;

    this.setupEventListeners();
    this.initBroadcastChannel();

    this.initialSync();

    setInterval(() => {
      this.loadFromServer();
    }, 5 * 60 * 1000);
  }

  async initialSync() {
    try {
      await this.loadFromServer();
      await this.uploadLocalDocumentsToServer();
    } catch (error) {
      console.error('초기 동기화 실패:', error);
    }
  }

  initBroadcastChannel() {
    try {
      this.channel = new BroadcastChannel('admin-sync');
      this.channel.addEventListener('message', (event) => {
        const { type, data, source } = event.data;

        if (source === this.getInstanceId()) return;

        switch (type) {
          case 'inventory-updated':
            this.handleInventoryUpdate(data);
            break;
          case 'prices-updated':
            this.handlePricesUpdate(data);
            break;
          case 'documents-updated':
            this.handleDocumentsUpdate(data);
            break;
          case 'force-reload':
            this.handleForceReload();
            break;
        }
      });
    } catch (error) {
      console.warn('BroadcastChannel을 지원하지 않는 브라우저입니다.');
    }
  }

  getInstanceId() {
    if (!this.instanceId) {
      this.instanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.instanceId;
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('📶 네트워크 연결됨 - 동기화 재시작');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📵 네트워크 연결 끊김 - 오프라인 모드');
    });
  }

  async getUserIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  async getCreatorInfo() {
    const userIP = await this.getUserIP();
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const username = currentUser.username || currentUser.name || 'unknown';
    return `${username}@${userIP}`;
  }

  debouncedSave() {
    const now = Date.now();
    if (now < this.blockedUntil) {
      const waitSeconds = Math.ceil((this.blockedUntil - now) / 1000);
      console.log(`⏸️ 서버 차단 중. ${waitSeconds}초 후 자동 재시도됩니다.`);

      if (!this.saveTimeout) {
        this.saveTimeout = setTimeout(() => {
          this.debouncedSave();
        }, this.blockedUntil - now);
      }
      return;
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.pendingSave = true;
    console.log(`📥 저장 요청 수신 (${this.debounceDelay}ms 후 일괄 처리)`);

    this.saveTimeout = setTimeout(async () => {
      const timeSinceLastSave = Date.now() - this.lastSaveTime;
      const minInterval = 800;

      if (timeSinceLastSave < minInterval) {
        const waitTime = minInterval - timeSinceLastSave;
        console.log(`⏳ Rate limit 방지: ${Math.ceil(waitTime)}ms 추가 대기`);
        this.saveTimeout = setTimeout(() => this.executeSave(), waitTime);
        return;
      }

      await this.executeSave();
      this.pendingSave = false;
      this.saveTimeout = null;
    }, this.debounceDelay);
  }

  async executeSave() {
    console.log('🔄 서버 저장 실행');
    this.lastSaveTime = Date.now();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.saveToServerWithMerge();
        console.log('✅ 서버 저장 완료');

        this.consecutiveFailures = 0;
        this.blockedUntil = 0;

        return true;
      } catch (error) {
        console.error(`❌ 저장 시도 ${attempt}/${this.maxRetries} 실패:`, error.message);

        if (error.message.includes('429') || error.message.includes('503')) {
          this.consecutiveFailures++;

          const baseWait = 60000;
          const exponentialWait = baseWait * Math.pow(2, this.consecutiveFailures - 1);
          const maxWait = 300000;
          const waitTime = Math.min(exponentialWait, maxWait);

          this.blockedUntil = Date.now() + waitTime;

          console.error('🚫 서버 Rate Limit 감지');
          console.error(`   연속 실패: ${this.consecutiveFailures}회`);
          console.error(`   대기 시간: ${Math.ceil(waitTime / 1000)}초`);

          window.dispatchEvent(new CustomEvent('serverBlocked', {
            detail: {
              waitSeconds: Math.ceil(waitTime / 1000),
              unblockTime: new Date(this.blockedUntil)
            }
          }));

          break;
        }

        if (attempt < this.maxRetries) {
          const waitTime = attempt * 3000;
          console.log(`⏳ ${waitTime / 1000}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.error('❌ 최대 재시도 횟수 초과. 저장 실패');
    return false;
  }

  async getServerDocuments() {
    try {
      const response = await documentsAPI.getAll();
      return response.data || {};
    } catch (error) {
      console.error('서버 문서 로드 실패:', error);
      return {};
    }
  }

  async loadFromServer() {
    try {
      console.log('🔄 Gabia 서버에서 데이터 로드 중...');

      const [inventoryRes, pricesRes, documentsRes, activityRes] = await Promise.all([
        inventoryAPI.getAll().catch(err => { console.error('재고 로드 실패:', err); return { data: {} }; }),
        pricesAPI.getAll().catch(err => { console.error('가격 로드 실패:', err); return { data: {} }; }),
        documentsAPI.getAll().catch(err => { console.error('문서 로드 실패:', err); return { data: {} }; }),
        activityAPI.getRecent(1000).catch(err => { console.error('활동 로그 로드 실패:', err); return { data: [] }; })
      ]);

      const inventoryData = inventoryRes.data || {};
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventoryData));
      this.broadcastUpdate('inventory-updated', inventoryData);

      const serverPrices = pricesRes.data || {};
      const localPrices = JSON.parse(localStorage.getItem(ADMIN_PRICES_KEY) || '{}');
      const mergedPrices = this.mergeByTimestamp(serverPrices, localPrices);
      localStorage.setItem(ADMIN_PRICES_KEY, JSON.stringify(mergedPrices));
      this.broadcastUpdate('prices-updated', mergedPrices);

      const serverDocumentsRaw = documentsRes.data || {};
      const serverDocuments = {};
      for (const [docIdKey, doc] of Object.entries(serverDocumentsRaw)) {
        const type = doc.type || (docIdKey.indexOf('_') >= 0 ? docIdKey.split('_')[0] : 'estimate');
        const id = doc.id != null ? doc.id : (docIdKey.indexOf('_') >= 0 ? docIdKey.split('_').slice(1).join('_') : docIdKey);
        const normKey = type + '_' + id;
        serverDocuments[normKey] = { ...doc, id, type };
      }
      const localDocuments = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
      const mergedDocuments = this.mergeDocumentsByTimestamp(serverDocuments, localDocuments);
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(mergedDocuments));
      this.syncToLegacyKeys(mergedDocuments);
      this.broadcastUpdate('documents-updated', mergedDocuments);

      const activityData = activityRes.data || [];
      localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityData));

      console.log('✅ Gabia 서버 데이터 로드 완료');
      console.log(`   재고: ${Object.keys(inventoryData).length}개`);
      console.log(`   가격: ${Object.keys(mergedPrices).length}개`);
      console.log(`   문서: ${Object.keys(mergedDocuments).length}개`);
      console.log(`   활동: ${activityData.length}개`);
      return true;

    } catch (error) {
      console.error('❌ Gabia 서버 데이터 로드 실패:', error);
      throw error;
    }
  }

  async uploadLocalDocumentsToServer() {
    try {
      const localLegacyDocuments = this.getLocalLegacyDocuments();
      const localDocCount = Object.keys(localLegacyDocuments).length;

      if (localDocCount === 0) {
        console.log('📄 업로드할 로컬 문서 없음');
        return;
      }

      console.log(`📄 로컬 문서 ${localDocCount}개 서버 업로드 시작...`);

      const creatorInfo = await this.getCreatorInfo();
      for (const docKey in localLegacyDocuments) {
        if (!localLegacyDocuments[docKey].createdBy) {
          localLegacyDocuments[docKey].createdBy = creatorInfo;
        }
        if (!localLegacyDocuments[docKey].syncedAt) {
          localLegacyDocuments[docKey].syncedAt = new Date().toISOString();
        }
      }

      const serverDocuments = await this.getServerDocuments();
      console.log(`📄 서버 기존 문서: ${Object.keys(serverDocuments).length}개`);

      const mergedDocuments = this.mergeDocumentsByTimestamp(serverDocuments, localLegacyDocuments);
      console.log(`📄 병합 후 총 문서: ${Object.keys(mergedDocuments).length}개`);

      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(mergedDocuments));

      await this.saveToServerWithMerge();

      console.log('✅ 로컬 문서 서버 업로드 완료');

    } catch (error) {
      console.error('❌ 로컬 문서 업로드 실패:', error);
    }
  }

  getLocalLegacyDocuments() {
    const documents = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key && (
          key.startsWith('estimate_') ||
          key.startsWith('purchase_') ||
          key.startsWith('delivery_')
        )
      ) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && item.id && item.type) {
            const docKey = `${item.type}_${item.id}`;
            documents[docKey] = item;
          }
        } catch (e) {
          console.error('문서 파싱 실패:', key, e);
        }
      }
    }

    return documents;
  }

  mergeDocumentsByTimestamp(serverDocs, localDocs) {
    const merged = { ...serverDocs };

    for (const docKey in localDocs) {
      const localDoc = localDocs[docKey];
      const serverDoc = merged[docKey];

      if (!serverDoc) {
        // 서버에 없는 경우 (새로 생성된 것)
        merged[docKey] = localDoc;
      } else {
        // ✅ Zombie 방지 로직: 서버가 삭제된 상태라면, 로컬이 '복구(restore)'된게 아니면 서버 승리
        if (serverDoc.deleted) {
          const serverDeleteTime = new Date(serverDoc.deletedAt || serverDoc.updatedAt || 0).getTime();
          const localRestoreTime = localDoc.restoredAt ? new Date(localDoc.restoredAt).getTime() : 0;

          // 로컬에서 명시적으로 복구했고, 그 복구 시점이 서버 삭제보다 뒤라면 로컬이 이김
          if (localRestoreTime > serverDeleteTime) {
            merged[docKey] = localDoc;
          } else {
            // 그 외에는 서버의 '삭제됨' 상태를 유지 (로컬이 아무리 최신이어도 무시)
            merged[docKey] = serverDoc;
          }
        } else {
          // 일반적인 업데이트 경쟁 (둘 다 살아있을 때)
          const serverTime = new Date(serverDoc.updatedAt || serverDoc.createdAt || 0).getTime();
          const localTime = new Date(localDoc.updatedAt || localDoc.createdAt || 0).getTime();

          if (localTime > serverTime) {
            merged[docKey] = localDoc;
          }
        }
      }
    }

    return merged;
  }

  mergeByTimestamp(serverData, localData) {
    const merged = { ...serverData };

    for (const key in localData) {
      const localItem = localData[key];
      const serverItem = merged[key];

      if (!serverItem) {
        merged[key] = localItem;
      } else {
        const serverTime = new Date(serverItem.timestamp || 0).getTime();
        const localTime = new Date(localItem.timestamp || 0).getTime();

        if (localTime > serverTime) {
          merged[key] = localItem;
        }
      }
    }

    return merged;
  }

  syncToLegacyKeys(documents) {
    for (const docKey in documents) {
      const doc = documents[docKey];
      if (doc && !doc.deleted) {
        localStorage.setItem(docKey, JSON.stringify(doc));
      } else if (doc && doc.deleted) {
        localStorage.removeItem(docKey);
      }
    }
  }

  async saveToServerWithMerge() {
    try {
      console.log('💾 Gabia 서버에 데이터 저장 시작...');

      const serverDocuments = await this.getServerDocuments();

      const localDocuments = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
      const inventory = JSON.parse(localStorage.getItem(INVENTORY_KEY) || '{}');
      const adminPrices = JSON.parse(localStorage.getItem(ADMIN_PRICES_KEY) || '{}');
      // ✅ activityLog가 배열인지 확인
      let activityLog;
      try {
        const stored = localStorage.getItem(ACTIVITY_LOG_KEY);
        activityLog = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(activityLog)) {
          console.warn('⚠️ activityLog가 배열이 아님. 초기화함:', activityLog);
          activityLog = [];
        }
      } catch (e) {
        console.error('❌ activityLog 파싱 실패:', e);
        activityLog = [];
      }
      const mergedDocuments = this.mergeDocumentsByTimestamp(serverDocuments, localDocuments);

      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(mergedDocuments));
      this.syncToLegacyKeys(mergedDocuments);

      const userIP = await this.getUserIP();

      // ✅ 배열 검증
      if (!Array.isArray(activityLog)) {
        activityLog = [];
      }

      activityLog.unshift({
        timestamp: new Date().toISOString(),
        action: 'data_sync',
        userIP,
        dataTypes: ['inventory', 'prices', 'documents'],
        documentCount: Object.keys(mergedDocuments).length
      });

      if (activityLog.length > 1000) {
        activityLog.splice(1000);
      }

      // ✅ 최적화: 변경된 문서만 필터링하여 저장 (Diff Sync)
      const documentsToSave = {};
      let changedCount = 0;

      for (const [key, doc] of Object.entries(mergedDocuments)) {
        const serverDoc = serverDocuments[key];

        // 1. 서버에 없는 새로운 문서
        if (!serverDoc) {
          documentsToSave[key] = doc;
          changedCount++;
          continue;
        }

        // 2. 로컬에서 수정된 문서 (timestamp 비교)
        const localTime = new Date(doc.updatedAt || doc.createdAt || 0).getTime();
        const serverTime = new Date(serverDoc.updatedAt || serverDoc.createdAt || 0).getTime();

        // 로컬이 더 최신이거나, 삭제 상태가 다른 경우 저장
        if (localTime > serverTime || doc.deleted !== serverDoc.deleted) {
          documentsToSave[key] = doc;
          changedCount++;
        }
      }

      console.log(`⚡ 변경된 문서 ${changedCount}개만 서버에 저장합니다. (전체: ${Object.keys(mergedDocuments).length}개)`);

      await Promise.all([
        inventoryAPI.update(inventory).catch(err => console.error('재고 저장 실패:', err)),
        this.saveAllPrices(adminPrices).catch(err => console.error('가격 저장 실패:', err)),
        // ✅ 수정: 전체 문서 대신 변경된 문서만 저장
        this.saveAllDocuments(documentsToSave).catch(err => console.error('문서 저장 실패:', err)),
        activityAPI.log('data_sync', {
          dataTypes: ['inventory', 'prices', 'documents'],
          documentCount: Object.keys(mergedDocuments).length
        }).catch(err => console.error('활동 로그 저장 실패:', err))
      ]);

      console.log(`✅ Gabia 서버에 데이터 저장 완료 (문서 ${Object.keys(mergedDocuments).length}개 중 ${changedCount}개 업데이트)`);

      localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLog));

      this.broadcastUpdate('documents-updated', mergedDocuments);

      return true;

    } catch (error) {
      console.error('❌ Gabia 서버 저장 실패:', error);
      throw error;
    }
  }

  async saveAllPrices(adminPrices) {
    // ✅ 배열이면 객체로 변환 (데이터 손상 방지)
    if (Array.isArray(adminPrices)) {
      console.warn('⚠️ adminPrices가 배열입니다. 무시합니다.');
      return;
    }

    // ✅ 유효한 항목만 필터링
    const validEntries = Object.entries(adminPrices).filter(([partId, data]) => {
      // 숫자 키 제거
      if (!isNaN(partId)) {
        console.warn(`⚠️ 잘못된 partId 제거: ${partId}`);
        return false;
      }
      // price가 없는 항목 제거
      if (!data || !data.price || data.price <= 0) {
        console.warn(`⚠️ price 없는 항목 제거: ${partId}`);
        return false;
      }
      return true;
    });

    if (validEntries.length === 0) {
      console.log('📋 저장할 가격 데이터 없음');
      return;
    }

    // ✅ 배치 크기 줄이고 에러 무시
    for (let i = 0; i < validEntries.length; i += 5) {
      const batch = validEntries.slice(i, i + 5);
      await Promise.all(
        batch.map(([partId, data]) =>
          pricesAPI.update(partId, {
            price: Number(data.price),
            timestamp: data.timestamp,
            account: data.account,
            partInfo: data.partInfo || {}
          }).catch(err => {
            // 405 에러는 무시
            if (!err.message.includes('405')) {
              console.error(`가격 저장 실패 (${partId}):`, err.message);
            }
          })
        )
      );
    }
  }

  async saveAllDocuments(documents) {
    const docEntries = Object.entries(documents);
    for (let i = 0; i < docEntries.length; i += 10) {
      const batch = docEntries.slice(i, i + 10);
      await Promise.all(
        batch.map(([docKey, doc]) => {
          // ✅ Fix: ID 충돌 방지를 위해 접두사가 포함된 docKey를 그대로 docId로 사용
          // 기존: const [type, ...idParts] = docKey.split('_'); const docId = idParts.join('_');
          const docId = docKey;
          return documentsAPI.save(docId, { ...doc, docId, type: doc.type }).catch(err =>
            console.error(`문서 저장 실패 (${docKey}):`, err)
          );
        })
      );
    }
  }

  broadcastUpdate(type, data) {
    if (this.channel) {
      this.channel.postMessage({
        type,
        data,
        source: this.getInstanceId(),
        timestamp: Date.now()
      });
    }

    window.dispatchEvent(new CustomEvent(`${type.replace('-', '')}`, {
      detail: { data, source: this.getInstanceId() }
    }));
  }

  handleInventoryUpdate(data) {
    console.log('📦 실시간 재고 업데이트 수신:', data);
    window.dispatchEvent(new CustomEvent('inventoryUpdated', { detail: data }));
  }

  handlePricesUpdate(data) {
    console.log('💰 실시간 단가 업데이트 수신:', data);
    window.dispatchEvent(new CustomEvent('adminPricesUpdated', { detail: data }));
  }

  handleDocumentsUpdate(data) {
    console.log('📄 실시간 문서 업데이트 수신:', data);
    window.dispatchEvent(new CustomEvent('documentsUpdated', { detail: data }));
  }

  handleForceReload() {
    console.log('🔄 강제 새로고침 수신');
    window.dispatchEvent(new CustomEvent('forceDataReload'));
  }
}

let syncInstance = null;

export const initRealtimeSync = () => {
  if (!syncInstance) {
    syncInstance = new RealtimeAdminSync();
  }
  return syncInstance;
};

export const adminSyncManager = {
  getInstance: () => syncInstance || initRealtimeSync()
};

export const saveInventorySync = async (partId, quantity, userInfo = {}) => {
  try {
    const inventory = JSON.parse(localStorage.getItem(INVENTORY_KEY) || '{}');
    inventory[partId] = Number(quantity);
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
    if (syncInstance) {
      syncInstance.broadcastUpdate('inventory-updated', { [partId]: quantity });
    }
    if (syncInstance) {
      syncInstance.debouncedSave();
    }
    return true;
  } catch (error) {
    console.error('재고 저장 실패:', error);
    return false;
  }
};

export const loadInventory = () => {
  try {
    const stored = localStorage.getItem(INVENTORY_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('재고 로드 실패:', error);
    return {};
  }
};

export const forceServerSync = async () => {
  if (syncInstance) {
    await syncInstance.loadFromServer();
  }
};

export const loadAdminPrices = () => {
  try {
    const stored = localStorage.getItem(ADMIN_PRICES_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('관리자 단가 로드 실패:', error);
    return {};
  }
};

export const saveAdminPriceSync = async (partId, price, partInfo = {}, userInfo = {}) => {
  try {
    const adminPrices = JSON.parse(localStorage.getItem(ADMIN_PRICES_KEY) || '{}');

    if (price && price > 0) {
      adminPrices[partId] = {
        price: Number(price),
        timestamp: new Date().toISOString(),
        account: userInfo.username || 'admin',
        partInfo
      };
    } else {
      delete adminPrices[partId];
    }

    localStorage.setItem(ADMIN_PRICES_KEY, JSON.stringify(adminPrices));

    if (syncInstance) {
      syncInstance.broadcastUpdate('prices-updated', adminPrices);
    }

    if (syncInstance) {
      syncInstance.debouncedSave();
    }

    return true;
  } catch (error) {
    console.error('관리자 단가 저장 실패:', error);
    return false;
  }
};

export const loadAllDocuments = (includeDeleted = false) => {
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    const docArray = Object.values(documents);

    if (includeDeleted) {
      return docArray;
    }

    return docArray.filter(doc => !doc.deleted);
  } catch (error) {
    console.error('문서 로드 실패:', error);
    return [];
  }
};

export const loadDeletedDocuments = () => {
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    return Object.values(documents).filter(doc => doc.deleted === true);
  } catch (error) {
    console.error('삭제된 문서 로드 실패:', error);
    return [];
  }
};

export const saveDocumentSync = async (document) => {
  try {
    if (!document || !document.id || !document.type) {
      console.error('유효하지 않은 문서:', document);
      return false;
    }

    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    const docKey = `${document.type}_${document.id}`;

    if (!documents[docKey] && syncInstance) {
      document.createdBy = await syncInstance.getCreatorInfo();
    }

    document.updatedAt = new Date().toISOString();
    document.syncedAt = new Date().toISOString();

    documents[docKey] = document;

    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    localStorage.setItem(docKey, JSON.stringify(document));

    if (syncInstance) {
      syncInstance.broadcastUpdate('documents-updated', documents);
      syncInstance.debouncedSave();
    }

    console.log(`📄 문서 저장 완료: ${docKey}`);
    return true;

  } catch (error) {
    console.error('문서 저장 실패:', error);
    return false;
  }
};

export const deleteDocumentSync = async (docId, docType) => {
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    const docKey = `${docType}_${docId}`;

    if (!documents[docKey]) {
      console.warn('삭제할 문서를 찾을 수 없음:', docKey);
      return false;
    }

    documents[docKey].deleted = true;
    documents[docKey].deletedAt = new Date().toISOString();
    documents[docKey].updatedAt = new Date().toISOString();

    if (syncInstance) {
      documents[docKey].deletedBy = await syncInstance.getCreatorInfo();
    }

    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    // ✅ Fix: 삭제된 상태를 서버로 전송하기 위해 localStorage에서 즉시 제거하지 않음
    // (removeItem을 하면 서버 저장 시 '로컬 데이터 없음'으로 간주되어 Active된 서버 데이터가 이겨버림)
    // localStorage.removeItem(docKey); 

    if (syncInstance) {
      syncInstance.broadcastUpdate('documents-updated', documents);
      syncInstance.debouncedSave();
    }

    console.log(`🗑️ 문서 소프트 삭제 완료: ${docKey}`);
    return true;

  } catch (error) {
    console.error('문서 삭제 실패:', error);
    return false;
  }
};

export const restoreDocumentSync = async (docId, docType) => {
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    const docKey = `${docType}_${docId}`;

    if (!documents[docKey]) {
      console.warn('복구할 문서를 찾을 수 없음:', docKey);
      return false;
    }

    delete documents[docKey].deleted;
    delete documents[docKey].deletedAt;
    delete documents[docKey].deletedBy;

    documents[docKey].restoredAt = new Date().toISOString();
    documents[docKey].updatedAt = new Date().toISOString();

    if (syncInstance) {
      documents[docKey].restoredBy = await syncInstance.getCreatorInfo();
    }

    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    localStorage.setItem(docKey, JSON.stringify(documents[docKey]));

    if (syncInstance) {
      syncInstance.broadcastUpdate('documents-updated', documents);
      syncInstance.debouncedSave();
    }

    console.log(`♻️ 문서 복구 완료: ${docKey}`);
    return true;

  } catch (error) {
    console.error('문서 복구 실패:', error);
    return false;
  }
};

export const permanentDeleteDocumentSync = async (docId, docType) => {
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    const docKey = `${docType}_${docId}`;

    if (!documents[docKey]) {
      console.warn('영구 삭제할 문서를 찾을 수 없음:', docKey);
      return false;
    }

    delete documents[docKey];

    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    localStorage.removeItem(docKey);

    if (syncInstance) {
      syncInstance.broadcastUpdate('documents-updated', documents);
      syncInstance.debouncedSave();
    }

    console.log(`🔥 문서 영구 삭제 완료: ${docKey}`);
    return true;

  } catch (error) {
    console.error('문서 영구 삭제 실패:', error);
    return false;
  }
};

export const getDocumentById = (docId, docType) => {
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    const docKey = `${docType}_${docId}`;
    return documents[docKey] || null;
  } catch (error) {
    console.error('문서 조회 실패:', error);
    return null;
  }
};

if (typeof window !== 'undefined') {
  initRealtimeSync();
}
