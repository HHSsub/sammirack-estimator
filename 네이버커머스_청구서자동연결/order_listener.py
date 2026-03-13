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
    ENABLE_PAYLOAD_LOGGING,
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
        "주문번호":     order.get("orderId", ""),      # <--- 추가됨: 상위 장바구니 그룹용 진짜 주문번호
        "상품주문번호": po.get("productOrderId", ""),  # 개별 아이템 키
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

def filter_korean(text):
    # type: (str) -> str
    """한글, 영문, 숫자 및 공백만 남깁니다."""
    if not text: return ""
    return _re.sub(r'[^a-zA-Z0-9\u3131-\u3163\uac00-\ud7a3\s×xX*()./-]', '', str(text))


# ─── DRY_RUN 플래그 ────────────────────────────────────────────────────────
# True : 콘솔 출력만 (DB 저장 안 함)  ← 1단계 기본값
# False: 가비아 서버에 실제 POST       ← 2단계에서 전환
DRY_RUN = False

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
    "스텐랙":   "스텐랙",
    "스텐":     "스텐랙",
}

# ─── 비지원 랙 블랙리스트 (초스피드/실버랙/사이버랙/올스텐랙 등) ────────────
# 이 키워드로 시작하는 주문은 리슨 단계에서 즉시 무시
# 절대 다른 종류로 매핑하거나 분류하지 말 것
UNSUPPORTED_RACK_PREFIXES = [
    "초스피드", "실버랙", "사이버랙", "올스텐랙",
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



def get_rack_type(product_name, option_name=""):
    # type: (str, str) -> str
    """지원 랙의 정규화된 rackType 반환. 비지원이면 빈 문자열.

    ⚠️ 규칙: 상품명에서 가장 먼저(왼쪽) 나오는 랙 종류 이름이 해당 랙.
    뒤에 SEO용으로 다른 랙 이름이 아무리 많아도 무시.
    예) "하이랙 철제선반 앵글 중량랙 경량랙 창고 파렛트랙..." → 하이랙
    예) "파렛트랙 파래트랙 중량랙 창고..." → 파렛트랙
    예) "철제선반 경량랙 수납장 조립식앵글..." → 경량랙
    """
    name = (product_name or "").strip()

    # 상품명에서 각 지원 랙 키워드의 위치를 찾아서 가장 앞에 있는 것 선택
    best_pos = len(name) + 1
    best_type = ""

    for prefix, rack_type in SUPPORTED_RACK_PREFIXES.items():
        pos = name.find(prefix)
        if pos != -1 and pos < best_pos:
            best_pos = pos
            best_type = rack_type

    if not best_type:
        return ""

    combined = name + " " + (option_name or "")

    # ── 하이랙 강제 판별: 하이랙 전용 색상/중량 키워드가 있으면 무조건 하이랙 ──
    # 파렛트랙에는 메트그레이/아이보리(볼트식)/블루+오렌지/270kg/450kg/600kg 없음
    # 파렛트랙은 2t/3t, 색상 없음
    _HIGHRACK_ONLY = ["메트그레이(볼트식)", "아이보리(볼트식)", "블루(기둥)+오렌지",
                      "(볼트식)270kg", "(볼트식)450kg", "(볼트식)600kg"]
    if best_type != "하이랙" and any(k in combined for k in _HIGHRACK_ONLY):
        return "하이랙"

    # 파렛트랙인 경우 철판형 여부 추가 판별
    if best_type == "파렛트랙":
        if any(k in combined for k in ["철판형", "선반형", "700kg", "990kg"]):
            return "파렛트랙 철판형"

    return best_type


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
    반환 키: rack_type_hint, color, width, length, height, dan, size_raw, is_iron, 원본옵션
    """
    if not option_str or option_str == "(옵션없음)":
        return {"원본옵션": option_str or ""}

    result = {"원본옵션": option_str, "is_iron": False}
    if "철판형" in option_str or "선반형" in option_str:
        result["is_iron"] = True

    segments = [s.strip() for s in option_str.split("/")]

    for seg in segments:
        seg = _strip_segment_label(seg)
        if ":" not in seg:
            # 3개 숫자(WxLxH)
            m3 = _re.search(r'(\d+)[^\d]*[xX*][^\d]*(\d+)[^\d]*[xX*][^\d]*(\d+)', seg)
            if m3:
                result["width"] = int(m3.group(1))
                result["length"] = int(m3.group(2))
                result["height"] = int(m3.group(3))
                result["size_raw"] = m3.group(0)
                continue
            # 2개 숫자(WxL)
            m2 = _re.search(r'(\d+)[^\d]*[xX*][^\d]*(\d+)', seg)
            if m2:
                result["width"] = int(m2.group(1))
                result["length"] = int(m2.group(2))
                result["size_raw"] = m2.group(0)
                continue
            continue
            
        colon_idx = seg.index(":")
        raw_key = seg[:colon_idx].strip()
        raw_val = seg[colon_idx + 1:].strip()
        key_lower = raw_key.lower()

        if "색상" in raw_key:
            result["color"] = raw_val
        elif "단수" in raw_key or raw_key == "단":
            result["dan"] = raw_val
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
            # size_raw: 숫자만 추출하여 깨끗한 WxD 형식으로 저장 (한글 제거)
            if len(nums) >= 2:
                result["size_raw"] = "{}x{}".format(nums[0], nums[1])
            elif len(nums) == 1:
                result["size_raw"] = str(nums[0])
            else:
                result["size_raw"] = raw_val
        elif "높이" in raw_key:
            nums = _extract_size_numbers(raw_val)
            if nums:
                result["height"] = nums[0]
            conn = _detect_connection_type(raw_val)
            if conn and "rack_type_hint" not in result:
                result["rack_type_hint"] = conn
        elif "추가" in raw_key or "단추가" in raw_key:
            result["extra_add"] = raw_val
        else:
            result["extra_{}".format(raw_key)] = raw_val

    return result


# ─── 파렛트랙 / 파렛트랙 철판형 size 키 변환 ──────────────────────────────────
# SOURCE OF TRUTH: ProductContext.jsx + bom_data_weight_added.json 기준
# 파렛트랙 (일반):  1390x1000 / 2590x1000 / 2790x1000
# 파렛트랙 철판형:  1390x800 / 1390x1000 / 2590x800 / 2590x1000
#                   + EXTRA: 2090x800 / 2090x1000  (ProductContext EXTRA_OPTIONS)
#
# 스마트스토어 옵션에서 치수 두 숫자(a, b)를 받아서:
#   - 로드빔 길이를 판별 (1390 / 2090 / 2590 / 2790?)
#   - 철판형 여부를 반환

# 로드빔 길이 후보 (허용 오차 ±50mm) - 2090은 철판형 EXTRA_OPTIONS 전용
_PALLET_RODBEAM_CANDIDATES = [1390, 2090, 2590, 2790]
# 타이빔/깊이 후보 (허용 오차 ±50mm)
_PALLET_DEPTH_CANDIDATES = [800, 1000]

def _nearest(val, candidates, tolerance=100):
    # type: (int, list, int) -> int
    """candidates 중 val에 가장 가까운 값 반환. 허용 오차 초과 시 0 반환."""
    best, best_dist = 0, tolerance + 1
    for c in candidates:
        d = abs(val - c)
        if d < best_dist:
            best, best_dist = c, d
    return best if best_dist <= tolerance else 0


def map_pallet_size_key(num_a, num_b, product_name="", option_data=None):
    # type: (int, int, str, dict) -> tuple
    """
    파렛트랙/철판형 스마트스토어 치수 (두 숫자) → 실제 시스템 size 키 + 타입 판정.

    스마트스토어 표기는 폭x깊이 또는 깊이x폭 등 혼재.
    로드빔 길이(1390/2090/2590/2790)가 어느 숫자인지 판별 후 size 키 생성.

    반환: (size_key, is_iron)
      size_key : str  "1390x1000", "2590x800" 등. 매핑 실패 시 ""
      is_iron  : bool True=철판형, False=일반 파렛트랙

    ※ 2090 = 철판형 EXTRA_OPTIONS 전용 (파렛트랙 일반엔 없음)
    ※ 2790 = 파렛트랙 일반만 (철판형 없음)
    ※ 800 깊이 = 철판형만 허용
    """
    a_beam = _nearest(num_a, _PALLET_RODBEAM_CANDIDATES)
    b_depth = _nearest(num_b, _PALLET_DEPTH_CANDIDATES)
    b_beam = _nearest(num_b, _PALLET_RODBEAM_CANDIDATES)
    a_depth = _nearest(num_a, _PALLET_DEPTH_CANDIDATES)

    # 케이스1: a가 로드빔, b가 깊이
    if a_beam and b_depth:
        rod = a_beam
        dep = b_depth
    # 케이스2: b가 로드빔, a가 깊이
    elif b_beam and a_depth:
        rod = b_beam
        dep = a_depth
    else:
        # 매핑 불가
        return ("", False)

    is_iron = "철판" in product_name
    if option_data and option_data.get("is_iron"):
        is_iron = True
        
    # 800 깊이는 철판형만 허용
    if dep == 800:
        is_iron = True
    # 2090은 철판형 EXTRA_OPTIONS 전용
    if rod == 2090 and not is_iron:
        is_iron = True
    # 2790은 파렛트랙 일반만 (철판형 없음)
    if rod == 2790 and is_iron:
        return ("", False)  # 존재하지 않는 조합

    size_key = "{}x{}".format(rod, dep)
    return (size_key, is_iron)


def map_highrack_color(raw_color):
    # type: (str) -> str
    """
    스마트스토어의 잡다한 하이랙 색상(예: 아이보리 200kg, 700kg 등)을
    시스템의 5가지 표준 color 키로 매핑.
    (메트그레이 270/450, 블루오렌지 270/450, 블루오렌지 600kg)
    """
    if not raw_color: return "메트그레이(볼트식)270kg"
    
    raw = str(raw_color).replace(" ", "")
    is_blue_orange = "블루" in raw or "오렌지" in raw
    is_ivory = "아이보리" in raw
    
    # 중량 추출 (숫자만 보고 시스템 표준 중량으로 매핑)
    weight = "270kg"
    if "700" in raw or "600" in raw:
        weight = "600kg"
    elif "450" in raw or "350" in raw:
        weight = "450kg"
    elif "200" in raw or "270" in raw:
        weight = "270kg"
        
    if is_blue_orange:
        # 블루오렌지의 경우 로드빔은 _generate_inventory_part_id에서 별도 처리됨
        return "블루(기둥)+오렌지(가로대)(볼트식){}".format(weight)
    elif is_ivory:
        return "아이보리(볼트식){}".format(weight)
    else:
        # 기타 색상(메트그레이 등)은 전부 메트그레이 통일
        return "메트그레이(볼트식){}".format(weight)


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

    # ① ADDON 키워드 있으면 즉시 addon (단, '추가상품구매'는 제외)
    # '추가상품구매'는 메인 상품명에 자주 포함되는 플레이스홀더임
    addon_check_str = combined.replace("추가상품구매", "")
    for kw in ADDON_KEYWORDS:
        if kw in addon_check_str:
            return "addon"

    # ② 지원 랙 이름으로 시작하면 파싱 없이 바로 main
    for prefix in SUPPORTED_RACK_PREFIXES:
        if product_name.strip().startswith(prefix):
            return "main"

    # ③ 색상 또는 규격(폭) 있으면 main
    parsed = parse_smartstore_option(option_str)
    if (parsed.get("color") or parsed.get("width") or parsed.get("size_raw")):
        return "main"
        
    return "addon"


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
    pname = str(order.get("상품명", "") or "")
    optv  = str(order.get("옵션", "") or "")
    
    rtype  = get_rack_type(pname, optv)
    parsed = parse_smartstore_option(optv)
    
    # 랙 타입별 기본 이름
    base_name = rtype if rtype and rtype != "기타" else pname
    
    # 규격 문자열 구성 (사이즈 -> 높이 -> 단수 순서)
    dims = []
    
    # ── nearest-valid 헬퍼 ──
    def _nearest(val, valid_list):
        return min(valid_list, key=lambda x: abs(x - val))
    
    # 1. 사이즈 (WxD)
    if rtype in ("파렛트랙", "파렛트랙 철판형") and parsed.get("width") and parsed.get("length"):
        size_key, is_iron = map_pallet_size_key(
            parsed["width"], parsed["length"], pname, parsed
        )
        if size_key:
            dims.append(size_key)
            if is_iron and base_name == "파렛트랙":
                base_name = "파렛트랙 철판형"
        else:
            dims.append("{}x{}".format(parsed["width"], parsed["length"]))
    elif parsed.get("width") and parsed.get("length"):
        w = int(parsed["width"])
        d = int(parsed["length"])
        # 하이랙: cm 단위 (45/60 x 108/150/200)
        if rtype == "하이랙":
            w = _nearest(w, [45, 60])
            d = _nearest(d, [108, 150, 200])
        # 경량랙: SS는 depth x width (cm), 유효값은 mm
        elif rtype == "경량랙":
            d_mm = _nearest(w * 10, [300, 450, 600])
            w_mm = _nearest(d * 10, [700, 900, 1000, 1200, 1500])
            w = d_mm // 10
            d = w_mm // 10
        # 중량랙: SS는 depth x width (cm), 유효값은 mm
        elif rtype == "중량랙":
            d_mm = _nearest(w * 10, [450, 600, 900])
            w_mm = _nearest(d * 10, [900, 1200, 1500, 1800])
            w = d_mm // 10
            d = w_mm // 10
        dims.append("{}x{}".format(w, d))
    elif parsed.get("size_raw"):
        dims.append(parsed["size_raw"])
        
    # 2. 높이
    if parsed.get("height"):
        dims.append(str(parsed["height"]))
        
    # 3. 단수
    if parsed.get("dan"):
        dan_val = str(parsed["dan"])
        m = _re.search(r'(\d+)', dan_val)
        dims.append("{}단".format(m.group(1)) if m else dan_val)
        
    spec_str = " ".join(dims)
    full_name = filter_korean("{} {}".format(base_name, spec_str).strip())
    
    # 4. 옵션 (색상/중량)
    if rtype == "하이랙" and parsed.get("color"):
        full_name += " " + map_highrack_color(parsed["color"])
    elif parsed.get("color"):
        full_name += " " + parsed["color"]
        
    # 최소한의 이름 보장 (내용이 너무 없으면 상품명 반환)
    if len(full_name) < len(base_name) + 2:
        return pname
        
    return full_name


def build_material_item(order, main_rack_type=""):
    # type: (dict, str) -> dict
    """
    추가부품(addon) 주문 1행 → materials[] 한 행.
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

    # 괄호 안 텍스트에서 부품명 추출
    m = _re.search(r'[（(]([^）)]+)[）)]', product_name)
    mat_name = m.group(1) if m else product_name

    # 규격: 옵션(더 상세함) -> 상품명 순으로 숫자×숫자(×숫자) 추출
    # 80x206 600kg 같은 경우 600이 3번째 숫자로 잡히지 않도록 구분자(x, X, *, ×)를 명시
    dim_pattern = r'(\d+)\s*[xX×*]\s*(\d+)(?:\s*[xX×*]\s*(\d+))?'
    m2 = _re.search(dim_pattern, option_str)
    if not m2:
        m2 = _re.search(dim_pattern, product_name)
    
    if m2:
        if m2.group(3):
            spec = "{}x{}x{}".format(m2.group(1), m2.group(2), m2.group(3))
        else:
            spec = "{}x{}".format(m2.group(1), m2.group(2))
    else:
        spec = product_name

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

    # 하이랙인 경우 색상/중량 추출
    cw = ""
    color = ""
    if main_rack_type == "하이랙":
        combined = product_name + " " + option_str
        cw = map_highrack_color(combined)
        
    return {
        "name":          mat_name,
        "rackType":      main_rack_type,
        "specification": spec,
        "quantity":      qty,
        "unitPrice":     unit_price,
        "totalPrice":    total,
        "note":          "",
        "colorWeight":   cw,
        "color":         color
    }


# ── BOM 재생성 로직 (React regenerateBOMFromOptions 100% 재현) ───────────────

def _parse_wd(size_str):
    # type: (str) -> Tuple[Optional[int], Optional[int]]
    """숫자xD 형식에서 w, d 추출. 한글 섞여 있어도 숫자만 추출."""
    if not size_str: return None, None
    # 무게 표기(예: 3000kg, 2000Kg) 먼저 제거
    s = _re.sub(r'\d+\s*[kK][gG]', '', str(size_str))
    # 한글 등 제거하고 숫자와 구분자만 남기기
    cleaned = _re.sub(r'[^\d.xX*×]', '', s)
    m = _re.search(r'(\d+)\s*[xX*×]\s*(\d+)', cleaned)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    # fallback: 원본에서 시도
    m = _re.search(r'(\d+)[^\d]*[xX*×][^\d]*(\d+)', str(size_str))
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)

