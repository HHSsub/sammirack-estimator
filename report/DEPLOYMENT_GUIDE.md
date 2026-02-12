# Race Condition Fix - 배포 가이드

> **작성일:** 2026-02-12  
> **목적:** 다중 PC 동시 인쇄 시 재고 감소 손실 문제 완전 해결

---

## ✅ 수정 완료된 파일들

### 1. 서버 API (sammirack-api)
- **`sammirack-api/routes/inventory.js`**
  - ✅ `POST /api/inventory/deduct` 추가 (원자적 차감)
  - ✅ `POST /api/inventory/restore` 추가 (복구/롤백)
  - ✅ 기존 `POST /api/inventory/update` 유지 (하위 호환성)

### 2. 클라이언트 코드 (sammirack-estimator)
- **`src/services/apiClient.js`**
  - ✅ `inventoryAPI.deduct()` 추가
  - ✅ `inventoryAPI.restore()` 추가

- **`src/services/InventoryService.js`**
  - ✅ `deductInventory()` 메서드 추가
  - ✅ `restoreInventory()` 메서드 추가

- **`src/components/InventoryManager.jsx`**
  - ✅ `deductInventoryOnPrint()` 로직 변경:
    - ❌ 이전: 클라이언트에서 새 재고량 계산 → 절대값 전송
    - ✅ 현재: 감소량만 계산 → 서버에서 원자적 차감

---

## 🚀 배포 절차

### Step 1: 서버 코드 배포 (5분)

```powershell
# 1. 파일 확인
cat sammirack-api\routes\inventory.js

# 2. 서버에 업로드
scp -i SSH_KeyPair-260127163331.pem sammirack-api\routes\inventory.js rocky@139.150.11.53:~/sammirack-api/routes/

# 3. 서버 접속 후 재시작
ssh -i SSH_KeyPair-260127163331.pem rocky@139.150.11.53
cd ~/sammirack-api
pm2 restart sammirack-api

# 4. 로그 확인
pm2 logs sammirack-api --lines 50
```

### Step 2: 클라이언트 빌드 및 배포 (10분)

```powershell
# 1. 빌드
cd c:\Users\User\Downloads\sammi\sammirack-estimator
npm run build

# 2. dist 압축
tar -czf dist.tar.gz dist/

# 3. 서버에 업로드
scp -i SSH_KeyPair-260127163331.pem dist.tar.gz rocky@139.150.11.53:~/

# 4. 서버에서 압축 해제 및 배포
ssh -i SSH_KeyPair-260127163331.pem rocky@139.150.11.53
cd ~
tar -xzf dist.tar.gz
# 기존 dist 백업 (선택사항)
# mv dist dist.backup.$(date +%Y%m%d_%H%M%S)
```

---

## 🧪 테스트 시나리오

### 테스트 1: 동시 재고 차감 (2 PC)

**목표:** Race Condition 해결 확인

**절차:**
1. 테스트용 부품 확인 (예: `경량랙-기둥-h750`, 재고 100개)
2. **PC-A**: 견적서 생성, 10개 사용, 인쇄
3. **PC-B**: (동시에) 견적서 생성, 5개 사용, 인쇄
4. 재고 확인

**예상 결과:**
- ✅ 재고: 85개 (100 - 10 - 5)
- ✅ Activity Log에 두 차감 기록 모두 존재

**확인 명령어:**
```bash
# 서버에서 확인
ssh rocky@139.150.11.53
sqlite3 ~/db/sammi.db "SELECT quantity FROM inventory WHERE part_id='경량랙-기둥-h750';"
sqlite3 ~/db/sammi.db "SELECT * FROM activity_log WHERE action='inventory_deduct' ORDER BY timestamp DESC LIMIT 10;"
```

### 테스트 2: 재고 부족 처리

**시나리오:** 재고 5개인데 10개 차감 요청

**예상 동작:**
- ✅ 서버가 재고를 0으로 설정
- ✅ `warnings` 배열에 부족 정보 반환
- ✅ 클라이언트에서 경고 메시지 표시

### 테스트 3: 단일 PC 정상 동작

**절차:**
1. 일반 견적서 생성 및 인쇄
2. 재고 정상 감소 확인
3. LocalStorage 업데이트 확인

---

## 🔄 롤백 계획

### 빠른 롤백 (문제 발생 시)

```powershell
# 1. 서버측 롤백 (서버 API만 문제일 경우)
ssh -i SSH_KeyPair-260127163331.pem rocky@139.150.11.53
cd ~/sammirack-api
git log --oneline -5
git revert HEAD  # 또는 특정 커밋
pm2 restart sammirack-api

# 2. 클라이언트 롤백 (전체 롤백)
# 서버에서 백업본 복구
cd ~
mv dist dist.failed
mv dist.backup.YYYYMMDD_HHMMSS dist
```

---

## 📊 모니터링 포인트

### 배포 후 1시간 동안 확인

1. **서버 로그**
   ```bash
   pm2 logs sammirack-api --lines 100
   ```

2. **에러 발생 여부**
   - API 호출 실패
   - 재고 음수 발생
   - DB 트랜잭션 실패

3. **Activity Log 확인**
   ```bash
   sqlite3 ~/db/sammi.db "SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 20;"
   ```

4. **재고 정합성**
   - 수동으로 몇 개 부품 재고 확인
   - 음수 재고 없는지 확인
   ```bash
   sqlite3 ~/db/sammi.db "SELECT part_id, quantity FROM inventory WHERE quantity < 0;"
   ```

---

## 기술적 변경 요약

### 이전 방식 (Race Condition 발생)
```javascript
// 클라이언트
const currentQty = 100;
const newQty = currentQty - 10;  // 90
await api.update({ partId: newQty }); // 절대값 전송
```

**문제:** 두 클라이언트가 동시에 100개 읽고 각자 계산 → 마지막 요청만 반영

### 현재 방식 (Race Condition 방지)
```javascript
// 클라이언트
await api.deduct({ partId: 10 }); // 감소량만 전송

// 서버 (SQL 레벨에서 원자적 처리)
UPDATE inventory SET quantity = quantity - 10 WHERE part_id = ?
```

**해결:** 서버가 SQL WHERE 절에서 원자적으로 계산 → 두 요청 모두 반영

---

## 체크리스트

배포 전:
- [ ] 서버 코드 백업 확인
- [ ] 클라이언트 빌드 성공
- [ ] 로컬 테스트 완료

배포 중:
- [ ] 서버 재시작 성공
- [ ] 서버 로그 에러 없음
- [ ] 클라이언트 배포 완료

배포 후:
- [ ] 2 PC 동시 테스트 성공
- [ ] 재고 부족 처리 확인
- [ ] Activity Log 기록 확인
- [ ] 1시간 모니터링 완료

---

## 긴급 연락

문제 발생 시:
1. 즉시 롤백 실행
2. 로그 캡처: `pm2 logs sammirack-api > error.log`
3. DB 백업: `cp ~/db/sammi.db ~/db/sammi.db.emergency`
