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
        let type = doc.type || (docIdKey.indexOf('_') >= 0 ? docIdKey.split('_')[0] : 'estimate');

        // ✅ [Fix] 서버 데이터 로드 시 ID 정규화 (무조건 prefix_id 형태)
        let id = String(doc.id || (docIdKey.indexOf('_') >= 0 ? docIdKey.split('_').slice(1).join('_') : docIdKey)).replace(/\.0$/, '');

        // 1. 접두사 확인 및 추가
        if (!id.startsWith(`${type}_`)) {
          id = `${type}_${id}`;
        }

        // 2. 이중 접두사 제거
        if (id.startsWith(`${type}_${type}_`)) {
          id = id.replace(`${type}_${type}_`, `${type}_`);
        }

        const normKey = id;

        // 중복 시 더 최신 데이터 유지
        if (!serverDocuments[normKey] ||
          new Date(doc.updatedAt || 0) > new Date(serverDocuments[normKey].updatedAt || 0)) {
          serverDocuments[normKey] = { ...doc, id, type };
        }
      }
      const localDocuments = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
      const mergedDocuments = this.mergeDocumentsByTimestamp(serverDocuments, localDocuments);
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(mergedDocuments));
      this.syncToLegacyKeys(mergedDocuments);
      this.broadcastUpdate('documents-updated', mergedDocuments);

      const activityData = activityRes.data || [];
      localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityData));

      // 서버 풀 로드 시점 기록 → 이후 saveToServerWithMerge에서 변경분만 전송
      this.lastSyncTime = Date.now();

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
            // ✅ ID 정규화
            const normId = String(item.id).replace(/\.0$/, '');
            const docKey = `${item.type}_${normId}`;
            documents[docKey] = { ...item, id: normId };
          }
        } catch (e) {
          console.error('문서 파싱 실패:', key, e);
        }
      }
    }

    return documents;
  }

  mergeDocumentsByTimestamp(serverDocs, localDocs) {
    const merged = {};

    // ✅ 보조 함수: ID 정규화 (전수조사 결과 반영)
    const normalizeKey = (key) => {
      if (!key) return '';
      let k = String(key).replace(/\.0$/, '');
      // 접두사가 없으면 (숫자 형태라면) 기본값 처리
      if (k.indexOf('_') === -1) {
        // 내부 데이터의 type을 확인하는 로직은 호출부에서 처리하거나 여기서 추론
        return k;
      }
      return k;
    };

    // 1. 서버 문서 정규화 및 병합
    for (const key in serverDocs) {
      const doc = serverDocs[key];
      const type = doc.type || (key.indexOf('_') >= 0 ? key.split('_')[0] : 'estimate');

      // ✅ [Fix] ID 처리 로직 개선
      // 1. .0 제거
      let id = String(doc.id || (key.indexOf('_') >= 0 ? key.split('_').slice(1).join('_') : key)).replace(/\.0$/, '');

      // 2. ID에 type 접두사가 포함되어 있는지 확인
      // 만약 id가 "purchase_123"이고 type이 "purchase"라면, 그대로 유지
      // 만약 id가 "123"이고 type이 "purchase"라면, "purchase_123"으로 변환하지 않고 "123"을 ID로 사용하되 키는 "purchase_123"

      // 하지만 시스템 일관성을 위해 내부 ID도 full ID (purchase_123)로 통일하는 것이 안전함
      // 기존 로직: id = 123, normKey = purchase_123
      // 새 로직: id가 접두사를 포함하지 않으면 붙여준다?
      // 사용자 요청: "prefix_번호"가 유일하게 허용되는 형태. 
      // 즉 document.id는 반드시 "purchase_123" 이어야 함.

      if (!id.startsWith(`${type}_`)) {
        id = `${type}_${id}`;
      }

      // 3. 이중 접두사 방지 (혹시 purchase_purchase_123 형태라면 수정)
      if (id.startsWith(`${type}_${type}_`)) {
        id = id.replace(`${type}_${type}_`, `${type}_`);
      }

      const normKey = id; // 키도 ID와 동일하게 설정

      if (!merged[normKey] || new Date(doc.updatedAt || 0) > new Date(merged[normKey].updatedAt || 0)) {
        merged[normKey] = { ...doc, id, type };
      }
    }

    // 2. 로컬 문서 정규화 및 병합
    for (const key in localDocs) {
      const doc = localDocs[key];
      const type = doc.type || (key.indexOf('_') >= 0 ? key.split('_')[0] : 'estimate');

      // 1. .0 제거
      let id = String(doc.id || (key.indexOf('_') >= 0 ? key.split('_').slice(1).join('_') : key)).replace(/\.0$/, '');

      // 2. 접두사 확인 및 추가
      if (!id.startsWith(`${type}_`)) {
        id = `${type}_${id}`;
      }

      // 3. 이중 접두사 방지
      if (id.startsWith(`${type}_${type}_`)) {
        id = id.replace(`${type}_${type}_`, `${type}_`);
      }

      const normKey = id;
      const localDoc = { ...doc, id, type };
      const serverDoc = merged[normKey];

      if (!serverDoc) {
        merged[normKey] = localDoc;
      } else {
        // Zombie 방지 로직
        if (serverDoc.deleted) {
          const serverDeleteTime = new Date(serverDoc.deletedAt || serverDoc.updatedAt || 0).getTime();
          const localRestoreTime = localDoc.restoredAt ? new Date(localDoc.restoredAt).getTime() : 0;

          if (localRestoreTime > serverDeleteTime) {
            merged[normKey] = localDoc;
          } else {
            merged[normKey] = serverDoc;
          }
        } else {
          // 타임스탬프 비교 (서버가 Truth, 하지만 로컬이 최신이면 로컬 반영 -> 그리고 즉시 서버로 보내짐)
          const serverTime = new Date(serverDoc.updatedAt || serverDoc.createdAt || 0).getTime();
          const localTime = new Date(localDoc.updatedAt || localDoc.createdAt || 0).getTime();

          if (localTime > serverTime) {
            merged[normKey] = localDoc;
          }
          // else: 서버가 더 최신이거나 같으면 서버 데이터 유지
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
    // legacy 키 정리 (오래된 .0 키들 등 삭제 유도)
    for (const docKey in documents) {
      const doc = documents[docKey];
      if (doc && doc.deleted !== true && doc.deleted !== 1) {
        // 1. .0 키 정리
        if (docKey.endsWith('.0')) {
          const cleanKey = docKey.replace(/\.0$/, '');
          // 새 키로 저장
          if (!localStorage.getItem(cleanKey)) {
            localStorage.setItem(cleanKey, JSON.stringify(doc));
          }
          // 구 키 삭제
          localStorage.removeItem(docKey);
          console.log(`🧹 Legacy key cleanup: ${docKey} -> ${cleanKey}`);
        }

        // 2. 이중 접두사 키 정리 (purchase_purchase_123)
        // doc.type이 있으면 그것을 기준으로 체크
        if (doc.type) {
          const doublePrefix = `${doc.type}_${doc.type}_`;
          if (docKey.startsWith(doublePrefix)) {
            const cleanKey = docKey.replace(doublePrefix, `${doc.type}_`);
            // 새 키로 저장 (데이터 마이그레이션)
            if (!localStorage.getItem(cleanKey)) {
              // ID도 내부적으로 수정해야 함
              const cleanDoc = { ...doc, id: cleanKey };
              localStorage.setItem(cleanKey, JSON.stringify(cleanDoc));
            }
            // 구 키 삭제
            localStorage.removeItem(docKey);
            console.log(`🔥 Double prefix key detected and removed: ${docKey}`);
          }
        }

        // ✅ 정규화된 키로만 저장
        const idStr = String(doc.id).replace(/\.0$/, '');
        // ID에 type 접두사가 붙어있다면 제거
        const realId = idStr.startsWith(`${doc.type}_`) ? idStr.substring(doc.type.length + 1) : idStr;

        const normKey = `${doc.type}_${realId}`;

        // 데이터 내부 ID도 정규화
        doc.id = realId;

        localStorage.setItem(normKey, JSON.stringify(doc));

        // 만약 docKey가 정규화된 키와 다르면 구버전 키 삭제
        if (docKey !== normKey) {
          console.warn(`🧹 Legacy/Duplicate key cleanup: ${docKey} -> ${normKey}`);
          localStorage.removeItem(docKey);
        }

        // 🚨 purchase_purchase_... 같은 이중 접두사 키 삭제
        if (docKey.startsWith(`${doc.type}_${doc.type}_`)) {
          console.warn(`🔥 Double prefix key detected and removed: ${docKey}`);
          localStorage.removeItem(docKey);
        }

      } else if (doc && (doc.deleted === true || doc.deleted === 1)) {
        localStorage.removeItem(docKey);
        // .0 붙은 구형 키도 삭제 시도
        localStorage.removeItem(docKey + '.0');
      }
    }
  }

  async saveToServerWithMerge() {
    try {
      console.log('💾 Gabia 서버에 데이터 저장 시작...');

      const localDocuments = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
      const inventory = JSON.parse(localStorage.getItem(INVENTORY_KEY) || '{}');
      const adminPrices = JSON.parse(localStorage.getItem(ADMIN_PRICES_KEY) || '{}');

      this.syncToLegacyKeys(localDocuments);

      // lastSyncTime 이후 변경된 문서만 전송 (서버 재조회 없음)
      const lastSyncTime = this.lastSyncTime || 0;
      const documentsToSave = {};
      let changedCount = 0;
      for (const [key, doc] of Object.entries(localDocuments)) {
        const docTime = new Date(doc.updatedAt || doc.createdAt || 0).getTime();
        if (docTime > lastSyncTime) {
          documentsToSave[key] = doc;
          changedCount++;
        }
      }

      console.log(`⚡ 변경된 문서 ${changedCount}개만 서버에 저장합니다. (전체: ${Object.keys(localDocuments).length}개)`);

      await Promise.all([
        inventoryAPI.update(inventory).catch(err => console.error('재고 저장 실패:', err)),
        this.saveAllPrices(adminPrices).catch(err => console.error('가격 저장 실패:', err)),
        changedCount > 0
          ? this.saveAllDocuments(documentsToSave).catch(err => console.error('문서 저장 실패:', err))
          : Promise.resolve(),
        activityAPI.log('data_sync', {
          dataTypes: ['inventory', 'prices', 'documents'],
          documentCount: Object.keys(localDocuments).length
        }).catch(err => console.error('활동 로그 저장 실패:', err))
      ]);

      this.lastSyncTime = Date.now();

      console.log(`✅ Gabia 서버에 데이터 저장 완료 (${changedCount}개 변경분 전송)`);

      this.broadcastUpdate('documents-updated', localDocuments);

      return true;

    } catch (error) {
      console.error('❌ Gabia 서버 저장 실패:', error);
      throw error;
    }
  }

  async saveAllPrices(adminPrices) {
    if (Array.isArray(adminPrices)) {
      console.warn('⚠️ adminPrices가 배열입니다. 무시합니다.');
      return;
    }

    // 유효한 항목만 필터링
    const validPrices = {};
    for (const [partId, data] of Object.entries(adminPrices)) {
      if (!isNaN(partId) || !data || !data.price || data.price <= 0) continue;
      validPrices[partId] = {
        price: Number(data.price),
        timestamp: data.timestamp,
        account: data.account,
        partInfo: data.partInfo || {}
      };
    }

    if (Object.keys(validPrices).length === 0) {
      console.log('📋 저장할 가격 데이터 없음');
      return;
    }

    // 전체 가격 한 번에 전송 (HTTP 요청 1번)
    await pricesAPI.bulkUpdate(validPrices).catch(err =>
      console.error('가격 벌크 저장 실패:', err.message)
    );
  }

  async saveAllDocuments(documents) {
    const docEntries = Object.entries(documents);
    if (docEntries.length === 0) return;

    // ID 정규화 후 한 번에 전송 (HTTP 요청 1번)
    const normalized = {};
    for (const [docKey, doc] of docEntries) {
      const type = doc.type;
      let idStr = String(docKey).replace(/\.0$/, '');
      if (!idStr.startsWith(`${type}_`)) idStr = `${type}_${idStr}`;
      if (idStr.startsWith(`${type}_${type}_`)) idStr = idStr.replace(`${type}_${type}_`, `${type}_`);
      normalized[idStr] = { ...doc, id: idStr, docId: idStr, type };
    }

    await documentsAPI.bulkSave(normalized).catch(err =>
      console.error('문서 벌크 저장 실패:', err)
    );
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

    return docArray.filter(doc => doc.deleted !== true && doc.deleted !== 1);
  } catch (error) {
    console.error('문서 로드 실패:', error);
    return [];
  }
};

export const loadDeletedDocuments = () => {
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    // permanently_deleted=true는 UI에서 완전히 숨김 (영구삭제 완료된 것)
    return Object.values(documents).filter(doc =>
      (doc.deleted === true || doc.deleted === 1) &&
      !doc.permanentlyDeleted && doc.permanently_deleted !== 1
    );
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

    // ✅ ID 강제 정규화
    // ✅ ID 강제 정규화 (이중 접두사 방지)
    let normalizedId = String(document.id).replace(/\.0$/, '');

    // 이미 type_ 접두사가 있으면, type_ 접두사를 제거하지 않고 그대로 둠? 
    // 아니, key 생성을 위해 일단 분리한다.
    if (normalizedId.startsWith(`${document.type}_`)) {
      // 이미 prefix가 있는 경우, 내부 ID는 유지하되 키 생성시 중복 안되게 주의
    } else {
      // prefix가 없는 경우 (이럴 일은 거의 없어야 함)
      normalizedId = `${document.type}_${normalizedId}`;
    }

    // 최종적으로 document.id는 'type_숫자' 형태여야 함
    document.id = normalizedId;

    // 키는 document.id 그대로 사용 (이미 type_ 포함됨)
    const docKey = normalizedId;

    // 🚨 방어 코드: 혹시라도 purchase_purchase_ 꼴이 되었다면 수정
    if (docKey.startsWith(`${document.type}_${document.type}_`)) {
      const fixedId = docKey.replace(`${document.type}_${document.type}_`, `${document.type}_`);
      console.warn(`🔧 Fixed double prefix ID: ${docKey} -> ${fixedId}`);
      document.id = fixedId;
      // docKey 재할당 불가하므로 아래에서 fixedId 사용 유도...를 위해 변수명 통일 필요하지만
      // const 재할당 불가하므로 여기서 return false하고 재귀호출? 은 위험.
      // 그냥 덮어쓰기
      // (const docKey 선언부를 let으로 바꾸거나, 아래 로직에서 document.id를 사용)
    }

    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    // const docKey = ... (위에서 정의함, 하지만 수정 필요)

    // 재정의
    const finalKey = document.id;

    if (!documents[finalKey] && syncInstance) {
      document.createdBy = await syncInstance.getCreatorInfo();
    }

    document.updatedAt = new Date().toISOString();
    document.syncedAt = new Date().toISOString();

    documents[finalKey] = document;

    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    localStorage.setItem(finalKey, JSON.stringify(document));

    if (syncInstance) {
      syncInstance.broadcastUpdate('documents-updated', documents);
      syncInstance.debouncedSave();
    }

    console.log(`📄 문서 저장 완료: ${finalKey}`);
    return true;

  } catch (error) {
    console.error('문서 저장 실패:', error);
    return false;
  }
};

/**
 * 재고 감소 완료 상태 업데이트
 * @param {string} docId - 실제 문서 ID (예: 'purchase_1770876851437')
 * @param {object} statusInfo - 상태 정보 {inventoryDeducted, inventoryDeductedAt, inventoryDeductedBy}
 */
export async function updateDocumentInventoryStatus(docId, statusInfo) {
  try {
    // 1. 로컬스토리지에서 문서 로드 (ID 유연성 확보)
    let docData = localStorage.getItem(docId);
    let finalDocId = docId;

    if (!docData) {
      // 혹시 prefix가 빠진 ID가 들어왔다면 접두사 붙여서 재시도
      const prefixes = ['purchase', 'estimate', 'delivery'];
      for (const prefix of prefixes) {
        const tryKey = `${prefix}_${docId}`;
        docData = localStorage.getItem(tryKey);
        if (docData) {
          finalDocId = tryKey;
          console.log(`🔧 ID 자동 보정: ${docId} -> ${finalDocId}`);
          break;
        }
      }
    }

    if (!docData) {
      console.warn(`⚠️ 문서를 찾을 수 없음: ${docId}`);
      return false;
    }

    const doc = JSON.parse(docData);

    // 2. 상태 업데이트
    doc.inventoryDeducted = statusInfo.inventoryDeducted || false;
    doc.inventoryDeductedAt = statusInfo.inventoryDeductedAt || new Date().toISOString();
    doc.inventoryDeductedBy = statusInfo.inventoryDeductedBy || 'system';
    doc.updatedAt = new Date().toISOString();

    // 3. 로컬스토리지 저장
    localStorage.setItem(finalDocId, JSON.stringify(doc));
    console.log(` ✅ 재고 상태 업데이트: ${finalDocId} → ${statusInfo.inventoryDeducted ? '완료' : '미완료'}`);

    // 4. 서버 동기화 (Queue 방식)
    await saveDocumentSync(doc);

    // 5. 🚨 [CRITICAL] 서버 즉시 저장 (Race Condition 방지)
    // Queue가 아니라 즉시 쏴버려서 서버 타임스탬프를 갱신하거나 최신 데이터로 만듦
    try {
      // documentsAPI.save 사용 시 ID 정규화 주의
      await documentsAPI.save(doc.id, {
        docId: doc.id,
        type: doc.type,
        date: doc.date,
        documentNumber: doc.documentNumber || doc.purchaseNumber || doc.deliveryNumber || doc.estimateNumber,
        companyName: doc.companyName,
        bizNumber: doc.bizNumber,
        items: doc.items || [],
        materials: doc.materials || [],
        subtotal: doc.subtotal,
        tax: doc.tax,
        totalAmount: doc.totalAmount,
        notes: doc.notes,
        topMemo: doc.topMemo,
        // ✅ 핵심: 재고 상태 포함
        inventoryDeducted: doc.inventoryDeducted,
        inventoryDeductedAt: doc.inventoryDeductedAt,
        inventoryDeductedBy: doc.inventoryDeductedBy
      });
      console.log(`🚀 재고 상태 서버 즉시 전송 완료: ${finalDocId}`);
    } catch (serverErr) {
      console.error('❌ 재고 상태 서버 즉시 전송 실패 (백그라운드 싱크에 의존):', serverErr);
    }

    // 6. 이벤트 발송 (다른 컴포넌트에서 UI 업데이트)
    window.dispatchEvent(new CustomEvent('documentInventoryStatusUpdated', {
      detail: { docId: finalDocId, ...statusInfo }
    }));

    return true;
  } catch (error) {
    console.error('❌ 재고 상태 업데이트 실패:', error);
    return false;
  }
}


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

/**
 * 특정 거래번호(documentNumber)가 재고 처리되었는지 확인
 * (문서 종류에 상관없이 하나라도 처리되었으면 true)
 */
export const isTransactionDeducted = (docNumber) => {
  if (!docNumber) return false;
  try {
    const documents = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '{}');
    const targetNum = String(docNumber).trim();

    // 모든 문서를 순회하며 해당 거래번호의 재고 상태 확인
    return Object.values(documents).some(doc => {
      const docNum = String(doc.documentNumber || doc.purchaseNumber || doc.deliveryNumber || doc.estimateNumber || '').trim();
      return docNum === targetNum && doc.inventoryDeducted === true && !doc.deleted;
    });
  } catch (error) {
    console.error('거래번호 재고상태 확인 실패:', error);
    return false;
  }
};

if (typeof window !== 'undefined') {
  initRealtimeSync();
}
