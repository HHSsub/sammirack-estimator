"""
order_listener.py
─────────────────────────────────────────────────────────────────────────────
삼미랙 스마트스토어 실시간 주문 리스너
- 네이버 커머스 API를 N초마다 폴링하여 새로운 결제 완료 주문을 감지합니다.
- 새 주문 발견 시 '누가', '어떤 랙 제품(옵션)을', '얼마에' 주문했는지 즉시 출력합니다.
- 토큰은 3시간 만료 전 자동 갱신됩니다.

사용법:
    python3 order_listener.py

종료:
    Ctrl+C
─────────────────────────────────────────────────────────────────────────────
호환: Python 3.6+
"""

import csv
import json
import os
import signal
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

import requests

# config.py 에서 설정값 로드
from config import (
    CLIENT_ID,
    CLIENT_SECRET,
    TOKEN_URL,
    API_BASE_URL,
    PROXIES,
    USE_PROXY,
    POLL_INTERVAL_SECONDS,
    TOKEN_REFRESH_BUFFER_SECONDS,
    TOKEN_EXPIRES_IN_SECONDS,
)

# ─────────────────────────────────────────
# KST 타임존 상수
# ─────────────────────────────────────────
KST = timezone(timedelta(hours=9))

# ─────────────────────────────────────────
# API 엔드포인트
# ─────────────────────────────────────────
URL_PRODUCT_ORDER_LIST = (
    "{}/external/v1/pay-order/seller/product-orders".format(API_BASE_URL)
)
URL_PRODUCT_ORDER_QUERY = (
    "{}/external/v1/pay-order/seller/product-orders/query".format(API_BASE_URL)
)

# CSV 저장 컬럼 순서
ORDER_CSV_FIELDS = [
    "상품주문번호",
    "결제완료시각",
    "구매자명",
    "상품명",
    "옵션",
    "주문수량",
    "최종금액",
    "수취인명",
    "연락처",
    "배송지",
]


# ═════════════════════════════════════════════════════════════════════════════
# 1. 토큰 관리
# ═════════════════════════════════════════════════════════════════════════════

def _generate_client_secret_sign(timestamp):
    # type: (str) -> str
    """
    네이버 커머스 API 공식 인증 방식:
      password  = CLIENT_ID + "_" + timestamp
      hashed    = bcrypt(password, CLIENT_SECRET)
      sign      = base64(hashed)
    """
    import bcrypt
    import pybase64

    password = "{}_{}".format(CLIENT_ID, timestamp)
    hashed = bcrypt.hashpw(password.encode("utf-8"), CLIENT_SECRET.encode("utf-8"))
    return pybase64.standard_b64encode(hashed).decode("utf-8")


def get_access_token():
    # type: () -> str
    """
    네이버 커머스 API 액세스 토큰을 발급받습니다.
    """
    from urllib.parse import urlencode

    timestamp = str(int(time.time() * 1000))
    client_secret_sign = _generate_client_secret_sign(timestamp)

    params = {
        "client_id": CLIENT_ID,
        "timestamp": timestamp,
        "client_secret_sign": client_secret_sign,
        "grant_type": "client_credentials",
        "type": "SELF",
    }

    headers = {"content-type": "application/x-www-form-urlencoded"}
    url = "{}?{}".format(TOKEN_URL, urlencode(params))

    proxies = PROXIES if USE_PROXY else None
    resp = requests.post(url, headers=headers, proxies=proxies, timeout=15)
    resp.raise_for_status()

    data = resp.json()
    if "access_token" not in data:
        raise RuntimeError("[TOKEN] 발급 실패: {}".format(data))

    print("[TOKEN] 새 액세스 토큰 발급 완료 ({})".format(
        datetime.now(KST).strftime("%H:%M:%S")
    ))
    return data["access_token"]


