import json
import requests
import time
from datetime import datetime, timezone, timedelta
from config import (
    CLIENT_ID,
    CLIENT_SECRET,
    TOKEN_URL,
    API_BASE_URL,
    PROXIES,
    USE_PROXY
)

# KST 타임존 상수
KST = timezone(timedelta(hours=9))

def _generate_client_secret_sign(timestamp):
    import bcrypt
    import pybase64
    password = "{}_{}".format(CLIENT_ID, timestamp)
    hashed = bcrypt.hashpw(password.encode("utf-8"), CLIENT_SECRET.encode("utf-8"))
    return pybase64.standard_b64encode(hashed).decode("utf-8")

def get_access_token():
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
    return data["access_token"]

def fetch_full_product_details(token, origin_product_no):
    url = f"{API_BASE_URL}/external/v2/products/origin-products/{origin_product_no}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    proxies = PROXIES if USE_PROXY else None
    resp = requests.get(url, headers=headers, proxies=proxies, timeout=15)
    if resp.status_code == 200:
        return resp.json().get("originProduct", {})
    else:
        print(f"[ERROR] Failed to fetch details for {origin_product_no}: {resp.status_code}")
        return {}

def fetch_all_products(token):
    search_url = f"{API_BASE_URL}/external/v1/products/search"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    all_origin_nos = []
    page = 1
    size = 100
    
    # 1. Get all originProductNos
    while True:
        payload = {"page": page, "size": size}
        print(f"[FETCH-SEARCH] Page {page}...")
        proxies = PROXIES if USE_PROXY else None
        resp = requests.post(search_url, headers=headers, json=payload, proxies=proxies, timeout=20)
        
        if resp.status_code != 200:
            print(f"[ERROR] {resp.status_code}: {resp.text}")
            break
            
        data = resp.json()
        contents = data.get("contents", [])
        if not contents:
            break
            
        for item in contents:
            all_origin_nos.append(item.get("originProductNo"))
        
        if len(contents) < size:
            break
        page += 1
        time.sleep(0.3)
    
    print(f"[INFO] Found {len(all_origin_nos)} products. Fetching details...")
    
    # 2. Get full details (including options) for each
    full_details = []
    for i, pno in enumerate(all_origin_nos):
        print(f"[DETAIL] ({i+1}/{len(all_origin_nos)}) Product No: {pno}")
        details = fetch_full_product_details(token, pno)
        if details:
            full_details.append(details)
        time.sleep(0.3) # Rate limit protection
        
    return full_details

def main():
    print("="*60)
    print(" SAMMIRACK FULL PRODUCT & OPTION DUMPER ")
    print("="*60)
    
    try:
        print("[AUTH] Getting access token...")
        token = get_access_token()
        print("[AUTH] Done.")
        
        print("[DATA] Starting comprehensive dump...")
        full_data = fetch_all_products(token)
        
        output_file = "products_full_dump.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(full_data, f, ensure_ascii=False, indent=2)
            
        print("="*60)
        print(f"[SUCCESS] Total {len(full_data)} product details dumped to {output_file}")
        print("="*60)
        
    except Exception as e:
        print(f"[CRITICAL ERROR] {e}")

if __name__ == "__main__":
    main()