def _parse_level(dan_str):
    # type: (str) -> int
    m = _re.search(r'(\d+)', str(dan_str or ""))
    return int(m.group(1)) if m else 1


# ── admin_prices.json 캐시 ────────────────────────────────────────────────────
_ADMIN_PRICES_CACHE = None  # type: Optional[dict]

def _load_admin_prices_cache():
    # type: () -> dict
    """admin_prices.json을 1회만 로드하여 {part_id: price} 딕셔너리 반환."""
    global _ADMIN_PRICES_CACHE
    if _ADMIN_PRICES_CACHE is not None:
        return _ADMIN_PRICES_CACHE
    # 프로젝트 루트의 admin_prices.json 경로
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base, "admin_prices.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        # admin_prices.json은 part_id를 키로 하는 dict
        if isinstance(raw, dict):
            _ADMIN_PRICES_CACHE = raw
        elif isinstance(raw, list):
            # [{part_id, price, ...}, ...] 형식인 경우
            _ADMIN_PRICES_CACHE = {}
            for item in raw:
                pid = item.get("part_id") or item.get("partId") or ""
                if pid:
                    _ADMIN_PRICES_CACHE[pid] = item
        else:
            _ADMIN_PRICES_CACHE = {}
    except Exception as e:
        print("[WARN] admin_prices.json 로드 실패: {}".format(e))
        _ADMIN_PRICES_CACHE = {}
    return _ADMIN_PRICES_CACHE


