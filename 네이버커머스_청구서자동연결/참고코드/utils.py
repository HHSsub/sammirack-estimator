# utils.py
import time
import csv
from datetime import datetime, timedelta, date
from typing import List, Dict, Tuple, Any
from email.utils import parsedate_to_datetime
import requests
import bcrypt
import pybase64
from config import CLIENT_ID, CLIENT_SECRET, PROXIES, USE_PROXY

TOKEN_URL = "https://api.commerce.naver.com/external/v1/oauth2/token"
API_URL_PRODUCT_ORDERS = (
    "https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders"
)

# ---------------------------------------------------------
# 0) PC 환경 체크
# ---------------------------------------------------------
def check_time_drift(max_seconds=240):
    """
    네이버 서버 시간과 로컬 PC 시간 차이를 검사
    max_seconds: 허용 오차 (권장 240초 = 4분)
    """
    import email.utils
    import requests
    import time

    proxies = PROXIES if USE_PROXY else None
    resp = requests.head("https://api.commerce.naver.com", timeout=5, proxies=proxies)
    server_date = resp.headers.get("Date")
    if not server_date:
        return True, 0  # 서버 시간 못 받아오면 그냥 통과

    server_ts = email.utils.parsedate_to_datetime(server_date).timestamp()
    local_ts = time.time()

    diff = abs(server_ts - local_ts)
    return diff <= max_seconds, diff


# ---------------------------------------------------------
# 1) 토큰 발급
# ---------------------------------------------------------
def get_access_token(type_: str = "SELF") -> str:
    """
    네이버 커머스 API 공식 가이드 방식으로 access_token 발급
    (SELF 타입 기준)
    """
    ok, diff = check_time_drift()
    if not ok:
        raise RuntimeError(
            f"PC 시스템 시간이 네이버 서버와 {int(diff)}초 차이납니다.\n"
            f"Windows 시간 동기화를 먼저 맞춰주세요."
        )
        
    timestamp = str(int((time.time()) * 1000)) # -3 제거!

    # password = client_id + "_" + timestamp
    password = f"{CLIENT_ID}_{timestamp}"
    # bcrypt 해싱 (clientSecret 사용)
    hashed = bcrypt.hashpw(password.encode("utf-8"), CLIENT_SECRET.encode("utf-8"))
    # base64 인코딩 → client_secret_sign
    client_secret_sign = pybase64.standard_b64encode(hashed).decode("utf-8")

    params = {
        "client_id": CLIENT_ID,
        "timestamp": timestamp,
        "client_secret_sign": client_secret_sign,
        "grant_type": "client_credentials",
        "type": type_,
    }

    headers = {
        "content-type": "application/x-www-form-urlencoded",
    }

    # 쿼리스트링 방식 (공식 문서 패턴)
    from urllib.parse import urlencode

    query = urlencode(params)
    url = f"{TOKEN_URL}?{query}"

    proxies = PROXIES if USE_PROXY else None
    resp = requests.post(url=url, headers=headers, proxies=proxies)
    print(resp.text)
    resp.raise_for_status()
    data = resp.json()

    if "access_token" not in data:
        raise RuntimeError(f"토큰 발급 실패: {data}")

    return data["access_token"]


# ---------------------------------------------------------
# 2) 날짜 → ISO 문자열 (해당 날짜 전체 00:00~23:59:59.999)
# ---------------------------------------------------------
def make_iso_range_for_date(target: date) -> Tuple[str, str]:
    """
    target 날짜 하루 전체를 조회하기 위한 from/to ISO 문자열 생성
    """
    date_str = target.strftime("%Y-%m-%d")
    from_iso = f"{date_str}T00:00:00.000+09:00"
    to_iso   = f"{date_str}T23:59:59.999+09:00"
    return from_iso, to_iso


