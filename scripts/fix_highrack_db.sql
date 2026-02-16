-- =====================================================
-- 하이랙 DB 수정 SQL (서버 ~/db/sammi.db 에서 실행)
-- 실행방법: sqlite3 ~/db/sammi.db < fix_highrack_db.sql
-- =====================================================

-- =====================================================
-- 1. inventory 쓰레기/옛 데이터 정리
-- =====================================================

-- 1-1. 쓰레기 엔트리 삭제
DELETE FROM inventory WHERE part_id = '--';

-- 1-2. 옛 포맷 0개 데이터 삭제 (색상이 부품명 뒤에 오는 잘못된 형식)
DELETE FROM inventory WHERE part_id = '하이랙-메트그레이기둥-사이즈60x높이200270kg';
DELETE FROM inventory WHERE part_id = '하이랙-메트그레이선반-사이즈60x150270kg';
DELETE FROM inventory WHERE part_id = '하이랙-메트그레이로드빔-150270kg';
DELETE FROM inventory WHERE part_id = '하이랙-기둥메트그레이-사이즈60x높이200270kg';
DELETE FROM inventory WHERE part_id = '하이랙-선반메트그레이-사이즈60x150270kg';
DELETE FROM inventory WHERE part_id = '하이랙-로드빔메트그레이-150270kg';

-- =====================================================
-- 2. inventory 아이보리 기둥 추가 (60x만, 45x 없음)
-- 270kg: 60 × 150/200/250 = 3개
-- 450kg: 60 × 150/200/250 = 3개
-- =====================================================

INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이150270kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이200270kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이250270kg', 600, datetime('now', 'localtime'), 'migration');

INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-기둥아이보리(볼트식)450kg-사이즈60x높이150450kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-기둥아이보리(볼트식)450kg-사이즈60x높이200450kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-기둥아이보리(볼트식)450kg-사이즈60x높이250450kg', 600, datetime('now', 'localtime'), 'migration');

-- =====================================================
-- 3. inventory 아이보리 선반 추가 (60x만)
-- 270kg: 60x108/60x150/60x200 = 3개
-- 450kg: 60x108/60x150/60x200 = 3개
-- =====================================================

INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-선반아이보리(볼트식)270kg-사이즈60x108270kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-선반아이보리(볼트식)270kg-사이즈60x150270kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-선반아이보리(볼트식)270kg-사이즈60x200270kg', 600, datetime('now', 'localtime'), 'migration');

INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-선반아이보리(볼트식)450kg-사이즈60x108450kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-선반아이보리(볼트식)450kg-사이즈60x150450kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-선반아이보리(볼트식)450kg-사이즈60x200450kg', 600, datetime('now', 'localtime'), 'migration');

-- =====================================================
-- 4. inventory 아이보리 로드빔 추가
-- 270kg: 108/150/200 = 3개
-- 450kg: 108/150/200 = 3개
-- =====================================================

INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-로드빔아이보리(볼트식)270kg-108270kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-로드빔아이보리(볼트식)270kg-150270kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-로드빔아이보리(볼트식)270kg-200270kg', 600, datetime('now', 'localtime'), 'migration');

INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-로드빔아이보리(볼트식)450kg-108450kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-로드빔아이보리(볼트식)450kg-150450kg', 600, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO inventory (part_id, quantity, updated_at, updated_by)
VALUES ('하이랙-로드빔아이보리(볼트식)450kg-200450kg', 600, datetime('now', 'localtime'), 'migration');

-- =====================================================
-- 5. admin_prices 옛 포맷 삭제 (기둥 옆에 숫자가 붙은 잘못된 형식)
-- 기둥200-높이200 → 잘못됨, 기둥-높이200 이 올바름
-- =====================================================

-- 기둥[숫자]-높이... 형식 삭제 (옛날 admin이 입력한 것)
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-기둥___-높이%';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-기둥__-높이%';

-- 45x150메트그레이기둥- 같은 아주 오래된 형식도 삭제
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-80x%기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%블루기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%블루기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%메트그레이기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%메트그레이기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%매트그레이기둥-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%매트그레이기둥-';

