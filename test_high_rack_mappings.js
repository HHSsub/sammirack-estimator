import { generatePartId, generateInventoryPartId } from './src/utils/unifiedPriceManager.js';

// Mock Item Helpers
const createItem = (name, spec, color, colorWeight) => ({
    rackType: '하이랙',
    name,
    specification: spec,
    color,
    colorWeight
});

console.log("=== High Rack ID Verification (Depth Unification) ===");

// 1. Ivory Column (Inventory & Price)
console.log("\n[Test 1] Ivory Column 60x108 H150 270kg");
const ivoryCol = createItem('기둥', '사이즈 60x108 높이 150 270kg', '아이보리', '아이보리(볼트식)270kg');
const invId1 = generateInventoryPartId(ivoryCol);
const priceId1 = generatePartId(ivoryCol);

console.log(`Inventory ID: ${invId1}`);
// Expected: Depth 108 is removed -> 60x
console.log(`Expected Inv: 하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이150270kg`);

console.log(`Price ID    : ${priceId1}`);
// Expected: Depth 108 is removed -> 60x
console.log(`Expected Prc: 하이랙-기둥-사이즈60x높이150270kg`);

// 2. MetGrey Shelf (Inventory & Price) - Shelf should NOT be affected
console.log("\n[Test 2] MetGrey Shelf 60x150 270kg");
const metShelf = createItem('선반', '사이즈 60x150 270kg', '메트그레이', '메트그레이(볼트식)270kg');
const invId2 = generateInventoryPartId(metShelf);
const priceId2 = generatePartId(metShelf);
console.log(`Inventory ID: ${invId2}`);
console.log(`Expected Inv: 하이랙-선반메트그레이(볼트식)270kg-사이즈60x150270kg`); // Retains 150
console.log(`Price ID    : ${priceId2}`);
console.log(`Expected Prc: 하이랙-선반-사이즈60x150270kg`); // Retains 150

// 3. Blue/Orange Beam (Inventory & Price)
console.log("\n[Test 3] Blue/Orange Beam 2590 270kg");
const blueOrangeBeam = createItem('로드빔', '200 270kg', '블루', '블루(기둥)+오렌지(가로대)(볼트식)270kg');
const invId3 = generateInventoryPartId(blueOrangeBeam);
const priceId3 = generatePartId(blueOrangeBeam);
console.log(`Inventory ID: ${invId3}`);
console.log(`Expected Inv: 하이랙-로드빔블루(기둥)+오렌지(가로대)(볼트식)270kg-200270kg`);
console.log(`Price ID    : ${priceId3}`);
console.log(`Expected Prc: 하이랙-로드빔-200270kg`);

console.log("\n=== Final Verdict ===");
const pass1 = priceId1 === '하이랙-기둥-사이즈60x높이150270kg';
const pass1_inv = invId1 === '하이랙-기둥아이보리(볼트식)270kg-사이즈60x높이150270kg';
const pass2 = priceId2 === '하이랙-선반-사이즈60x150270kg';
const pass3 = priceId3 === '하이랙-로드빔-200270kg';

if (pass1 && pass1_inv && pass2 && pass3) {
    console.log("SUCCESS: High Rack Column Depth Ignored, others untouched.");
} else {
    console.log("FAILURE: Rules mismatch.");
    if (!pass1) console.log(` - Column Price ID Mismatch: Got ${priceId1}`);
    if (!pass1_inv) console.log(` - Column Inventory ID Mismatch: Got ${invId1}`);
    if (!pass2) console.log(` - Shelf ID Mismatch: Got ${priceId2}`);
    if (!pass3) console.log(` - Beam ID Mismatch: Got ${priceId3}`);
}
