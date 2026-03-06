import csv, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')

from order_listener import group_orders_by_session, build_grouped_document

fieldnames = ['상품주문번호','결제완료시각','구매자명','상품명','옵션','주문수량','최종금액','수취인명','연락처','배송지']
orders = []
with open('order_logs/orders_2026-02.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    next(reader)
    for row in reader:
        if len(row) >= 10:
            orders.append(dict(zip(fieldnames, row[:10])))

groups = group_orders_by_session(orders)

for i, g in enumerate(groups):
    doc = build_grouped_document(g)
    print("==================================================")
    print("구매자:", doc.get("_buyer", ""))
    print("  [Mains]")
    for item in doc.get("items", []):
        print("    -", item.get("name"), "| 단가:", item.get("unitPrice"), "| Total:", item.get("totalPrice"))
    print("  [Addons]")
    for mat in doc.get("materials", []):
        print("    -", mat.get("name"), "| 규격:", mat.get("specification"), "| 타입:", mat.get("rackType"), "| Qty:", mat.get("quantity"))
