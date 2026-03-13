# -*- coding: utf-8 -*-
"""
migrate_fix_purchase_ss.py
═══════════════════════════════════════════════════════════════════════
기존에 잘못 생성된 purchase_ss_* 문서의 materials를
수정된 BOM 코드로 재생성하는 마이그레이션 스크립트.

사용법 (가비아 서버에서):
  cd /opt/sammirack/네이버커머스_발주서자동연결
  python3 migrate_fix_purchase_ss.py              # DRY_RUN (기본)
  python3 migrate_fix_purchase_ss.py --execute    # 실제 반영

로컬에서:
  python migrate_fix_purchase_ss.py --api http://139.150.11.53/api
═══════════════════════════════════════════════════════════════════════
"""
import sys, os, json, argparse, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
from order_listener import (
    get_rack_type,
    parse_smartstore_option,
    generate_bom_for_rack,
    map_highrack_color,
    _generate_inventory_part_id,
    build_item_name,
)


def parse_args():
    p = argparse.ArgumentParser(description="purchase_ss 문서 materials 재생성 마이그레이션")
    p.add_argument("--execute", action="store_true",
                   help="실제 DB에 반영 (기본: DRY_RUN)")
    p.add_argument("--api", default="http://localhost/api",
                   help="sammirack API base URL (기본: http://localhost/api)")
    p.add_argument("--doc-id", default=None,
                   help="특정 doc_id만 처리 (기본: purchase_ss_* 전체)")
    return p.parse_args()


def fetch_all_documents(api_base):
    """GET /documents → 전체 문서 목록"""
    url = "{}/documents".format(api_base)
    print("  GET {} ...".format(url))
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    # 응답은 dict (key=doc_id, value=doc data) 또는 list
    if isinstance(data, dict):
        return data
    elif isinstance(data, list):
        return {d.get("doc_id") or d.get("id", ""): d for d in data}
    return {}


def save_document(api_base, doc_id, doc_data, dry_run=True):
    """POST /documents/save → 문서 저장"""
    if dry_run:
        print("  [DRY-RUN] 저장 건너뜀: {}".format(doc_id))
        return True
    url = "{}/documents/save".format(api_base)
    payload = {"docId": doc_id}
    payload.update(doc_data)
    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code < 300:
        print("  ✅ 저장 완료: {}".format(doc_id))
        return True
    else:
        print("  ❌ 저장 실패: {} (HTTP {})".format(doc_id, resp.status_code))
        return False


def regenerate_materials_for_doc(doc):
    """
    문서의 items JSON에서 원본 상품명+옵션을 읽어
    수정된 코드로 materials를 재생성하고, items의 name도 함께 갱신합니다.
    """
    items = doc.get("items", [])
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except (json.JSONDecodeError, TypeError):
            return None, None, "items JSON 파싱 실패"

    if not items:
        return None, None, "items 비어있음"

    all_materials = {}
    updated_items = []

    for item in items:
        # 원본 주문 행 구조 복원 (build_item_name을 위해)
        pseudo_order = {
            "상품명": item.get("name", ""),
            "옵션": item.get("note", ""),
        }
        
        # 1. 항목명(name) 재생성 (하이랙 감지 및 규격 rounding 적용)
        new_item_name = build_item_name(pseudo_order)
        item["name"] = new_item_name
        updated_items.append(item)

        name = pseudo_order["상품명"]
        note = pseudo_order["옵션"]
        qty = item.get("quantity", 1) or 1

        # 랙 종류 판별 (원본 상품명 기준)
        rack_type = get_rack_type(name, note)
        if not rack_type:
            continue  # 비지원 랙은 건너뜀

        # 옵션 파싱
        option = parse_smartstore_option(note)

        # BOM 생성
        try:
            bom = generate_bom_for_rack(rack_type, option, qty)
            # 병합 (같은 _inventoryPartId는 수량 합산)
            for mat in bom:
                inv_id = mat.get("_inventoryPartId", "")
                if inv_id in all_materials:
                    all_materials[inv_id]["quantity"] += mat["quantity"]
                else:
                    all_materials[inv_id] = dict(mat)
        except Exception as e:
            print("  ⚠️ BOM 재생성 에러:", e)

    materials = sorted(all_materials.values(),
                       key=lambda x: (x.get("rackType", ""), x["name"]))
    return materials, updated_items, None


