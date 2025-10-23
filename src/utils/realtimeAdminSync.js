// src/utils/realtimeAdminSync.js
/**
 * 실시간 관리자 데이터 동기화 시스템
 * 전 세계 모든 PC에서 실시간 동기화
 */

// 데이터 키
const INVENTORY_KEY = 'inventory_data';
const ADMIN_PRICES_KEY = 'admin_edit_prices';
const PRICE_HISTORY_KEY = 'admin_price_history';
const ACTIVITY_LOG_KEY = 'admin_activity_log';

class RealtimeAdminSync {
  constructor() {
    // GitHub 설정 - 환경변수에서만 로드
    this.GIST_ID = import.meta.env.VITE_GITHUB_GIST_ID;
    this.GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
    
    this.API_BASE = 'https://api.github.com/gists';
    this.isOnline = navigator.onLine;
    this.maxRetries = 3;
    
    // ✅ Debounce용 변수
    this.saveTimeout = null;
    this.lastSaveTime = 0;
    this.minSaveInterval = 3000; // 최소 3초 간격
    
    this.setupEventListeners();
    this.initBroadcastChannel();
    
    // 초기 데이터 로드
    this.loadFromServer();
    
    // 5분마다 자동 동기화
    setInterval(() => {
      this.loadFromServer();
    }, 5 * 60 * 1000);
  }

