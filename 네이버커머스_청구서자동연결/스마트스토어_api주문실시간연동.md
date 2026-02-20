---

## 📋 Naver Commerce API: 주문 상세 정보 수집 연동 명세

### 1. 개요 및 목적

네이버 스마트스토어 판매자 센터의 GUI에서 확인 가능한 **'주문 상세 정보'**를 API(`POST /v1/pay-order/seller/product-orders/query`)를 통해 데이터화함.

### 2. 인증 및 프록시 전략 (핵심)

* **토큰 발급 위치:** 로컬 PC가 아닌 **가비아 리눅스(프록시 서버 139.150.11.53)**를 통해 인증 및 API 요청 수행.
* **3시간 제한 문제 해결:**
* 3시간이 지나면 프로그램이 고장 나는 것이 아니라, **토큰 유효성 체크 로직**이 필요함.
* **Logic:** API 호출 시 `401 Unauthorized` 에러가 발생하거나, 토큰 발급 시간을 기록해 두었다가 3시간이 임박하면 프록시 서버를 통해 자동으로 `get_access_token`을 재호출하여 갱신하는 구조로 설계해야 함.



### 3. API 요청 파라미터 상세

* **Endpoint:** `POST https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query`
* **Headers:**
* `Authorization: Bearer {access_token}`
* `Content-Type: application/json`


* **Payload (JSON Body):**
```json
{
  "productOrderIds": ["{상품주문번호1}", "{상품주문번호2}"]
}

```


* *참고: 상세 정보를 가져오려면 먼저 '리스트 조회 API' 등을 통해 '상품주문번호' 리스트를 확보해야 함.*



### 4. 수집 데이터 매핑 (GUI vs API Schema)

판매자 센터 GUI의 항목과 API 응답 객체(`data[]`)의 매핑 정보입니다.

| GUI 항목 명칭 | API 응답 필드 (JSON Path) | 비고 |
| --- | --- | --- |
| **상품주문번호** | `productOrder.productOrderId` | 주문 고유 ID |
| **구매자명** | `order.ordererName` |  |
| **옵션** | `productOrder.productOption` | 선택한 옵션 텍스트 |
| **주문수량** | `productOrder.quantity` |  |
| **최종금액** | `productOrder.totalPaymentAmount` | 결제된 총액 |
| **수취인명** | `productOrder.shippingAddress.name` | 또는 `order.ordererName` |
| **연락처1** | `productOrder.shippingAddress.tel1` | 배송지 연락처 |
| **배송지** | `productOrder.shippingAddress` 내 주소 필드 | `baseAddress` + `detailedAddress` |
| **결제완료시각** | `order.paymentDate` | ISO 8601 형식 |

### 5. 에이전트 수행 가이드 (Instructions for Agent)

1. **프록시 환경 유지:** 모든 요청은 `config.py`에 정의된 `PROXIES` 설정을 통해 가비아 서버 IP를 경유해야 함.
2. **예외 처리:** 토큰 만료(3시간)에 대비하여, 요청 실패 시 토큰을 재발급받고 재시도(Retry)하는 로직을 반드시 포함할 것.
3. **데이터 파싱:** 응답받은 JSON에서 `data` 리스트를 순회하며 위 표에 명시된 필드들을 추출하여 정제된 리스트(혹은 CSV/DB)로 반환할 것.

---
