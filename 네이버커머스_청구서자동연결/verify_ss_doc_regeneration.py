# -*- coding: utf-8 -*-
"""
verify_ss_doc_regeneration.py

기존 스마트스토어 문서를 절대 수정하지 않고,
`document_number` 기준으로 현재 저장 문서와 원본 order_logs 재생성 결과를 비교하는 검증 스크립트.

기본 동작:
1. API 또는 documents.json 에서 기존 문서 조회
2. order_logs/orders_*.csv 전체를 다시 읽어 그룹핑
3. 같은 document_number 로 재생성된 후보 문서 탐색
4. items/materials 행 수와 각 주문행의 main/addon 분류 결과 출력
"""
import argparse
import csv
import glob
import io
import json
import os
import sqlite3
import sys
from urllib.request import urlopen

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import order_listener as listener
from order_listener import build_grouped_document, classify_row, group_orders_by_session


ORDER_FIELDS = [
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


def parse_args():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    default_db_path = "/home/rocky/db/sammi.db" if os.path.exists("/home/rocky/db/sammi.db") else ""
    p = argparse.ArgumentParser(
        description="기존 스마트스토어 문서 재생성 결과를 dry-run으로 검증"
    )
    p.add_argument(
        "--document-number",
        required=True,
        help="검증할 문서번호. 예: SS-2229234441",
    )
    p.add_argument(
        "--api",
        default="http://localhost/api",
        help="문서 조회용 API base URL. 예: http://localhost/api",
    )
    p.add_argument(
        "--db-path",
        default=default_db_path,
        help="직접 조회할 sammirack SQLite 경로. 예: /home/rocky/db/sammi.db",
    )
    p.add_argument(
        "--documents-json",
        default="",
        help="API 대신 사용할 documents.json 경로",
    )
    p.add_argument(
        "--order-glob",
        default=os.path.join(base_dir, "order_logs", "orders_*.csv"),
        help="원본 주문 CSV glob",
    )
    p.add_argument(
        "--show-orders",
        action="store_true",
        help="후보 그룹의 원본 주문행 전체 출력",
    )
    p.add_argument(
        "--show-json",
        action="store_true",
        help="재생성 payload JSON 일부 출력",
    )
    p.add_argument(
        "--api-timeout",
        type=int,
        default=10,
        help="API 조회 타임아웃 초",
    )
    return p.parse_args()


def _safe_json_loads(value, fallback):
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return value
    if value in (None, ""):
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _load_json_if_exists(path):
    if not path or not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def prime_admin_prices_cache():
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "admin_prices.json"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sammirack-api", "data", "admin_prices.json"),
        os.path.join(os.path.expanduser("~"), "admin_prices.json"),
        os.path.join(os.path.expanduser("~"), "sammirack-api", "data", "admin_prices.json"),
    ]
    for path in candidates:
        raw = _load_json_if_exists(path)
        if raw is None:
            continue
        if isinstance(raw, dict):
            listener._ADMIN_PRICES_CACHE = raw
            return path
        if isinstance(raw, list):
            cache = {}
            for item in raw:
                pid = item.get("part_id") or item.get("partId") or ""
                if pid:
                    cache[pid] = item
            listener._ADMIN_PRICES_CACHE = cache
            return path
    listener._ADMIN_PRICES_CACHE = {}
    return ""


