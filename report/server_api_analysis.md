# 서버 API 완전 분석 및 동시성 제어 개선 계획

> **분석 대상:** sammirack-api (가비아 서버 실시간 운영 중)  
> **분석 일자:** 2026-02-12  
> **현재 상태:** ⚠️ Race Condition 심각 취약 - 즉시 개선 필요

---

## 📋 목차

1. [현재 구현 분석](#1-현재-구현-분석)
2. [동시성 문제 상세 분석](#2-동시성-문제-상세-분석)
3. [해결 방안 비교](#3-해결-방안-비교)
4. [권장 구현 방안](#4-권장-구현-방안)
5. [마이그레이션 전략](#5-마이그레이션-전략)
6. [리스크 분석 및 대응](#6-리스크-분석-및-대응)
7. [테스트 시나리오](#7-테스트-시나리오)

---

## 1. 현재 구현 분석

### 1.1 DB 설정 (`db.js`)

```javascript
// ✅ 긍정: WAL 모드 활성화됨
this.db.run('PRAGMA journal_mode = WAL');
this.db.run('PRAGMA synchronous = NORMAL');
this.db.run('PRAGMA foreign_keys = ON');
```

**평가:**
- ✅ WAL (Write-Ahead Logging) 모드 활성화: 읽기/쓰기 병행 가능
- ✅ 트랜잭션 지원 준비됨
- ❌ 동시성 제어를 위한 격리 수준 설정 없음

### 1.2 재고 업데이트 (`routes/inventory.js`)

```javascript
router.post('/update', async (req, res) => {
  const updates = req.body; // { partId: quantity, ... }
  
  await db.run('BEGIN TRANSACTION');
  
  for (const [partId, quantity] of Object.entries(updates)) {
    await db.run(`
      INSERT INTO inventory (part_id, quantity, updated_at, updated_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(part_id) DO UPDATE SET
        quantity = excluded.quantity,  // ⚠️ 문제: 절대값으로 덮어씀
        updated_at = excluded.updated_at
    `, [partId, Math.max(0, quantity), now, 'api']);
  }
  
  await db.run('COMMIT');
});
```

**문제점:**
1. ❌ **클라이언트가 계산한 절대값으로 덮어씀** (`quantity = excluded.quantity`)
2. ❌ **Read-Modify-Write 패턴을 클라이언트에서 수행**
   - 클라이언트 A: `GET /inventory` → 재고 100개 확인 → 10개 감소 계산 → `POST /update { quantity: 90 }`
   - 클라이언트 B: `GET /inventory` → 재고 100개 확인 → 5개 감소 계산 → `POST /update { quantity: 95 }`
   - **결과:** 마지막 요청(B)의 95개만 반영 → 15개가 아닌 5개만 감소
3. ✅ 트랜잭션 사용 (단, 의미 없음 - 단일 클라이언트 요청 내에서만 원자적)

### 1.3 문서 저장 (`routes/documents.js`)

```javascript
await db.run(`
  INSERT INTO documents (...)
  VALUES (?, ?, ...)
  ON CONFLICT(doc_id) DO UPDATE SET
    ...
    updated_at = excluded.updated_at
`, [...]);
```

**평가:**
- ✅ `ON CONFLICT` 사용으로 중복 방지
- ❌ **동시 수정 감지 메커니즘 없음**
- ❌ `updated_at`은 기록용일 뿐, 충돌 감지에 미사용

---

## 2. 동시성 문제 상세 분석

### 2.1 재고 감소 Race Condition (심각도: 🔴 CRITICAL)

#### 시나리오: 2개 PC에서 동일 부품 동시 인쇄

**타임라인:**

| 시간 | PC-A (경량랙-기둥-h750 10개 사용) | PC-B (경량랙-기둥-h750 5개 사용) | 서버 재고 |
|------|-----------------------------------|----------------------------------|---------
|:--|--|--|--:|
| T0 | - | - | 100 |
| T1 | `GET /inventory` → 100개 | - | 100 |
| T2 | - | `GET /inventory` → 100개 | 100 |
| T3 | 계산: 100 - 10 = 90 | - | 100 |
| T4 | - | 계산: 100 - 5 = 95 | 100 |
| T5 | `POST /update { quantity: 90 }` | - | 90 |
| T6 | - | `POST /update { quantity: 95 }` | **95** |

**예상 결과:** 85개 (100 - 10 - 5)  
**실제 결과:** 95개 (마지막 쓰기가 이전 쓰기를 덮어씀)  
**손실:** 10개 재고 감소가 사라짐

#### 발생 가능성
- ⚠️ **매우 높음**: 2개 이상의 PC가 동시 사용 중이며, 같은 부품을 사용하는 랙 제품 주문 시 항상 발생

### 2.2 문서 동시 수정 (심각도: 🟡 MEDIUM)

**시나리오:** 같은 견적서를 2명이 동시에 수정

| 시간 | 사용자 A | 사용자 B | 결과 |
|------|----------|----------|------|
| T0 | 견적서 열기 (회사명: 삼성) | - | - |
| T1 | - | 견적서 열기 (회사명: 삼성) | - |
| T2 | 회사명 → "LG"로 변경 | - | - |
| T3 | - | 품목 추가 | - |
| T4 | 저장 (회사명=LG, 품목=기존) | - | DB: 회사명=LG |
| T5 | - | 저장 (회사명=삼성, 품목=기존+신규) | **DB: 회사명=삼성, 품목=기존+신규** |

**결과:** 사용자 A의 회사명 변경이 손실됨

---

## 3. 해결 방안 비교

### Option 1: 서버 측 원자적 업데이트 (권장 ⭐⭐⭐⭐⭐)

**개념:**
- 클라이언트는 **"감소량"**만 전송
- 서버가 **SQL 수준에서 원자적으로 차감**

**장점:**
- ✅ Race Condition 완전 해결
- ✅ 기존 클라이언트 코드 최소 변경
- ✅ 추가 컬럼 불필요
- ✅ 성능 우수 (DB 엔진이 처리)

**단점:**
- ⚠️ API 엔드포인트 추가 필요 (`POST /inventory/deduct`)

**구현:**
```javascript
// 새 엔드포인트: POST /api/inventory/deduct
router.post('/deduct', async (req, res) => {
  const { deductions, documentId } = req.body;
  // deductions: { partId: amount, ... }
  
  await db.run('BEGIN TRANSACTION');
  
  for (const [partId, amount] of Object.entries(deductions)) {
    const result = await db.run(`
      UPDATE inventory 
      SET quantity = quantity - ?,
          updated_at = ?,
          updated_by = ?
      WHERE part_id = ? AND quantity >= ?
    `, [amount, now, documentId, partId, amount]);
    
    if (result.changes === 0) {
      await db.run('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient inventory',
        partId 
      });
    }
  }
  
  await db.run('COMMIT');
  res.json({ success: true });
});
```

**클라이언트 변경:**
```javascript
// Before
const updates = { 'partId1': newQuantity1, ... };
await inventoryAPI.update(updates);

// After
const deductions = { 'partId1': deductAmount1, ... };
await inventoryAPI.deduct(deductions, documentId);
```

---

### Option 2: 낙관적 잠금 (Optimistic Locking) (⭐⭐⭐⭐)

**개념:**
- `version` 컬럼 추가
- 업데이트 시 버전 확인 → 충돌 시 재시도

**장점:**
- ✅ 충돌 감지 가능
- ✅ 동시성 높음 (잠금 없음)

**단점:**
- ⚠️ 스키마 변경 필요 (`version` 컬럼 추가)
- ⚠️ 클라이언트에서 재시도 로직 구현 필요
- ⚠️ 충돌 빈번 시 성능 저하

**구현:**
```sql
-- 마이그레이션
ALTER TABLE inventory ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

```javascript
// inventory 업데이트
const result = await db.run(`
  UPDATE inventory 
  SET quantity = ?,
      version = version + 1,
      updated_at = ?
  WHERE part_id = ? AND version = ?
`, [newQty, now, partId, oldVersion]);

if (result.changes === 0) {
  throw new Error('Version conflict - retry');
}
```

---

### Option 3: 비관적 잠금 (Pessimistic Locking) (⭐⭐)

**개념:**
- `SELECT ... FOR UPDATE` 사용
- 읽기 시점에 행 잠금

**장점:**
- ✅ 충돌 완전 방지

**단점:**
- ❌ SQLite은 행 수준 잠금 미지원 (테이블 전체 잠금)
- ❌ 동시성 급격히 저하
- ❌ 데드락 위험

**평가:** SQLite 특성상 **비권장**

---

## 4. 권장 구현 방안

### 최종 선택: **Option 1 (서버 원자적 업데이트) + Option 2 일부 (문서용)**

#### 4.1 재고 관리 → Option 1 적용

**새 API 엔드포인트:**

```javascript
// routes/inventory.js에 추가

// POST /api/inventory/deduct
router.post('/deduct', async (req, res) => {
  const { deductions, documentId, userIp } = req.body;
  const now = new Date().toISOString();
  const results = {};
  
  try {
    await db.run('BEGIN TRANSACTION');
    
    for (const [partId, amount] of Object.entries(deductions)) {
      // 1. 현재 재고 확인
      const current = await db.get(
        'SELECT quantity FROM inventory WHERE part_id = ?',
        [partId]
      );
      
      if (!current || current.quantity < amount) {
        await db.run('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient inventory',
          partId,
          requested: amount,
          available: current?.quantity || 0
        });
      }
      
      // 2. 원자적 차감
      const result = await db.run(`
        UPDATE inventory 
        SET quantity = quantity - ?,
            updated_at = ?,
            updated_by = ?
        WHERE part_id = ?
      `, [amount, now, documentId || userIp, partId]);
      
      results[partId] = current.quantity - amount;
    }
    
    await db.run('COMMIT');
    
    // 3. 활동 로그 기록
    await db.run(`
      INSERT INTO activity_log (timestamp, action, user_ip, details)
      VALUES (?, ?, ?, ?)
    `, [
      now,
      'inventory_deduct',
      userIp,
      JSON.stringify({ documentId, deductions, results })
    ]);
    
    res.json({ success: true, results });
    
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('재고 차감 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/inventory/restore (취소/복구용)
router.post('/restore', async (req, res) => {
  const { restorations, documentId, userIp } = req.body;
  const now = new Date().toISOString();
  
  try {
    await db.run('BEGIN TRANSACTION');
    
    for (const [partId, amount] of Object.entries(restorations)) {
      await db.run(`
        UPDATE inventory 
        SET quantity = quantity + ?,
            updated_at = ?,
            updated_by = ?
        WHERE part_id = ?
      `, [amount, now, `restore_${documentId}`, partId]);
    }
    
    await db.run('COMMIT');
    res.json({ success: true });
    
  } catch (error) {
    await db.run('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});
```

#### 4.2 문서 관리 → 현재 유지 + 향후 Option 2 고려

**현재 상태:**
- 문서는 `doc_id`가 고유하므로 동시 수정 빈도 낮음
- 타임스탬프 기반 병합이 클라이언트에서 작동 중

**향후 개선 (필요 시):**
```sql
-- version 컬럼 추가 (마이그레이션)
ALTER TABLE documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

```javascript
// 저장 시 버전 확인
const result = await db.run(`
  UPDATE documents 
  SET ..., version = version + 1
  WHERE doc_id = ? AND version = ?
`, [..., oldVersion]);

if (result.changes === 0) {
  return res.status(409).json({ 
    error: 'Version conflict',
    message: '다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.'
  });
}
```

---

## 5. 마이그레이션 전략

### 5.1 무중단 배포 계획

#### Phase 1: 서버 코드 추가 (1시간)

1. **새 엔드포인트 추가** (기존 코드 유지)
   ```bash
   vi ~/sammirack-api/routes/inventory.js
   # /deduct, /restore 엔드포인트 추가
   ```

2. **서버 재시작**
   ```bash
   pm2 restart sammirack-api
   ```

3. **API 테스트**
   ```bash
   curl -X POST http://139.150.11.53:3001/api/inventory/deduct \
     -H "Content-Type: application/json" \
     -d '{"deductions":{"test-part":1},"documentId":"test"}'
   ```

#### Phase 2: 클라이언트 코드 업데이트 (30분)

1. **`src/services/apiClient.js` 수정**
   ```javascript
   export const inventoryAPI = {
     getAll: () => apiClient.get('/inventory'),
     update: (updates) => apiClient.post('/inventory/update', updates),
     // ✅ 새로 추가
     deduct: (deductions, documentId) => 
       apiClient.post('/inventory/deduct', { deductions, documentId }),
     restore: (restorations, documentId) => 
       apiClient.post('/inventory/restore', { restorations, documentId })
   };
   ```

2. **`src/components/InventoryManager.jsx` 수정**
   ```javascript
   // Before
   const updates = {};
   for (const [partId, item] of Object.entries(deductions)) {
     const currentQty = localInventory[partId] || 0;
     updates[partId] = currentQty - item.quantity;
   }
   await inventoryService.updateInventory(updates);
   
   // After
   const deductions = {};
   for (const [partId, item] of Object.entries(deductionsCalc)) {
     deductions[partId] = item.quantity; // 감소량만 전송
   }
   await inventoryService.deductInventory(deductions, documentNumber);
   ```

3. **배포**
   ```bash
   npm run build
   scp dist.tar.gz rocky@139.150.11.53:~/
   ssh rocky@139.150.11.53 "cd ~ && tar -xzf dist.tar.gz"
   ```

#### Phase 3: 검증 및 모니터링 (1시간)

1. **2개 PC로 동시 주문 테스트**
2. **활동 로그 확인**
   ```bash
   sqlite3 ~/db/sammi.db "SELECT * FROM activity_log WHERE action='inventory_deduct' ORDER BY timestamp DESC LIMIT 10;"
   ```
3. **재고 정합성 확인**

---

### 5.2 롤백 계획

#### 문제 발생 시 즉시 롤백

**Option A: 서버만 롤백**
```bash
cd ~/sammirack-api
git log --oneline -5
git revert <commit-hash>
pm2 restart sammirack-api
```

**Option B: 전체 롤백**
```bash
# 서버
git revert <commit-hash>
pm2 restart sammirack-api

# 클라이언트 (이전 dist 복구)
cd ~
tar -xzf dist.backup.tar.gz
```

---

## 6. 리스크 분석 및 대응

### 6.1 스키마 변경 리스크

| 리스크 | 발생 가능성 | 영향도 | 대응 방안 |
|--------|------------|--------|----------|
| Column 추가 시 기존 쿼리 오류 | 낮음 | 중간 | `try-catch`로 안전 처리 (migrate.js 참고) |
| `version` 컬럼 없는 레거시 데이터 | 낮음 | 낮음 | `DEFAULT 1` 설정 |

**안전 장치 (migrate.js 방식):**
```javascript
try { 
  await db.run('ALTER TABLE inventory ADD COLUMN version INTEGER DEFAULT 1'); 
} catch (e) { 
  console.warn('version 컬럼 이미 존재 또는 무시:', e.message);
}
```

### 6.2 API 변경 리스크

| 리스크 | 발생 가능성 | 영향도 | 대응 방안 |
|--------|------------|--------|----------|
| 기존 `/update` 호출하는 다른 코드 | 중간 | 중간 | `/update` 유지 (삭제 안 함) |
| 새 `/deduct` 호출 실패 | 낮음 | 높음 | Fallback to `/update` |

**Fallback 구현:**
```javascript
async deductInventory(deductions, documentId) {
  try {
    return await apiClient.post('/inventory/deduct', { deductions, documentId });
  } catch (error) {
    console.warn('deduct 실패, update로 fallback:', error);
    // 기존 방식으로 재시도
    const updates = /* 계산 */;
    return await apiClient.post('/inventory/update', updates);
  }
}
```

### 6.3 동시성 증가로 인한 부하

| 지표 | 현재 | 개선 후 예상 | 대응 |
|------|------|------------|------|
| DB 커넥션 풀 | 1개 (단일 인스턴스) | 1개 | WAL 모드로 충분 |
| 트랜잭션 길이 | 짧음 | 짧음 유지 | OK |
| 잠금 대기 시간 | 없음 | < 10ms | WAL 모드로 최소화 |

---

## 7. 테스트 시나리오

### 7.1 재고 동시 감소 테스트

**목표:** Race Condition 해결 확인

**준비:**
1. 테스트 부품 생성: `test-part-001` (수량: 100)
2. 2개 PC 또는 2개 브라우저 창 준비

**절차:**
1. **PC-A**: 견적서 생성, `test-part-001` 10개 사용, 인쇄 시작
2. **PC-B**: (동시에) 견적서 생성, `test-part-001` 5개 사용, 인쇄 시작
3. 두 인쇄 완료 대기
4. DB 확인:
   ```bash
   sqlite3 ~/db/sammi.db "SELECT quantity FROM inventory WHERE part_id='test-part-001';"
   ```

**예상 결과:**
- ❌ 현재 (개선 전): 95 또는 90 (랜덤)
- ✅ 개선 후: 85 (100 - 10 - 5)

### 7.2 재고 부족 처리 테스트

**시나리오:** 재고보다 많이 감소 요청

**절차:**
1. `test-part-002` 수량: 5
2. 10개 감소 요청
3. 응답 확인

**예상 결과:**
```json
{
  "error": "Insufficient inventory",
  "partId": "test-part-002",
  "requested": 10,
  "available": 5
}
```

### 7.3 성능 테스트

**목표:** 개선 후 성능 저하 확인

**방법:**
```bash
# 100번 연속 재고 감소
time for i in {1..100}; do
  curl -X POST http://139.150.11.53:3001/api/inventory/deduct \
    -H "Content-Type: application/json" \
    -d '{"deductions":{"test-part":1},"documentId":"perf-test"}';
done
```

**목표:** < 5초 (평균 50ms/요청)

---

## 8. 구현 우선순위

### 즉시 (1주일 내)
1. ✅ **서버 `/deduct` 엔드포인트 추가**
2. ✅ **클라이언트 `inventoryService.deductInventory()` 구현**
3. ✅ **2-PC 동시 테스트**

### 단기 (1개월 내)
4. ⏳ **문서 `version` 컬럼 추가 및 충돌 감지**
5. ⏳ **Activity Log 강화** (재고 변동 추적)

### 장기 (3개월 내)
6. ⏳ **PostgreSQL 마이그레이션 검토** (SQLite 한계 극복)
7. ⏳ **Redis 캐싱 도입** (읽기 성능 향상)

---

## 9. 최종 체크리스트

### 배포 전 확인사항

- [ ] 서버 코드 추가 완료 (`/deduct`, `/restore`)
- [ ] 클라이언트 코드 수정 완료
- [ ] 로컬 테스트 통과
- [ ] Staging 환경 테스트 (가능하면)
- [ ] DB 백업 완료
- [ ] 롤백 계획 수립

### 배포 후 모니터링

- [ ] Activity Log 확인 (재고 변동 기록)
- [ ] 에러 로그 확인 (`pm2 logs sammirack-api`)
- [ ] 재고 정합성 샘플 검증
- [ ] 사용자 피드백 수집 (1주일)

---

## 부록 A: 빠른 참조

### 주요 파일 경로
- **서버:** `~/sammirack-api/routes/inventory.js`
- **클라이언트 API:** `src/services/apiClient.js`
- **인벤토리 매니저:** `src/components/InventoryManager.jsx`
- **DB:** `~/db/sammi.db`

### 유용한 명령어
```bash
# 서버 재시작
pm2 restart sammirack-api

# 서버 로그 확인
pm2 logs sammirack-api --lines 100

# DB 쿼리
sqlite3 ~/db/sammi.db "SELECT * FROM inventory WHERE part_id LIKE 'test%';"

# 배포
npm run build && tar -czf dist.tar.gz dist/
```