-- 로드빔[숫자]-[길이]... 형식도 삭제
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-로드빔___-____%';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-로드빔__-___%';

-- 선반[숫자]-사이즈... 형식도 삭제
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-선반__-사이즈%';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-선반___-사이즈%';

-- 기둥-높이... 형식 (사이즈 정보 없는 중간 형식) 삭제
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-기둥-높이%';

-- 옛날 오렌지/매트/블루 별도 이름 형식들 삭제
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%오렌지선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%오렌지선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%매트그레이선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%매트그레이선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%메트그레이선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%메트그레이선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%매트선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%매트선반-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-45x%선반-' AND part_id NOT LIKE '%볼트식%';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%선반-' AND part_id NOT LIKE '%볼트식%';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-80x%선반빔-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-80x%블루선반오렌지빔-';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%선반450kg-' AND part_id NOT LIKE '%볼트식%';
DELETE FROM admin_prices WHERE part_id LIKE '하이랙-60x%기둥450kg-' AND part_id NOT LIKE '%볼트식%';

-- =====================================================
-- 6. admin_prices 아이보리 기둥/선반/로드빔 추가
-- (generatePartId 형식: 색상 제거, 하이랙-기둥-사이즈Wx높이H중량)
-- =====================================================

-- 아이보리 기둥 (60x만)
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-기둥-사이즈60x높이150270kg', '하이랙', '기둥', '사이즈60x높이150270kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-기둥-사이즈60x높이200270kg', '하이랙', '기둥', '사이즈60x높이200270kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-기둥-사이즈60x높이250270kg', '하이랙', '기둥', '사이즈60x높이250270kg', 0, datetime('now', 'localtime'), 'migration');

INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-기둥-사이즈60x높이150450kg', '하이랙', '기둥', '사이즈60x높이150450kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-기둥-사이즈60x높이200450kg', '하이랙', '기둥', '사이즈60x높이200450kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-기둥-사이즈60x높이250450kg', '하이랙', '기둥', '사이즈60x높이250450kg', 0, datetime('now', 'localtime'), 'migration');

-- 아이보리 선반 (60x만)
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-선반-사이즈60x108270kg', '하이랙', '선반', '사이즈60x108270kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-선반-사이즈60x150270kg', '하이랙', '선반', '사이즈60x150270kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-선반-사이즈60x200270kg', '하이랙', '선반', '사이즈60x200270kg', 0, datetime('now', 'localtime'), 'migration');

INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-선반-사이즈60x108450kg', '하이랙', '선반', '사이즈60x108450kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-선반-사이즈60x150450kg', '하이랙', '선반', '사이즈60x150450kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-선반-사이즈60x200450kg', '하이랙', '선반', '사이즈60x200450kg', 0, datetime('now', 'localtime'), 'migration');

-- 아이보리 로드빔
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-로드빔-108270kg', '하이랙', '로드빔', '108270kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-로드빔-150270kg', '하이랙', '로드빔', '150270kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-로드빔-200270kg', '하이랙', '로드빔', '200270kg', 0, datetime('now', 'localtime'), 'migration');

INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-로드빔-108450kg', '하이랙', '로드빔', '108450kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-로드빔-150450kg', '하이랙', '로드빔', '150450kg', 0, datetime('now', 'localtime'), 'migration');
INSERT OR IGNORE INTO admin_prices (part_id, rack_type, name, specification, price, updated_at, updated_by)
VALUES ('하이랙-로드빔-200450kg', '하이랙', '로드빔', '200450kg', 0, datetime('now', 'localtime'), 'migration');

-- =====================================================
-- 7. 결과 확인
-- =====================================================

SELECT '=== inventory 하이랙 기둥 확인 ===' AS info;
SELECT part_id, quantity FROM inventory WHERE part_id LIKE '하이랙-기둥%' ORDER BY part_id;

SELECT '=== admin_prices 하이랙 기둥 확인 ===' AS info;
SELECT part_id, price, name FROM admin_prices WHERE part_id LIKE '하이랙-기둥%' ORDER BY part_id;

SELECT '=== admin_prices 하이랙 전체 남은 수 ===' AS info;
SELECT COUNT(*) AS total FROM admin_prices WHERE rack_type = '하이랙';