def load_documents_from_api(api_base, timeout_seconds):
    url = "{}/documents".format(api_base.rstrip("/"))
    with urlopen(url, timeout=timeout_seconds) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_documents_from_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_documents_from_sqlite(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        tables = {
            row["name"]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        if "documents" not in tables:
            raise RuntimeError(
                "documents 테이블이 없습니다. 현재 테이블: {}".format(
                    ", ".join(sorted(tables)) if tables else "(없음)"
                )
            )
        rows = conn.execute(
            """
            SELECT doc_id, type, date, document_number, company_name, biz_number,
                   items, materials, subtotal, tax, total_amount, notes, top_memo,
                   created_at, updated_at, deleted
            FROM documents
            ORDER BY date DESC
            """
        ).fetchall()
    finally:
        conn.close()

    documents = {}
    for row in rows:
        doc_id = row["doc_id"]
        documents[doc_id] = {
            "doc_id": doc_id,
            "id": doc_id,
            "type": row["type"],
            "date": row["date"],
            "document_number": row["document_number"],
            "documentNumber": row["document_number"],
            "company_name": row["company_name"],
            "companyName": row["company_name"],
            "biz_number": row["biz_number"],
            "bizNumber": row["biz_number"],
            "items": _safe_json_loads(row["items"], []),
            "materials": _safe_json_loads(row["materials"], []),
            "subtotal": row["subtotal"],
            "tax": row["tax"],
            "total_amount": row["total_amount"],
            "totalAmount": row["total_amount"],
            "notes": row["notes"],
            "top_memo": row["top_memo"],
            "topMemo": row["top_memo"],
            "created_at": row["created_at"],
            "createdAt": row["created_at"],
            "updated_at": row["updated_at"],
            "updatedAt": row["updated_at"],
            "deleted": row["deleted"],
        }
    return documents


def normalize_documents(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):
        normalized = {}
        for doc in raw:
            doc_id = doc.get("doc_id") or doc.get("id") or ""
            if doc_id:
                normalized[doc_id] = doc
        return normalized
    return {}


def find_documents_by_number(documents, document_number):
    matches = []
    for doc_id, doc in documents.items():
        doc_num = doc.get("documentNumber") or doc.get("document_number")
        if doc_num == document_number:
            copied = dict(doc)
            copied["_resolved_doc_id"] = doc_id
            copied["items"] = _safe_json_loads(copied.get("items"), [])
            copied["materials"] = _safe_json_loads(copied.get("materials"), [])
            matches.append(copied)
    return matches


def load_orders_from_csv(csv_path):
    orders = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        try:
            next(reader)
        except StopIteration:
            return orders
        for row in reader:
            if len(row) < len(ORDER_FIELDS):
                continue
            orders.append(dict(zip(ORDER_FIELDS, row[: len(ORDER_FIELDS)])))
    return orders


def load_all_orders(order_glob):
    csv_paths = sorted(glob.glob(order_glob))
    all_orders = []
    for csv_path in csv_paths:
        all_orders.extend(load_orders_from_csv(csv_path))
    return csv_paths, all_orders


def choose_best_candidate(existing_doc, candidates):
    if not candidates:
        return None

    def score(entry):
        payload = entry["payload"]
        score_value = 0
        if existing_doc:
            existing_date = str(existing_doc.get("date", "") or "")
            existing_company = str(
                existing_doc.get("companyName")
                or existing_doc.get("company_name")
                or ""
            ).strip()
            existing_total = int(
                existing_doc.get("totalAmount")
                or existing_doc.get("total_amount")
                or 0
            )
            if payload.get("date") == existing_date:
                score_value += 10
            if str(payload.get("company_name", "")).strip() == existing_company:
                score_value += 5
            if int(payload.get("total_amount", 0) or 0) == existing_total:
                score_value += 3
        score_value += len(entry["group"])
        return score_value

    return sorted(candidates, key=score, reverse=True)[0]


def extract_order_id_from_doc(existing_doc):
    if not existing_doc:
        return ""
    doc_id = (
        existing_doc.get("_resolved_doc_id")
        or existing_doc.get("doc_id")
        or existing_doc.get("id")
        or ""
    )
    doc_id = str(doc_id)
    prefix = "purchase_ss_"
    if doc_id.startswith(prefix):
        return doc_id[len(prefix):]
    return ""


def find_group_by_order_id(groups, order_id):
    if not order_id:
        return None
    for group in groups:
        for row in group:
            if str(row.get("상품주문번호", "")) == str(order_id):
                return group
    return None


def summarize_existing_doc(doc):
    if not doc:
        print("[기존 문서] 찾지 못함")
        return
    print("[기존 문서]")
    print("  doc_id           :", doc.get("_resolved_doc_id", ""))
    print("  document_number  :", doc.get("documentNumber") or doc.get("document_number"))
    print("  date             :", doc.get("date", ""))
    print("  company          :", doc.get("companyName") or doc.get("company_name") or "")
    print("  total_amount     :", doc.get("totalAmount") or doc.get("total_amount") or 0)
    print("  items            :", len(doc.get("items", [])))
    print("  materials        :", len(doc.get("materials", [])))
    for idx, item in enumerate(doc.get("items", []), 1):
        print(
            "    [{}] {} | qty={} | total={} | note={}".format(
                idx,
                item.get("name", ""),
                item.get("quantity", 0),
                item.get("totalPrice", 0),
                item.get("note", ""),
            )
        )


def print_candidate_summary(entry, show_orders=False, show_json=False):
    payload = entry["payload"]
    group = entry["group"]
    print("[재생성 후보]")
    print("  match_reason     :", entry.get("match_reason", "document_number"))
    print("  document_number  :", payload.get("document_number", ""))
    if entry.get("expected_document_number"):
        print("  expected_doc_no  :", entry.get("expected_document_number"))
    print("  doc_id           :", payload.get("doc_id", ""))
    print("  date             :", payload.get("date", ""))
    print("  company          :", payload.get("company_name", ""))
    print("  total_amount     :", payload.get("total_amount", 0))
    print("  group_rows       :", len(group))
    print("  mains            :", payload.get("_mains_count", 0))
    print("  addons           :", payload.get("_addons_count", 0))
    print("  items            :", len(payload.get("items", [])))
    print("  materials        :", len(payload.get("materials", [])))
    for idx, item in enumerate(payload.get("items", []), 1):
        print(
            "    [{}] {} | qty={} | total={} | note={}".format(
                idx,
                item.get("name", ""),
                item.get("quantity", 0),
                item.get("totalPrice", 0),
                item.get("note", ""),
            )
        )

    if show_orders:
        print("  [원본 주문행 분류]")
        for row in sorted(group, key=lambda x: str(x.get("상품주문번호", ""))):
            print(
                "    - {} | {} | {} | {}".format(
                    row.get("상품주문번호", ""),
                    classify_row(row),
                    row.get("상품명", ""),
                    row.get("옵션", ""),
                )
            )

    if show_json:
        print("  [재생성 payload]")
        print(
            json.dumps(
                {
                    "doc_id": payload.get("doc_id"),
                    "document_number": payload.get("document_number"),
                    "items": payload.get("items", []),
                    "materials": payload.get("materials", []),
                },
                ensure_ascii=False,
                indent=2,
            )
        )


def print_diff(existing_doc, candidate):
    print("[비교 요약]")
    if not existing_doc:
        print("  기존 문서가 없어 재생성 결과만 확인 가능")
        return

    old_items = existing_doc.get("items", [])
    old_materials = existing_doc.get("materials", [])
    new_items = candidate["payload"].get("items", [])
    new_materials = candidate["payload"].get("materials", [])

    print(
        "  items 행 수      : 기존 {} -> 재생성 {}".format(
            len(old_items), len(new_items)
        )
    )
    print(
        "  materials 행 수  : 기존 {} -> 재생성 {}".format(
            len(old_materials), len(new_materials)
        )
    )

    old_names = [str(it.get("name", "")) for it in old_items]
    new_names = [str(it.get("name", "")) for it in new_items]

    if old_names == new_names:
        print("  items 이름 비교   : 동일")
    else:
        print("  items 이름 비교   : 변경됨")
        print("    기존:", " | ".join(old_names) if old_names else "(없음)")
        print("    신규:", " | ".join(new_names) if new_names else "(없음)")


def main():
    args = parse_args()

    print("=" * 72)
    print("스마트스토어 문서 재생성 검증 (DRY-RUN ONLY)")
    print("  document_number :", args.document_number)
    print("  order_glob      :", args.order_glob)
    if args.documents_json:
        print("  documents_json  :", args.documents_json)
    elif args.db_path:
        print("  db_path         :", args.db_path)
        print("  api fallback    :", args.api)
    else:
        print("  api             :", args.api)
    print("=" * 72)

    admin_prices_path = prime_admin_prices_cache()
    if admin_prices_path:
        print("[admin_prices 캐시]")
        print("  loaded from      :", admin_prices_path)

    documents = {}
    document_source = ""
    if args.documents_json:
        documents = normalize_documents(load_documents_from_json(args.documents_json))
        document_source = "documents_json"
    elif args.db_path and os.path.exists(args.db_path):
        try:
            documents = normalize_documents(load_documents_from_sqlite(args.db_path))
            document_source = "sqlite"
        except Exception as exc:
            print("[기존 문서 로드 실패]")
            print("  source          : sqlite")
            print("  db_path         :", args.db_path)
            print("  error           :", repr(exc))
            print("  hint            : sqlite3 '{}' '.table' 로 실제 테이블 확인".format(args.db_path))
            return
    else:
        try:
            documents = normalize_documents(load_documents_from_api(args.api, args.api_timeout))
            document_source = "api"
        except Exception as exc:
            print("[기존 문서 로드 실패]")
            print("  source          : api")
            print("  error           :", repr(exc))
            print("  hint            : --db-path /home/rocky/db/sammi.db 또는 --documents-json 사용")
            return

    print("[기존 문서 로드]")
    print("  source          :", document_source)
    print("  documents       :", len(documents))

    existing_matches = find_documents_by_number(documents, args.document_number)
    existing_doc = existing_matches[0] if existing_matches else None
    summarize_existing_doc(existing_doc)
    if len(existing_matches) > 1:
        print("  경고: 같은 document_number 문서가 {}개 있음".format(len(existing_matches)))

    csv_paths, all_orders = load_all_orders(args.order_glob)
    print("[주문 로그]")
    print("  csv files        :", len(csv_paths))
    if csv_paths:
        for path in csv_paths:
            print("    -", path)
    print("  loaded rows      :", len(all_orders))
    if not all_orders:
        print("  원본 주문 로그가 없어 종료")
        return

    groups = group_orders_by_session(all_orders)
    candidates = []
    for group in groups:
        deduped_group = listener._dedupe_group_rows(group)
        payload = build_grouped_document(group)
        if payload.get("document_number") == args.document_number:
            candidates.append({
                "group": deduped_group,
                "payload": payload,
                "match_reason": "document_number",
                "expected_document_number": args.document_number,
            })

    existing_order_id = extract_order_id_from_doc(existing_doc)
    if existing_order_id:
        forced_group = find_group_by_order_id(groups, existing_order_id)
        if forced_group is not None:
            deduped_group = listener._dedupe_group_rows(forced_group)
            forced_payload = build_grouped_document(forced_group)
            forced_doc_id = forced_payload.get("doc_id", "")
            if not any(c["payload"].get("doc_id") == forced_doc_id for c in candidates):
                candidates.append({
                    "group": deduped_group,
                    "payload": forced_payload,
                    "match_reason": "doc_id_order_id_match",
                    "expected_document_number": args.document_number,
                })

    print("[재생성 후보 수]")
    print("  candidates       :", len(candidates))
    if not candidates:
        print("  해당 document_number 로 재생성되는 그룹을 order_logs 에서 찾지 못함")
        if existing_order_id:
            print("  existing order_id:", existing_order_id)
        return

    best = choose_best_candidate(existing_doc, candidates)
    print_candidate_summary(best, show_orders=args.show_orders, show_json=args.show_json)
    print_diff(existing_doc, best)


if __name__ == "__main__":
    main()