def _lookup_admin_price(part_id):
    # type: (str) -> int
    """part_id로 admin_prices에서 가격 조회. 없으면 0."""
    cache = _load_admin_prices_cache()
    entry = cache.get(part_id)
    if entry is None:
        return 0
    if isinstance(entry, dict):
        return int(entry.get("price", 0) or 0)
    if isinstance(entry, (int, float)):
        return int(entry)
    return 0


# ── partId / inventoryPartId 생성 (JS generateInventoryPartId 재현) ──────────

def _generate_part_id(rack_type, name, specification):
    # type: (str, str, str) -> str
    """JS generatePartId 재현: '{rackType}-{name}-{spec}' (소문자, 공백제거)."""
    clean_name = _re.sub(r'\s+', '', str(name)).replace('*', 'x')
    clean_name = _re.sub(r'[()]', '', clean_name).lower()
    clean_spec = _re.sub(r'\s+', '', str(specification or '')).replace('*', 'x').lower()
    return "{}-{}-{}".format(rack_type, clean_name, clean_spec)


def _generate_inventory_part_id(rack_type, name, specification, color="", color_weight="", version=""):
    # type: (str, str, str, str, str, str) -> str
    """
    JS generateInventoryPartId 100% 재현.
    재고 관리용 ID 생성 (색상 포함).
    """
    rt = str(rack_type)

    # 파렛트랙 + 신형 → 파렛트랙신형
    if rt == "파렛트랙" and version == "신형":
        rt = "파렛트랙신형"

    clean_name = _re.sub(r'\s+', '', str(name)).replace('*', 'x')

    def _snap_dimension(val_str, standards, tolerance=10):
        try:
            num_str = _re.sub(r'\D', '', val_str)
            if not num_str: return val_str
            val = int(num_str)
            best_match = val_str
            min_diff = tolerance + 1
            for s in standards:
                diff = abs(s - val)
                if diff < min_diff:
                    min_diff = diff
                    best_match = str(s)
            return best_match
        except:
            return val_str

    HI_D = [45, 60, 80]
    HI_W = [108, 150, 200]
    HI_H = [150, 200, 250]

    # ── 하이랙 전용 처리 ──
    if rt == "하이랙":
        # 기본 부품명 추출
        if "기둥" in clean_name:
            base_name = "기둥"
        elif "선반" in clean_name:
            base_name = "선반"
        elif "로드빔" in clean_name:
            base_name = "로드빔"
        else:
            base_name = clean_name

        # 색상+속성 결정
        target_str = clean_name + str(color or '') + str(color_weight or '')
        color_attr = ""
        if "아이보리" in target_str:
            color_attr = "아이보리(볼트식)"
        elif "메트그레이" in target_str or "매트그레이" in target_str:
            color_attr = "메트그레이(볼트식)"
        elif "블루" in target_str or "오렌지" in target_str:
            if (base_name == "로드빔" or "빔" in target_str) and "600kg" in target_str:
                color_attr = "블루(기둥.선반)+오렌지(빔)"
            else:
                color_attr = "블루(기둥)+오렌지(가로대)(볼트식)"

        # 중량 추출 (기본 270kg)
        # 중요: clean_name뿐만 아니라 specification, color, color_weight 전체에서 중량 검색
        weight_attr = "270kg"
        search_target = clean_name + str(specification or '') + str(color or '') + str(color_weight or '')
        if "450kg" in search_target:
            weight_attr = "450kg"
        elif "600kg" in search_target:
            weight_attr = "600kg"
        elif "270kg" in search_target:
            weight_attr = "270kg"

        # 규격 처리
        clean_spec = _re.sub(r'\s+', '', str(specification or '')).replace('*', 'x')
        clean_spec = _re.sub(r'(270|450|600)kg', '', clean_spec)  # 중량 중복 제거

        if base_name == "기둥":
            # 하이랙 기둥 인벤토리 규격: '사이즈{폭}x높이{높이}{중량}'
            # clean_spec에서 숫자만 추출하여 폭과 높이를 스냅
            nums = _re.findall(r'(\d+)', clean_spec)
            if len(nums) >= 3:
                # DxWxH -> 첫번째가 폭(45,60,80), 세번째가 높이 (가운데 width는 무시)
                width_part = _snap_dimension(nums[0], HI_D, tolerance=20)
                height_part = _snap_dimension(nums[2], HI_H, tolerance=50)
            elif len(nums) == 2:
                # WxH (Addon) -> 첫번째가 폭(깊이), 두번째가 높이
                width_part = _snap_dimension(nums[0], HI_D, tolerance=20)
                height_part = _snap_dimension(nums[1], HI_H, tolerance=50)
            else:
                # 숫자가 하나만 있으면 높이로 간주하고 폭은 기본값 60
                width_part = '60'
                height_part = _snap_dimension(nums[0] if nums else '150', HI_H, tolerance=50)
            
            final_spec = "사이즈{}x높이{}{}".format(width_part, height_part, weight_attr)
        elif base_name == "선반":
            m = _re.search(r'(\d+)x(\d+)', clean_spec)
            if m:
                d_part = _snap_dimension(m.group(1), HI_D)
                w_part = _snap_dimension(m.group(2), HI_W)
                size_part = "{}x{}".format(d_part, w_part)
            else:
                sm = _re.search(r'(\d+)', clean_spec)
                size_part = sm.group(1) if sm else '45x108'
            final_spec = "사이즈{}{}".format(size_part, weight_attr)
        elif base_name == "로드빔":
            lm = _re.search(r'(\d+)', clean_spec)
            length_part = _snap_dimension(lm.group(1) if lm else '108', HI_W)
            final_spec = "{}{}".format(length_part, weight_attr)
        else:
            final_spec = clean_spec

        return "하이랙-{}{}{}-{}".format(base_name, color_attr, weight_attr, final_spec)

    # ── 경량랙: color가 있으면 이름에 포함 ──
    clean_name_lower = clean_name.lower()
    if rt == "경량랙" and color:
        clean_color = _re.sub(r'\s+', '', str(color)).lower()
        clean_name_lower = "{}{}".format(clean_name_lower, clean_color)

    # ── 하이랙 외 일반 처리 ──
    clean_name_lower = _re.sub(r'[()]', '', clean_name_lower)
    clean_spec = _re.sub(r'\s+', '', str(specification or '')).replace('*', 'x').lower()
    return "{}-{}-{}".format(rt, clean_name_lower, clean_spec)


