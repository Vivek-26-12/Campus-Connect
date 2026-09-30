/**
 * API Gateway Unit / Smoke Tests (CI Pipeline)
 */
const assert = require('assert');
const config = require('./config');

console.log('Running API Gateway CI Tests...');

// 1. Verify Configuration & Registry
assert.ok(config.port, 'Gateway PORT should be defined');
assert.ok(config.services, 'Service registry should exist');
assert.ok(config.services.userService.url, 'User service URL should be configured');
assert.ok(config.services.productService.url, 'Product service URL should be configured');
assert.ok(config.services.orderService.url, 'Order service URL should be configured');

// 2. Verify Prom-client Metrics Integration
const promClient = require('prom-client');
assert.ok(promClient, 'prom-client should be loadable');

console.log('✓ All API Gateway tests passed successfully.');
process.exit(0);
