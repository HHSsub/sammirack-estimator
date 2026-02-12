# 다중 사용자 동시성 문제 분석 및 해결방안

## 문제 상황 요약

사용자님께서 우려하시는 상황:
- 여러 로컬 PC(서로 다른 IP)에서 동시에 문서를 생성/편집하고 가비아 서버에 재고감소를 요청하는 경우
- 특정 로컬 PC의 데이터가 통째로 덮어씌워지거나, 여러 로컬 PC의 작업이 제대로 서버에서 처리되지 않을 가능성

## 📊 현재 시스템 구조 분석

### 1. 문서 관리 Flow

**문서 저장 프로세스** ([`realtimeAdminSync.js` L765-803](file:///c:/Users/User/Downloads/sammi/sammirack-estimator/src/utils/realtimeAdminSync.js#L765-L803)):

```javascript
export const saveDocumentSync = async (document) => {
  // 1. 로컬스토리지에 저장
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
  localStorage.setItem(docKey, JSON.stringify(document));
  
  // 2. BroadcastChannel로 같은 브라우저의 다른 탭에 알림
  syncInstance.broadcastUpdate('documents-updated', documents);
  
  // 3. Debounced Save (1초 후)
  syncInstance.debouncedSave(); // → saveToServerWithMerge()
}
```

**서버 저장 프로세스** ([`realtimeAdminSync.js` L450-546](file:///c:/Users/User/Downloads/sammi/sammirack-estimator/src/utils/realtimeAdminSync.js#L450-L546)):

```javascript
async saveToServerWithMerge() {
  // 1. 서버에서 최신 문서 목록 가져오기
  const serverDocuments = await this.getServerDocuments();
  
  // 2. 로컬 문서와 병합 (타임스탬프 기준)
  const mergedDocuments = this.mergeDocumentsByTimestamp(serverDocuments, localDocuments);
  
  // 3. 변경된 문서만 서버에 전송
  const documentsToSave = {}; // 필터링된 문서만
  await documentsAPI.save(docId, data);
}
```

### 2. 재고 감소 Flow

**재고 감소 프로세스** ([`InventoryManager.jsx` L42-328](file:///c:/Users/User/Downloads/sammi/sammirack-estimator/src/components/InventoryManager.jsx#L42-L328)):

```javascript
export const deductInventoryOnPrint = async (cartItems, documentType, documentNumber, materialsOverride) => {
  // 1. 서버에서 최신 재고 데이터 가져오기
  const serverInventory = await inventoryService.getInventory();
  
  // 2. BOM 아이템별로 재고 계산
  bomItemsToProcess.forEach((bomItem) => {
    const currentStock = Number(serverInventory[inventoryPartId]) || 0;
    const newStock = currentStock - requiredQty;
    updates[inventoryPartId] = newStock;
  });
  
  // 3. 로컬스토리지 업데이트
  Object.assign(localInventory, updates);
  localStorage.setItem('inventory_data', JSON.stringify(localInventory));
  
  // 4. 변경된 부분만 서버로 전송
  await inventoryService.updateInventory(updates);
}
```

### 3. API 구조

[`apiClient.js`](file:///c:/Users/User/Downloads/sammi/sammirack-estimator/src/services/apiClient.js):

```javascript
export const inventoryAPI = {
  getAll: () => apiClient.get('/inventory'),
  update: (updates) => apiClient.post('/inventory/update', updates)
};

export const documentsAPI = {
  save: (docId, data) => apiClient.post('/documents/save', { docId, ...data })
};
```

## 🚨 식별된 동시성 문제

### 문제 1: Race Condition (경쟁 상태)

> [!CAUTION]
> 여러 PC에서 동시에 문서를 저장하거나 재고를 감소시킬 때, **타임스탬프 기반 병합** 방식으로 인해 최신 변경사항만 살아남고 나머지는 소실될 수 있습니다.

**시나리오 예시 (사용자님의 예시)**:

```
시각        | PC A (사용자 a)              | PC B (사용자 b)              | Gabia 서버
----------- | ---------------------------- | ---------------------------- | ------------------
13:00:00    | 문서 6 생성 (로컬)          |                              | 문서: [1,2,3,4,5]
13:00:05    |                              | 문서 7 생성 (로컬)          | 문서: [1,2,3,4,5]
13:00:10    | 청구서 인쇄 버튼 클릭       |                              | 문서: [1,2,3,4,5]
13:00:11    | → 재고감소 요청 시작        |                              | 문서: [1,2,3,4,5]
13:00:12    | → 서버 재고 조회: 100개     |                              | 재고: partX = 100
13:00:13    |                              | 저장 버튼 클릭 → 문서 7 저장 | 문서: [1,2,3,4,5,7]
13:00:14    |                              | 청구서 인쇄 버튼 클릭        | 문서: [1,2,3,4,5,7]
13:00:15    | → 재고 계산: 100 - 10 = 90  | → 재고감소 요청 시작        | 재고: partX = 100
13:00:16    | → 서버에 재고 전송: 90      | → 서버 재고 조회: 100개 ❌  | 재고: partX = 90
13:00:17    | → 문서 6 저장 (debounced)   | → 재고 계산: 100 - 5 = 95   | 문서: [1,2,3,4,5,7]
13:00:18    |                              | → 서버에 재고 전송: 95 ❌   | 재고: partX = 95 ❌
13:00:19    |                              | → 문서 7 재저장 (중복)      | 재고: partX = 95 ❌
```

**결과**: A의 재고 감소(-10)가 무시되고, B의 재고 감소(-5)만 반영됨. **실제로는 15개가 감소해야 하지만 5개만 감소됨**.

### 문제 2: Lost Update (소실된 업데이트)

> [!WARNING]
> Read → Modify → Write 패턴에서 중간에 다른 사용자의 변경이 발생하면 먼저 저장한 사용자의 변경사항이 소실됩니다.

**문서 저장 시나리오**:

```javascript
// PC A: 13:00:00
serverDocuments = { estimate_1, estimate_2 }
localDocuments = { estimate_1, estimate_2, estimate_6 } // 새로 생성
merged = mergeDocumentsByTimestamp(server, local)
// → { estimate_1, estimate_2, estimate_6 }

// PC B: 13:00:05 (동시에)
serverDocuments = { estimate_1, estimate_2 } // 아직 estimate_6 없음
localDocuments = { estimate_1, estimate_2, estimate_7 } // 새로 생성
merged = mergeDocumentsByTimestamp(server, local)
// → { estimate_1, estimate_2, estimate_7 }

// PC A가 먼저 저장: 13:00:10
documentsAPI.save() // → 서버에 estimate_6 저장
// 서버 상태: { estimate_1, estimate_2, estimate_6 }

// PC B가 저장: 13:00:12
documentsAPI.save() // → 서버에 estimate_7 저장
// ❌ 문제: 서버가 PC B의 전체 문서 목록으로 덮어씌우면
// estimate_6이 사라질 수 있음!
```

### 문제 3: Debounce로 인한 지연

> [!IMPORTANT]
> `debouncedSave()` (1초 대기)로 인해 빠른 연속 작업 시 중간 상태가 서버에 반영되지 않을 수 있습니다.

```javascript
// realtimeAdminSync.js L113-150
debouncedSave() {
  this.debounceDelay = 1000; // 1초 대기
  // → 1초 안에 여러 변경이 발생하면 마지막 것만 저장됨
}
```

### 문제 4: 타임스탬프 기반 병합의 한계

```javascript
// realtimeAdminSync.js L407-427
mergeByTimestamp(serverData, localData) {
  const serverTime = new Date(serverItem.timestamp).getTime();
  const localTime = new Date(localItem.timestamp).getTime();
  
  if (localTime > serverTime) {
    merged[key] = localItem; // 로컬이 더 최신이면 로컬 사용
  }
  // ❌ 문제: 동시에 다른 항목을 수정한 경우
  // 각 로컬의 다른 변경사항이 모두 반영되지 않음
}
```

## 💡 권장 해결방안

### 해결방안 1: 원자적(Atomic) 업데이트 + 서버 측 병합

> [!TIP]
> **재고 감소**는 서버에서 원자적으로 처리하여 Race Condition 방지

**변경 전** (현재):
```javascript
// 클라이언트에서 계산하고 절대값 전송
const newStock = currentStock - requiredQty;
await inventoryAPI.update({ partId: newStock });
```

**변경 후** (권장):
```javascript
// 서버에 "감소" 명령만 전송
await inventoryAPI.deduct({ 
  partId: inventoryPartId, 
  quantity: requiredQty,
  documentId: documentNumber,
  timestamp: Date.now()
});

// 서버측 처리 (Node.js/PHP):
// 1. 트랜잭션 시작
// 2. SELECT ... FOR UPDATE (Lock)
// 3. UPDATE inventory SET quantity = quantity - :qty WHERE partId = :id
// 4. 변경 로그 저장 (어떤 문서가 언제 감소시켰는지)
// 5. 트랜잭션 커밋
```

### 해결방안 2: 문서는 Append-Only + ID 기반 병합

**변경 전** (현재):
```javascript
// 타임스탬프로 전체 문서 목록 병합
const merged = mergeDocumentsByTimestamp(serverDocs, localDocs);
```

**변경 후** (권장):
```javascript
// 각 문서를 독립적으로 처리
for (const [docId, doc] of Object.entries(localDocuments)) {
  const serverDoc = serverDocuments[docId];
  
  if (!serverDoc) {
    // 새 문서: 서버에 추가
    await documentsAPI.create(docId, doc);
  } else {
    // 기존 문서: 타임스탬프 비교 후 최신 것 사용
    if (doc.updatedAt > serverDoc.updatedAt) {
      await documentsAPI.update(docId, doc);
    }
  }
}
```

### 해결방안 3: Optimistic Locking (낙관적 잠금)

**서버 측 구현**:
```javascript
// 문서에 version 필드 추가
{
  id: "estimate_6",
  version: 3, // 매번 저장 시 +1
  ...
}

// 클라이언트에서 저장 시 버전 포함
await documentsAPI.save(docId, { ...doc, version: 3 });

// 서버에서 검증
if (serverDoc.version !== requestedVersion) {
  // 충돌 발생!
  return { conflict: true, serverDoc };
}
// 정상: version 증가 후 저장
serverDoc.version++;
```

### 해결방안 4: 실시간 동기화 개선

**변경 후**:
```javascript
// WebSocket 또는 Server-Sent Events 사용
const eventSource = new EventSource('/api/events');
eventSource.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  if (type === 'inventory-updated') {
    // 서버에서 푸시한 최신 재고 즉시 반영
    setInventory(data);
  } else if (type === 'document-created') {
    // 다른 PC에서 만든 문서 즉시 표시
    updateDocumentList(data);
  }
};
```

## 📋 즉시 적용 가능한 임시 해결책

### 1. 재고 감소 시 서버 재조회 추가

[`InventoryManager.jsx` L42-328](file:///c:/Users/User/Downloads/sammi/sammirack-estimator/src/components/InventoryManager.jsx#L42-L328) 수정:

```javascript
export const deductInventoryOnPrint = async (...) => {
  // 기존 코드...
  
  // ✅ 추가: 서버 저장 후 즉시 재조회하여 확인
  await inventoryService.updateInventory(updates);
  
  // ✅ 검증: 서버에서 다시 읽어와서 확인
  const verifiedInventory = await inventoryService.getInventory();
  const conflicts = [];
  
  for (const [partId, expectedQty] of Object.entries(updates)) {
    const actualQty = verifiedInventory[partId];
    if (actualQty !== expectedQty) {
      conflicts.push({ partId, expected: expectedQty, actual: actualQty });
    }
  }
  
  if (conflicts.length > 0) {
    console.warn('⚠️ 재고 충돌 감지:', conflicts);
    // 사용자에게 알림
  }
};
```

### 2. Debounce 시간 단축

[`realtimeAdminSync.js` L113-150](file:///c:/Users/User/Downloads/sammi/sammirack-estimator/src/utils/realtimeAdminSync.js#L113-L150) 수정:

```javascript
// 변경 전
this.debounceDelay = 1000; // 1초

// 변경 후
this.debounceDelay = 300; // 0.3초로 단축
```

### 3. 충돌 로그 추가

```javascript
// saveToServerWithMerge() 내부에 추가
console.log('🔄 병합 상세:');
for (const [key, doc] of Object.entries(mergedDocuments)) {
  const serverDoc = serverDocuments[key];
  const localDoc = localDocuments[key];
  
  if (serverDoc && localDoc) {
    const winner = doc.updatedAt === localDoc.updatedAt ? 'LOCAL' : 'SERVER';
    console.log(`  ${key}: ${winner} 우선 (서버: ${serverDoc.updatedAt}, 로컬: ${localDoc.updatedAt})`);
  }
}
```

## 🎯 결론

### 현재 시스템의 동시성 처리 방식

**✅ 잘 작동하는 부분**:
1. **타임스탬프 기반 병합**: 단일 사용자의 경우 로컬 ↔ 서버 동기화 잘 됨
2. **Broadcast Channel**: 같은 브라우저의 여러 탭 간 동기화 정상 작동
3. **재시도 로직**: 네트워크 오류 시 자동 재시도 (최대 3회)

**❌ 문제가 되는 부분**:
1. **재고 감소**: Read-Modify-Write 패턴으로 인한 Lost Update
2. **문서 저장**: 타임스탬프만으로는 동시 저장 시 충돌 해결 불가
3. **Debounce**: 빠른 연속 작업 시 중간 상태 손실 가능

### 사용자님 시나리오 분석

```
현재 서버 문서: [1,2,3,4,5]

PC A: 문서 6 생성 → 청구서 인쇄 (재고 -10)
PC B: 문서 7 생성 → 저장 → 청구서 인쇄 (재고 -5)
```

**예상 결과** (현재 시스템):
- ✅ 문서 6, 7 모두 서버에 저장됨 (ID가 다르므로 충돌 없음)
- ❌ 재고는 **마지막에 저장한 PC의 값**으로 덮어씌워질 가능성 높음
- ❌ 만약 PC A가 13:00:17에, PC B가 13:00:18에 저장하면:
  - PC B의 재고(-5)가 최종 값이 되어 PC A의 -10은 무시됨

**이상적인 결과**:
- ✅ 문서 6, 7 모두 저장
- ✅ 재고는 -15 (A의 -10 + B의 -5) 반영
- ✅ 각 문서가 어떤 부품을 몇 개 감소시켰는지 로그 보관

## User Review Required

> [!WARNING]
> **현재 시스템은 동시 사용자 환경에서 재고 데이터 손실 위험이 있습니다.**

다음 사항을 확인해주세요:

1. **서버 API 수정 권한**: Gabia 서버의 `/api/inventory/update` 엔드포인트를 수정할 수 있나요?
   - 가능하다면 → 해결방안 1 (원자적 업데이트) 적용 권장
   - 불가능하다면 → 임시 해결책 적용 후 모니터링

2. **WebSocket 지원**: 서버에서 WebSocket 또는 SSE를 지원하나요?
   - 지원한다면 → 실시간 동기화 개선 가능
   - 지원하지 않으면 → Polling 방식으로 주기적 재조회

3. **테스트 환경**: 2대 이상의 PC에서 동시 테스트가 가능한가요?
   - 가능하다면 → 실제 동시성 테스트 후 문제 재현 여부 확인

## Proposed Changes

현재는 **분석 단계**이므로 코드 변경은 제안하지 않습니다. 사용자님의 확인 후 다음 단계를 진행하겠습니다.

## Verification Plan

### 동시성 문제 재현 테스트

**준비물**: PC 2대 (또는 브라우저 2개 - 다른 프로필 사용)

**테스트 시나리오 1 - 재고 감소 충돌**:
1. PC A: 문서 생성 (아직 저장 안 함)
2. PC B: 문서 생성 (저장 완료)
3. PC A, B 거의 동시에 (5초 이내) "인쇄" 버튼 클릭
4. 개발자 도구 콘솔 확인:
   - `📦 서버 재고 데이터` 로그의 타임스탬프 비교
   - 재고 감소 전후 값 확인
5. 서버 DB 확인: 실제 재고가 (A의 감소 + B의 감소) 만큼 줄었는지 확인

**기대 결과**: 
- ❌ (현재) 둘 중 하나의 감소만 반영되거나, 예상보다 적게 감소
- ✅ (수정 후) 두 감소 모두 정확히 반영

**테스트 시나리오 2 - 문서 저장 충돌**:
1. PC A: 문서 ID 100 생성
2. PC B: 문서 ID 101 생성
3. 둘 다 거의 동시에 저장
4. 서버 새로고침하여 문서 목록 확인

**기대 결과**:
- ✅ (현재) ID가 다르므로 둘 다 저장됨
- ✅ (수정 후) 동일