  // 브로드캐스트 채널 초기화 (같은 PC 내 탭 간 동기화)
  initBroadcastChannel() {
    try {
      this.channel = new BroadcastChannel('admin-sync');
      this.channel.addEventListener('message', (event) => {
        const { type, data, source } = event.data;
        
        // 자신이 보낸 메시지는 무시
        if (source === this.getInstanceId()) return;
        
        switch (type) {
          case 'inventory-updated':
            this.handleInventoryUpdate(data);
            break;
          case 'prices-updated':
            this.handlePricesUpdate(data);
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

  // 인스턴스 고유 ID 생성
  getInstanceId() {
    if (!this.instanceId) {
      this.instanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.instanceId;
  }

  // 네트워크 상태 감지
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

  // GitHub API 헤더
  getHeaders() {
    return {
      'Authorization': `token ${this.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'sammirack-admin-sync/1.0'
    };
  }

  // 현재 사용자 IP 가져오기
  async getUserIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  // ✅ 새로 추가: Debounced 저장 (3초 모았다가 한 번만)
  debouncedSave() {
    // 기존 타이머 취소
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    console.log('📥 저장 예약 (3초 후 실행)');

    // 3초 후 저장 실행
    this.saveTimeout = setTimeout(async () => {
      const now = Date.now();
      const timeSinceLastSave = now - this.lastSaveTime;

      // 마지막 저장 후 3초 이상 경과했는지 확인
      if (timeSinceLastSave < this.minSaveInterval) {
        const waitTime = this.minSaveInterval - timeSinceLastSave;
        console.log(`⏳ 너무 빠른 저장 요청. ${Math.ceil(waitTime/1000)}초 후 재시도`);
        setTimeout(() => this.executeSave(), waitTime);
        return;
      }

      await this.executeSave();
    }, 3000);
  }

  // ✅ 실제 저장 실행
  async executeSave() {
    console.log('🔄 서버 저장 실행');
    this.lastSaveTime = Date.now();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.saveToServer();
        console.log('✅ 서버 저장 완료');
        return true;
      } catch (error) {
        console.error(`❌ 저장 시도 ${attempt}/${this.maxRetries} 실패:`, error.message);

        if (attempt < this.maxRetries) {
          const waitTime = attempt * 2000; // 2초, 4초, 6초...
          console.log(`⏳ ${waitTime/1000}초 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.error('❌ 최대 재시도 횟수 초과. 저장 실패');
    return false;
  }

  // GitHub Gist에서 데이터 로드
  async loadFromServer() {
    if (!this.GIST_ID || !this.GITHUB_TOKEN) {
      console.error('❌ GitHub 설정이 누락되었습니다.');
      console.error('   GIST_ID:', this.GIST_ID ? '설정됨' : '없음');
      console.error('   TOKEN:', this.GITHUB_TOKEN ? `설정됨 (${this.GITHUB_TOKEN.substring(0, 4)}...)` : '없음');
      throw new Error('GitHub 설정 오류: GIST_ID 또는 TOKEN이 없습니다.');
    }
    
    try {
      console.log('🔄 GitHub 서버에서 데이터 로드 중...');
      
      const response = await fetch(`${this.API_BASE}/${this.GIST_ID}`, {
        headers: this.getHeaders()
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new Error(`GitHub API 인증 실패 (401): Token 권한 확인 필요`);
        } else if (response.status === 404) {
          throw new Error(`Gist를 찾을 수 없음 (404): GIST_ID 확인 필요`);
        } else if (response.status === 403) {
          // ✅ 403 에러 상세 분석
          if (errorText.includes('rate limit')) {
            throw new Error(`Rate Limit 초과 (403)`);
          } else {
            throw new Error(`접근 거부 (403): Token 권한 또는 너무 빠른 요청`);
          }
        } else {
          throw new Error(`GitHub API 오류 (${response.status}): ${errorText}`);
        }
      }
  
      const gist = await response.json();
      
      if (gist.files) {
        if (gist.files['inventory.json']) {
          const inventoryData = JSON.parse(gist.files['inventory.json'].content);
          localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventoryData));
          this.broadcastUpdate('inventory-updated', inventoryData);
        }
  
        if (gist.files['admin_prices.json']) {
          const pricesData = JSON.parse(gist.files['admin_prices.json'].content);
          localStorage.setItem(ADMIN_PRICES_KEY, JSON.stringify(pricesData));
          this.broadcastUpdate('prices-updated', pricesData);
        }
  
        if (gist.files['price_history.json']) {
          const historyData = JSON.parse(gist.files['price_history.json'].content);
          localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(historyData));
        }
  
        if (gist.files['activity_log.json']) {
          const activityData = JSON.parse(gist.files['activity_log.json'].content);
          localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityData));
        }
      }
  
      console.log('✅ GitHub 서버 데이터 로드 완료');
      return true;
      
    } catch (error) {
      console.error('❌ GitHub 서버 데이터 로드 실패:', error);
      console.error('   에러 상세:', error.message);
      throw error;
    }
  }

  // GitHub Gist에 데이터 저장
  async saveToServer() {
    if (!this.GIST_ID || !this.GITHUB_TOKEN) {
      console.error('❌ GitHub 설정이 누락되었습니다.');
      return false;
    }

    try {
      const inventory = JSON.parse(localStorage.getItem(INVENTORY_KEY) || '{}');
      const adminPrices = JSON.parse(localStorage.getItem(ADMIN_PRICES_KEY) || '{}');
      const priceHistory = JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY) || '{}');
      const activityLog = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || '[]');

      const userIP = await this.getUserIP();
      
      activityLog.unshift({
        timestamp: new Date().toISOString(),
        action: 'data_sync',
        userIP,
        dataTypes: ['inventory', 'prices', 'history']
      });

      if (activityLog.length > 1000) {
        activityLog.splice(1000);
      }

      const files = {
        'inventory.json': {
          content: JSON.stringify(inventory, null, 2)
        },
        'admin_prices.json': {
          content: JSON.stringify(adminPrices, null, 2)
        },
        'price_history.json': {
          content: JSON.stringify(priceHistory, null, 2)
        },
        'activity_log.json': {
          content: JSON.stringify(activityLog, null, 2)
        },
        'last_updated.txt': {
          content: `Last updated: ${new Date().toISOString()}\nUser IP: ${userIP}\nSync ID: ${this.getInstanceId()}`
        }
      };

      const response = await fetch(`${this.API_BASE}/${this.GIST_ID}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ files })
      });

      if (!response.ok) {
        throw new Error(`GitHub API 저장 실패: ${response.status} - ${response.statusText}`);
      }

      console.log('✅ GitHub 서버에 데이터 저장 완료');
      
      localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLog));
      
      return true;
      
    } catch (error) {
      console.error('❌ GitHub 서버 저장 실패:', error);
      throw error;
    }
  }

  // 브로드캐스트 업데이트
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

  // 업데이트 핸들러들
  handleInventoryUpdate(data) {
    console.log('📦 실시간 재고 업데이트 수신:', data);
    window.dispatchEvent(new CustomEvent('inventoryUpdated', { detail: data }));
  }

  handlePricesUpdate(data) {
    console.log('💰 실시간 단가 업데이트 수신:', data);
    window.dispatchEvent(new CustomEvent('adminPricesUpdated', { detail: data }));
  }

  handleForceReload() {
    console.log('🔄 강제 새로고침 수신');
    window.dispatchEvent(new CustomEvent('forceDataReload'));
  }
}

// 싱글톤 인스턴스
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

// ✅ 수정: 재고 저장 함수 (Debounce 적용)
export const saveInventorySync = async (partId, quantity, userInfo = {}) => {
  try {
    const inventory = JSON.parse(localStorage.getItem(INVENTORY_KEY) || '{}');
    inventory[partId] = quantity;
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));

    if (syncInstance) {
      syncInstance.broadcastUpdate('inventory-updated', { [partId]: quantity });
    }

    // ✅ 즉시 저장하지 않고 Debounce
    if (syncInstance) {
      syncInstance.debouncedSave();
    }

    return true;
  } catch (error) {
    console.error('재고 저장 실패:', error);
    return false;
  }
};

// 재고 로드 함수
export const loadInventory = () => {
  try {
    const stored = localStorage.getItem(INVENTORY_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('재고 로드 실패:', error);
    return {};
  }
};

// 강제 서버 동기화
export const forceServerSync = async () => {
  if (syncInstance) {
    await syncInstance.loadFromServer();
  }
};

// 부품 고유 ID 생성
export const generatePartId = (item) => {
  if (!item) {
    console.warn('generatePartId: item이 undefined입니다');
    return 'unknown-part';
  }
  
  const { rackType = '', name = '', specification = '' } = item;
  const cleanName = String(name).replace(/[^\w가-힣]/g, '');
  const cleanSpec = String(specification).replace(/[^\w가-힣]/g, '');
  return `${rackType}-${cleanName}-${cleanSpec}`.toLowerCase();
};

// 관리자 단가 로드
export const loadAdminPrices = () => {
  try {
    const stored = localStorage.getItem(ADMIN_PRICES_KEY) || '{}';
    return JSON.parse(stored);
  } catch (error) {
    console.error('관리자 단가 로드 실패:', error);
    return {};
  }
};

// ✅ 수정: 관리자 단가 저장 (Debounce 적용)
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

    // ✅ 즉시 저장하지 않고 Debounce
    if (syncInstance) {
      syncInstance.debouncedSave();
    }

    return true;
  } catch (error) {
    console.error('관리자 단가 저장 실패:', error);
    return false;
  }
};

// 자동 초기화
if (typeof window !== 'undefined') {
  initRealtimeSync();
}