class TokenManager(object):
    """
    액세스 토큰을 관리하고 만료 전 자동으로 재발급합니다.
    """

    def __init__(self):
        self._token = None          # type: Optional[str]
        self._issued_at = None      # type: Optional[float]

    def get_token(self):
        # type: () -> str
        """유효한 토큰을 반환합니다. 만료 임박 시 자동 갱신."""
        if self._should_refresh():
            self._token = get_access_token()
            self._issued_at = time.time()
        return self._token

    def invalidate(self):
        """401 응답 등으로 토큰이 무효화된 경우 강제 리셋."""
        print("[TOKEN] 토큰 무효화 → 다음 호출 시 재발급됩니다.")
        self._token = None
        self._issued_at = None

    def _should_refresh(self):
        # type: () -> bool
        if self._token is None or self._issued_at is None:
            return True
        elapsed = time.time() - self._issued_at
        return elapsed >= (TOKEN_EXPIRES_IN_SECONDS - TOKEN_REFRESH_BUFFER_SECONDS)


# ═════════════════════════════════════════════════════════════════════════════
# 2. API 호출 유틸
# ═════════════════════════════════════════════════════════════════════════════

def _make_headers(token):
    # type: (str) -> Dict[str, str]
    return {
        "Authorization": "Bearer {}".format(token),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _safe_get(url, token_mgr, **kwargs):
    # type: (str, TokenManager, ...) -> requests.Response
    """GET 요청 래퍼: 401 발생 시 토큰 재발급 후 1회 재시도"""
    proxies = PROXIES if USE_PROXY else None
    token = token_mgr.get_token()
    resp = requests.get(url, headers=_make_headers(token), proxies=proxies, timeout=15, **kwargs)

    if resp.status_code == 401:
        print("[AUTH] 401 Unauthorized → 토큰 재발급 후 재시도")
        token_mgr.invalidate()
        token = token_mgr.get_token()
        resp = requests.get(url, headers=_make_headers(token), proxies=proxies, timeout=15, **kwargs)

    return resp


def _safe_post(url, token_mgr, json_body):
    # type: (str, TokenManager, dict) -> requests.Response
    """POST 요청 래퍼: 401 발생 시 토큰 재발급 후 1회 재시도"""
    proxies = PROXIES if USE_PROXY else None
    token = token_mgr.get_token()
    resp = requests.post(url, headers=_make_headers(token), json=json_body, proxies=proxies, timeout=15)

    if resp.status_code == 401:
        print("[AUTH] 401 Unauthorized → 토큰 재발급 후 재시도")
        token_mgr.invalidate()
        token = token_mgr.get_token()
        resp = requests.post(url, headers=_make_headers(token), json=json_body, proxies=proxies, timeout=15)

    return resp


# ═════════════════════════════════════════════════════════════════════════════
# 3. 주문 조회 (1단계: 목록 → 2단계: 상세)
# ═════════════════════════════════════════════════════════════════════════════

def fetch_recent_product_order_ids(token_mgr, from_dt, to_dt):
    # type: (TokenManager, datetime, datetime) -> List[str]
    """결제완료 상태의 상품주문번호 목록을 조회합니다."""

    def _fmt(dt):
        return dt.strftime("%Y-%m-%dT%H:%M:%S.000+09:00")

    params = {
        "from": _fmt(from_dt),
        "to": _fmt(to_dt),
        "rangeType": "PAYED_DATETIME",
        "statusType": "ALL",
        "quantityClaimCompatibility": "true",
        "limit": 300,
    }

    resp = _safe_get(URL_PRODUCT_ORDER_LIST, token_mgr, params=params)

    if resp.status_code != 200:
        print("[LIST-API] 오류 {}: {}".format(resp.status_code, resp.text[:300]))
        return []

    payload = resp.json()
    data = payload.get("data", {})
    ids = []  # type: List[str]

    if isinstance(data, list):
        for item in data:
            pid = _extract_product_order_id(item)
            if pid:
                ids.append(pid)
    elif isinstance(data, dict):
        contents = data.get("contents") or data.get("productOrderData") or []
        for item in contents:
            pid = _extract_product_order_id(item)
            if pid:
                ids.append(pid)

    return ids


def _extract_product_order_id(item):
    # type: (dict) -> Optional[str]
    """item 혹은 item.content.productOrder 에서 productOrderId 추출"""
    if not isinstance(item, dict):
        return None

    pid = item.get("productOrderId")
    if pid:
        return str(pid)

    content = item.get("content") or {}
    po = content.get("productOrder") or {}
    pid = po.get("productOrderId")
    if pid:
        return str(pid)

    return None


def fetch_order_details(token_mgr, product_order_ids):
    # type: (TokenManager, List[str]) -> List[Dict]
    """상품주문번호 목록으로 상세 주문 정보를 조회합니다 (POST /query)."""
    if not product_order_ids:
        return []

    body = {"productOrderIds": product_order_ids}
    resp = _safe_post(URL_PRODUCT_ORDER_QUERY, token_mgr, body)

    if resp.status_code != 200:
        print("[QUERY-API] 오류 {}: {}".format(resp.status_code, resp.text[:300]))
        return []

    payload = resp.json()
    data = payload.get("data", [])

    orders = []
    for item in (data if isinstance(data, list) else []):
        parsed = _parse_order_item(item)
        if parsed:
            orders.append(parsed)

    return orders


def _parse_order_item(item):
    # type: (dict) -> Optional[Dict]
    """
    API 응답의 단일 주문 항목을 읽기 쉬운 딕셔너리로 변환.

    API 명세 기준 필드 매핑:
      상품주문번호  ← productOrder.productOrderId
      구매자명      ← order.ordererName
      옵션          ← productOrder.productOption
      주문수량      ← productOrder.quantity
      최종금액      ← productOrder.totalPaymentAmount
      수취인명      ← productOrder.shippingAddress.name
      연락처        ← productOrder.shippingAddress.tel1
      배송지        ← productOrder.shippingAddress (baseAddress + detailedAddress)
      결제완료시각  ← order.paymentDate
    """
    if not isinstance(item, dict):
        return None

    content = item.get("content", item)
    order = content.get("order") or {}
    po = content.get("productOrder") or {}
    shipping = po.get("shippingAddress") or {}

    base_addr = shipping.get("baseAddress") or ""
    detail_addr = shipping.get("detailedAddress") or ""
    full_address = "{} {}".format(base_addr, detail_addr).strip()

    return {
        "상품주문번호": po.get("productOrderId", ""),
        "구매자명":     order.get("ordererName", ""),
        "상품명":       po.get("productName", ""),
        "옵션":         po.get("productOption") or "(옵션없음)",
        "주문수량":     po.get("quantity", 0),
        "최종금액":     po.get("totalPaymentAmount", 0),
        "수취인명":     shipping.get("name") or order.get("ordererName", ""),
        "연락처":       shipping.get("tel1") or order.get("ordererTel", ""),
        "배송지":       full_address,
        "결제완료시각": order.get("paymentDate", ""),
    }


# ═════════════════════════════════════════════════════════════════════════════
# 4. 콘솔 출력
# ═════════════════════════════════════════════════════════════════════════════

def print_new_order(order):
    # type: (Dict) -> None
    """새 주문 정보를 콘솔에 보기 좋게 출력합니다."""
    now_str = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")
    print()
    print("=" * 60)
    print("  [NEW ORDER] {}".format(now_str))
    print("=" * 60)
    print("  상품주문번호  : {}".format(order["상품주문번호"]))
    print("  결제완료시각  : {}".format(order["결제완료시각"]))
    print("  구매자명      : {}".format(order["구매자명"]))
    print("  주문 상품     : {}".format(order["상품명"]))
    print("  선택 옵션     : {}".format(order["옵션"]))
    print("  주문 수량     : {}개".format(order["주문수량"]))
    print("  최종 금액     : {:,}원".format(order["최종금액"]))
    print("  수취인        : {} / {}".format(order["수취인명"], order["연락처"]))
    print("  배송지        : {}".format(order["배송지"]))
    print("=" * 60)
    print()


# ═════════════════════════════════════════════════════════════════════════════
# 5. 스마트스토어 파싱 (랙종류 + 옵션)
# ═════════════════════════════════════════════════════════════════════════════

import re as _re

# 알려진 랙 종류 (상품명 앞에서 매핑)
RACK_TYPE_MAP = {
    "하이랙":     "하이랙",
    "파렛트랙":   "파렛트랙",
    "파래트랙":   "파렛트랙",
    "파랫트랙":   "파렛트랙",
    "중량랙":     "중량랙",
    "경량랙":     "경량랙",
    "스텐랙":     "스텐랙",
    "올스텐랙":   "스텐랙",
    "사이버랙":   "스텐랙",
    "초스피드":   "경량랙",
    "실버랙":     "경량랙",
}


def extract_rack_type(product_name):
    # type: (str) -> str
    """
    상품명 맨 앞 단어로 랙 종류를 결정합니다.
    뒤에 오는 SEO 키워드는 무시.

    예) "하이랙 철제선반 앵글 중량랙 물류 ..." → "하이랙"
        "파렛트랙 중량랙 앵글 ..."              → "파렛트랙"
        "중량랙 무볼트 철제선반 ..."             → "중량랙"
    """
    name = (product_name or "").strip()
    for kw, rack_type in RACK_TYPE_MAP.items():
        if name.startswith(kw):
            return rack_type
    # 매핑 실패 시 첫 단어 반환
    return name.split()[0] if name else "기타"


def _strip_segment_label(seg):
    # type: (str) -> str
    """
    세그먼트 앞의 레이블을 제거합니다.
    지원 패턴:
      "A.색상: ..."   → "색상: ..."
      "B.선반(...): ..."
      "1 . 폭(앞뒤): ..."
      "2 . 높이: ..."
    """
    # 영문/한글 한 글자 + 점/대시 + 공백 (예: A., B., C.)
    seg = _re.sub(r'^[A-Za-z]\s*[.\-]\s*', '', seg).strip()
    # 숫자 레이블 (예: 1 . , 2 . )
    seg = _re.sub(r'^\d+\s*[.\-]\s*', '', seg).strip()
    return seg


def _extract_size_numbers(val):
    # type: (str) -> list
    """
    규격 값에서 순수 치수 숫자만 추출합니다.
    중량(kg) 숫자는 제외합니다.

    예)
      "60(폭)x200(가로)x200(높이)"  → [60, 200, 200]
      "800x1480(연결)700kg선반형"    → [800, 1480]   ← 700kg 제외
      "45x125"                       → [45, 125]
    """
    # kg 앞 숫자 제거 (예: 700kg, 2000Kg)
    val_no_weight = _re.sub(r'\d+\s*[kK][gG]', '', val)
    nums = _re.findall(r'\d+', val_no_weight)
    return [int(n) for n in nums]


def _detect_connection_type(val):
    # type: (str) -> str
    """연결형/독립형 여부 탐지"""
    if "연결" in val:
        return "연결형"
    if "독립" in val:
        return "독립형"
    return ""


def parse_smartstore_option(option_str):
    # type: (str) -> dict
    """
    스마트스토어 옵션 문자열을 파싱합니다.

    반환 키:
      rack_type_hint  - 연결형/독립형 힌트 (없을 수 있음)
      color           - 색상 (예: "블루(기둥)+오렌지(가로대)(고중량)270kg")
      width           - 폭 cm  (int)
      length          - 가로 cm (int)
      height          - 높이 cm (int)
      dan             - 단수 (예: "4단")
      extra_*         - 기타 옵션
      원본옵션        - 원본 문자열
    """
    if not option_str or option_str == "(옵션없음)":
        return {"원본옵션": option_str or ""}

    result = {"원본옵션": option_str}

    segments = [s.strip() for s in option_str.split("/")]

    for seg in segments:
        seg = _strip_segment_label(seg)
        if ":" not in seg:
            continue

        colon_idx = seg.index(":")
        raw_key = seg[:colon_idx].strip()
        raw_val = seg[colon_idx + 1:].strip()

        key_lower = raw_key.lower()

        # ─── 색상 ───────────────────────────────────────────
        if "색상" in raw_key:
            result["color"] = raw_val

        # ─── 규격 (폭/가로/높이) ────────────────────────────
        elif any(k in raw_key for k in ["선반", "폭", "규격", "사이즈", "길이"]) or "cm" in key_lower:
            nums = _extract_size_numbers(raw_val)
            conn = _detect_connection_type(raw_val)
            if conn:
                result["rack_type_hint"] = conn

            # 숫자 개수에 따라 폭/가로(/높이) 분배
            # 파렛트랙: "폭x길이" 키 → nums[0]=폭, nums[1]=가로
            # 하이랙:   "선반(폭+가로)x기둥(높이)" → nums[0]=폭, nums[1]=가로, nums[2]=높이
            if len(nums) >= 3:
                result["width"]  = nums[0]
                result["length"] = nums[1]
                result["height"] = nums[2]
            elif len(nums) == 2:
                result["width"]  = nums[0]
                result["length"] = nums[1]
            elif len(nums) == 1:
                result["width"]  = nums[0]

            result["size_raw"] = raw_val

        # ─── 높이 (별도 키로 오는 경우, 파렛트랙 등) ────────
        elif "높이" in raw_key:
            nums = _extract_size_numbers(raw_val)
            if nums:
                result["height"] = nums[0]
            conn = _detect_connection_type(raw_val)
            if conn and "rack_type_hint" not in result:
                result["rack_type_hint"] = conn

        # ─── 단수 ───────────────────────────────────────────
        elif "단수" in raw_key or raw_key == "단":
            result["dan"] = raw_val

        # ─── 추가 단/선반 (단추가 상품 등) ──────────────────
        elif "추가" in raw_key or "단추가" in raw_key:
            result["extra_add"] = raw_val

        # ─── 기타 ───────────────────────────────────────────
        else:
            result["extra_{}".format(raw_key)] = raw_val

    return result


def build_purchase_order_item(order):
    # type: (dict) -> dict
    """
    주문 dict → PurchaseOrderForm items[] 한 행.

    DB의 items[].name 형식 (실제 purchase 문서 기준):
      "{랙종류} {연결/독립형} {폭}x{가로} {높이} {단수} {색상}"
      예) "하이랙 독립형 60x150 150 2단 아이보리(볼트식)270kg"

    단추가/추가선반 등 단일 부품 주문은 상품명을 그대로 사용.
    """
    product_name = order.get("상품명", "")
    option_str   = order.get("옵션", "")
    parsed       = parse_smartstore_option(option_str)
    rack_type    = extract_rack_type(product_name)

    qty   = int(order.get("주문수량", 1)) or 1
    total = int(order.get("최종금액", 0))
    unit_price = total // qty if qty else total

    # 단추가/추가선반 같은 단일 부품 상품은 옵션에 색상/규격 없음
    # → 상품명 자체가 품명 (예: "60X108(오렌지선반)")
    is_addon = not parsed.get("color") and not parsed.get("width")

    if is_addon:
        item_name = product_name
    else:
        # DB 형식: "{랙종류} {연결/독립형} {폭}x{가로} {높이} {단수} {색상}"
        parts = [rack_type]

        hint = parsed.get("rack_type_hint", "")
        if hint:
            parts.append(hint)

        if parsed.get("width") and parsed.get("length"):
            parts.append("{}x{}".format(parsed["width"], parsed["length"]))

        if parsed.get("height"):
            parts.append(str(parsed["height"]))

        if parsed.get("dan"):
            # "4단" → "4단" 그대로
            dan = parsed["dan"]
            # "1단(철판형)" 같이 괄호 있으면 앞 숫자+단만 추출
            m = _re.match(r'(\d+단)', dan)
            parts.append(m.group(1) if m else dan)

        if parsed.get("color"):
            parts.append(parsed["color"])

        item_name = " ".join(parts)

    return {
        "name":       item_name,
        "unit":       "개",
        "quantity":   qty,
        "unitPrice":  unit_price,
        "totalPrice": total,
        "note":       option_str,   # 원본 옵션 비고에 보존
    }


def build_purchase_order_payload(order):
    # type: (dict) -> dict
    """
    주문 dict → documents DB 행 + PurchaseOrderForm.formData 구조.

    DB 스키마:
      doc_id, date, document_number, company_name, biz_number,
      items (JSON), materials (JSON),
      subtotal, tax, total_amount, notes, top_memo,
      created_at, updated_at, type
    """
    parsed   = parse_smartstore_option(order.get("옵션", ""))
    item     = build_purchase_order_item(order)
    rack_type = extract_rack_type(order.get("상품명", ""))

    subtotal     = int(order.get("최종금액", 0))
    tax          = round(subtotal * 0.1)
    total_amount = subtotal + tax

    payment_date = order.get("결제완료시각", "") or ""
    date_part = payment_date.split("T")[0] if "T" in payment_date else datetime.now(KST).strftime("%Y-%m-%d")

    order_id   = str(order.get("상품주문번호", ""))
    doc_number = "SS-{}".format(order_id[-10:]) if len(order_id) >= 10 else "SS-{}".format(order_id)
    doc_id     = "purchase_ss_{}".format(order_id)

    now_iso = datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S.000+09:00")

    return {
        # ── documents DB 컬럼 직접 매핑 ──────────────────────
        "doc_id":          doc_id,
        "date":            date_part,
        "document_number": doc_number,
        "company_name":    order.get("구매자명", ""),
        "biz_number":      "",
        "items":           [item],
        "materials":       [],          # BOM: sammirack-api 연동 후 채움
        "subtotal":        subtotal,
        "tax":             tax,
        "total_amount":    total_amount,
        "notes":           "배송지: {} | 연락처: {} | 수취인: {}".format(
                               order.get("배송지", ""),
                               order.get("연락처", ""),
                               order.get("수취인명", "")
                           ),
        "top_memo":        "",
        "created_at":      now_iso,
        "updated_at":      now_iso,
        "type":            "purchase",
        # ── 파싱 결과 (디버깅용) ─────────────────────────────
        "_rack_type":      rack_type,
        "_parsed_option":  parsed,
        "_smartstore":     order,
    }



# ═════════════════════════════════════════════════════════════════════════════
# 6. 저장 (CSV 단일 저장)
# ═════════════════════════════════════════════════════════════════════════════

# CSV 컬럼 순서
ORDER_CSV_FIELDS = [
    "상품주문번호",
    "결제완료시각",
    "구매자명",
    "상품명",
    "옵션",
    "주문수량",
    "최종금액",
    "수취인명",
    "연락처",
    "배송지",
]


def save_order_to_csv(order, log_dir):
    # type: (dict, str) -> str
    """월별 누적 CSV (orders_YYYY-MM.csv) 에 주문 1행을 append 합니다."""
    ym = datetime.now(KST).strftime("%Y-%m")
    csv_path = os.path.join(log_dir, "orders_{}.csv".format(ym))

    file_exists = os.path.isfile(csv_path)
    with open(csv_path, "a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=ORDER_CSV_FIELDS, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()
        writer.writerow(order)

    return csv_path




# ═════════════════════════════════════════════════════════════════════════════
# 6. 메인 실시간 리스너
# ═════════════════════════════════════════════════════════════════════════════

class OrderListener(object):
    """
    스마트스토어 실시간 주문 리스너 (폴링 방식).

    동작:
      1. POLL_INTERVAL_SECONDS 마다 최근 결제 완료 주문 목록 조회
      2. 이전에 본 상품주문번호를 제외 → 새 주문만 필터링
      3. 새 주문 발견 시 상세 조회 후 콘솔 출력 + 파일 저장
      4. on_new_order 콜백이 등록된 경우 함께 호출 (자동화 연결용)
    """

    def __init__(self, on_new_order=None):
        self.token_mgr = TokenManager()
        self.on_new_order = on_new_order
        self._seen_ids = set()   # type: set
        self._running = False

    def start(self):
        """리스너를 시작합니다. Ctrl+C로 종료."""
        self._running = True
        self._setup_signal_handler()

        print()
        print("=" * 60)
        print("  삼미랙 스마트스토어 실시간 주문 리스너 시작")
        print("  폴링 주기: {}초".format(POLL_INTERVAL_SECONDS))
        if USE_PROXY:
            print("  프록시: 사용 중 ({})".format(PROXIES.get("https", "")))
        else:
            print("  프록시: 미사용 (서버 직접 요청)")
        print("  종료: Ctrl+C")
        print("=" * 60)
        print()

        print("[INIT] 기존 주문 목록 초기화 중...")
        self._poll(init_run=True)
        print("[INIT] 완료. 이 시각 이후의 새 주문부터 감지합니다.")
        print()

        while self._running:
            time.sleep(POLL_INTERVAL_SECONDS)
            if self._running:
                self._poll(init_run=False)

    def stop(self):
        self._running = False
        print("\n[STOP] 리스너를 종료합니다...")

    def _setup_signal_handler(self):
        def _handler(sig, frame):
            self.stop()
            sys.exit(0)
        signal.signal(signal.SIGINT, _handler)

    def _poll(self, init_run=False):
        """한 번의 폴링 사이클을 실행합니다."""
        now = datetime.now(KST)

        if init_run:
            look_back_seconds = 600  # 초기: 최근 10분 조회 → seen 등록
        else:
            look_back_seconds = POLL_INTERVAL_SECONDS * 2  # 여유 2배

        from_dt = now - timedelta(seconds=look_back_seconds)
        to_dt = now

        try:
            product_order_ids = fetch_recent_product_order_ids(
                self.token_mgr, from_dt, to_dt
            )
        except Exception as e:
            print("[ERROR] 주문 목록 조회 실패: {}".format(e))
            return

        if not init_run:
            ts_str = now.strftime("%H:%M:%S")
            print("[POLL] {} | 조회: {}건".format(ts_str, len(product_order_ids)), end="")

        new_ids = [pid for pid in product_order_ids if pid not in self._seen_ids]
        self._seen_ids.update(product_order_ids)

        if init_run:
            print("  → 기존 주문 {}건 등록 완료".format(len(self._seen_ids)))
            return

        if not new_ids:
            print("  → 새 주문 없음")
            return

        print("  → [NEW] 새 주문 {}건 발견!".format(len(new_ids)))

        try:
            orders = fetch_order_details(self.token_mgr, new_ids)
        except Exception as e:
            print("[ERROR] 주문 상세 조회 실패: {}".format(e))
            return

        for order in orders:
            print_new_order(order)

            if self.on_new_order:
                try:
                    self.on_new_order(order)
                except Exception as cb_err:
                    print("[CALLBACK-ERROR] {}".format(cb_err))


# ═════════════════════════════════════════════════════════════════════════════
# 7. 훅 (CSV 저장 + 향후 PurchaseOrderForm 자동 생성)
# ═════════════════════════════════════════════════════════════════════════════

def on_new_order_hook(order):
    # type: (dict) -> None
    """
    새 주문 발생 시 자동 호출됩니다.
      - 월별 누적 CSV 한 파일에 append
      - PurchaseOrderForm 호환 페이로드 구성 (나중에 서버 API로 전송)
    """
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "order_logs")
    os.makedirs(log_dir, exist_ok=True)

    # ① CSV 저장 (하나만)
    try:
        csv_path = save_order_to_csv(order, log_dir)
        print("[SAVE] {}".format(csv_path))
    except Exception as e:
        print("[SAVE-ERROR] {}".format(e))

    # ② 청구서(PurchaseOrderForm / documents DB) 페이로드 구성 및 출력
    payload = build_purchase_order_payload(order)
    print("[PAYLOAD] doc_id={}".format(payload["doc_id"]))
    print("  문서번호 : {}".format(payload["document_number"]))
    print("  고객명   : {}".format(payload["company_name"]))
    print("  랙종류   : {}".format(payload.get("_rack_type", "")))
    print("  품목명   : {}".format(payload["items"][0]["name"] if payload["items"] else "-"))
    print("  수량     : {}개".format(payload["items"][0]["quantity"] if payload["items"] else 0))
    print("  공급가   : {:,}원  세액: {:,}원  합계: {:,}원".format(
        payload["subtotal"], payload["tax"], payload["total_amount"]
    ))
    print("  비고     : {}".format(payload["notes"]))

    # ── 향후 자동화 연결 포인트 ──────────────────────────────────────
    # sammirack-api 서버에 청구서 자동 저장:
    # import requests as req
    # req.post("http://localhost:3000/api/documents", json=payload)
    # ────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    listener = OrderListener(on_new_order=on_new_order_hook)
    listener.start()

