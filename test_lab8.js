/**
 * Automated Verification & Traffic Generation Script - Lab 8
 * Kubernetes • GitHub Actions • Prometheus • Grafana
 * Web Services & SOA Laboratory
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLab8Tests() {
    console.log('================================================================');
    console.log(' LAB 8: KUBERNETES, BASIC CI/CD & MONITORING VERIFICATION');
    console.log(` Target Gateway: ${GATEWAY_URL}`);
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    async function testEndpoint(name, url, options = {}) {
        process.stdout.write(`Testing: ${name.padEnd(45)} `);
        try {
            const start = Date.now();
            const res = await fetch(url, options);
            const duration = Date.now() - start;
            if (res.ok) {
                console.log(`\x1b[32m[PASS]\x1b[0m (HTTP ${res.status}, ${duration}ms)`);
                passed++;
                return await res.text();
            } else {
                console.log(`\x1b[33m[WARN]\x1b[0m (HTTP ${res.status}, ${duration}ms)`);
                return await res.text();
            }
        } catch (err) {
            console.log(`\x1b[31m[FAIL]\x1b[0m (${err.message})`);
            failed++;
            return null;
        }
    }

    // --- STEP 1: Basic Health & Service Discovery ---
    console.log('--- Step 1: Gateway & Discovery Endpoints ---');
    await testEndpoint('Gateway Health Check (/health)', `${GATEWAY_URL}/health`);
    await testEndpoint('Service Registry (/services)', `${GATEWAY_URL}/services`);

    // --- STEP 2: Prometheus Metrics Endpoint ---
    console.log('\n--- Step 2: Prometheus /metrics Endpoint ---');
    const metricsData = await testEndpoint('Prometheus Metrics Scrape (/metrics)', `${GATEWAY_URL}/metrics`);
    if (metricsData && metricsData.includes('http_requests_total')) {
        console.log('  -> Confirmed: http_requests_total metric exists in /metrics');
    }

    // --- STEP 3: Functional Microservice Routing ---
    console.log('\n--- Step 3: Functional Routes Through Gateway ---');
    await testEndpoint('Get Users (/users)', `${GATEWAY_URL}/users`);
    await testEndpoint('Get Products (/products)', `${GATEWAY_URL}/products`);
    await testEndpoint('Place Order (/orders)', `${GATEWAY_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 101, productId: 501, quantity: 2 })
    });

    // --- STEP 4: Traffic Generation for Prometheus & Grafana ---
    console.log('\n--- Step 4: Generating API Traffic for Monitoring Observation ---');
    console.log('Sending 25 sample requests to stimulate Prometheus metrics...');
    const endpoints = [
        `${GATEWAY_URL}/health`,
        `${GATEWAY_URL}/users`,
        `${GATEWAY_URL}/products`,
        `${GATEWAY_URL}/metrics`
    ];

    for (let i = 1; i <= 25; i++) {
        const target = endpoints[i % endpoints.length];
        try {
            await fetch(target);
            process.stdout.write(`\r  Traffic generation progress: [${i}/25 requests sent]`);
        } catch (e) {}
        await wait(50);
    }
    console.log('\n  -> Traffic generation completed.');

    // --- STEP 5: Generate safe 404 error traffic to observe error metrics ---
    console.log('\n--- Step 5: Generating Safe Error Traffic (HTTP 404) ---');
    for (let i = 0; i < 5; i++) {
        try {
            await fetch(`${GATEWAY_URL}/non-existent-route-${i}`);
        } catch (e) {}
    }
    console.log('  -> Safe 404 errors generated to populate error rate monitoring.');

    // --- Final Summary ---
    console.log('\n================================================================');
    console.log(` Summary: ${passed} passed, ${failed} failed`);
    console.log(' You can now open Prometheus & Grafana to inspect graphs & metrics!');
    console.log('================================================================');
}

runLab8Tests();
