# -*- coding: utf-8 -*-
"""
restore_ss_timestamps.py
─────────────────────────────────────────────────────────────────────
마이그레이션으로 updated_at이 현재시각으로 덮어쓰인
purchase_ss_* 문서들의 updated_at을 원래 값으로 복원.

복원 기준:
  - DB의 updated_at이 마이그레이션 시각(2026-03-04T07:xx ~ 16:xx UTC)이면
    → updated_at을 created_at 값으로 되돌림
    (SS 주문은 최초 생성 후 수정이 없었으므로 created_at = 원본 주문시각)

사용법:
  python restore_ss_timestamps.py --api http://139.150.11.53/api
  python restore_ss_timestamps.py --api http://139.150.11.53/api --execute
"""
import sys, io, argparse, json, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--execute", action="store_true", help="실제 반영 (기본: DRY_RUN)")
    p.add_argument("--api", default="http://localhost/api")
    return p.parse_args()

def main():
    args = parse_args()
    dry_run = not args.execute
    api = args.api.rstrip("/")

    print("=" * 60)
    print("purchase_ss updated_at 복원")
    print("  모드: {}".format("DRY_RUN" if dry_run else "EXECUTE"))
    print("=" * 60)

    # 전체 문서 조회
    resp = requests.get("{}/documents".format(api), timeout=30)
    resp.raise_for_status()
    all_docs = resp.json()

    # purchase_ss_* 필터
    ss_docs = {k: v for k, v in all_docs.items()
               if k.startswith("purchase_ss_") and not v.get("deleted")}
    print("purchase_ss 문서: {}건".format(len(ss_docs)))

    patched = 0
    skipped = 0

    for doc_id, doc in sorted(ss_docs.items()):
        created_at = doc.get("createdAt", "")
        updated_at = doc.get("updatedAt", "")

        # 마이그레이션 시각대 감지:
        # 마이그레이션이 2026-03-04 07:xx~16:xx UTC 에 실행됨
        # created_at은 보통 2026-02-xx ~ 2026-03-04T07:30:18 이 기존값
        # updated_at이 "2026-03-04T16:" 이나 "2026-03-04T07:" 같은 시각이면 마이그레이션이 덮어쓴 것
        is_migrated = (
            updated_at.startswith("2026-03-04T07:") or
            updated_at.startswith("2026-03-04T16:") or
            updated_at.startswith("2026-03-04T08:") or
            updated_at.startswith("2026-03-04T09:") or
            updated_at.startswith("2026-03-04T15:")
        )

        if not is_migrated:
            print("  ⏭  {} → 수정 불필요 (updated_at={})".format(doc_id[-20:], updated_at))
            skipped += 1
            continue

        # created_at으로 복원
        restore_to = created_at if created_at else updated_at
        print("  🔄 {} | {} → {}".format(doc_id[-20:], updated_at[:22], restore_to[:22]))

        if not dry_run:
            # POST /documents/save 로 updated_at만 변경 (나머지 그대로)
            payload = {"docId": doc_id}
            payload.update(doc)
            payload["updatedAt"] = restore_to
            payload["updated_at"] = restore_to

            # items/materials가 list인지 확인
            if isinstance(payload.get("items"), list):
                payload["items"] = payload["items"]
            if isinstance(payload.get("materials"), list):
                payload["materials"] = payload["materials"]

            r = requests.post("{}/documents/save".format(api), json=payload, timeout=30)
            if r.status_code < 300:
                print("    ✅ 저장 완료")
            else:
                print("    ❌ 저장 실패: HTTP {}".format(r.status_code))
        patched += 1

    print("\n" + "=" * 60)
    print("수정: {}건 | 건너뜀: {}건".format(patched, skipped))
    if dry_run:
        print("⚠️  DRY_RUN. 실제 반영: --execute")
    print("=" * 60)

if __name__ == "__main__":
    main()
