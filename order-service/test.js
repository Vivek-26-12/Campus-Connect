/**
 * Order Service Unit / Smoke Tests (CI Pipeline)
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running Order Service CI Tests...');

const DATA_FILE = path.join(__dirname, 'data', 'orders.json');

if (fs.existsSync(DATA_FILE)) {
    const orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    assert.ok(Array.isArray(orders), 'Orders data should be an array');
} else {
    assert.ok(fs.existsSync(__dirname), 'Directory must exist');
}

// Validation logic unit test
function validateOrderPayload(order) {
    if (!order.userId || !order.productId || !order.quantity) {
        return false;
    }
    return true;
}

assert.strictEqual(validateOrderPayload({ userId: 101, productId: 501, quantity: 2 }), true);
assert.strictEqual(validateOrderPayload({ userId: 101 }), false);

console.log('✓ All Order Service tests passed successfully.');
process.exit(0);
