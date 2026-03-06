import json
import sys
import os

# Import order_listener logic
sys.path.append(os.getcwd())
from order_listener import get_rack_type, parse_smartstore_option, build_item_name, generate_bom_for_rack

def generate_report():
    test_cases = [
        {
            "category": "파렛트랙 (철판형 판정)",
            "product": "파렛트랙 독립형",
            "option": "규격:800x1390(가로x폭) / 높이:2500 / 단수:2단 / 철판유무:철판형",
            "qty": 1
        },
        {
            "category": "파렛트랙 (실제 규격 매핑)",
            "product": "파렛트랙 연결형",
            "option": "폭800x가로2580 / 높이:3500 / 단수:4단 / 주항",
            "qty": 2
        },
        {
            "category": "스텐랙 (화분대 키워드 매칭)",
            "product": "스텐 화분대 랙",
            "option": "선반사이즈:45(폭)x90(가로) / 높이:150 / 단수:3단",
            "qty": 1
        },
        {
            "category": "하이랙 (중량형/색상 매핑)",
            "product": "하이랙 선반형",
            "option": "사이즈:108x60 / 높이:210 / 단수:5단 / 색상:오렌지(중량)",
            "qty": 1
        }
    ]

    report = []
    report.append("# Smartstore -> SAMMIRACK Mapping Dry-Run Report\n")
    report.append("Generated on: 2026-02-27\n")
    
    report.append("| Case | Category | Naver Input | Mapped Item Name | Rack Type | BOM Count |")
    report.append("| :--- | :--- | :--- | :--- | :--- | :--- |")

    for i, tc in enumerate(test_cases):
        pname = tc["product"]
        optv = tc["option"]
        qty = tc["qty"]

        rtype = get_rack_type(pname, optv)
        parsed = parse_smartstore_option(optv)
        display_name = build_item_name({"상품명": pname, "옵션": optv})
        bom = generate_bom_for_rack(rtype, parsed, qty)

        report.append("| {} | {} | `{}`<br>`{}` | {} | {} | {} |".format(
            i+1, tc["category"], pname, optv, display_name, rtype or "기타", len(bom)
        ))

    report.append("\n## Detailed BOM Breakdown\n")
    for i, tc in enumerate(test_cases):
        pname = tc["product"]
        optv = tc["option"]
        qty = tc["qty"]
        rtype = get_rack_type(pname, optv)
        parsed = parse_smartstore_option(optv)
        display_name = build_item_name({"상품명": pname, "옵션": optv})
        bom = generate_bom_for_rack(rtype, parsed, qty)
        
        report.append("### CASE {}: {}\n- **Item**: {}\n".format(i+1, tc["category"], display_name))
        if bom:
            report.append("| Material | Specification | Quantity |")
            report.append("| :--- | :--- | :--- |")
            for item in bom:
                report.append("| {} | {} | {} |".format(item['name'], item.get('specification',''), item['quantity']))
        else:
            report.append("*No BOM generated (Addon or Unsupported)*")
        report.append("\n---\n")

    with open("MAPPING_DRY_RUN_RESULTS.md", "w", encoding="utf-8") as f:
        f.write("\n".join(report))

if __name__ == "__main__":
    generate_report()
