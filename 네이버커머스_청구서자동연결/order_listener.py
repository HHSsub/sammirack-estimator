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
    SAMMIRACK_SERVER_URL,
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
# 5. 스마트스토어 파싱 (랙종류 필터링 + 옵션 파싱 + 그룹핑)
# ═════════════════════════════════════════════════════════════════════════════

import re as _re

# ─── DRY_RUN 플래그 ────────────────────────────────────────────────────────
# True : 콘솔 출력만 (DB 저장 안 함)  ← 1단계 기본값
# False: 가비아 서버에 실제 POST       ← 2단계에서 전환
DRY_RUN = True

# ─── 지원 랙 타입 화이트리스트 ──────────────────────────────────────────────
# admin_prices.json 기준 실제 존재하는 rack_type만 포함
# 절대 다른 종류를 여기에 매핑(aliasing)하지 말 것
SUPPORTED_RACK_PREFIXES = {
    "하이랙":   "하이랙",
    "파렛트랙": "파렛트랙",
    "파래트랙": "파렛트랙",
    "파랫트랙": "파렛트랙",
    "중량랙":   "중량랙",
    "경량랙":   "경량랙",
}

# ─── 비지원 랙 블랙리스트 (초스피드/실버랙/사이버랙/올스텐랙 등) ────────────
# 이 키워드로 시작하는 주문은 리슨 단계에서 즉시 무시
# 절대 다른 종류로 매핑하거나 분류하지 말 것
UNSUPPORTED_RACK_PREFIXES = [
    "초스피드", "실버랙", "사이버랙", "올스텐랙", "스텐랙",
    "조립식 앵글", "앵글선반", "철제선반 경량", "철제선반 무볼트",
]

# ─── 추가부품(addon) 판단 키워드 ─────────────────────────────────────────────
ADDON_KEYWORDS = ["추가", "단추가", "선반추가", "기둥추가", "로드빔"]



def is_supported_rack(product_name, option_str=""):
    # type: (str, str) -> bool
    """
    스마트스토어 상품명(+옵션)이 sammirack-estimator 지원 랙 관련 주문인지 확인.
    비지원 랙(초스피드/실버/사이버/올스텐/스텐)은 False → 주문 전체 skip.

    단, 추가부품(선반추가/기둥추가/로드빔 등):
    - 상품명 또는 옵션 중 하나라도 ADDON_KEYWORDS 포함 시 True (통과)
    - 예) "1460(철판형 1단)" 상품명에는 없어도 옵션에 "로드빔+" 있으면 통과
    """
    name     = (product_name or "").strip()
    opt_str  = (option_str or "").strip()
    combined = name + " " + opt_str

    # 추가부품 키워드 → 통과 (그룹 내 addon으로 처리)
    for kw in ADDON_KEYWORDS:
        if kw in combined:
            return True

    # 비지원 랙 블랙리스트
    for prefix in UNSUPPORTED_RACK_PREFIXES:
        if name.startswith(prefix):
            return False
    # 지원 랙 화이트리스트
    for prefix in SUPPORTED_RACK_PREFIXES:
        if name.startswith(prefix):
            return True
    # 알 수 없는 상품명도 skip (안전 우선)
    return False



def get_rack_type(product_name):
    # type: (str) -> str
    """지원 랙의 정규화된 rackType 반환. 비지원이면 빈 문자열."""
    name = (product_name or "").strip()
    for prefix, rack_type in SUPPORTED_RACK_PREFIXES.items():
        if name.startswith(prefix):
            return rack_type
    return ""


def _strip_segment_label(seg):
    # type: (str) -> str
    seg = _re.sub(r'^[A-Za-z]\s*[.\-]\s*', '', seg).strip()
    seg = _re.sub(r'^\d+\s*[.\-]\s*', '', seg).strip()
    return seg


def _extract_size_numbers(val):
    # type: (str) -> list
    val_no_weight = _re.sub(r'\d+\s*[kK][gG]', '', val)
    nums = _re.findall(r'\d+', val_no_weight)
    return [int(n) for n in nums]


def _detect_connection_type(val):
    # type: (str) -> str
    if "연결" in val:
        return "연결형"
    if "독립" in val:
        return "독립형"
    return ""


