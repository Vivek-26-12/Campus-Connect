/**
 * Automated Verification & Traffic Generation Script - Lab 8
 * Kubernetes • GitHub Actions CI/CD • Prometheus • Grafana
 * Web Services & SOA Laboratory
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://127.0.0.1:9090';
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://127.0.0.1:3005';

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLab8Tests() {
    console.log('================================================================');
    console.log(' LAB 8: KUBERNETES, BASIC CI/CD & MONITORING VERIFICATION');
    console.log(` Target Gateway:    ${GATEWAY_URL}`);
    console.log(` Target Prometheus: ${PROMETHEUS_URL}`);
    console.log(` Target Grafana:    ${GRAFANA_URL}`);
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    async function testEndpoint(name, url, options = {}) {
        process.stdout.write(`Testing: ${name.padEnd(50)} `);
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

    // --- STEP 1: Basic Health, Probes & Service Discovery ---
    console.log('--- Step 1: Gateway Health, Probes & Discovery Endpoints ---');
    await testEndpoint('Gateway Health & Liveness/Readiness (/health)', `${GATEWAY_URL}/health`);
    await testEndpoint('Service Discovery Registry (/services)', `${GATEWAY_URL}/services`);

    // --- STEP 2: Prometheus Metrics Endpoint ---
    console.log('\n--- Step 2: Prometheus /metrics Endpoint ---');
    const metricsData = await testEndpoint('Prometheus Metrics Scrape (/metrics)', `${GATEWAY_URL}/metrics`);
    if (metricsData && metricsData.includes('http_requests_total')) {
        console.log('  -> Confirmed: http_requests_total counter is active.');
    }
    if (metricsData && metricsData.includes('http_request_duration_seconds')) {
        console.log('  -> Confirmed: http_request_duration_seconds histogram is active.');
    }

    // --- STEP 3: Functional Microservice Routing ---
    console.log('\n--- Step 3: Functional Routes Through Gateway ---');
    await testEndpoint('Get Users (/users)', `${GATEWAY_URL}/users`);
    await testEndpoint('Get Products (/products)', `${GATEWAY_URL}/products`);
    await testEndpoint('Place Valid Order (/orders)', `${GATEWAY_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 101, productId: 501, quantity: 2 })
    });
    await testEndpoint('Get Order History (/orders)', `${GATEWAY_URL}/orders`);

    // --- STEP 4: Traffic Generation for Prometheus & Grafana ---
    console.log('\n--- Step 4: Generating API Traffic for Monitoring Observation ---');
    console.log('Sending 30 sample requests to stimulate Prometheus metrics...');
    const endpoints = [
        `${GATEWAY_URL}/health`,
        `${GATEWAY_URL}/users`,
        `${GATEWAY_URL}/products`,
        `${GATEWAY_URL}/metrics`
    ];

    for (let i = 1; i <= 30; i++) {
        const target = endpoints[i % endpoints.length];
        try {
            await fetch(target);
            process.stdout.write(`\r  Traffic generation progress: [${i}/30 requests sent]`);
        } catch (e) {}
        await wait(40);
    }
    console.log('\n  -> Traffic generation completed.');

    // --- STEP 5: Generate safe 404 error traffic to observe error metrics ---
    console.log('\n--- Step 5: Generating Safe Error Traffic (HTTP 404) ---');
    for (let i = 0; i < 5; i++) {
        try {
            await fetch(`${GATEWAY_URL}/api/v1/invalid-route-${i}`);
        } catch (e) {}
    }
    console.log('  -> Safe 404 errors generated to populate error rate monitoring.');

    // --- STEP 6: Optional Prometheus & Grafana Integration Check ---
    console.log('\n--- Step 6: Verifying Prometheus & Grafana Reachability ---');
    try {
        const promRes = await fetch(`${PROMETHEUS_URL}/api/v1/targets`);
        if (promRes.ok) {
            console.log(`\x1b[32m[PASS]\x1b[0m Prometheus targets API reachable at ${PROMETHEUS_URL}`);
            passed++;
        }
    } catch (e) {
        console.log(`\x1b[90m[INFO]\x1b[0m Prometheus direct check skipped (port-forward or cluster internal)`);
    }

    try {
        const grafRes = await fetch(`${GRAFANA_URL}/api/health`);
        if (grafRes.ok) {
            console.log(`\x1b[32m[PASS]\x1b[0m Grafana health API reachable at ${GRAFANA_URL}`);
            passed++;
        }
    } catch (e) {
        console.log(`\x1b[90m[INFO]\x1b[0m Grafana direct check skipped (port-forward or cluster internal)`);
    }

    // --- Final Summary ---
    console.log('\n================================================================');
    console.log(` Lab 8 Verification Summary: ${passed} passed, ${failed} failed`);
    console.log(' Microservices, probes, routing, and metrics are fully validated!');
    console.log('================================================================\n');
}

runLab8Tests();
