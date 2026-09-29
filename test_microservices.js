/**
 * Automated Microservices Test & Verification Script
 * Web Services & SOA Laboratory - Lab 7 Edition
 * Validates Gateway Routing, Service Discovery, Inter-Service Communication, Isolation, and Error Handling
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const USER_URL = process.env.USER_SERVICE_URL || `${GATEWAY_URL}/users`;
const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || `${GATEWAY_URL}/products`;
const ORDER_URL = process.env.ORDER_SERVICE_URL || `${GATEWAY_URL}/orders`;

async function runTests() {
    console.log('====================================================');
    console.log(' CAMPUSCONNECT MICROSERVICES VERIFICATION (LAB 7)   ');
    console.log(` Gateway Target: ${GATEWAY_URL}`);
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    async function assertEndpoint(name, url, options, expectedStatus, validateFn) {
        process.stdout.write(`Testing: ${name.padEnd(46)} `);
        try {
            const res = await fetch(url, options);
            const statusMatch = res.status === expectedStatus;
            let data = null;
            try {
                data = await res.json();
            } catch (e) {}

            let customValid = true;
            if (validateFn && statusMatch) {
                try {
                    customValid = validateFn(data);
                } catch (vErr) {
                    customValid = false;
                }
            }

            if (statusMatch && customValid) {
                console.log(`\x1b[32m[PASS]\x1b[0m (HTTP ${res.status})`);
                passed++;
                return data;
            } else {
                console.log(`\x1b[31m[FAIL]\x1b[0m (Got HTTP ${res.status}, Expected HTTP ${expectedStatus})`);
                if (data) console.log('  Response:', JSON.stringify(data, null, 2));
                failed++;
                return null;
            }
        } catch (err) {
            console.log(`\x1b[31m[ERROR]\x1b[0m (${err.message})`);
            failed++;
            return null;
        }
    }

    // 1. Gateway Health Check & Service Discovery Tests
    console.log('--- 1. API GATEWAY HEALTH & SERVICE DISCOVERY (:3000) ---');
    await assertEndpoint('GET /health (Gateway Health Check)', `${GATEWAY_URL}/health`, { method: 'GET' }, 200, d => d.status === 'UP');
    await assertEndpoint('GET /services (Dynamic Service Registry)', `${GATEWAY_URL}/services`, { method: 'GET' }, 200, d => d.services !== undefined);
    await assertEndpoint('GET / (Gateway Status Dashboard)', `${GATEWAY_URL}/`, { method: 'GET' }, 200, d => d.status === 'RUNNING');

    // 2. User Service via Gateway
    console.log('\n--- 2. USER SERVICE VIA GATEWAY (/users) ---');
    await assertEndpoint('GET /users (List All)', `${USER_URL}`, { method: 'GET' }, 200, d => d.data && d.data.length > 0);
    await assertEndpoint('GET /users/101 (Get Specific)', `${USER_URL}/101`, { method: 'GET' }, 200, d => d.data && d.data.id === 101);
    await assertEndpoint('GET /users/9999 (Invalid ID)', `${USER_URL}/9999`, { method: 'GET' }, 404);

    // 3. Product Service via Gateway
    console.log('\n--- 3. PRODUCT SERVICE VIA GATEWAY (/products) ---');
    await assertEndpoint('GET /products (List All)', `${PRODUCT_URL}`, { method: 'GET' }, 200, d => d.data && d.data.length > 0);
    await assertEndpoint('GET /products/501 (Get Specific)', `${PRODUCT_URL}/501`, { method: 'GET' }, 200, d => d.data && d.data.id === 501);
    await assertEndpoint('GET /products/9999 (Invalid ID)', `${PRODUCT_URL}/9999`, { method: 'GET' }, 404);

    // 4. Order Service & Service-to-Service Tests via Gateway
    console.log('\n--- 4. ORDER SERVICE & SERVICE-TO-SERVICE TESTS (/orders) ---');
    await assertEndpoint('GET /orders (List All)', `${ORDER_URL}`, { method: 'GET' }, 200);

    // Valid Order: Order -> User (101) & Product (501)
    await assertEndpoint(
        'POST /orders (Inter-service Success)',
        `${ORDER_URL}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 101, productId: 501, quantity: 2 })
        },
        201,
        d => d.data && d.data.totalAmount === 1300 && d.data.status === 'CONFIRMED'
    );

    // Invalid User: Order -> User (404)
    await assertEndpoint(
        'POST /orders (Invalid User -> 404)',
        `${ORDER_URL}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 9999, productId: 501, quantity: 1 })
        },
        404
    );

    // Invalid Product: Order -> Product (404)
    await assertEndpoint(
        'POST /orders (Invalid Product -> 404)',
        `${ORDER_URL}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 101, productId: 9999, quantity: 1 })
        },
        404
    );

    // 5. Unreachable service / 404 Centralized Error Handling
    console.log('\n--- 5. CENTRALIZED ERROR HANDLING & NETWORK ISOLATION ---');
    await assertEndpoint('GET /unmapped-route (Gateway 404)', `${GATEWAY_URL}/unmapped-route`, { method: 'GET' }, 404);

    process.stdout.write('Testing: Microservices direct ports isolation       ');
    try {
        await fetch('http://127.0.0.1:3001/users', { signal: AbortSignal.timeout(1000) });
        console.log('\x1b[31m[FAIL]\x1b[0m (Port 3001 is open)');
        failed++;
    } catch (e) {
        console.log('\x1b[32m[PASS]\x1b[0m (Direct ports unexposed - Docker network isolated)');
        passed++;
    }

    console.log('\n====================================================');
    console.log(` RESULTS: Passed: ${passed} | Failed: ${failed}`);
    console.log('====================================================\n');
}

runTests();
