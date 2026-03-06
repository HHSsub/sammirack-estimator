import sys
import os
import json
from datetime import datetime

# Ensure we can import order_listener
sys.path.append(os.getcwd())

from order_listener import build_grouped_document, KST

def generate_quality_report():
    # Mock a real Smartstore order group based on analysis
    # Case: Pallet Rack (Iron Type) + Addon Shelf
    mock_order_group = [
        {
            "상품주문번호": "202602271001",
            "결제완료시각": "2026-02-27T16:00:00+09:00",
            "구매자명": "테스트고객",
            "상품명": "파렛트랙 광속배송 (철판형 800깊이)",
            "옵션": "규격:800x1390 / 높이:2000 / 단수:2단 / 독립형",
            "주문수량": "1",
            "최종금액": "250000",
            "수취인명": "받는사람",
            "연락처": "010-1234-5678",
            "배송지": "서울시 강남구 삼성동 123-456"
        },
        {
            "상품주문번호": "202602271002",
            "결제완료시각": "2026-02-27T16:00:00+09:00",
            "구매자명": "테스트고객",
            "상품명": "추가부품 - 철판선반 (1390x800)",
            "옵션": "단수:1단",
            "주문수량": "2",
            "최종금액": "40000",
            "수취인명": "받는사람",
            "연락처": "010-1234-5678",
            "배송지": "서울시 강남구 삼성동 123-456"
        }
    ]

    print("="*80)
    print(" [STRUCTURE QUALITY REPORT] Smartstore -> SAMMIRACK Document Payload ")
    print("="*80)

    # Generate payload
    payload = build_grouped_document(mock_order_group)

    print("\n1. HEADER & CUSTOMER INFO")
    header_fields = ["id", "doc_id", "date", "documentNumber", "purchaseNumber", "companyName", "bizNumber", "totalAmount"]
    for f in header_fields:
        print(f"   - {f:15}: {payload.get(f)}")

    print("\n2. ITEMS (Display in Web UI)")
    print("   " + "-"*75)
    print(f"   {'Name':<40} | {'Qty':<5} | {'UnitPrice':<10} | {'Total':<10}")
    print("   " + "-"*75)
    for item in payload.get("items", []):
        print(f"   {item['name']:<40} | {item['quantity']:<5} | {item['unitPrice']:<10} | {item['totalPrice']:<10}")

    print("\n3. MATERIALS (BOM / Inventory Mapping)")
    print("   " + "-"*75)
    print(f"   {'Name':<25} | {'Type':<10} | {'Spec':<15} | {'Qty':<5}")
    print("   " + "-"*75)
    for mat in payload.get("materials", []):
        name = mat['name'][:25]
        print(f"   {name:<25} | {mat['rackType']:<10} | {mat['specification']:<15} | {mat['quantity']:<5}")

    print("\n4. FULL RAW JSON PAYLOAD (For Structural Verification)")
    print("-" * 80)
    # Filter out _ hidden debugging fields for cleaner view if needed, but the user wants to see the structure
    clean_payload = {k: v for k, v in payload.items()}
    print(json.dumps(clean_payload, indent=2, ensure_ascii=False))
    print("-" * 80)

    # Simple validation against PurchaseOrderForm.jsx expectations
    required_keys = ["id", "type", "date", "documentNumber", "companyName", "items", "materials", "totalAmount"]
    missing = [k for k in required_keys if k not in payload]
    if missing:
        print(f"\n[WARNING] Missing keys for React Frontend: {missing}")
    else:
        print("\n[SUCCESS] Structural Validation Passed (Matches React FormData schema)")

if __name__ == "__main__":
    generate_quality_report()
