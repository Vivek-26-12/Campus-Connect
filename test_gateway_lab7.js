/**
 * Automated Verification Script - Lab 7: API Gateway, Service Discovery & Cloud Deployment
 * Web Services & SOA Laboratory
 *
 * Tests:
 * 1. Gateway Health Check & Service Registry Endpoints
 * 2. Reverse Proxy Routing to User, Product, and Order microservices
 * 3. Inter-service orchestration executed through the Gateway
 * 4. Microservice isolation (proving ports 3001, 3002, 3003 are unreachable from outside)
 * 5. Centralized Error Handling (502 Bad Gateway / 404 on unmapped route)
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';

async function runLab7Tests() {
    console.log('================================================================');
    console.log(' LAB 7: API GATEWAY, SERVICE DISCOVERY & CLOUD DEPLOYMENT TESTS');
    console.log(` Target Gateway: ${GATEWAY_URL}`);
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    async function assertEndpoint(name, url, options, expectedStatus, validateFn) {
        process.stdout.write(`Testing: ${name.padEnd(52)} `);
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
                    customValid = validateFn(data, res);
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

    // --- SECTION 1: Gateway Core & Service Discovery ---
    console.log('--- 1. API GATEWAY HEALTH & SERVICE DISCOVERY ---');
    await assertEndpoint(
        'GET /health (Gateway Health Check)',
        `${GATEWAY_URL}/health`,
        { method: 'GET' },
        200,
        d => d.service === 'api-gateway' && d.status === 'UP' && d.serviceDiscovery
    );

    await assertEndpoint(
        'GET /services (Dynamic Service Registry)',
        `${GATEWAY_URL}/services`,
        { method: 'GET' },
        200,
        d => d.services && d.services.userService && d.services.productService && d.services.orderService
    );

    await assertEndpoint(
        'GET / (Gateway Dashboard & Routing Table)',
        `${GATEWAY_URL}/`,
        { method: 'GET' },
        200,
        d => d.status === 'RUNNING' && d.routingTable
    );

    // --- SECTION 2: Routing /users to User Service ---
    console.log('\n--- 2. GATEWAY ROUTING: USER SERVICE (/users) ---');
    await assertEndpoint(
        'GET /users (List All Users via Gateway)',
        `${GATEWAY_URL}/users`,
        { method: 'GET' },
        200,
        d => d.success === true && Array.isArray(d.data) && d.data.length > 0
    );

    await assertEndpoint(
        'GET /users/101 (Get User 101 via Gateway)',
        `${GATEWAY_URL}/users/101`,
        { method: 'GET' },
        200,
        d => d.success === true && d.data.id === 101 && d.data.name.includes('Aarav')
    );

    await assertEndpoint(
        'GET /users/9999 (User Not Found -> 404 via Gateway)',
        `${GATEWAY_URL}/users/9999`,
        { method: 'GET' },
        404,
        d => d.status === 404
    );

    // --- SECTION 3: Routing /products to Product Service ---
    console.log('\n--- 3. GATEWAY ROUTING: PRODUCT SERVICE (/products) ---');
    await assertEndpoint(
        'GET /products (List All Products via Gateway)',
        `${GATEWAY_URL}/products`,
        { method: 'GET' },
        200,
        d => d.success === true && Array.isArray(d.data) && d.data.length > 0
    );

    await assertEndpoint(
        'GET /products/501 (Get Product 501 via Gateway)',
        `${GATEWAY_URL}/products/501`,
        { method: 'GET' },
        200,
        d => d.success === true && d.data.id === 501 && d.data.price === 650
    );

    await assertEndpoint(
        'GET /products/9999 (Product Not Found -> 404 via Gateway)',
        `${GATEWAY_URL}/products/9999`,
        { method: 'GET' },
        404,
        d => d.status === 404
    );

    // --- SECTION 4: Routing /orders & Inter-Service via Gateway ---
    console.log('\n--- 4. GATEWAY ROUTING: ORDER SERVICE (/orders) ---');
    await assertEndpoint(
        'GET /orders (List All Orders via Gateway)',
        `${GATEWAY_URL}/orders`,
        { method: 'GET' },
        200,
        d => d.success === true && Array.isArray(d.data)
    );

    await assertEndpoint(
        'POST /orders (Place Valid Order via Gateway)',
        `${GATEWAY_URL}/orders`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 101, productId: 501, quantity: 2 })
        },
        201,
        d => d.success === true && d.data.status === 'CONFIRMED' && d.data.totalAmount === 1300
    );

    await assertEndpoint(
        'POST /orders (Invalid User 9999 -> 404 via Gateway)',
        `${GATEWAY_URL}/orders`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 9999, productId: 501, quantity: 1 })
        },
        404
    );

    // --- SECTION 5: Network Isolation Verification ---
    console.log('\n--- 5. MICROSERVICE ISOLATION (DOCKER NETWORK ONLY) ---');
    process.stdout.write('Testing: Direct User Service Port (:3001) blocked        ');
    try {
        await fetch('http://127.0.0.1:3001/users', { signal: AbortSignal.timeout(1000) });
        console.log('\x1b[31m[FAIL]\x1b[0m (Port 3001 is unexpectedly accessible from host)');
        failed++;
    } catch (e) {
        console.log('\x1b[32m[PASS]\x1b[0m (Connection Refused - Port is private)');
        passed++;
    }

    process.stdout.write('Testing: Direct Product Service Port (:3002) blocked     ');
    try {
        await fetch('http://127.0.0.1:3002/products', { signal: AbortSignal.timeout(1000) });
        console.log('\x1b[31m[FAIL]\x1b[0m (Port 3002 is unexpectedly accessible from host)');
        failed++;
    } catch (e) {
        console.log('\x1b[32m[PASS]\x1b[0m (Connection Refused - Port is private)');
        passed++;
    }

    process.stdout.write('Testing: Direct Order Service Port (:3003) blocked       ');
    try {
        await fetch('http://127.0.0.1:3003/orders', { signal: AbortSignal.timeout(1000) });
        console.log('\x1b[31m[FAIL]\x1b[0m (Port 3003 is unexpectedly accessible from host)');
        failed++;
    } catch (e) {
        console.log('\x1b[32m[PASS]\x1b[0m (Connection Refused - Port is private)');
        passed++;
    }

    // --- SECTION 6: Gateway Centralized Error Handling ---
    console.log('\n--- 6. CENTRALIZED ERROR HANDLING ---');
    await assertEndpoint(
        'GET /non-existent-endpoint (404 Fallback)',
        `${GATEWAY_URL}/non-existent-endpoint`,
        { method: 'GET' },
        404,
        d => d.error === 'Not Found'
    );

    console.log('\n================================================================');
    console.log(` LAB 7 TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================\n');

    if (failed === 0) {
        console.log('\x1b[32m>>> ALL LAB 7 GATEWAY & ISOLATION CHECKS PASSED SUCCESSFULLY! <<<\x1b[0m\n');
    }
}

runLab7Tests();
