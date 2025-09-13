/**
 * Subtotal 정책 계산 유틸
 * 정책 종류:
 *  - BOM_ONLY_WITH_ITEM_FALLBACK: BOM(원자재) 항목이 1개 이상이면 BOM 합계, 아니면 품목(Item) 합계
 *  - BOM_ONLY_STRICT: BOM 항목 합계만 (BOM 없으면 0)
 *  - ITEM_ONLY: 품목 합계만
 *  - SUM_BOTH: 두 합계를 단순 합산 (기존 문제 상황)
 */
export function extractSubtotal({
  itemSum = 0,
  matSum = 0,
  materialCount = 0,
  policy = 'BOM_ONLY_WITH_ITEM_FALLBACK'
}) {
  switch (policy) {
    case 'BOM_ONLY_WITH_ITEM_FALLBACK':
      return materialCount > 0 ? matSum : itemSum;
    case 'BOM_ONLY_STRICT':
      return matSum;
    case 'ITEM_ONLY':
      return itemSum;
    case 'SUM_BOTH':
      return itemSum + matSum;
    default:
      return materialCount > 0 ? matSum : itemSum;
  }
}
