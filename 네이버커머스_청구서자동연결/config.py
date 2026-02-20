# config.py
# 네이버 커머스 API 인증/엔드포인트 설정 파일

CLIENT_ID = "4RVwBrPGiSldwEpkk1XosY"        # 애플리케이션 ID
CLIENT_SECRET = "$2a$04$btKPg5JExcAL3sZDX0dznO"  # 애플리케이션 시크릿

# 토큰 발급 URL (공식 문서 기준)
TOKEN_URL = "https://api.commerce.naver.com/external/v1/oauth2/token"

# 주문 조회 베이스 URL
API_BASE_URL = "https://api.commerce.naver.com"

# 기본 타임존: 한국(KST, UTC+9)
KST_OFFSET_HOURS = 9

# ====================================
# 프록시 서버 설정
# ====================================
PROXY_HOST = "139.150.11.53"
PROXY_PORT = 3128  # Squid 기본 포트 (실제 포트로 변경 필요)

# 프록시 인증이 필요 없는 경우
PROXIES = {
    'http': f'http://{PROXY_HOST}:{PROXY_PORT}',
    'https': f'http://{PROXY_HOST}:{PROXY_PORT}'
}

# 프록시 인증이 필요한 경우 (아래 주석 해제 후 사용)
# PROXY_USERNAME = "username"
# PROXY_PASSWORD = "password"
# PROXIES = {
#     'http': f'http://{PROXY_USERNAME}:{PROXY_PASSWORD}@{PROXY_HOST}:{PROXY_PORT}',
#     'https': f'http://{PROXY_USERNAME}:{PROXY_PASSWORD}@{PROXY_HOST}:{PROXY_PORT}'
# }

# ====================================
# 실행 환경에 따라 USE_PROXY 설정
# ====================================
#
# [로컬 PC에서 실행할 때]
#   USE_PROXY = True   ← 로컬에서는 가비아 프록시를 경유해야 함
#
# [가비아 서버(139.150.11.53)에서 실행할 때]
#   USE_PROXY = False  ← 서버 자체가 프록시이므로 직접 요청
#
USE_PROXY = False  # ← 가비아 서버에서 실행 시 False

# ====================================
# 실시간 주문 리스너 설정
# ====================================
# 폴링 주기 (초) - 매 N초마다 새 주문 확인
POLL_INTERVAL_SECONDS = 30

# 토큰 갱신 여유 시간 (초) - 만료 N초 전에 미리 재발급
TOKEN_REFRESH_BUFFER_SECONDS = 300  # 5분 여유

# 토큰 유효 시간 (초) - 네이버 커머스 API 기준 3시간
TOKEN_EXPIRES_IN_SECONDS = 10800  # 3시간 = 3 * 60 * 60
