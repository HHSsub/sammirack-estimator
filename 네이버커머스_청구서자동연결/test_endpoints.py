import requests
import time
import sys
import os

# Ensure we can import config
sys.path.append(os.getcwd())

try:
    from config import CLIENT_ID, CLIENT_SECRET, TOKEN_URL, API_BASE_URL, PROXIES, USE_PROXY
    from dump_products import get_access_token
except ImportError as e:
    print(f"[ERROR] Import failed: {e}")
    sys.exit(1)

def test_endpoints(token, pno):
    endpoints = [
        f"{API_BASE_URL}/external/v1/products/{pno}",
        f"{API_BASE_URL}/external/v2/products/{pno}",
        f"{API_BASE_URL}/external/v1/products/origin-products/{pno}",
        f"{API_BASE_URL}/external/v2/products/origin-products/{pno}",
        f"https://api.commerce.naver.com/external/v1/contents-service/v1/products/{pno}",
        f"https://api.commerce.naver.com/external/v1/products/v2/{pno}"
    ]
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    proxies = PROXIES if USE_PROXY else None
    
    for url in endpoints:
        print(f"[TEST] {url}")
        try:
            resp = requests.get(url, headers=headers, proxies=proxies, timeout=10)
            print(f"      Result: {resp.status_code}")
            if resp.status_code == 200:
                print("      SUCCESS!")
                return url
        except Exception as e:
            print(f"      Error: {e}")
    return None

if __name__ == "__main__":
    token = get_access_token()
    test_endpoints(token, 11117755153)
