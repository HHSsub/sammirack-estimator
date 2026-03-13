# 🏗️ 삼미랙 재고 자동화 시스템 설계 (v2)
## 수동 주문 + 스마트스토어 이중 경로 추적

---

## 📊 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│           두 가지 주문 경로, 두 가지 재고 처리 방식             │
└─────────────────────────────────────────────────────────────────┘

경로 A: 수동 주문                    경로 B: 스마트스토어 자동
(사람이 의사결정)                    (자동으로 처리)

홈페이지 옵션선택기
         ↓
OptionSelector입력
         ↓
    견적서 생성
         ↓
[상태 기반]                       스마트스토어 주문 수신
상태: ESTIMATE_CREATED              ↓
Impact: 0.20                    [시간 기반]
         ↓                       
[수정 가능 - 버전 관리]          시간 확인
상태: ESTIMATE_MODIFIED          ↓
Impact: 0.20                 ┌─ 14:00 이전?
         ↓                  │  └→ 당일 처리
발주서 생성                  │     (당일 발송)
상태: PURCHASE_ORDER_CREATED│
Impact: 0.70                 └─ 14:00 이후?
         ↓                      └→ 다음 영업일 처리
[수정 가능]                       (다음날 발송)
상태:PURCHASE_ORDER_MODIFIED      ↓
Impact: 0.70              SMARTSTORE_AUTO_DEDUCTED
         ↓                Impact: 1.00 (무조건 출고)
FAX 또는 인쇄 전송               ↓
상태: ORDER_CONFIRMED_FAX_SENT   배송
Impact: 0.95                     ↓
         ↓                   DELIVERED
배송 준비 및 출고             Impact: 1.00
상태: PACKING / SHIPPED
Impact: 0.99 ~ 1.00
         ↓
배송 완료 & 재고 실제 감소
상태: DELIVERED
Impact: 1.00
```

---

## 🔑 핵심 개념

### 1️⃣ 수동 주문: 상태 기반 + 확률 기반

**문서 상태 머신**:
```
       (초안)              (준비중)           (확정)              (처리중)
ESTIMATE  ──수정──→  PURCHASE_ORDER  ──전송──→  ORDER_CONFIRMED  ──출고──→  DELIVERED
 0.20      0.20          0.70            0.95         0.99~1.00        1.00

 변경가능   변경가능       변경가능         거의확정       거의확정         확정
 확률낮음   확률낮음       확률중간         확률높음       확률매우높음     확정
```

**Impact Score의 의미**:
- **0.20**: 견적서 단계 - 취소될 가능성 높음 (80% 확률로 변경/취소)
- **0.70**: 발주서 단계 - 의도 명확하지만 마지막 확인 전 (30% 리스크)
- **0.95**: FAX 전송됨 - 거의 확정 (5% 리스크만 있음)
- **1.00**: 배송 중/완료 - 100% 확정

**재고 영향 계산**:
```
예약된 재고 = 상품 수량 × BOM 세트 × Impact Score

예시:
- 하이랙 4단 2개 주문
- 기둥 8개 필요
- 상태: ESTIMATE_CREATED (Impact: 0.20)
- 예약: 8개 × 0.20 = 1.6개만 예약 (불확실성 반영)

---

나중에 상태가 변경되면:
상태: FAX_SENT (Impact: 0.95)
예약: 8개 × 0.95 = 7.6개로 증가 (더 확실해짐)
```

---

### 2️⃣ 스마트스토어 자동 주문: 시간 기반 + 결정론적

**오후 2시 기준 규칙**:
```
오전 6시 ~ 오후 2시 00분 사이 주문
    ↓
즉시 결정론적 처리
그 날 재고 감소 → 당일 발송

─────────────────────────────────────

오후 2시 01분 ~ 다음날 오전 6시 사이 주문
    ↓
대기 상태 (PENDING_NEXT_BUSINESS_DAY)
다음 영업일 오전 10시에 자동 처리
다음 영업일 재고 감소 → 다음날 발송
```

**영업일 예시**:
```
금요일 오후 3시 주문
  → PENDING 상태
  → 다음 영업일(월요일) 오전 10시에 자동 처리
  → 월요일 재고 감소 & 발송
  → 화요일 도착