def main():
    args = parse_args()
    dry_run = not args.execute
    api_base = args.api.rstrip("/")

    print("=" * 70)
    print("purchase_ss 문서 materials 재생성 마이그레이션")
    print("  API: {}".format(api_base))
    print("  모드: {}".format("DRY_RUN (미리보기)" if dry_run else "🔴 EXECUTE (실제 반영)"))
    if args.doc_id:
        print("  대상: {}".format(args.doc_id))
    print("=" * 70)

    # 1. 전체 문서 조회
    print("\n[1] 문서 조회 중...")
    all_docs = fetch_all_documents(api_base)
    print("  전체 문서: {}개".format(len(all_docs)))

    # 2. purchase_ss_* 필터
    if args.doc_id:
        target_docs = {k: v for k, v in all_docs.items() if k == args.doc_id}
    else:
        target_docs = {k: v for k, v in all_docs.items()
                       if k.startswith("purchase_ss_") and not v.get("deleted")}
    print("  대상 purchase_ss 문서: {}개".format(len(target_docs)))

    if not target_docs:
        print("\n처리할 purchase_ss 문서 없음. 종료.")
        return

    # 3. 각 문서 재생성
    print("\n[2] materials 재생성 중...")
    success = 0
    fail = 0
    skip = 0

    for doc_id, doc in sorted(target_docs.items()):
        print("\n" + "-" * 60)
        print("📄 {}".format(doc_id))

        # items 확인
        items = doc.get("items", [])
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except:
                items = []
        print("  items: {}건".format(len(items)))

        if not items:
            print("  ⏭️ items 없음 → 건너뜀")
            skip += 1
            continue

        # 각 item 요약
        for i, item in enumerate(items):
            name = item.get("name", "")[:50]
            rack_type = get_rack_type(name)
            print("  [{}] {} → {} (qty={})".format(
                i + 1, name, rack_type or "❌비지원", item.get("quantity", 1)))

        # 기존 materials 요약
        old_mats = doc.get("materials", [])
        if isinstance(old_mats, str):
            try:
                old_mats = json.loads(old_mats)
            except:
                old_mats = []
        print("  기존 materials: {}건".format(len(old_mats)))
        for mat in old_mats[:3]:  # 처음 3개만
            print("    {} spec={} inv_id={}".format(
                mat.get("name", ""), mat.get("specification", ""),
                mat.get("_inventoryPartId", "")))
        if len(old_mats) > 3:
            print("    ... +{}개".format(len(old_mats) - 3))

        # 신규 materials 생성
        new_mats, updated_items, err = regenerate_materials_for_doc(doc)
        if err:
            print("  ❌ 재생성 실패: {}".format(err))
            fail += 1
            continue

        print("  ➡️ 새 materials: {}건".format(len(new_mats)))
        for mat in new_mats:
            print("    ✅ {} qty={} spec={} inv_id={}".format(
                mat.get("name", ""), mat.get("quantity", 0),
                mat.get("specification", ""), mat.get("_inventoryPartId", "")))

        # 저장
        updated_doc = dict(doc)
        updated_doc["materials"] = new_mats
        if updated_items is not None:
             updated_doc["items"] = updated_items
        elif isinstance(updated_doc.get("items"), str):
            try:
                updated_doc["items"] = json.loads(updated_doc["items"])
            except:
                pass


        ok = save_document(api_base, doc_id, updated_doc, dry_run=dry_run)
        if ok:
            success += 1
        else:
            fail += 1

    # 4. 결과
    print("\n" + "=" * 70)
    print("마이그레이션 결과:")
    print("  ✅ 성공: {}건".format(success))
    print("  ❌ 실패: {}건".format(fail))
    print("  ⏭️ 건너뜀: {}건".format(skip))
    print("  총: {}건".format(success + fail + skip))
    if dry_run:
        print("\n⚠️ DRY_RUN 모드였습니다. 실제 반영하려면:")
        print("  python3 migrate_fix_purchase_ss.py --execute")
    print("=" * 70)


if __name__ == "__main__":
    main()
