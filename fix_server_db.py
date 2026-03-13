import sqlite3
import json
import re
import os
import shutil
from datetime import datetime

# [증거 기반] 가비아 서버 실제 구조 준수
# DB 경로: ~/db/sammi.db
# 테이블: documents
# 식별자: doc_id
# 주문번호: document_number
# 자재데이터: materials (JSON) - [기존 상상: bom 아님]

DB_PATH = os.path.expanduser("~/db/sammi.db")
if not os.path.exists(DB_PATH):
    DB_PATH = "sammi.db"

BACKUP_PATH = f"{DB_PATH}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def fix_pillar_id(part_id):
    if not part_id or not isinstance(part_id, str):
        return part_id
    
    # 1. 증거 기반: 모든 공백 제거 (DB 매칭용)
    fixed = re.sub(r'\s+', '', part_id)
    
    # 2. 증거 기반: 하이랙 기둥 규격 내 깊이(D) 삭제
    # 사이즈{폭}x{깊이}높이{높이} -> 사이즈{폭}x높이{높이}
    # 예: 하이랙-기둥...-사이즈60x108높이200270kg -> 하이랙-기둥...-사이즈60x높이200270kg
    fixed = re.sub(r'사이즈(\d+)x\d+높이', r'사이즈\1x높이', fixed)
    
    # 3. '높이' 키워드 누락 케이스 대응 (사이즈60x108200 -> 사이즈60x높이200)
    fixed = re.sub(r'사이즈(\d+)x\d+(\d{3})', r'사이즈\1x높이\2', fixed)
    
    return fixed

def run_fix():
    if not os.path.exists(DB_PATH):
        print(f"Error: DB not found at {DB_PATH}")
        return

    print(f"--- Sammi DB Pinpoint Fixer (High-Rack Pillar Only) ---")
    print(f"Target: {DB_PATH}")
    print(f"Backup: {BACKUP_PATH}")
    shutil.copy2(DB_PATH, BACKUP_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # [증거] 테이블명 및 컬럼명: documents, doc_id, materials
        cursor.execute("SELECT doc_id, materials FROM documents WHERE materials IS NOT NULL")
        rows = cursor.fetchall()
        
        update_count = 0
        total_instances = 0

        for doc_id, materials_json in rows:
            try:
                materials = json.loads(materials_json)
                modified = False
                
                for item in materials:
                    # 하이랙 기둥일 때만 핀포인트 작업 수행 (절대 다른 자재 침범 금지)
                    if item.get('rackType') == '하이랙' and item.get('name') == '기둥':
                        # 수정이 필요한 필드 목록
                        fields = ['inventoryPartId', '_inventoryPartId']
                        for field in fields:
                            orig = item.get(field)
                            if orig:
                                updated = fix_pillar_id(orig)
                                if orig != updated:
                                    item[field] = updated
                                    modified = True
                                    total_instances += 1
                        
                        # _inventoryList 배열 내부도 동일하게 수정
                        inv_list = item.get('_inventoryList', [])
                        for inv_item in inv_list:
                            orig_vid = inv_item.get('inventoryPartId')
                            if orig_vid:
                                updated_vid = fix_pillar_id(orig_vid)
                                if orig_vid != updated_vid:
                                    inv_item['inventoryPartId'] = updated_vid
                                    modified = True

                if modified:
                    # [증거] doc_id 식별자를 사용하여 materials 컬럼 업데이트
                    cursor.execute("UPDATE documents SET materials = ? WHERE doc_id = ?", 
                                 (json.dumps(materials, ensure_ascii=False), doc_id))
                    update_count += 1

            except (json.JSONDecodeError, TypeError):
                continue

        conn.commit()
        print(f"--- Fix Complete ---")
        print(f"Updated Documents: {update_count}")
        print(f"Fixed Pillar IDs: {total_instances}")

    except Exception as e:
        print(f"Processing Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    run_fix()
