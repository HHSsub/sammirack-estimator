const fs = require('fs');

const sqlContent = \`
-- ======================================================================================
-- [Migration Script] High Rack Column Depth Unification (하이랙 기둥 Depth 통합)
-- ======================================================================================
-- 목표: 하이랙 기둥의 ID에서 Depth 정보(예: 108, 150)를 제거하고 '너비x' 형태로 통일
-- 예: '...사이즈60x108높이...' -> '...사이즈60x높이...'
-- 적용 대상: inventory (재고), admin_prices (단가)
-- 주의: MySQL 8.0+ 또는 MariaDB 10.0.5+ (REGEXP_REPLACE 지원 버전) 필요
-- ======================================================================================

START TRANSACTION;

-- --------------------------------------------------------------------------------------
-- 1. Inventory Table Migration
-- --------------------------------------------------------------------------------------

-- 1-1. 백업 테이블 생성 (안전장치)
CREATE TABLE IF NOT EXISTS inventory_backup_phase_i AS SELECT * FROM inventory;

-- 1-2. 통합될 ID와 수량 집계 (임시 테이블)
CREATE TEMPORARY TABLE temp_high_rack_inventory AS
SELECT 
    REGEXP_REPLACE(part_id, '사이즈([0-9]+)x[0-9]+높이', '사이즈\\\\1x높이') AS new_part_id,
    SUM(quantity) as total_quantity
FROM inventory
WHERE part_id LIKE '하이랙-기둥%' 
  AND part_id REGEXP '사이즈[0-9]+x[0-9]+높이'
GROUP BY new_part_id;

-- 1-3. 기존 데이터 삭제 (하이랙 기둥 중 Depth가 있는 항목)
DELETE FROM inventory 
WHERE part_id LIKE '하이랙-기둥%' 
  AND part_id REGEXP '사이즈[0-9]+x[0-9]+높이';

-- 1-4. 통합된 데이터 삽입 (Duplicate Key Update)
-- 임시 테이블의 데이터를 inventory에 삽입하되, 이미 존재하면 수량 더하기
INSERT INTO inventory (part_id, quantity)
SELECT new_part_id, total_quantity 
FROM temp_high_rack_inventory
ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity);

-- --------------------------------------------------------------------------------------
-- 2. Admin Prices Table Migration
-- --------------------------------------------------------------------------------------

-- 2-1. 백업 테이블 생성
CREATE TABLE IF NOT EXISTS admin_prices_backup_phase_i AS SELECT * FROM admin_prices;

-- 2-2. 통합될 ID 집계 (임시 테이블)
-- 단가는 SUM이 아니라 MAX(price) 또는 최신값 사용. 여기서는 MAX 사용 (혹은 ANY_VALUE)
CREATE TEMPORARY TABLE temp_high_rack_prices AS
SELECT 
    REGEXP_REPLACE(part_id, '사이즈([0-9]+)x[0-9]+높이', '사이즈\\\\1x높이') AS new_part_id,
    MAX(price) as price, -- 동일 부품이므로 가격은 같다고 가정, 안전하게 MAX
    MAX(updated_at) as updated_at
FROM admin_prices
WHERE part_id LIKE '하이랙-기둥%' 
  AND part_id REGEXP '사이즈[0-9]+x[0-9]+높이'
GROUP BY new_part_id;

-- 2-3. 기존 데이터 삭제
DELETE FROM admin_prices 
WHERE part_id LIKE '하이랙-기둥%' 
  AND part_id REGEXP '사이즈[0-9]+x[0-9]+높이';

-- 2-4. 통합된 데이터 삽입
INSERT INTO admin_prices (part_id, price, updated_at)
SELECT new_part_id, price, updated_at
FROM temp_high_rack_prices
ON DUPLICATE KEY UPDATE 
    price = VALUES(price),
    updated_at = VALUES(updated_at);

-- --------------------------------------------------------------------------------------
-- 3. Cleanup & Commit
-- --------------------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS temp_high_rack_inventory;
DROP TEMPORARY TABLE IF EXISTS temp_high_rack_prices;

COMMIT;

-- ======================================================================================
-- Migration Complete
-- 확인 쿼리:
-- SELECT * FROM inventory WHERE part_id LIKE '하이랙-기둥%';
-- ======================================================================================
\`;

fs.writeFileSync('migration_high_rack_depth_unification.sql', sqlContent);
console.log('✅ Generated SQL Migration File: migration_high_rack_depth_unification.sql');
\`;

module.exports = { };
