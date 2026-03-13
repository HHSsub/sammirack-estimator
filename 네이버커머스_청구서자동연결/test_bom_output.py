# -*- coding: utf-8 -*-
"""
test_bom_output.py
═══════════════════════════════════════════════════════════════════════
FULL PIPELINE 검증: SS 상품명+옵션 → get_rack_type → parse → generate_bom
→ 각 material의 _inventoryPartId가 실제 DB inventory에 존재하는지 검증
═══════════════════════════════════════════════════════════════════════
"""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')

from order_listener import (
    generate_bom_for_rack,
    parse_smartstore_option,
    get_rack_type,
    _parse_wd,
    _generate_inventory_part_id,
    build_material_item,
    build_grouped_document, # ADDED
)

PASS = 0
FAIL = 0
TESTS = []

def check(test_id, condition, msg):
    global PASS, FAIL
    status = "✅" if condition else "❌"
    if not condition:
        FAIL += 1
    else:
        PASS += 1
    TESTS.append((test_id, status, msg, condition))
    print(f"  {status} [{test_id}] {msg}")


# ═══════════════════════════════════════════════════════════════════════
# 실제 DB inventory part_id 목록 (현재가격및재고DB구조.txt에서 추출)
# ═══════════════════════════════════════════════════════════════════════
VALID_INVENTORY_IDS = set([
    # ─── 하이랙 기둥 (Real User DB Snapshot 기반 정규화) ───
    *[f"하이랙-기둥{c}{w}-사이즈{s}x높이{h}{w}" 
      for c, w in [("메트그레이(볼트식)", "270kg"), ("메트그레이(볼트식)", "450kg"), ("메트그레이(볼트식)", "600kg"),
                   ("블루(기둥)+오렌지(가로대)(볼트식)", "270kg"), ("블루(기둥)+오렌지(가로대)(볼트식)", "450kg"),
                   ("블루(기둥)+오렌지(가로대)(볼트식)", "600kg"), ("아이보리(볼트식)", "270kg"), ("아이보리(볼트식)", "450kg")]
      for s in [45, 60, 80]
      for h in [150, 200, 250]],

    # ─── 하이랙 로드빔 (Real User DB Snapshot) ───
    *[f"하이랙-로드빔{c}{w}-{l}{w}" 
      for c, w in [("메트그레이(볼트식)", "270kg"), ("메트그레이(볼트식)", "450kg"), ("메트그레이(볼트식)", "600kg"),
                   ("블루(기둥)+오렌지(가로대)(볼트식)", "270kg"), ("블루(기둥)+오렌지(가로대)(볼트식)", "450kg"), 
                   ("블루(기둥.선반)+오렌지(빔)", "600kg"), ("아이보리(볼트식)", "270kg"), ("아이보리(볼트식)", "450kg")]
      for l in [108, 150, 200]],

    # ─── 하이랙 선반 (Real User DB Snapshot) ───
    *[f"하이랙-선반메트그레이(볼트식)270kg-사이즈{s}270kg" for s in ["45x108","45x150","45x200","60x108","60x150","60x200"]],
    *[f"하이랙-선반메트그레이(볼트식)450kg-사이즈{s}450kg" for s in ["60x108","60x150","60x200"]],
    *[f"하이랙-선반블루(기둥)+오렌지(가로대)(볼트식)270kg-사이즈{s}270kg" for s in ["45x108","45x150","45x200","60x108","60x150","60x200"]],
    *[f"하이랙-선반블루(기둥)+오렌지(가로대)(볼트식)450kg-사이즈60x{w}450kg" for w in [108,150,200]],
    *[f"하이랙-선반블루(기둥)+오렌지(가로대)(볼트식)600kg-사이즈80x{w}600kg" for w in [108,150,200]],
    *[f"하이랙-선반아이보리(볼트식){w}-사이즈60x{l}{w}" for w in ["270kg","450kg"] for l in [108,150,200]],
    # ─── 파렛트랙신형 ───
    "파렛트랙신형-기둥-1500", "파렛트랙신형-기둥-2000", "파렛트랙신형-기둥-2500",
    "파렛트랙신형-기둥-3000", "파렛트랙신형-기둥-3500", "파렛트랙신형-기둥-4000",
    "파렛트랙신형-기둥-h4500", "파렛트랙신형-기둥-h5000", "파렛트랙신형-기둥-h5500", "파렛트랙신형-기둥-h6000",
    "파렛트랙신형-기둥-1500_3t", "파렛트랙신형-기둥-2000_3t", "파렛트랙신형-기둥-2500_3t",
    "파렛트랙신형-기둥-3000_3t", "파렛트랙신형-기둥-3500_3t", "파렛트랙신형-기둥-4000_3t",
    "파렛트랙신형-기둥-h4500_3t", "파렛트랙신형-기둥-h5000_3t", "파렛트랙신형-기둥-h5500_3t", "파렛트랙신형-기둥-h6000_3t",
    "파렛트랙신형-로드빔-1390", "파렛트랙신형-로드빔-2590", "파렛트랙신형-로드빔-2790",
    "파렛트랙신형-로드빔-1390_3t", "파렛트랙신형-로드빔-2590_3t", "파렛트랙신형-로드빔-2790_3t",
    "파렛트랙신형-타이빔-1000", "파렛트랙신형-타이빔-1000_3t",
    "파렛트랙신형-수평브레싱-1000", "파렛트랙신형-경사브레싱-1000",
    "파렛트랙신형-안전핀-", "파렛트랙신형-앙카볼트-", "파렛트랙신형-브레싱볼트-", "파렛트랙신형-브러싱고무-",
    # ─── 파렛트랙 (구형) ───
    "파렛트랙-기둥-1500", "파렛트랙-기둥-2000", "파렛트랙-기둥-2500",
    "파렛트랙-기둥-3000", "파렛트랙-기둥-3500", "파렛트랙-기둥-4000",
    "파렛트랙-기둥-h4500", "파렛트랙-기둥-h5000", "파렛트랙-기둥-h5500", "파렛트랙-기둥-h6000",
    "파렛트랙-기둥-1500_3t", "파렛트랙-기둥-2000_3t", "파렛트랙-기둥-2500_3t",
    "파렛트랙-기둥-3000_3t", "파렛트랙-기둥-3500_3t", "파렛트랙-기둥-4000_3t",
    "파렛트랙-로드빔-1390", "파렛트랙-로드빔-2590", "파렛트랙-로드빔-2790",
    "파렛트랙-로드빔-1390_3t", "파렛트랙-로드빔-2590_3t", "파렛트랙-로드빔-2790_3t",
    "파렛트랙-타이빔-1000", "파렛트랙-타이빔-1000_3t",
    "파렛트랙-수평브레싱-1000", "파렛트랙-경사브레싱-1000",
    "파렛트랙-안전핀-", "파렛트랙-앙카볼트-", "파렛트랙-브레싱볼트-", "파렛트랙-브러싱고무-",
    # ─── 파렛트랙 철판형 ───
    "파렛트랙 철판형-기둥-1500", "파렛트랙 철판형-기둥-2000", "파렛트랙 철판형-기둥-2500",
    "파렛트랙 철판형-기둥-3000", "파렛트랙 철판형-기둥-3500", "파렛트랙 철판형-기둥-4000",
    "파렛트랙 철판형-기둥-h4500", "파렛트랙 철판형-기둥-h5000", "파렛트랙 철판형-기둥-h5500", "파렛트랙 철판형-기둥-h6000",
    "파렛트랙 철판형-로드빔-1390", "파렛트랙 철판형-로드빔-2090", "파렛트랙 철판형-로드빔-2590",
    "파렛트랙 철판형-선반-사이즈1390x800", "파렛트랙 철판형-선반-사이즈1390x1000",
    "파렛트랙 철판형-선반-사이즈2090x800", "파렛트랙 철판형-선반-사이즈2090x1000",
    "파렛트랙 철판형-선반-사이즈2590x800", "파렛트랙 철판형-선반-사이즈2590x1000",
    "파렛트랙 철판형-수평브레싱-1000", "파렛트랙 철판형-수평브레싱-800",
    "파렛트랙 철판형-경사브레싱-800", "파렛트랙 철판형-경사브레싱-1000",
    "파렛트랙 철판형-안전핀-", "파렛트랙 철판형-앙카볼트-", "파렛트랙 철판형-브레싱볼트-", "파렛트랙 철판형-브러싱고무-",
    "파렛트랙 철판형-철판형로드빔-1390", "파렛트랙 철판형-철판형로드빔-2090", "파렛트랙 철판형-철판형로드빔-2590",
    # ─── 경량랙 (아이보리/블랙/실버 × 각 부품) ───
    *[f"경량랙-기둥{c}-h{h}" for c in ["아이보리","블랙","실버"] for h in [750,900,1200,1500,1800,2100,2400]],
    *[f"경량랙-선반{c}-w{w}xd{d}" for c in ["아이보리","블랙","실버"] for w in [700,900,1000,1200,1500] for d in [300,450,600]],
    *[f"경량랙-받침상{c}-d{d}" for c in ["아이보리","블랙","실버"] for d in [300,450,600]],
    *[f"경량랙-받침하{c}-d{d}" for c in ["아이보리","블랙","실버"] for d in [300,450,600]],
    *[f"경량랙-연결대{c}-w{w}" for c in ["아이보리","블랙","실버"] for w in [700,900,1000,1200,1500]],
    "경량랙-안전좌-", "경량랙-안전핀-",
    # ─── 중량랙 ───
    *[f"중량랙-기둥-h{h}" for h in [900,1200,1500,1800,2100,2400]],
    *[f"중량랙-선반-w{w}xd{d}" for w in [900,1200,1500,1800] for d in [450,600,900]],
    *[f"중량랙-받침상-d{d}" for d in [450,600,900]],
    *[f"중량랙-받침하-d{d}" for d in [450,600,900]],
    *[f"중량랙-연결대-w{w}" for w in [900,1200,1500,1800]],
    "중량랙-안전좌-", "중량랙-안전핀-", "중량랙-중량바퀴-", 
    # ─── 스텐랙 ───
    *[f"스텐랙-기둥-높이{h}" for h in [75,90,120,150,180,210]],
    *[f"스텐랙-선반-사이즈{s}" for s in ["43x90","43x120","43x150","43x180","50x75","50x90","50x120","50x150","50x180","50x210"]],
    # ─── 하이랙 아이보리 (User DB Snapshot) ───
    "하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이150270kg",
    "하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이200270kg",
    "하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이250270kg",
    "하이랙-기둥아이보리(볼트식)450kg-사이즈60x높이150450kg",
    "하이랙-기둥아이보리(볼트식)450kg-사이즈60x높이200450kg",
    "하이랙-기둥아이보리(볼트식)450kg-사이즈60x높이250450kg",
    "하이랙-선반아이보리(볼트식)270kg-사이즈60x108270kg",
    "하이랙-선반아이보리(볼트식)270kg-사이즈60x150270kg",
    "하이랙-선반아이보리(볼트식)270kg-사이즈60x200270kg",
    "하이랙-선반아이보리(볼트식)450kg-사이즈60x108450kg",
    "하이랙-선반아이보리(볼트식)450kg-사이즈60x150450kg",
    "하이랙-선반아이보리(볼트식)450kg-사이즈60x200450kg",
    "하이랙-로드빔아이보리(볼트식)270kg-108270kg",
    "하이랙-로드빔아이보리(볼트식)270kg-150270kg",
    "하이랙-로드빔아이보리(볼트식)270kg-200270kg",
    "하이랙-로드빔아이보리(볼트식)450kg-108450kg",
    "하이랙-로드빔아이보리(볼트식)450kg-150450kg",
    "하이랙-로드빔아이보리(볼트식)450kg-200450kg",
])


