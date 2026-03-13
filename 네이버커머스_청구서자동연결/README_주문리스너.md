# 스마트스토어 실시간 주문 리스너 사용 가이드

## 파일 구성

```
네이버커머스_발주서자동연결/
├── config.py             ← API 키 및 프록시 설정 (★ 여기에 KEY 입력)
├── order_listener.py     ← 실시간 주문 리스너 메인
├── requirements.txt      ← 필요 패키지 목록
└── order_logs/           ← 감지된 주문 자동 저장 폴더 (자동 생성)
```

---

## 1단계: 패키지 설치

```bash
pip install -r requirements.txt
```

---

## 2단계: API 키 입력

`config.py` 를 열어 아래 두 줄을 실제 값으로 교체:

```python
CLIENT_ID     = "YOUR_CLIENT_ID"      # 네이버 커머스 API 앱 ID
CLIENT_SECRET = "YOUR_CLIENT_SECRET"  # 앱 시크릿 (bcrypt salt)
```

> **네이버 커머스 API 키 발급 경로:**  
> [네이버 커머스 파트너 센터](https://partner.naver.com) → API 관리 → 앱 등록

---

## 3단계: 실행

```bash
cd 네이버커머스_발주서자동연결
python order_listener.py
```

---

## 동작 방식

```
[시작] 최근 10분 주문 → seen 목록 등록 (기존 주문 무시)
  ↓
[매 30초] 최근 1분 구간 조회
  ↓
seen 에 없는 새 productOrderId 발견
  ↓
/query API 로 상세 조회 (상품명, 옵션, 구매자, 배송지 등)
  ↓
콘솔 출력 + order_logs/ 에 JSON 저장
```

---

## 새 주문 출력 예시

```
============================================================
  🛒  새 주문 감지! (2025-03-15 14:32:05)
============================================================
  상품주문번호  : 2025031512345678
  결제완료시각  : 2025-03-15T14:31:55+09:00
  구매자명      : 홍길동
  주문 상품     : 하이랙 철제선반 60x108x200 4단 270kg
  선택 옵션     : 메트그레이 / 4단
  주문 수량     : 1개
  최종 금액     : 119,000원
  수취인        : 홍길동 / 010-1234-5678
  배송지        : 서울시 강남구 테헤란로 123 456호
============================================================
```

---

## 폴링 주기 변경

`config.py` 에서 조정:

```python
POLL_INTERVAL_SECONDS = 30   # 기본 30초, 더 빠르게 하려면 줄일 것
```

> ⚠️ 너무 짧게 설정 시 API Rate Limit 초과 가능. 최소 10초 권장.

---

## 견적서/발주서 자동화 연결 (향후 작업)

`order_listener.py` 하단의 `on_new_order_hook()` 함수에서  
새 주문 수신 시 자동으로 호출되는 로직을 추가하면 됩니다:

```python
def on_new_order_hook(order: dict):
    # 예: 견적서 자동 생성
    create_estimate_document(order)
    # 예: 발주서 자동 생성
    create_invoice_document(order)
```