def _extract_weight_from_color(color_str):
    # type: (str) -> str
    """색상 문자열에서 중량만 추출. 예: 메트그레이(볼트식)270kg → 270kg"""
    m = _re.search(r'(\d{2,4}kg)', str(color_str or ''), _re.IGNORECASE)
    return m.group(1) if m else ""


def generate_bom_for_rack(rack_type, option_data, quantity):
    # type: (str, dict, int) -> List[dict]
    """
    rack_type과 옵션을 기반으로 실제 자재 명세(BOM)를 생성합니다.
    React의 bomRegeneration.js 로직을 100% 구현합니다.

    각 material에 다음 필드를 포함합니다:
      name, rackType, specification, quantity, unitPrice, totalPrice, note,
      colorWeight, color, partId, _inventoryPartId, _inventoryList
    """
    qty = int(quantity)
    res = []

    sz = option_data.get("size_raw", "")
    # "추가상품구매" 등의 플레이스홀더 처리
    if sz and "추가" in sz:
        sz = ""
    
    w, d = _parse_wd(sz)
    ht_raw = str(option_data.get("height", ""))
    if "추가" in ht_raw:
        ht_raw = ""
        
    dan = _parse_level(option_data.get("dan", "1"))
    form = option_data.get("rack_type_hint", "독립형")
    color = option_data.get("color", "")

    # ═══ 하이랙 ═══════════════════════════════════════════════════════════════
    # 하이랙 SS 옵션: 선반(폭cm+가로cm)x기둥(높이cm): 60(폭)x108(가로)x200(높이)
    # → w=폭(깊이), d=가로(로드빔 길이cm), h=높이
    # 시스템 키: 기둥 → 사이즈{w}x{d}높이{h}{weight}, 선반 → 사이즈{w}x{d}{weight}, 로드빔 → {d}{weight}
    if rack_type == "하이랙":
        cw = map_highrack_color(color)  # 예: 메트그레이(볼트식)270kg
        weight_only = _extract_weight_from_color(cw)
        pillar_qty = (2 if form == "연결형" else 4) * qty
        rod_beam_d = str(d) if d else ""  # d = 가로cm (로드빔 길이)
        shelf_per_level = 2 if d in (150, 200) else 1

        # 기둥: 사이즈{w}x{d}높이{h}{weight}
        if w and d:
            g_spec = "사이즈 {}x{}높이{} {}".format(w, d, ht_raw, weight_only).strip()
        else:
            g_spec = "높이 {} {}".format(ht_raw, weight_only).strip()
        res.append({"name": "기둥", "rackType": rack_type, "specification": g_spec,
                    "quantity": pillar_qty, "colorWeight": cw, "color": ""})
        # 로드빔: {d}{weight}
        r_spec = "{} {}".format(rod_beam_d, weight_only).strip() if rod_beam_d else weight_only
        res.append({"name": "로드빔", "rackType": rack_type, "specification": r_spec,
                    "quantity": 2 * dan * qty, "colorWeight": cw, "color": ""})
        # 선반: 사이즈{w}x{d}{weight}
        if w and d:
            s_spec = "사이즈 {}x{} {}".format(w, d, weight_only).strip()
        else:
            s_spec = "사이즈 {} {}".format(sz, weight_only).strip() if sz else weight_only
        res.append({"name": "선반", "rackType": rack_type, "specification": s_spec,
                    "quantity": shelf_per_level * dan * qty, "colorWeight": cw, "color": ""})

    # ═══ 파렛트랙 / 파렛트랙 철판형 ══════════════════════════════════════════
    # 파렛트랙 SS 옵션: 폭x길이(단당2000Kg): 1000x1480(연결형)2000kg
    # → w=폭(깊이=1000mm), d=길이(로드빔 길이mm)
    # 시스템: 로드빔 spec = d(1390/2590/2790), 타이빔 = 1000(깊이 고정), 브레싱 = 1000
    elif rack_type in ("파렛트랙", "파렛트랙 철판형"):
        is_iron = (rack_type == "파렛트랙 철판형")
        post_qty = (2 if form == "연결형" else 4) * qty

        # 파렛트랙 기둥 높이: 이미 mm 단위 (3000, 2000 등)
        ht_mm = ht_raw
        try:
            ht_num = int(ht_raw)
            if ht_num <= 600:  # 600 이하이면 cm로 간주 → mm 변환
                ht_mm = str(ht_num * 10)
        except (ValueError, TypeError):
            pass

        # 파렛트랙 로드빔 길이 = d (SS의 길이/가로 값)
        # SS 1480 → 시스템 1390 매핑 (가장 가까운 유효 규격)
        VALID_RODBEAM = [1390, 2090, 2590, 2790]
        rod_len = d if d else 0
        if rod_len > 0:
            rod_len = min(VALID_RODBEAM, key=lambda x: abs(x - rod_len))
        rod_spec = str(rod_len) if rod_len else ""

        # 파렛트랙 깊이 = w (SS의 폭 값, 보통 1000)
        depth_val = w if w else 1000

        # 기둥
        res.append({"name": "기둥", "rackType": rack_type, "specification": ht_mm,
                    "quantity": post_qty, "colorWeight": "", "color": ""})
        # 로드빔
        res.append({"name": "로드빔", "rackType": rack_type, "specification": rod_spec,
                    "quantity": 2 * dan * qty, "colorWeight": "", "color": ""})

        if is_iron:
            # 철판 선반: 사이즈 {로드빔}x{깊이}
            shelf_per_level = 2 if rod_len in (1380, 1390) else (3 if rod_len in (2080, 2090) else (4 if rod_len in (2580, 2590, 2710, 2790) else 1))
            iron_sz = "사이즈 {}x{}".format(rod_len, depth_val)
            res.append({"name": "선반", "rackType": rack_type, "specification": iron_sz,
                        "quantity": shelf_per_level * dan * qty, "colorWeight": "", "color": ""})
        else:
            # 타이빔: 깊이 (항상 1000)
            tie_spec = str(depth_val)
            res.append({"name": "타이빔", "rackType": rack_type, "specification": tie_spec,
                        "quantity": 2 * dan * qty, "colorWeight": "", "color": ""})

        # 안전핀
        res.append({"name": "안전핀", "rackType": rack_type, "specification": "",
                    "quantity": 2 * dan * 2 * qty, "colorWeight": "", "color": ""})
        # 하드웨어: 브레싱 spec은 깊이 (1000)
        brace_spec = str(depth_val)
        res.append({"name": "수평브레싱", "rackType": rack_type, "specification": brace_spec,
                    "quantity": (2 if form == "연결형" else 4) * qty, "colorWeight": "", "color": ""})
        res.append({"name": "경사브레싱", "rackType": rack_type, "specification": brace_spec,
                    "quantity": (2 if form == "연결형" else 4) * qty, "colorWeight": "", "color": ""})
        res.append({"name": "앙카볼트", "rackType": rack_type, "specification": "",
                    "quantity": (2 if form == "연결형" else 4) * qty, "colorWeight": "", "color": ""})
        res.append({"name": "브레싱볼트", "rackType": rack_type, "specification": "",
                    "quantity": post_qty * 3, "colorWeight": "", "color": ""})

    # ═══ 스텐랙 ══════════════════════════════════════════════════════════════
    # 스텐랙 SS: "스텐선반추가(단위cm) 폭x길이: 50x180" → height는 별도 또는 기본 210
    elif rack_type == "스텐랙":
        # 높이가 없으면 기본값 210 (SOURCE_OF_TRUTH: EXTRA_OPTIONS 고정)
        ht_val = ht_raw if ht_raw and ht_raw != "None" else "210"
        ht_spec = "높이{}".format(ht_val)
        # 선반 사이즈: WxD 형식
        sz_spec = "사이즈{}".format(sz) if sz else ""
        res.append({"name": "기둥", "rackType": rack_type, "specification": ht_spec,
                    "quantity": 4 * qty, "colorWeight": "", "color": ""})
        res.append({"name": "선반", "rackType": rack_type, "specification": sz_spec,
                    "quantity": dan * qty, "colorWeight": "", "color": ""})

    # ═══ 경량랙 / 중량랙 ═════════════════════════════════════════════════════
    # 경량랙 SS: "색상: 블랙 / 규격: 30x75 / 높이: 75 / 단수: 2단"
    #   → SS '규격: 30x75' = 폭(앞뒤=깊이)x가로(좌우=폭).
    #   → 30cm = depth(D300), 75cm = width(W700에 가장 가까운 유효값)
    # 중량랙 SS: "폭(앞뒤)x가로(좌우): 45x185"
    #   → 45cm = depth(D450), 185cm = width(W1800에 가장 가까운)
    # 공통: SS의 첫번째 숫자 = depth, 두번째 = width
    elif rack_type in ("경량랙", "중량랙"):
        post_qty = (2 if form == "연결형" else 4) * qty

        # ⚠️ w, d 반전: SS의 parse결과 w=첫째(깊이), d=둘째(폭/가로)
        ss_depth_cm = w   # SS 첫번째 숫자 = 깊이(앞뒤)
        ss_width_cm = d   # SS 두번째 숫자 = 폭(좌우/가로)

        # cm → mm 변환
        if rack_type == "경량랙":
            depth_mm = ss_depth_cm * 10 if ss_depth_cm and ss_depth_cm <= 200 else (ss_depth_cm or 0)
            width_mm = ss_width_cm * 10 if ss_width_cm and ss_width_cm <= 200 else (ss_width_cm or 0)
            # 유효 규격 매핑
            VALID_W_LIGHT = [700, 900, 1000, 1200, 1500]
            VALID_D_LIGHT = [300, 450, 600]
            if width_mm > 0:
                width_mm = min(VALID_W_LIGHT, key=lambda x: abs(x - width_mm))
            if depth_mm > 0:
                depth_mm = min(VALID_D_LIGHT, key=lambda x: abs(x - depth_mm))
        else:  # 중량랙
            depth_mm = ss_depth_cm * 10 if ss_depth_cm and ss_depth_cm <= 200 else (ss_depth_cm or 0)
            width_mm = ss_width_cm * 10 if ss_width_cm and ss_width_cm <= 200 else (ss_width_cm or 0)
            VALID_W_HEAVY = [900, 1200, 1500, 1800]
            VALID_D_HEAVY = [450, 600, 900]
            if width_mm > 0:
                width_mm = min(VALID_W_HEAVY, key=lambda x: abs(x - width_mm))
            if depth_mm > 0:
                depth_mm = min(VALID_D_HEAVY, key=lambda x: abs(x - depth_mm))

        # 경량랙 색상 추출 (아이보리/블랙/실버)
        rack_color = ""
        if rack_type == "경량랙" and color:
            raw_c = str(color).replace(" ", "")
            if "블랙" in raw_c or "검정" in raw_c:
                rack_color = "블랙"
            elif "실버" in raw_c or "은색" in raw_c:
                rack_color = "실버"
            elif "아이보리" in raw_c or "백색" in raw_c or "흰" in raw_c:
                rack_color = "아이보리"

        # 기둥 spec: h{height_mm}
        ht_mm_val = ht_raw
        try:
            ht_num = int(ht_raw)
            if ht_num <= 300:
                ht_mm_val = str(ht_num * 10)
        except (ValueError, TypeError):
            pass
        g_spec = "h{}".format(ht_mm_val) if ht_mm_val else ""
        res.append({"name": "기둥", "rackType": rack_type, "specification": g_spec,
                    "quantity": post_qty, "colorWeight": "", "color": rack_color})

        # 선반 spec: w{width}xd{depth}
        if width_mm and depth_mm:
            sel_spec = "w{}xd{}".format(width_mm, depth_mm)
        else:
            sel_spec = sz
        res.append({"name": "선반", "rackType": rack_type, "specification": sel_spec,
                    "quantity": dan * qty, "colorWeight": "", "color": rack_color})

        # 받침(상/하) spec: d{depth_mm}
        depth_spec = "d{}".format(depth_mm) if depth_mm else ""
        res.append({"name": "받침(상)", "rackType": rack_type, "specification": depth_spec,
                    "quantity": post_qty, "colorWeight": "", "color": rack_color})
        res.append({"name": "받침(하)", "rackType": rack_type, "specification": depth_spec,
                    "quantity": post_qty, "colorWeight": "", "color": rack_color})

        # 연결대 spec: w{width_mm}
        width_spec = "w{}".format(width_mm) if width_mm else ""
        res.append({"name": "연결대", "rackType": rack_type, "specification": width_spec,
                    "quantity": dan * qty, "colorWeight": "", "color": rack_color})

        # 안전좌 / 안전핀
        res.append({"name": "안전좌", "rackType": rack_type, "specification": "",
                    "quantity": dan * qty, "colorWeight": "", "color": ""})
        res.append({"name": "안전핀", "rackType": rack_type, "specification": "",
                    "quantity": dan * qty, "colorWeight": "", "color": ""})

    # ─── 모든 자재에 대해 공통 ID 및 단가 로드 (ID 생성 필수) ───
    for r in res:
        rt = r["rackType"]
        nm = r["name"]
        sp = r.get("specification", "")
        cl = r.get("color", "")
        cw = r.get("colorWeight", "")

        version = "신형" if rt == "파렛트랙" else ""

        r["partId"] = _generate_part_id(rt, nm, sp)
        # _inventoryPartId 생성 (매우 중요: 테스트 코드 및 재고 연동 필수)
        r["_inventoryPartId"] = _generate_inventory_part_id(
            rt, nm, sp, color=cl, color_weight=cw, version=version
        )
        r["inventoryPartId"] = r["_inventoryPartId"]
        
        # _inventoryList (React 호환)
        r["_inventoryList"] = [{
            "inventoryPartId": r["_inventoryPartId"],
            "quantity": r["quantity"],
            "colorWeight": cw,
            "color": cl,
            "specification": sp,
            "rackType": rt,
            "name": nm,
            "version": version
        }]

        # admin_prices에서 가격 조회
        if not r.get("unitPrice"):
            price = _lookup_admin_price(r["partId"])
            if not price:
                price = _lookup_admin_price(r["_inventoryPartId"])
            r["unitPrice"] = price
            r["totalPrice"] = price * r["quantity"]

    return res


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

    # 세션의 대표 랙 타입 결정
    session_rack_type = ""
    if mains:
        session_rack_type = get_rack_type(mains[0].get("상품명", ""), mains[0].get("옵션", ""))
    elif addons:
        # 메인 상품 없이 추가상품만 있는 경우, 첫 번째 항목에서 랙 타입을 유추
        for r in addons:
            session_rack_type = get_rack_type(r.get("상품명", ""), r.get("옵션", ""))
            if session_rack_type: break

    # items[] 및 materials[](BOM) 생성
    items = []
    materials = []
    
    # 메인 랙 처리 (있는 경우에만)
    for r in mains:
        pname = str(r.get("상품명", "") or "")
        optv  = str(r.get("옵션", "") or "")
        qty   = _safe_int(r.get("주문수량", 1)) or 1
        total = _safe_int(r.get("최종금액", 0))
        
        # 1. 항목명 생성
        display_name = build_item_name(r)
        parsed = parse_smartstore_option(optv)
        rtype = get_rack_type(pname, optv)
        
        items.append({
            "name":       display_name,
            "unit":       "개",
            "quantity":   qty,
            "unitPrice":  total // qty if qty else total,
            "totalPrice": total,
            "note":       optv,
        })
        
        # 2. 메인 랙의 BOM 생성하여 materials에 합산
        if rtype and rtype != "기타":
            rack_bom = generate_bom_for_rack(rtype, parsed, qty)
            materials.extend(rack_bom)

    # 3. 추가부품(addons) 주문을 materials에 합산
    for r in addons:
        materials.append(build_material_item(r, session_rack_type))

    # 4. materials 중복 제거 및 수량 합산 (자재명 + 규격 + 색상 기준)
    merged_mats = {}
    for m in materials:
        key = (m["name"], m.get("rackType", ""), m.get("specification", ""), m.get("colorWeight", ""), m.get("color", ""))
        if key in merged_mats:
            merged_mats[key]["quantity"] += m["quantity"]
            # totalPrice는 나중에 재조회된 단가로 갱신할 수 있으나 일단 합산
            merged_mats[key]["totalPrice"] = merged_mats[key].get("totalPrice", 0) + m.get("totalPrice", 0)
        else:
            merged_mats[key] = m
            
    materials = sorted(merged_mats.values(), key=lambda x: (x.get("rackType", ""), x["name"]))

    # 5. 모든 자재에 대해 공통 ID 및 단가 로드
    for r in materials:
        rt = r["rackType"]
        nm = r["name"]
        sp = r.get("specification", "")
        cl = r.get("color", "")
        cw = r.get("colorWeight", "")

        # 파렛트랙은 SS 기본 신형
        version = "신형" if rt == "파렛트랙" else ""

        r["partId"] = _generate_part_id(rt, nm, sp)
        r["_inventoryPartId"] = _generate_inventory_part_id(
            rt, nm, sp, color=cl, color_weight=cw, version=version
        )
        r["inventoryPartId"] = r["_inventoryPartId"]
        
        # _inventoryList (React 호환)
        r["_inventoryList"] = [{
            "inventoryPartId": r["_inventoryPartId"],
            "quantity": r["quantity"],
            "colorWeight": cw,
            "color": cl,
            "specification": sp,
            "rackType": rt,
            "name": nm,
            "version": version
        }]

        # admin_prices에서 가격 조회 (이미 있으면(addon) 유지하되 없으면 조회)
        if not r.get("unitPrice"):
            price = _lookup_admin_price(r["partId"])
            if not price:
                price = _lookup_admin_price(r["_inventoryPartId"])
            r["unitPrice"] = price
            r["totalPrice"] = price * r["quantity"]

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
    
    # 상호명: 구매자명 우선, 비어있으면 수취인명
    buyer_name = str(first.get("구매자명", "") or "").strip()
    recipient_name = str(first.get("수취인명", "") or "").strip()
    company = buyer_name if buyer_name else recipient_name

    # 메모: 배송지, 연락처 정보를 메모칸으로 이동
    memo_str = "배송지: {} | 연락처: {}".format(
        str(first.get("배송지", "") or ""),
        str(first.get("연락처", "") or ""),
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
        "notes":           "", # 비고칸은 비움 (메모로 이동됨)
        "top_memo":        memo_str,
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
        "topMemo":         memo_str,
        "purchaseNumber":  doc_num,
        "customerName":    company,
        "status":          "진행 중",
        "isSmartstore":    True,
        "createdAt":       now_iso,
        "updatedAt":       now_iso,
        # ── 디버깅 메타 (저장 시 제외) ───────────────────────
        "_group_size":     len(group_sorted),
        "_buyer":          str(first.get("구매자명", "") or ""),
        "_mains_count":    len(mains),
        "_addons_count":   len(addons),
        "_rack_type":      session_rack_type,
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


def save_payload_to_log(payload, log_dir):
    # type: (dict, str) -> None
    """생성된 최종 JSON 페이로드를 분석용 로그 파일에 기록합니다 (ENABLE_PAYLOAD_LOGGING=True 시)."""
    log_path = os.path.join(log_dir, "payload_history.jsonl")
    
    # 저장 시각 추가
    log_entry = {
        "logged_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "payload": payload
    }
    
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")


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
        
        # 분석용 페이로드 로그 파일 미리 생성 (tail 에러 방지)
        if globals().get("ENABLE_PAYLOAD_LOGGING", False):
            payload_log = os.path.join(self.log_dir, "payload_history.jsonl")
            if not os.path.exists(payload_log):
                with open(payload_log, "a") as f:
                    pass

    def start(self):
        """리스너를 시작합니다. Ctrl+C로 종료."""
        self._running = True
        self._setup_signal_handler()

        print()
        print("=" * 62)
        print("  삼미랙 스마트스토어 실시간 주문 리스너 시작")
        print("  폴링 주기: {}초".format(POLL_INTERVAL_SECONDS))
        print("  모드: {}".format("[DRY-RUN] 콘솔 출력만 (DB 저장 안 함)" if DRY_RUN else "[LIVE] 실제 DB 저장 활성"))
        if USE_PROXY:
            print("  프록시: 사용 중 ({})".format(PROXIES.get("https", "")))
        else:
            print("  프록시: 미사용 (서버 직접 요청)")
        print("  sammirack API: {}".format(SAMMIRACK_SERVER_URL))
        print("  종료: Ctrl+C")
        print("=" * 62)
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
            print("[ERROR] 주문 목록 조회 실패: {}".format(e))
            return

        if not init_run:
            ts_str = now.strftime("%H:%M:%S")
            print("[POLL] {} | 조회: {}건".format(ts_str, len(product_order_ids)))
            sys.stdout.flush()

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

        # 비지원 랙 필터링
        supported = []
        for order in orders:
            pname = str(order.get("상품명", "") or "")
            optv  = str(order.get("옵션", "") or "")
            if is_supported_rack(pname, optv):
                supported.append(order)
                # CSV 저장 (확인용, 전체 로우 매)
                try:
                    save_order_to_csv(order, self.log_dir)
                except Exception as csv_err:
                    print("[CSV-ERROR] {}".format(csv_err))
            else:
                print("[SKIP] 비지원 랙: {}".format(pname[:50]))
                print_new_order(order)  # 콘솔 출력은 유지

        if not supported:
            return

        # 동일 세션 기준 그룹핑
        groups = group_orders_by_session(supported)
        print("[GROUP] {}건 → {}개 그룹".format(len(supported), len(groups)))

        for group in groups:
            for order in group:
                print_new_order(order)
            self.process_order_group(group)

    def process_order_group(self, group):
        # type: (list) -> None
        """
        그룹핑된 주문 목록을 document로 전환합니다.
        
        DRY_RUN=True : print_dry_run()으로 콘솔 출력만
        DRY_RUN=False: print_dry_run() 후 save_document_to_server()를 호출
        """
        payload = build_grouped_document(group)
        print_dry_run(payload)
        sys.stdout.flush() # PM2 실시간 출력을 위해 강제 플러시

        # 분석용 페이로드 로깅 (설정 시)
        if globals().get("ENABLE_PAYLOAD_LOGGING", False):
            try:
                # self.log_dir 접근을 위해 OrderListener 컨텍스트 필요하나, 
                # 여기서는 간단히 현재 파일 기준 order_logs 사용
                base_dir = os.path.dirname(os.path.abspath(__file__))
                log_dir = os.path.join(base_dir, "order_logs")
                save_payload_to_log(payload, log_dir)
            except Exception as e:
                print("[LOG-ERROR] 페이로드 로깅 실패: {}".format(e))

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