# ═══════════════════════════════════════════════════════════════════════
# FULL PIPELINE 테스트 함수
# ═══════════════════════════════════════════════════════════════════════

def run_pipeline(tc_id, product_name, option_str, qty, expected_rack_type):
    """
    전체 파이프라인 실행 + 상세 보고:
    1. get_rack_type 분류 검증
    2. parse_smartstore_option 파싱 결과 출력
    3. generate_bom_for_rack BOM 생성
    4. 각 material의 _inventoryPartId가 DB에 존재하는지 검증
    """
    print(f"\n{'='*70}")
    print(f"[{tc_id}] {product_name[:50]}...")
    print(f"  옵션: {option_str[:80]}...")
    print(f"  수량: {qty}")

    # 1. 분류
    rack_type = get_rack_type(product_name)
    check(f"{tc_id}-분류", rack_type == expected_rack_type,
          f"분류={rack_type} (기대={expected_rack_type})")
    if rack_type != expected_rack_type:
        print(f"  ⛔ 분류 실패로 이후 검증 중단")
        return

    # 2. 옵션 파싱
    opt = parse_smartstore_option(option_str)
    print(f"  파싱결과: w={opt.get('width')}, d={opt.get('length')}, "
          f"h={opt.get('height')}, dan={opt.get('dan')}, "
          f"color={opt.get('color','')}, size_raw={opt.get('size_raw','')}")

    # 3. BOM 생성
    bom = generate_bom_for_rack(rack_type, opt, qty)
    print(f"  BOM ({len(bom)}개 부품):")

    # 4. 각 material 검증
    for i, mat in enumerate(bom):
        inv_id = mat.get("_inventoryPartId", "")
        in_db = inv_id in VALID_INVENTORY_IDS
        marker = "✅" if in_db else "❌"
        print(f"    {marker} {mat['name']:8s} qty={mat['quantity']:3d}  "
              f"spec={mat.get('specification',''):20s}  "
              f"inv_id={inv_id}")
        check(f"{tc_id}-{mat['name']}-inv",
              in_db,
              f"{mat['name']} inventoryPartId '{inv_id}' → DB {'존재' if in_db else '미존재'}")