```

**Impact Score**:
```
SMARTSTORE_AUTO_DEDUCTED = 1.00 (항상 확정)
- 스마트스토어에서 정해진 규칙이므로 취소/수정 불가
- 자동으로 처리되므로 의사결정 필요 없음
```

---

## 📈 재고 추적의 세 가지 관점

### 관점 1: 현재 재고 (Current Inventory)
```json
{
  "2026-03-06": {
    "메트그레이 기둥": {
      "physical_count": 500,        // 실제 창고에 있는 수량
      "locked_for_delivery": 50,    // 현재 배송 중인 수량
      "available": 450              // 판매 가능한 수량
    }
  }
}
```

### 관점 2: 예약된 재고 (Reserved Inventory)
```json
{
  "2026-03-06": {
    "메트그레이 기둥": {
      "from_estimates": 100,        // Impact: 0.20~0.70
      "from_confirmed_orders": 80,  // Impact: 0.95~0.99
      "from_smartstore": 150,       // Impact: 1.00 (자동)
      "total_reserved": 330,
      "weighted_impact": 0.82,
      "expected_consumption": 271   // 330 × 0.82
    }
  }
}
```

### 관점 3: 예측 (Forecast)
```json
{
  "forecast_3_days": {
    "2026-03-07": {
      "메트그레이 기둥": {
        "expected_deduction": 180,
        "confidence": 0.85,
        "source": [
          "estimate_1: 50 (0.20)",
          "purchase_order_2: 80 (0.95)",
          "smartstore_10: 50 (1.00)"
        ]
      }
    }
  }
}
```

---

## 🗂️ 데이터 저장소 설계

### 저장소 1: `inventory_documents_v2.json`
```json
{
  "manual_orders": {
    "estimate_1768820888725": {
      "id": "estimate_1768820888725",
      "documentNumber": "5717-5073 *20",
      "type": "manual",
      "source": "manual",
      "created_at": "2026-01-19T09:38:00Z",
      "last_modified": "2026-01-21T10:00:00Z",
      "current_status": "ORDER_CONFIRMED_FAX_SENT",
      "current_version": 4,
      
      "versions": [
        {
          "version": 1,
          "timestamp": "2026-01-19T09:38:00Z",
          "status": "ESTIMATE_CREATED",
          "impact_score": 0.20,
          "items": [...],
          "materials": [...],
          "reserved_inventory": {"메트그레이 기둥": 8}
        },
        {
          "version": 2,
          "timestamp": "2026-01-20T14:22:00Z",
          "status": "ESTIMATE_MODIFIED",
          "impact_score": 0.20,
          "items": [...],
          "materials": [...],
          "reserved_inventory": {"메트그레이 기둥": 12},
          "delta": {"메트그레이 기둥": +4}
        },
        {
          "version": 3,
          "timestamp": "2026-01-20T16:45:00Z",
          "status": "PURCHASE_ORDER_CREATED",
          "impact_score": 0.70,
          "items": [...],
          "materials": [...],
          "reserved_inventory": {"메트그레이 기둥": 12},
          "delta": {"메트그레이 기둥": 0}
        },
        {
          "version": 4,
          "timestamp": "2026-01-21T10:00:00Z",
          "status": "ORDER_CONFIRMED_FAX_SENT",
          "impact_score": 0.95,
          "items": [...],
          "materials": [...],
          "reserved_inventory": {"메트그레이 기둥": 12},
          "delta": {"메트그레이 기둥": 0},
          "fax_sent_at": "2026-01-21T10:00:00Z"
        }
      ]
    }
  },
  
  "smartstore_orders": {
    "smartstore_order_12345": {
      "id": "smartstore_order_12345",
      "order_id": "naver_order_xyz",
      "type": "smartstore",
      "source": "smartstore_api",
      "received_at": "2026-03-06T13:45:00Z",  // 오후 1시 45분
      "cutoff_time": "2026-03-06T14:00:00Z",  // 오후 2시 기준
      "arrival_time_before_cutoff": true,     // 오후 2시 이전
      "scheduled_processing": "2026-03-06T00:00:00Z",  // 당일 처리
      
      "current_status": "SMARTSTORE_AUTO_DEDUCTED",
      "impact_score": 1.00,
      
      "items": [...],
      "materials": [...],
      "reserved_inventory": {"메트그레이 기둥": 12},
      
      "processing_history": [
        {
          "timestamp": "2026-03-06T14:05:00Z",
          "status": "SMARTSTORE_AUTO_DEDUCTED",
          "inventory_deducted": true,
          "inventory_deducted_timestamp": "2026-03-06T14:05:00Z"
        },
        {
          "timestamp": "2026-03-06T18:30:00Z",
          "status": "SHIPPED",
          "carrier": "CJ대한통운",
          "tracking_number": "1234567890"
        }
      ]
    },
    
    "smartstore_order_12346": {
      "id": "smartstore_order_12346",
      "received_at": "2026-03-06T15:30:00Z",  // 오후 3시 30분 (2시 이후)
      "arrival_time_before_cutoff": false,    // 오후 2시 이후
      "scheduled_processing": "2026-03-07T10:00:00Z",  // 다음 영업일 오전 10시
      
      "current_status": "SMARTSTORE_PENDING_NEXT_BUSINESS_DAY",
      "impact_score": 1.00,
      
      "items": [...],
      "materials": [...],
      "reserved_inventory": {"메트그레이 기둥": 15},
      
      "processing_history": [
        {
          "timestamp": "2026-03-06T15:30:00Z",
          "status": "SMARTSTORE_PENDING_NEXT_BUSINESS_DAY",
          "reason": "Received after 14:00 cutoff"
        },
        {
          "timestamp": "2026-03-07T10:00:00Z",
          "status": "SMARTSTORE_AUTO_DEDUCTED",
          "inventory_deducted": true,
          "inventory_deducted_timestamp": "2026-03-07T10:00:00Z"
        }
      ]
    }
  }
}
```

---

### 저장소 2: `daily_inventory_snapshot.json`
```json
{
  "2026-03-06": {
    "capture_time": "2026-03-06T23:59:59Z",
    "parts": {
      "메트그레이 기둥": {
        "physical_inventory": 500,
        
        "manual_orders": {
          "from_estimates": {
            "count": 3,
            "total_reserved": 80,
            "impact_score": 0.20,
            "weighted": 16
          },
          "from_purchase_orders": {
            "count": 2,
            "total_reserved": 100,
            "impact_score": 0.70,
            "weighted": 70
          },
          "from_confirmed_orders": {
            "count": 5,
            "total_reserved": 200,
            "impact_score": 0.95,
            "weighted": 190
          }
        },
        
        "smartstore_orders": {
          "already_deducted_today": {
            "count": 10,
            "total_deducted": 150,
            "impact_score": 1.00,
            "weighted": 150
          },
          "pending_next_business_day": {
            "count": 2,
            "total_reserved": 50,
            "impact_score": 1.00,
            "weighted": 50
          }
        },
        
        "summary": {
          "total_manual_reserved": 380,
          "total_smartstore_reserved": 200,
          "total_reserved": 580,
          
          "weighted_manual": 276,
          "weighted_smartstore": 200,
          "total_weighted_impact": 476,
          
          "expected_consumption_today": 150,
          "expected_consumption_tomorrow": 50,
          "expected_consumption_3days": 326,
          
          "available_for_new_orders": 24
        }
      }
    }
  }
}
```

---

## 🔄 처리 흐름 알고리즘

### 알고리즘 1: 수동 주문 저장 (문서 생성/수정)

```
function saveAndTrackManualOrder(newDocumentData) {
  existingDoc = loadDocument(newDocumentData.id)
  
  if (existingDoc) {
    // 1️⃣ 이전 버전의 재고 영향 제거 (UNDO)
    previousVersion = existingDoc.versions[-1]
    previousReservation = previousVersion.reserved_inventory
    previousScore = previousVersion.impact_score
    
    for (part, qty in previousReservation):
      inventory[part].reserved -= qty * previousScore  // 이전 영향 제거
    
    // 2️⃣ 새 버전의 변경사항 계산
    delta = calculateDelta(previousVersion, newDocumentData)
    newScore = getImpactScore(newDocumentData.status)
    
    // 3️⃣ 변경사항만 재고에 적용
    for (part, deltaQty in delta):
      inventory[part].reserved += deltaQty * newScore
    
    // 4️⃣ 새 버전 기록
    newVersion = {
      version: existingDoc.current_version + 1,
      timestamp: now(),
      status: newDocumentData.status,
      impact_score: newScore,
      items: newDocumentData.items,
      materials: newDocumentData.materials,
      reserved_inventory: newDocumentData.reserved_inventory,
      delta: delta
    }
    
    existingDoc.versions.append(newVersion)
    existingDoc.current_version += 1
    existingDoc.current_status = newDocumentData.status
    existingDoc.last_modified = now()
    
    save(existingDoc)
  }
}
```

---

### 알고리즘 2: 스마트스토어 자동 주문 처리

```
function processSmartStoreOrder(smartstoreData) {
  orderId = smartstoreData.id
  receivedTime = smartstoreData.received_at
  
  // 1️⃣ 현재 시간이 오후 2시 이전인지 확인
  cutoffTime = today() + 14:00
  isBeforeCutoff = receivedTime < cutoffTime
  
  // 2️⃣ 상태 결정
  if (isBeforeCutoff) {
    status = "SMARTSTORE_AUTO_DEDUCTED"
    processingTime = today()  // 당일 처리
  } else {
    status = "SMARTSTORE_PENDING_NEXT_BUSINESS_DAY"
    processingTime = nextBusinessDay()  // 다음 영업일
  }
  
  // 3️⃣ 스마트스토어 주문 기록
  smartstoreDoc = {
    id: orderId,
    received_at: receivedTime,
    current_status: status,
    impact_score: 1.00,  // 항상 1.00
    reserved_inventory: calculateReserved(smartstoreData),
    scheduled_processing: processingTime,
    processing_history: [{
      timestamp: receivedTime,
      status: status,
      scheduled_for: processingTime
    }]
  }
  
  save(smartstoreDoc)
  
  // 4️⃣ 즉시 처리 대상인 경우 재고 반영
  if (isBeforeCutoff) {
    deductInventory(smartstoreData.reserved_inventory, 1.00, "smartstore")
    updateProcessingHistory(orderId, "SMARTSTORE_AUTO_DEDUCTED")
  }
}
```

---

### 알고리즘 3: 자동 스케줄러 (백그라운드 태스크)

```
function runDailyInventoryProcessor() {
  // 매일 오전 10시에 실행
  
  // 1️⃣ 어제 이후로 처리 대기 중인 스마트스토어 주문 확인
  pendingOrders = loadSmartStoreOrders(
    status: "SMARTSTORE_PENDING_NEXT_BUSINESS_DAY",
    scheduled_processing <= today()
  )
  
  // 2️⃣ 각 주문에 대해 자동 처리
  for (order in pendingOrders) {
    deductInventory(order.reserved_inventory, 1.00, "smartstore")
    
    order.current_status = "SMARTSTORE_AUTO_DEDUCTED"
    order.processing_history.append({
      timestamp: now(),
      status: "SMARTSTORE_AUTO_DEDUCTED",
      inventory_deducted: true
    })
    
    save(order)
  }
  
  // 3️⃣ 일일 스냅샷 생성
  snapshot = generateDailyInventorySnapshot()
  save(snapshot)
  
  // 4️⃣ 필요시 알림 발송
  if (snapshot.available_for_new_orders < THRESHOLD):
    sendAlert("재고 부족 경고: 메트그레이 기둥 24개만 남음")
}
```

---

## 📊 상태별 Impact Score 매트릭스

| 상태 | 경로 | Impact | 설명 |
|------|------|--------|------|
| ESTIMATE_CREATED | 수동 | 0.20 | 견적서 작성, 매우 불확실 |
| ESTIMATE_MODIFIED | 수동 | 0.20 | 견적서 수정, 여전히 불확실 |
| QUOTE_SENT | 수동 | 0.50 | 고객에게 전송, 검토 중 |
| PURCHASE_ORDER_CREATED | 수동 | 0.70 | 발주서 생성, 의도 명확 |
| PURCHASE_ORDER_MODIFIED | 수동 | 0.70 | 발주서 수정, 마지막 확인 |
| ORDER_CONFIRMED_PRINTED | 수동 | 0.90 | 인쇄됨, 거의 확정 |
| ORDER_CONFIRMED_FAX_SENT | 수동 | 0.95 | FAX 전송됨, 매우 확정 |
| ORDER_CONFIRMED_EMAIL_SENT | 수동 | 0.90 | 메일 전송됨, 거의 확정 |
| PACKING_IN_PROGRESS | 수동 | 0.99 | 포장 중, 매우 확실 |
| SHIPPED | 수동 | 1.00 | 배송 중, 확정 |
| DELIVERED | 수동 | 1.00 | 배송 완료, 재고 감소 반영 |
| CANCELLED | 수동 | 0.00 | 취소됨, 재고 환원 |
| SMARTSTORE_AUTO_DEDUCTED | 스마트스토어 | 1.00 | 자동 처리됨, 무조건 출고 |
| SMARTSTORE_PENDING_NEXT_BUSINESS_DAY | 스마트스토어 | 1.00 | 다음 영업일 대기, 예약만 함 |
| RETURNED | 모두 | -1.00 | 반품됨, 재고 환원 |

---

## 🎯 핵심 설계 원칙

1. **이중 추적**: 수동 주문은 상태 기반, 스마트스토어는 시간 기반
2. **버전 관리**: 같은 문서의 수정은 버전으로 관리, 이전 버전의 영향 제거 후 새 버전만 반영
3. **확률 반영**: Impact Score로 상태별 확실성 반영 (0~1)
4. **자동화**: 스마트스토어는 시간 규칙에 따라 자동 처리
5. **추적성**: 모든 변경사항 기록, 언제 재고가 감소했는지 명확함
6. **유연성**: 상태 변경 시 Impact Score 자동 조정, 재고 영향도 동적 변경

---

## 📋 구현 체크리스트

- [ ] `inventory_documents_v2.json` 스키마 확정
- [ ] `daily_inventory_snapshot.json` 자동 생성 로직
- [ ] EstimateForm/PurchaseOrderForm에 상태 기록 기능
- [ ] 스마트스토어 API 처리 로직에 시간 기반 분기 추가
- [ ] 자동 스케줄러 (매일 오전 10시 실행)
- [ ] 웹 대시보드: 현재 재고 대시보드
- [ ] 웹 대시보드: 예약 재고 추이 그래프
- [ ] 웹 대시보드: 3일 예측 알림
- [ ] Python ML 엔진: 재고 감소 패턴 학습
- [ ] Python ML 엔진: 일일/주간 소비 예측

