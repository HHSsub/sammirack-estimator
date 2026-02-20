# config.py
# 네이버 커머스 API 인증/엔드포인트 설정 파일

CLIENT_ID = "YOUR_CLIENT_ID"        # 애플리케이션 ID
CLIENT_SECRET = "YOUR_CLIENT_SECRET"  # 애플리케이션 시크릿

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
PROXY_PORT = 3128  # ⚠️ 실제 프록시 포트로 변경 필요 (Squid 기본: 3128, HTTP: 8080, SOCKS: 1080)

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

# 프록시 사용 여부 (개발/테스트 시 끄기 위한 옵션)
USE_PROXY = True