def run_all():
    print("=" * 70)
    print("FULL PIPELINE 검증: SS 주문 → 시스템 BOM (실제 DB 기준)")
    print("=" * 70)

    # ─── 하이랙 (SS상품명에 파렛트랙 SEO 포함) ────────────────────────

    # TC-01: 하이랙 60x108 200 4단 메트그레이 270kg
    run_pipeline(
        "TC-01",
        "하이랙 철제선반 앵글 중량랙 경량랙 창고 파렛트랙 메트그레이 601084단 200kg",
        "A.색상: 메트그레이(볼트식)270kg (최고인기상품) / "
        "B.선반(폭cm+가로cm)x기둥(높이cm): 60(폭)x108(가로)x200(높이) / "
        "C.단수: 4단",
        qty=1,
        expected_rack_type="하이랙"
    )

    # TC-02: 하이랙 60x200 200 4단 메트그레이 270kg
    run_pipeline(
        "TC-02",
        "하이랙 철제선반 앵글 중량랙 물류 창고 파렛트랙 60x108x200 4단 270kg",
        "A.색상: 메트그레이(볼트식)270kg (최고인기상품) / "
        "B.선반(폭cm+가로cm)x기둥(높이cm): 60(폭)x200(가로)x200(높이) / "
        "C.단수: 4단",
        qty=1,
        expected_rack_type="하이랙"
    )

    # TC-03: 하이랙 60x150 150 4단 메트그레이
    run_pipeline(
        "TC-03",
        "하이랙 철제선반 경량랙 조립식앵글 중량 수납 블루오렌지 60 200 200 4단 200kg",
        "A.색상: 메트그레이(볼트식)270kg (최고인기상품) / "
        "B.선반(폭cm+가로cm)x기둥(높이cm): 60(폭)x150(가로)x150(높이) / "
        "C.단수: 4단",
        qty=1,
        expected_rack_type="하이랙"
    )

    # TC-04: 하이랙 블루+오렌지 60x108 200 4단
    run_pipeline(
        "TC-04",
        "하이랙 철제선반 앵글 중량랙 물류 창고 파렛트랙 블루오렌지 60x108x200 4단 270kg",
        "색상: 블루(기둥)+오렌지(가로대)(볼트식)270kg / "
        "선반(폭cm+가로cm)x기둥(높이cm): 60(폭)x108(가로)x200(높이) / "
        "단수: 4단",
        qty=1,
        expected_rack_type="하이랙"
    )

    # ─── 파렛트랙 (실제 파렛트랙 상품) ────────────────────────────────

    # TC-05: 파렛트랙 1390x1000 2000 2단
    run_pipeline(
        "TC-05",
        "파렛트랙 파래트랙 파렛트랙 중량랙 창고 수납 1000x2660x1990 2단",
        "폭x길이(단당2000Kg): 1000x1480(연결형)2000kg / "
        "높이: 3000(연결형) / "
        "단수: 2단",
        qty=1,
        expected_rack_type="파렛트랙"
    )

    # TC-06: 파렛트랙 1390x1000 2000 3단 독립
    run_pipeline(
        "TC-06",
        "파렛트랙 중량랙 앵글 철제선반 창고 수납장 적재수납 1000x1460x2000 3단 독립",
        "폭x길이(단당2000Kg): 1000x1460(독립형)2000kg / "
        "높이: 2000(독립형) / "
        "단수: 3단",
        qty=1,
        expected_rack_type="파렛트랙"
    )

    # ─── 중량랙 ───────────────────────────────────────────────────────

    # TC-07: 중량랙 45x185 180 4단
    run_pipeline(
        "TC-07",
        "중량랙 무볼트 철제선반 물류창고 수납 앵글 60x155, 240cm(독립형), 4단",
        "1 . 폭(앞뒤)x가로(좌우): 45x185 / "
        "2 . 높이(기둥): 180cm(독립형) / "
        "3 . 단수(선반): 4단",
        qty=1,
        expected_rack_type="중량랙"
    )

    # TC-08: 중량랙 60x155 240 6단
    run_pipeline(
        "TC-08",
        "중량랙 철제선반 조립식 앵글 창고 펜트리 물류수납 렉 60 x155 180cm 독립형 4단",
        "1 . 폭(앞뒤)x가로(좌우): 60x155 / "
        "2 . 높이(기둥): 240cm(독립형) / "
        "3 . 단수(선반): 6단",
        qty=2,
        expected_rack_type="중량랙"
    )

    # ─── 경량랙 ───────────────────────────────────────────────────────

    # TC-09: 경량랙 블랙 W700xD300 H750 2단
    run_pipeline(
        "TC-09",
        "철제선반 경량랙 수납장 조립식앵글 베란다 무볼트 펜트리 창고 중량랙 블랙3075 4단2열",
        "색상: 블랙 / 규격: 30x75 / 높이: 75 / 단수: 2단",
        qty=1,
        expected_rack_type="경량랙"
    )

    # TC-10: 경량랙 아이보리 W900xD300 H1800 4단
    run_pipeline(
        "TC-10",
        "철제선반 무볼트 조립식 앵글 경량랙 베란다 창고 수납 30 75 75 4단2열",
        "색상: 아이보리 / 규격: 90x30 / 높이: 180 / 단수: 4단",
        qty=1,
        expected_rack_type="경량랙"
    )

    # ─── 스텐랙 ───────────────────────────────────────────────────────

    # TC-11: 스텐랙 50x180
    run_pipeline(
        "TC-11",
        "스텐랙 선반 앵글 창고 선반 수납 냉동 스탠 베란다 중량랙 냉장 507575 4단",
        "스텐선반추가(단위cm) 폭x길이: 50x180",
        qty=1,
        expected_rack_type="스텐랙"
    )

    # ─── 하이랙 추가상품 (GENERALIZED CASES) ───────────────────────────
    
    print(f"\n{'='*70}")
    print("[하이랙 추가상품 및 변칙 케이스 검증]")
    
    addon_cases = [
        # TC-12: (Original Reported Issue) 60x108(오렌지선반추가) 450kg
        {
            "id": "TC-12",
            "desc": "60x108(오렌지선반추가) 450kg",
            "상품명": "60x108(오렌지선반추가) 450kg 60x108",
            "옵션": "450kg 블루+오렌지 기둥및선반추가: 60x108(오렌지선반추가) 450kg",
            "expected_name": "선반",
            "expected_spec": "60x108",
            "expected_cw": "블루(기둥)+오렌지(가로대)(볼트식)450kg",
        },
        # TC-13: 45x150(메트그레이기둥추가)
        {
            "id": "TC-13",
            "desc": "45x150(메트그레이기둥추가)",
            "상품명": "45x150(메트그레이기둥추가)",
            "옵션": "색상: 메트그레이 / 규격: 45x150",
            "expected_name": "기둥",
            "expected_spec": "45x150", # missing height -> mapping should handle it
            "expected_cw": "메트그레이(볼트식)270kg",
        },
        # TC-14: 60x150(메트그레이선반추가) 450kg
        {
            "id": "TC-14",
            "desc": "60x150(메트그레이선반추가) 450kg",
            "상품명": "60x150(메트그레이선반추가) 450kg",
            "옵션": "450kg 메트그레이 선반추가: 60x150",
            "expected_name": "선반",
            "expected_spec": "60x150",
            "expected_cw": "메트그레이(볼트식)450kg",
        },
        # TC-15: 60x108x150(메트그레이기둥추가) -> 3단 규격
        {
            "id": "TC-15",
            "desc": "60x108x150(메트그레이기둥추가)",
            "상품명": "60x108x150(메트그레이기둥추가)",
            "옵션": "색상: 메트그레이 / 규격: 60x108x150",
            "expected_name": "기둥",
            "expected_spec": "60x108x150",
            "expected_cw": "메트그레이(볼트식)270kg",
        },
        # TC-16: 아이보리 기둥 추가 (반드시 60x 규격)
        {
            "id": "TC-16",
            "desc": "아이보리 기둥 추가",
            "상품명": "하이랙 아이보리 기둥추가 60x108 150",
            "옵션": "규격: 60x108x150",
            "expected_name": "기둥",
            "expected_spec": "60x108", # Snap logic will handle height
            "expected_cw": "아이보리(볼트식)270kg",
        },
        # TC-17: 80x206 (Fuzzy Matching: 206 -> 200)
        {
            "id": "TC-17",
            "desc": "80x206 선반 (Fuzzy Matching: 206 -> 200)",
            "상품명": "하이랙 블루오렌지 선반추가 80x206",
            "옵션": "600kg 블루+오렌지: 80x206",
            "expected_name": "선반",
            "expected_spec": "80x206", # Raw extraction
            "expected_cw": "블루(기둥)+오렌지(가로대)(볼트식)600kg",
        }
    ]

    for tc in addon_cases:
        print(f"--- [{tc['id']}] {tc['desc']} ---")
        order = {
            "상품명": tc["상품명"],
            "옵션": tc["옵션"],
            "주문수량": "1",
            "최종금액": "25000"
        }
        addon_mat = build_material_item(order, "하이랙")
        inv_id = _generate_inventory_part_id(
            addon_mat["rackType"], addon_mat["name"], addon_mat["specification"], 
            color=addon_mat["color"], color_weight=addon_mat["colorWeight"]
        )
        
        check(f"{tc['id']}-name", tc["expected_name"] in addon_mat["name"], f"부품명={addon_mat['name']}")
        # spec 체크는 포함 여부로 (공백/소문자 등 차이 있을 수 있음)
        check(f"{tc['id']}-spec", tc["expected_spec"].replace(" ", "") in addon_mat["specification"].replace(" ", ""), 
              f"규격={addon_mat['specification']}")
        check(f"{tc['id']}-cw", tc["expected_cw"] == addon_mat["colorWeight"], f"색상중량={addon_mat['colorWeight']}")
        
        in_db = inv_id in VALID_INVENTORY_IDS
        print(f"    [Snapping Proof] Input: {tc['expected_spec']} -> Generated ID: {inv_id}")
        check(f"{tc['id']}-inv", in_db, f"inventoryPartId '{inv_id}' → DB {'존재' if in_db else '미존재'}")

    print(f"\n{'='*70}")
    print("[분류 보완] get_rack_type 추가 검증")
    check("분류-05", get_rack_type("스텐랙 선반 앵글 중량랙") == "스텐랙",
          "스텐랙...중량랙 → 스텐랙")

    print(f"\n{'='*70}")
    print("[버그 수정 검증] 추가상품 단독 주문 시 랙 세트 생성 여부")
    
    # TC-18: 오직 선반추가만 있는 주문 그룹
    addon_only_group = [
        {
            "상품명": "하이랙 60x108(메트그레이선반추가) 270kg",
            "옵션": "색상: 메트그레이 / 규격: 60x108",
            "주문수량": "2",
            "최종금액": "40000",
            "상품주문번호": "12345678"
        }
    ]
    doc = build_grouped_document(addon_only_group)
    mats = doc["materials"]
    
    # 기둥이나 로드빔이 포함되어 있으면 실패
    has_rack_set = any(m["name"] in ["기둥", "로드빔"] for m in mats)
    check("TC-18-세트방지", not has_rack_set, "추가상품 단독 주문 시 기둥/로드빔 자동생성 방지됨")
    check("TC-18-항목확인", len(mats) == 1 and "선반" in mats[0]["name"], f"BOM에 선반만 포함됨 (count={len(mats)})")
    if mats:
        inv_id = mats[0]["inventoryPartId"]
        check("TC-18-ID검증", inv_id in VALID_INVENTORY_IDS, f"추가상품 ID 매핑 성공: {inv_id}")

    # ─── 결과 ─────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"결과: ✅ PASS={PASS}  ❌ FAIL={FAIL}  총 {PASS + FAIL}건")
    print(f"{'='*70}")

    if FAIL > 0:
        print(f"\n[실패 상세 ({FAIL}건)]")
        for tid, s, msg, ok in TESTS:
            if not ok:
                print(f"  {s} [{tid}] {msg}")

    return FAIL == 0


if __name__ == "__main__":
    ok = run_all()
    sys.exit(0 if ok else 1)