def parse_smartstore_option(option_str):
    # type: (str) -> dict
    """
    스마트스토어 옵션 문자열 파싱.
    반환 키: rack_type_hint, color, width, length, height, dan, size_raw, extra_*, 원본옵션
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

        if "색상" in raw_key:
            result["color"] = raw_val
        elif any(k in raw_key for k in ["선반", "폭", "규격", "사이즈", "길이"]) or "cm" in key_lower:
            nums = _extract_size_numbers(raw_val)
            conn = _detect_connection_type(raw_val)
            if conn:
                result["rack_type_hint"] = conn
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
        elif "높이" in raw_key:
            nums = _extract_size_numbers(raw_val)
            if nums:
                result["height"] = nums[0]
            conn = _detect_connection_type(raw_val)
            if conn and "rack_type_hint" not in result:
                result["rack_type_hint"] = conn
        elif "단수" in raw_key or raw_key == "단":
            result["dan"] = raw_val
        elif "추가" in raw_key or "단추가" in raw_key:
            result["extra_add"] = raw_val
        else:
            result["extra_{}".format(raw_key)] = raw_val

    return result


def classify_row(order):
    # type: (dict) -> str
    """
    주문 1행이 메인 랙인지 추가부품(addon)인지 분류.

    ★ 버그 수정: ADDON_KEYWORDS 체크가 반드시 최우선이어야 함.
      이전 코드는 parse_option 결과 색상/규격 체크가 먼저 실행되어
      '아이보리선반 단추가(볼트식)' 같은 상품이 items[]로 잘못 분류됨.

    반환: "main" | "addon"
    """
    product_name = str(order.get("상품명", "") or "")
    option_str   = str(order.get("옵션", "") or "")
    combined     = product_name + " " + option_str

    # ① ADDON 키워드 있으면 즉시 addon (색상/규격 체크 불필요)
    for kw in ADDON_KEYWORDS:
        if kw in combined:
            return "addon"

    # ② 지원 랙 이름으로 시작하면 파싱 없이 바로 main (파렛트랙 옵션 구조 호환)
    for prefix in SUPPORTED_RACK_PREFIXES:
        if product_name.strip().startswith(prefix):
            return "main"

    # ③ 색상 또는 규격(폭) 있으면 main
    parsed = parse_smartstore_option(option_str)
    return "main" if (parsed.get("color") or parsed.get("width") or parsed.get("size_raw")) else "addon"


def _parse_payment_dt(dt_str):
    # type: (str) -> Optional[datetime]
    """결제완료시각 문자열을 파싱하여 datetime 반환."""
    try:
        dt_str2 = str(dt_str or "").strip()
        if _re.search(r'[+-]\d{2}:\d{2}$', dt_str2):
            return datetime.fromisoformat(dt_str2)
        return datetime.strptime(dt_str2[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=KST)
    except Exception:
        return None


def group_orders_by_session(orders):
    # type: (List[dict]) -> List[List[dict]]
    """
    동일 구매자명 + 결제완료시각(분단위) 기준으로 주문을 묶습니다.
    같은 분(minute) 내 같은 구매자 = 한 번의 장바구니 결제 = 1개 document.
    """
    groups = {}  # type: Dict[tuple, list]
    for order in orders:
        buyer  = str(order.get("구매자명", "") or "")
        dt     = _parse_payment_dt(order.get("결제완료시각", ""))
        tm_key = dt.strftime("%Y%m%d%H%M") if dt else ""
        key    = (buyer, tm_key)
        groups.setdefault(key, []).append(order)
    return list(groups.values())


def build_item_name(order):
    # type: (dict) -> str
    """주문 1행 → items[].name 문자열 생성."""
    product_name = str(order.get("상품명", "") or "")
    option_str   = str(order.get("옵션", "") or "")
    parsed       = parse_smartstore_option(option_str)
    rack_type    = get_rack_type(product_name)

    if not parsed.get("color") and not parsed.get("width"):
        return product_name  # 추가부품은 상품명 그대로

    parts = [rack_type]
    hint = parsed.get("rack_type_hint", "")
    if hint:
        parts.append(hint)
    if parsed.get("width") and parsed.get("length"):
        parts.append("{}x{}".format(parsed["width"], parsed["length"]))
    if parsed.get("height"):
        parts.append(str(parsed["height"]))
    if parsed.get("dan"):
        m = _re.match(r'(\d+단)', str(parsed["dan"]))
        parts.append(m.group(1) if m else str(parsed["dan"]))
    if parsed.get("color"):
        parts.append(parsed["color"])
    return " ".join(parts)


def build_material_item(order, main_rack_type=""):
    # type: (dict, str) -> dict
    """
    추가부품(addon) 주문 1행 → materials[] 한 행.
    materials 구조: name / rackType / specification / quantity / unitPrice / totalPrice / note
    """
    product_name = str(order.get("상품명", "") or "")
    option_str   = str(order.get("옵션", "") or "")
    qty_str      = str(order.get("주문수량", "1") or "1")
    total_str    = str(order.get("최종금액", "0") or "0")

    try:
        qty = int(qty_str)
    except ValueError:
        qty = 1
    try:
        total = int(total_str.replace(",", ""))
    except ValueError:
        total = 0
    unit_price = total // qty if qty else total

    # 괄호 안 텍스트에서 부품명 추출 (예: "45X200(메트그레이선반)" → "메트그레이선반")
    m = _re.search(r'[（(]([^）)]+)[）)]', product_name)
    mat_name = m.group(1) if m else product_name

    # 규격: 상품명에서 숫자×숫자 추출
    m2 = _re.search(r'(\d+)[xX×](\d+)', product_name)
    spec = "{}x{}".format(m2.group(1), m2.group(2)) if m2 else product_name

    # 로드빔 계열 처리
    if "로드빔" in option_str or "로드빔" in product_name:
        mat_name = "로드빔 + 철판형"
        mw = _re.search(r'(\d+)kg', option_str, _re.IGNORECASE)
        if mw:
            mat_name += " {}kg".format(mw.group(1))
        mn = _re.search(r'(\d{3,4})\(', product_name)
        spec = mn.group(1) if mn else spec
    elif "선반" in mat_name:
        mat_name = _re.sub(r'([가-힣])선반', r'\1 선반', mat_name)
    elif "기둥" in mat_name:
        mat_name = _re.sub(r'([가-힣])기둥', r'\1 기둥', mat_name)

    return {
        "name":          mat_name,
        "rackType":      main_rack_type,
        "specification": spec,
        "quantity":      qty,
        "unitPrice":     unit_price,
        "totalPrice":    total,
        "note":          "",
    }


def _safe_int(val):
    # type: (object) -> int
    try:
        return int(str(val or "0").replace(",", ""))
    except ValueError:
        return 0


def build_grouped_document(group):
    # type: (List[dict]) -> dict
    """
    같은 세션으로 묶인 주문 그룹 → documents DB 한 행.

    - 메인 랙 주문 → items[]
    - 추가부품 주문 → materials[]
    - 금액은 그룹 전체 합산
    - doc_id는 그룹 내 가장 작은 상품주문번호 기준
    - camelCase + snake_case 필드 동시 포함 (React 웹앱 + DB 양쪽 호환)
    """
    group_sorted = sorted(group, key=lambda r: str(r.get("상품주문번호", "")))

    mains  = [r for r in group_sorted if classify_row(r) == "main"]
    addons = [r for r in group_sorted if classify_row(r) == "addon"]

    # 메인 랙이 없을 경우 전체를 main으로 처리 (단독 주문 등)
    if not mains:
        mains  = group_sorted
        addons = []

    main_rack_type = get_rack_type(mains[0].get("상품명", "")) if mains else ""

    # items[] 생성
    items = []
    for r in mains:
        qty   = _safe_int(r.get("주문수량", 1)) or 1
        total = _safe_int(r.get("최종금액", 0))
        items.append({
            "name":       build_item_name(r),
            "unit":       "개",
            "quantity":   qty,
            "unitPrice":  total // qty if qty else total,
            "totalPrice": total,
            "note":       str(r.get("옵션", "") or ""),
        })

    # materials[] 생성
    materials = [build_material_item(r, main_rack_type) for r in addons]

    # 금액 합산
    subtotal     = sum(_safe_int(r.get("최종금액", 0)) for r in group_sorted)
    tax          = round(subtotal * 0.1)
    total_amount = subtotal + tax

    # 대표 행 (가장 앞 주문)
    first     = group_sorted[0]
    order_id  = str(first.get("상품주문번호", ""))
    now_iso   = datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S.000+09:00")
    dt_str    = str(first.get("결제완료시각", "") or "")
    date_part = dt_str.split("T")[0] if "T" in dt_str else datetime.now(KST).strftime("%Y-%m-%d")

    doc_id      = "purchase_ss_{}".format(order_id)
    doc_num     = "SS-{}".format(order_id[-10:]) if len(order_id) >= 10 else "SS-{}".format(order_id)
    company     = str(first.get("수취인명") or first.get("구매자명") or "")
    notes_str   = "배송지: {} | 연락처: {} | 수취인: {}".format(
        str(first.get("배송지", "") or ""),
        str(first.get("연락처", "") or ""),
        str(first.get("수취인명", "") or ""),
    )

    return {
        # ── DB 컬럼 (snake_case) ─────────────────────────────
        "doc_id":          doc_id,
        "date":            date_part,
        "document_number": doc_num,
        "company_name":    company,
        "biz_number":      "",
        "items":           items,
        "materials":       materials,
        "subtotal":        subtotal,
        "tax":             tax,
        "total_amount":    total_amount,
        "notes":           notes_str,
        "top_memo":        "",
        "created_at":      now_iso,
        "updated_at":      now_iso,
        "type":            "purchase",
        # ── React 웹앱 호환 추가 필드 (camelCase) ─────────────
        # realtimeAdminSync.js 및 PurchaseOrderForm.jsx에서 id/type 필수
        "id":              doc_id,
        "documentNumber":  doc_num,
        "companyName":     company,
        "bizNumber":       "",
        "totalAmount":     total_amount,
        "topMemo":         "",
        "purchaseNumber":  doc_num,
        "customerName":    company,
        "status":          "진행 중",
        "createdAt":       now_iso,
        "updatedAt":       now_iso,
        # ── 디버깅 메타 (저장 시 제외) ───────────────────────
        "_group_size":     len(group_sorted),
        "_buyer":          str(first.get("구매자명", "") or ""),
        "_mains_count":    len(mains),
        "_addons_count":   len(addons),
        "_rack_type":      main_rack_type,
    }


def print_dry_run(payload):
    # type: (dict) -> None
    """
    드라이런 모드: 생성될 document 전체 구조를 콘솔에 출력합니다.
    실제 DB 저장은 하지 않습니다 (DRY_RUN=True 상태).
    """
    print()
    print("[DRY-RUN] " + "=" * 58)
    print("  doc_id          : {}".format(payload["doc_id"]))
    print("  document_number : {}".format(payload["document_number"]))
    print("  date            : {}".format(payload["date"]))
    print("  company_name    : {}".format(payload["company_name"]))
    print("  type            : {}".format(payload["type"]))
    print("  그룹 주문수     : {}건 (메인랙 {}행 / 추가부품 {}행)".format(
        payload["_group_size"], payload["_mains_count"], payload["_addons_count"]
    ))
    print()
    print("  [items] {}행:".format(len(payload["items"])))
    for i, item in enumerate(payload["items"], 1):
        print("    {} {}개  단가:{:,}  합계:{:,}".format(
            item["name"], item["quantity"], item["unitPrice"], item["totalPrice"]
        ))
    print()
    print("  [materials] {}행:".format(len(payload["materials"])))
    for i, mat in enumerate(payload["materials"], 1):
        print("    {} | {} | {} | {}개 | {:,}원".format(
            mat["name"], mat["rackType"], mat["specification"],
            mat["quantity"], mat["totalPrice"]
        ))
    print()
    print("  subtotal   : {:,}원".format(payload["subtotal"]))
    print("  tax        : {:,}원".format(payload["tax"]))
    print("  total      : {:,}원".format(payload["total_amount"]))
    print("  notes      : {}".format(payload["notes"][:80]))
    print("[DRY-RUN] " + "=" * 58)
    print("  ※ DRY_RUN=True: 실제 DB 저장 안 함. 확인 후 False로 전환")
    print()


# ── 하위 호환: 기존 단건 처리 함수 (2단계에서 제거 예정) ─────────────────────
def build_purchase_order_item(order):
    # type: (dict) -> dict
    """[레거시] 단건 주문 → items[] 한 행. 2단계에서 build_grouped_document로 대체됨."""
    qty   = int(order.get("주문수량", 1) or 1)
    total = int(order.get("최종금액", 0) or 0)
    return {
        "name":       build_item_name(order),
        "unit":       "개",
        "quantity":   qty,
        "unitPrice":  total // qty if qty else total,
        "totalPrice": total,
        "note":       str(order.get("옵션", "") or ""),
    }


def build_purchase_order_payload(order):
    # type: (dict) -> dict
    """[레거시] 단건 주문 → document 페이로드. 2단계에서 build_grouped_document로 대체됨."""
    item    = build_purchase_order_item(order)
    rack_type = get_rack_type(order.get("상품명", ""))

    subtotal     = int(order.get("최종금액", 0) or 0)
    tax          = round(subtotal * 0.1)
    total_amount = subtotal + tax

    payment_date = str(order.get("결제완료시각", "") or "")
    date_part    = payment_date.split("T")[0] if "T" in payment_date else datetime.now(KST).strftime("%Y-%m-%d")

    order_id   = str(order.get("상품주문번호", ""))
    doc_number = "SS-{}".format(order_id[-10:]) if len(order_id) >= 10 else "SS-{}".format(order_id)
    doc_id     = "purchase_ss_{}".format(order_id)
    now_iso    = datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S.000+09:00")

    return {
        "doc_id":          doc_id,
        "date":            date_part,
        "document_number": doc_number,
        "company_name":    str(order.get("구매자명", "") or ""),
        "biz_number":      "",
        "items":           [item],
        "materials":       [],
        "subtotal":        subtotal,
        "tax":             tax,
        "total_amount":    total_amount,
        "notes":           "배송지: {} | 연락처: {} | 수취인: {}".format(
                               str(order.get("배송지", "") or ""),
                               str(order.get("연락처", "") or ""),
                               str(order.get("수취인명", "") or ""),
                           ),
        "top_memo":        "",
        "created_at":      now_iso,
        "updated_at":      now_iso,
        "type":            "purchase",
        "_rack_type":      rack_type,
        "_parsed_option":  parse_smartstore_option(str(order.get("옵션", "") or "")),
        "_smartstore":     order,
    }








# ═════════════════════════════════════════════════════════════════════════════
# 6. 저장 (CSV + 가비아 DB)
# ═════════════════════════════════════════════════════════════════════════════

# CSV 컨럼 순서
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


def save_document_to_server(payload):
    # type: (dict) -> bool
    """
    가비아 서버의 sammirack-estimator API에 documents를 POST합니다.
    DRY_RUN=False 시에만 실제 호출됩니다.

    API: POST {SAMMIRACK_SERVER_URL}/documents/save
    Body: { docId: str, ...document_fields }

    반환: True(성공) / False(실패)
    """
    if DRY_RUN:
        print("[DRY-RUN] save_document_to_server 실제 호출 안 함 (DRY_RUN=True)")
        return False

    # _로 시작하는 디버깅 필드 제외 (설계 외 DB 저장 불필요)
    doc_id = payload.get("doc_id") or payload.get("id", "")
    clean_payload = {k: v for k, v in payload.items() if not k.startswith("_")}
    clean_payload["docId"] = doc_id

    # items / materials 는 JSON 문자열로 직렬화 후 전송
    if isinstance(clean_payload.get("items"), list):
        clean_payload["items"] = json.dumps(clean_payload["items"], ensure_ascii=False)
    if isinstance(clean_payload.get("materials"), list):
        clean_payload["materials"] = json.dumps(clean_payload["materials"], ensure_ascii=False)

    url = "{}/documents/save".format(SAMMIRACK_SERVER_URL)
    headers = {"Content-Type": "application/json"}

    proxies = PROXIES if USE_PROXY else None

    try:
        resp = requests.post(
            url,
            json=clean_payload,
            headers=headers,
            proxies=proxies,
            timeout=30,
        )
        if resp.status_code in (200, 201):
            print("[DB-SAVE] 저장 성공: {} (HTTP {})".format(doc_id, resp.status_code))
            return True
        else:
            print("[DB-ERROR] HTTP {} | {}".format(resp.status_code, resp.text[:200]))
            return False
    except requests.exceptions.ConnectionError:
        print("[DB-ERROR] 서버 연결 실패: {}".format(url))
        return False
    except requests.exceptions.Timeout:
        print("[DB-ERROR] 서버 응답 시간 초과 (30서)")
        return False
    except Exception as e:
        print("[DB-ERROR] 예상치 못한 오류: {}".format(e))
        return False






# ═════════════════════════════════════════════════════════════════════════════
# 6. 메인 실시간 리스너
# ═════════════════════════════════════════════════════════════════════════════

class OrderListener(object):
    """
    스마트스토어 실시간 주문 리스너 (폴링 방식).

    동작:
      1. POLL_INTERVAL_SECONDS 마다 최근 결제 완료 주문 목록 조회
      2. 이전에 본 상품주문번호를 제외 → 새 주문만 필터링
      3. 비지원 낙 종류 필터링 (is_supported_rack)
      4. 동일 구매자+분 기준 그룹핑 → 한 폴링에서 수신한 주문 → 그룹단위 처리
      5. DRY_RUN=True:〼콘솔 드라이런 출력 / False:실제 DB POST
    """

    def __init__(self, on_new_order=None):
        self.token_mgr    = TokenManager()
        self.on_new_order = on_new_order   # 레거시 콜백 (미사용)
        self._seen_ids    = set()          # type: set
        self._running     = False
        self.log_dir      = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "order_logs"
        )
        os.makedirs(self.log_dir, exist_ok=True)

    def start(self):
        """\ub9ac\uc2a4\ub108\ub97c \uc2dc\uc791\ud569\ub2c8\ub2e4. Ctrl+C\ub85c \uc885\ub8cc."""
        self._running = True
        self._setup_signal_handler()

        print()
        print("=" * 62)
        print("  \uc0bc\ubbf8\ub799 \uc2a4\ub9c8\ud2b8\uc2a4\ud1a0\uc5b4 \uc2e4\uc2dc\uac04 \uc8fc\ubb38 \ub9ac\uc2a4\ub108 \uc2dc\uc791")
        print("  \ud3f4\ub9c1 \uc8fc\uae30: {}\ucd08".format(POLL_INTERVAL_SECONDS))
        print("  \ubaa8\ub4dc: {}".format("[DRY-RUN] \ucf58\uc194 \ucd9c\ub825\ub9cc (DB \uc800\uc7a5 \uc548 \ud568)" if DRY_RUN else "[LIVE] \uc2e4\uc81c DB \uc800\uc7a5 \ud65c\uc131"))
        if USE_PROXY:
            print("  \ud504\ub85d\uc2dc: \uc0ac\uc6a9 \uc911 ({})".format(PROXIES.get("https", "")))
        else:
            print("  \ud504\ub85d\uc2dc: \ubbf8\uc0ac\uc6a9 (\uc11c\ubc84 \uc9c1\uc811 \uc694\uccad)")
        print("  sammirack API: {}".format(SAMMIRACK_SERVER_URL))
        print("  \uc885\ub8cc: Ctrl+C")
        print("=" * 62)
        print()

        print("[INIT] \uae30\uc874 \uc8fc\ubb38 \ubaa9\ub85d \ucd08\uae30\ud654 \uc911...")
        self._poll(init_run=True)
        print("[INIT] \uc644\ub8cc. \uc774 \uc2dc\uac01 \uc774\ud6c4\uc758 \uc0c8 \uc8fc\ubb38\ubd80\ud130 \uac10\uc9c0\ud569\ub2c8\ub2e4.")
        print()

        while self._running:
            time.sleep(POLL_INTERVAL_SECONDS)
            if self._running:
                self._poll(init_run=False)

    def stop(self):
        self._running = False
        print("\n[STOP] \ub9ac\uc2a4\ub108\ub97c \uc885\ub8cc\ud569\ub2c8\ub2e4...")

    def _setup_signal_handler(self):
        def _handler(sig, frame):
            self.stop()
            sys.exit(0)
        signal.signal(signal.SIGINT, _handler)

    def _poll(self, init_run=False):
        """\ud55c \ubc88\uc758 \ud3f4\ub9c1 \uc0ac\uc774\ud074\uc744 \uc2e4\ud589\ud569\ub2c8\ub2e4."""
        now = datetime.now(KST)

        if init_run:
            look_back_seconds = 600
        else:
            look_back_seconds = POLL_INTERVAL_SECONDS * 2

        from_dt = now - timedelta(seconds=look_back_seconds)
        to_dt   = now

        try:
            product_order_ids = fetch_recent_product_order_ids(
                self.token_mgr, from_dt, to_dt
            )
        except Exception as e:
            print("[ERROR] \uc8fc\ubb38 \ubaa9\ub85d \uc870\ud68c \uc2e4\ud328: {}".format(e))
            return

        if not init_run:
            ts_str = now.strftime("%H:%M:%S")
            print("[POLL] {} | \uc870\ud68c: {}\uac74".format(ts_str, len(product_order_ids)), end="")

        new_ids = [pid for pid in product_order_ids if pid not in self._seen_ids]
        self._seen_ids.update(product_order_ids)

        if init_run:
            print("  \u2192 \uae30\uc874 \uc8fc\ubb38 {}\uac74 \ub4f1\ub85d \uc644\ub8cc".format(len(self._seen_ids)))
            return

        if not new_ids:
            print("  \u2192 \uc0c8 \uc8fc\ubb38 \uc5c6\uc74c")
            return

        print("  \u2192 [NEW] \uc0c8 \uc8fc\ubb38 {}\uac74 \ubc1c\uacac!".format(len(new_ids)))

        try:
            orders = fetch_order_details(self.token_mgr, new_ids)
        except Exception as e:
            print("[ERROR] \uc8fc\ubb38 \uc0c1\uc138 \uc870\ud68c \uc2e4\ud328: {}".format(e))
            return

        # \ube44\uc9c0\uc6d0 \ub099 \ud544\ud130\ub9c1
        supported = []
        for order in orders:
            pname = str(order.get("\uc0c1\ud488\uba85", "") or "")
            optv  = str(order.get("\uc635\uc158", "") or "")
            if is_supported_rack(pname, optv):
                supported.append(order)
                # CSV \uc800\uc7a5 (\ud655\uc778\uc6a9, \uc804\uccb4 \ub85c\uc6b0 \ub9e4)
                try:
                    save_order_to_csv(order, self.log_dir)
                except Exception as csv_err:
                    print("[CSV-ERROR] {}".format(csv_err))
            else:
                print("[SKIP] \ube44\uc9c0\uc6d0 \ub099: {}".format(pname[:50]))
                print_new_order(order)  # \ucf58\uc194 \ucd9c\ub825\uc740 \uc720\uc9c0

        if not supported:
            return

        # \ub3d9\uc77c \uc138\uc158 \uae30\uc900 \uadf8\ub8f9\ud551
        groups = group_orders_by_session(supported)
        print("[GROUP] {}\uac74 \u2192 {}\uac1c \uadf8\ub8f9".format(len(supported), len(groups)))

        for group in groups:
            for order in group:
                print_new_order(order)
            self.process_order_group(group)

    def process_order_group(self, group):
        # type: (list) -> None
        """
        \uadf8\ub8f9\ud551\ub41c \uc8fc\ubb38 \ubaa9\ub85d\uc744 document\uc73c\ub85c \uc804\ud658\ud569\ub2c8\ub2e4.

        DRY_RUN=True : print_dry_run()\uc73c\ub85c \ucf58\uc194 \ucd9c\ub825\ub9cc
        DRY_RUN=False: print_dry_run() \ud6c4 save_document_to_server()\ub97c \ud638\ucd9c
        """
        payload = build_grouped_document(group)
        print_dry_run(payload)

        if not DRY_RUN:
            save_document_to_server(payload)



# ═════════════════════════════════════════════════════════════════════════════
# 7. 진입점
# ═════════════════════════════════════════════════════════════════════════════
# NOTE: on_new_order_hook 제거 (2단계).
#   _poll() 내부에서 is_supported_rack 필터 + group_orders_by_session 그룹핑 +
#   process_order_group(DRY-RUN or DB 저장)을 직접 처리하므로 콜백 불필요.

if __name__ == "__main__":
    listener = OrderListener()   # 콜백 없이 실행
    listener.start()