# ---------------------------------------------------------
# 3) 응답 JSON에서 주문 리스트 꺼내기
# ---------------------------------------------------------
def extract_items_from_response(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    조건형 상품 주문 상세 내역 응답에서 주문 리스트를 최대한 유연하게 반환
    """
    data_node = payload.get("data")

    if isinstance(data_node, list):
        return data_node

    if isinstance(data_node, dict):
        contents = data_node.get("contents")
        if isinstance(contents, list):
            return contents

        pod = data_node.get("productOrderData")
        if isinstance(pod, list):
            return pod

        for key, value in data_node.items():
            if isinstance(value, list):
                print(f"[WARN] 예상치 못한 리스트 키 발견: data['{key}']")
                return value

        print(f"[FETCH-INFO] data dict 구조 (keys={list(data_node.keys())})")
        return []

    if data_node is not None:
        print(f"[FETCH-INFO] data 타입 비정상: {type(data_node)}")

    return []


# ---------------------------------------------------------
# 4) light 모드용 행 생성
# ---------------------------------------------------------
def _light_row_from_item(item: Dict[str, Any], query_date: date) -> Dict[str, Any]:
    content = item.get("content")
    if not isinstance(content, dict):
        content = item

    order = content.get("order", {}) or {}
    product_order = content.get("productOrder", {}) or {}

    query_date_str = query_date.strftime("%Y-%m-%d")

    # 주문번호 텍스트 고정
    raw_order_id = order.get("orderId")
    order_id = f"'{raw_order_id}" if raw_order_id is not None else ""

    # 🔥 배송주소(공식문서 기반)
    delivery = order.get("deliveryAddress", {}) or {}
    base_addr_1 = delivery.get("baseAddress") or ""
    detail_addr_1 = delivery.get("detailedAddress") or ""

    shipping = product_order.get("shippingAddress", {}) or {}
    base_addr_2 = shipping.get("baseAddress") or ""
    detail_addr_2 = shipping.get("detailedAddress") or ""

    if base_addr_1 or detail_addr_1:
        full_address = f"{base_addr_1} {detail_addr_1}".strip()
    elif base_addr_2 or detail_addr_2:
        full_address = f"{base_addr_2} {detail_addr_2}".strip()
    else:
        full_address = ""
    
    # ★ 추가된 부분 (네이버 공식 스키마 기반 zipCode)
    zipcode_1 = delivery.get("zipCode") or ""
    zipcode_2 = shipping.get("zipCode") or ""
    zipcode = zipcode_1 or zipcode_2

    row = {
        "확인날짜": query_date_str,
        "주문번호": order_id,
        "주문날짜": order.get("orderDate"),
        "수취인이름": order.get("ordererName"),
        "수취인번호": order.get("ordererTel"),
        "수취인주소": full_address,
        "우편번호": zipcode,   # ★ row에 zipCode 포함
        "상품명": product_order.get("productName"),
        "결제상태": product_order.get("productOrderStatus"),
    }
    return row


# ---------------------------------------------------------
# 5) 하루치 조회
# ---------------------------------------------------------
def fetch_product_orders_window(
    access_token: str, target_date: date, mode: str = "light"
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:

    from_iso, to_iso = make_iso_range_for_date(target_date)

    params = {
        "from": from_iso,
        "to": to_iso,
        "rangeType": "PAYED_DATETIME",
        "statusType": "ALL",
        "quantityClaimCompatibility": "true",
        "limit": 300,
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    proxies = PROXIES if USE_PROXY else None
    resp = requests.get(API_URL_PRODUCT_ORDERS, headers=headers, params=params, proxies=proxies)
    status_code = resp.status_code

    if status_code != 200:
        print("────────────────────────────")
        print("[ERROR]", target_date)
        print("status:", status_code)
        print("body  :", resp.text[:2000])
        print("trace :", resp.headers.get("GNCP-GW-Trace-ID"))
        print("────────────────────────────")
        return [], [], status_code

    try:
        payload = resp.json()
    except Exception:
        print(
            f"[FETCH-ERROR] {target_date} JSON 파싱 실패 "
            f"(status={status_code}) → {resp.text[:200]}"
        )
        return [], [], status_code

    items = extract_items_from_response(payload)
    light_rows: List[Dict[str, Any]] = []
    full_items: List[Dict[str, Any]] = []

    if items:
        for it in items:
            full_items.append(it)
            if mode in ("light", "both"):
                light_rows.append(_light_row_from_item(it, target_date))

    print(
        f"[FETCH] {target_date.strftime('%Y-%m-%d')} | "
        f"{status_code} | count={len(items)}"
    )
    return light_rows, full_items, status_code


# ---------------------------------------------------------
# 6) 여러 일자 조회 + CSV 저장
# ---------------------------------------------------------
def fetch_last_n_days(
    access_token: str,
    start_date: date,
    end_date: date,
    mode: str = "light",
    outfile: str | None = None,
    progress_callback=None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:

    all_light: List[Dict[str, Any]] = []
    all_full: List[Dict[str, Any]] = []

    # 🔥 [ADD] 진행률 계산
    total_days = (end_date - start_date).days + 1
    day_index = 1

    cur = start_date
    while cur <= end_date:

        # 🔥 [ADD] 진행 상황 GUI로 전달
        if progress_callback:
            progress_callback(
                f"[INFO] {day_index}/{total_days}일차 조회 중... ({cur})"
            )

        light_rows, full_items, _ = fetch_product_orders_window(
            access_token, cur, mode=mode
        )

        all_light.extend(light_rows)
        all_full.extend(full_items)

        cur += timedelta(days=1)
        day_index += 1

    # 기존 코드 그대로 유지 --------------------------
    if outfile is None:
        outfile = f"orders_{start_date.strftime('%Y-%m-%d')}_{end_date.strftime('%Y-%m-%d')}.csv"

    if mode in ("light", "both") and all_light:
        fieldnames = [
            "확인날짜",
            "주문번호",
            "주문날짜",
            "수취인이름",
            "수취인번호",
            "수취인주소",
            "상품명",
            "결제상태",
        ]
        with open(outfile, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in all_light:
                writer.writerow(row)

        print(f"[CSV] 저장 완료 → {outfile} | 총 {len(all_light)}개")

    if mode in ("full", "both") and all_full:
        import json, os
        full_out = os.path.splitext(outfile)[0] + "_full.json"
        with open(full_out, "w", encoding="utf-8") as f:
            json.dump(all_full, f, ensure_ascii=False)
        print(f"[JSON] full 데이터 저장 → {full_out} | 총 {len(all_full)}개")

    return all_light, all_full
