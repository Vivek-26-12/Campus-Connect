/**
 * CampusConnect API Gateway
 * Web Services & SOA Laboratory - Lab 7
 * Single entry point, configuration-based service discovery, request logging, and centralized error handling.
 */

const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
const config = require('./config');

const app = express();
const PORT = config.port;

// Initialize Prometheus registry and default node metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'gateway_' });

// Custom Prometheus Metrics for Lab 8
const httpRequestCounter = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests handled by the API Gateway',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests through API Gateway in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register]
});

// Middlewares
app.use(cors());
app.use(express.json());

// 1. Basic Request Logging at Gateway Entry
app.use((req, res, next) => {
    req._startTime = Date.now();
    next();
});

/**
 * Reverse proxy handler that forwards requests to target microservices.
 * Implements centralized error handling (502 / 504) and request/response logging.
 *
 * @param {object} service - The registered service object from the service registry
 */
const proxyRequest = async (service, req, res) => {
    const targetUrl = `${service.url}${req.originalUrl}`;
    const startTime = Date.now();

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Forwarded-For': req.ip || req.connection.remoteAddress,
                'X-Forwarded-Host': req.get('host') || 'api-gateway',
                'X-Gateway-Request-Id': `gw-${Date.now()}-${Math.floor(Math.random() * 1000)}`
            },
            signal: AbortSignal.timeout(config.timeoutMs)
        };

        // Forward request body for mutation methods
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const backendResponse = await fetch(targetUrl, fetchOptions);
        const duration = Date.now() - startTime;
        const responseData = await backendResponse.text();

        // Gateway Request & Response Logging: [Method, Path, Target Service, Status, Duration]
        console.log(`[API-Gateway] ${new Date().toISOString()} | ${req.method} ${req.originalUrl} -> ${service.name} (${targetUrl}) [Status: ${backendResponse.status}] (${duration}ms)`);

        // Record Prometheus Metrics
        httpRequestCounter.inc({ method: req.method, route: service.pathPrefix, status: backendResponse.status.toString() });
        httpRequestDuration.observe({ method: req.method, route: service.pathPrefix, status: backendResponse.status.toString() }, duration / 1000);

        res.status(backendResponse.status);
        res.set('Content-Type', backendResponse.headers.get('content-type') || 'application/json');
        return res.send(responseData);
    } catch (err) {
        const duration = Date.now() - startTime;

        // Distinguish between timeout and connection failure
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        const statusCode = isTimeout ? 504 : 502;
        const errorTitle = isTimeout ? 'Gateway Timeout' : 'Bad Gateway';
        const errorMessage = isTimeout
            ? `Downstream service '${service.name}' failed to respond within ${config.timeoutMs}ms.`
            : `Gateway failed to reach downstream microservice '${service.name}' at ${service.url}.`;

        console.error(`[API-Gateway ERROR] ${new Date().toISOString()} | ${req.method} ${req.originalUrl} -> ${service.name} [Status: ${statusCode}] (${duration}ms) | Cause: ${err.message}`);

        // Record Prometheus Metrics for Error
        httpRequestCounter.inc({ method: req.method, route: service.pathPrefix, status: statusCode.toString() });
        httpRequestDuration.observe({ method: req.method, route: service.pathPrefix, status: statusCode.toString() }, duration / 1000);

        return res.status(statusCode).json({
            success: false,
            status: statusCode,
            error: errorTitle,
            message: errorMessage,
            targetService: service.name,
            targetUrl: targetUrl,
            timestamp: new Date().toISOString(),
            details: err.message
        });
    }
};

// -------------------------------------------------------------
// Core Gateway Endpoints
// -------------------------------------------------------------

// GET /metrics - Prometheus Metrics Scrape Endpoint (Lab 8 Requirement)
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err.message);
    }
});

// GET /health - Gateway health-check endpoint (Part A Requirement)
app.get('/health', (req, res) => {
    httpRequestCounter.inc({ method: 'GET', route: '/health', status: '200' });
    res.status(200).json({
        service: "api-gateway",
        status: "UP",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: config.environment,
        serviceDiscovery: {
            mode: "Configuration-Based Service Registry",
            registeredServices: {
                users: config.services.userService.url,
                products: config.services.productService.url,
                orders: config.services.orderService.url,
                data: config.services.dataService.url
            }
        }
    });
});

// GET /services - Service Discovery Registry Inspection Endpoint (Part B Requirement)
app.get('/services', (req, res) => {
    httpRequestCounter.inc({ method: 'GET', route: '/services', status: '200' });
    res.status(200).json({
        serviceRegistry: "CampusConnect Service Registry",
        mode: "Environment / File Configured (Dynamic Registry Table)",
        timeoutConfigMs: config.timeoutMs,
        services: config.services
    });
});

// GET / - Gateway Landing & Service Discovery Dashboard
app.get('/', (req, res) => {
    httpRequestCounter.inc({ method: 'GET', route: '/', status: '200' });
    res.status(200).json({
        service: "CampusConnect API Gateway",
        description: "Unified entry point for microservices (Lab 7 - Gateway, Service Discovery & Cloud Deployment)",
        status: "RUNNING",
        gatewayPort: PORT,
        healthCheck: "/health",
        registryView: "/services",
        metricsEndpoint: "/metrics",
        routingTable: {
            "/users/*": {
                target: config.services.userService.url,
                service: config.services.userService.name,
                example: `GET /users, GET /users/101, POST /users`
            },
            "/products/*": {
                target: config.services.productService.url,
                service: config.services.productService.name,
                example: `GET /products, GET /products/501, POST /products`
            },
            "/orders/*": {
                target: config.services.orderService.url,
                service: config.services.orderService.name,
                example: `GET /orders, GET /orders/1001, POST /orders`
            },
            "/data/*": {
                target: config.services.dataService.url,
                service: config.services.dataService.name,
                example: `GET /data/health, GET /data/status, POST /data/seed, PATCH /data/update, GET /data/overview`
            }
        }
    });
});

// -------------------------------------------------------------
// Route Incoming Paths to Backend Services (Config-Driven)
// -------------------------------------------------------------
app.use('/users', (req, res) => proxyRequest(config.services.userService, req, res));
app.use('/products', (req, res) => proxyRequest(config.services.productService, req, res));
app.use('/orders', (req, res) => proxyRequest(config.services.orderService, req, res));
app.use('/data', (req, res) => proxyRequest(config.services.dataService, req, res));

// 404 Fallback for Unmapped Gateway Endpoints
app.use((req, res) => {
    httpRequestCounter.inc({ method: req.method, route: 'unmatched', status: '404' });
    res.status(404).json({
        success: false,
        status: 404,
        error: "Not Found",
        message: `Route '${req.method} ${req.originalUrl}' is not registered on the API Gateway.`,
        availableEndpoints: [
            "GET /health",
            "GET /services",
            "GET /metrics",
            "GET /users",
            "GET /products",
            "GET /orders"
        ]
    });
});

// Start Gateway Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`[API-Gateway] Running on http://0.0.0.0:${PORT}`);
    console.log(`[API-Gateway] Service Discovery Configuration:`);
    console.log(`  - /users    -> ${config.services.userService.url}`);
    console.log(`  - /products -> ${config.services.productService.url}`);
    console.log(`  - /orders   -> ${config.services.orderService.url}`);
    console.log(`  - Timeout   -> ${config.timeoutMs}ms`);
    console.log(`====================================================`);
});

module.exports = app;
