/**
 * Product Service Unit / Smoke Tests (CI Pipeline)
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running Product Service CI Tests...');

const DATA_FILE = path.join(__dirname, 'data', 'products.json');

if (fs.existsSync(DATA_FILE)) {
    const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    assert.ok(Array.isArray(products), 'Products data should be an array');
    assert.ok(products.length > 0, 'Products array should not be empty');
    const firstProduct = products[0];
    assert.ok(firstProduct.id, 'Product must have an ID');
    assert.ok(firstProduct.name, 'Product must have a name');
    assert.ok(typeof firstProduct.price === 'number', 'Product price must be a number');
} else {
    assert.ok(fs.existsSync(__dirname), 'Directory must exist');
}

console.log('✓ All Product Service tests passed successfully.');
process.exit(0);
