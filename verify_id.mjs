
import {
    normalizeHighRackColumnSpec,
    generatePartId,
    generateInventoryPartId
} from './src/utils/unifiedPriceManager.js';

console.log('--- Verification: High Rack ID Logic (ULTRA STRICT DB PARITY) ---');

const tests = [
    {
        name: 'Price ID: High Rack Column (DB Parity)',
        fn: () => generatePartId({
            rackType: '하이랙',
            name: '기둥(메트그레이)',
            specification: '사이즈60x108높이150450kg',
            colorWeight: '메트그레이(볼트식)450kg'
        }),
        // Now expected to preserve attributes like the inventory ID
        expected: '하이랙-기둥메트그레이(볼트식)450kg-사이즈60x높이150450kg'
    },
    {
        name: 'Inventory ID: High Rack Column (DB Parity)',
        fn: () => generateInventoryPartId({
            rackType: '하이랙',
            name: '기둥(메트그레이)',
            specification: '사이즈45x108높이150270kg',
            colorWeight: '메트그레이(볼트식)270kg'
        }),
        expected: '하이랙-기둥메트그레이(볼트식)270kg-사이즈45x높이150270kg'
    },
    {
        name: 'Inventory ID: Blue Column (DB Parity)',
        fn: () => generateInventoryPartId({
            rackType: '하이랙',
            name: '기둥블루',
            specification: '사이즈45x108높이200',
            colorWeight: '블루'
        }),
        expected: '하이랙-기둥블루-사이즈45x높이200'
    }
];

let passed = 0;
tests.forEach(t => {
    const result = t.fn();
    if (result === t.expected) {
        console.log(`✅ [PASS] ${t.name}`);
        passed++;
    } else {
        console.error(`❌ [FAIL] ${t.name}`);
        console.error(`   Expected: ${t.expected}`);
        console.error(`   Actual:   ${result}`);
    }
});

console.log(`\nResult: ${passed}/${tests.length} passed.`);
if (passed === tests.length) process.exit(0);
else process.exit(1);
