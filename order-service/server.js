require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || process.env.PORT || 3003;

// Configurable Service URLs for inter-service communication (Docker container names or 127.0.0.1)
const USER_SERVICE_URL = (process.env.USER_SERVICE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const PRODUCT_SERVICE_URL = (process.env.PRODUCT_SERVICE_URL || 'http://127.0.0.1:3002').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '3500', 10);

const DATA_FILE = path.join(__dirname, 'data', 'orders.json');

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[Order-Service ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Database Persistence Helpers (Data Ownership: Order Service owns its data)
const ensureDataStorage = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        const initialOrders = [
            {
                id: 1,
                userId: 101,
                user: { id: 101, name: "Aarav Patel", email: "aarav@campus.edu", department: "Computer Science" },
                productId: 501,
                product: { id: 501, name: "Engineering Physics Textbook", price: 650, category: "Books" },
                quantity: 1,
                totalAmount: 650,
                status: "CONFIRMED",
                createdAt: new Date().toISOString()
            }
        ];
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialOrders, null, 2), 'utf-8');
        console.log('[Order-Service] Initial order database initialized with seed data.');
    }
};

const readOrders = () => {
    ensureDataStorage();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[Order-Service Error] Failed reading data:', err.message);
        return [];
    }
};

const writeOrders = (orders) => {
    ensureDataStorage();
    fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf-8');
};

/**
 * Helper to call dependency services with timeout and graceful error reporting
 */
async function fetchFromDependency(url, serviceName) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        console.log(`[Order-Service] Calling ${serviceName} at: ${url}`);
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        let body = null;
        try {
            body = await response.json();
        } catch (e) {
            body = null;
        }

        return {
            ok: response.ok,
            status: response.status,
            data: body
        };
    } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT';
        console.error(`[Order-Service Error] Failed communicating with ${serviceName} at ${url}:`, err.message);
        return {
            unreachable: true,
            isTimeout,
            error: err.message
        };
    }
}

// Health & Info Endpoint
app.get(['/', '/health'], (req, res) => {
    res.json({
        service: "Order Service",
        status: "UP",
        port: PORT,
        dependencies: {
            userServiceUrl: USER_SERVICE_URL,
            productServiceUrl: PRODUCT_SERVICE_URL
        },
        timestamp: new Date().toISOString(),
        endpoints: {
            getAll: `GET /orders`,
            getOne: `GET /orders/:id`,
            create: `POST /orders`
        }
    });
});

// GET /orders - Retrieve all orders
app.get('/orders', (req, res) => {
    const orders = readOrders();
    res.status(200).json({
        success: true,
        count: orders.length,
        data: orders
    });
});

// GET /orders/:id - Retrieve order by ID
app.get('/orders/:id', (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const orders = readOrders();
    const order = orders.find(o => o.id === orderId);

    if (!order) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `Order with ID ${req.params.id} not found`
        });
    }

    res.status(200).json({
        success: true,
        data: order
    });
});

/**
 * POST /orders - Create order with inter-service validation
 * Body: { "userId": 101, "productId": 501, "quantity": 2 }
 */
app.post('/orders', async (req, res) => {
    const { userId, productId, quantity } = req.body;

    // 1. Basic payload validation
    if (userId === undefined || productId === undefined) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Missing required fields: 'userId' and 'productId' must be provided."
        });
    }

    const orderQty = quantity !== undefined ? parseInt(quantity, 10) : 1;
    if (isNaN(orderQty) || orderQty <= 0) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Field 'quantity' must be a positive integer greater than 0."
        });
    }

    // 2. Validate User with User Service (Service-to-Service call)
    const userTargetUrl = `${USER_SERVICE_URL}/users/${userId}`;
    const userResult = await fetchFromDependency(userTargetUrl, 'User Service');

    if (userResult.unreachable) {
        return res.status(503).json({
            success: false,
            status: 503,
            error: "Service Unavailable",
            message: "User Service is currently unavailable. Order cannot be validated.",
            dependency: "User Service",
            targetUrl: userTargetUrl,
            details: userResult.isTimeout ? "Connection timed out" : userResult.error
        });
    }

    if (userResult.status === 404 || !userResult.ok) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `User with ID ${userId} does not exist in User Service`,
            dependency: "User Service"
        });
    }

    const userObj = userResult.data && userResult.data.data ? userResult.data.data : userResult.data;

    // 3. Validate Product with Product Service (Service-to-Service call)
    const productTargetUrl = `${PRODUCT_SERVICE_URL}/products/${productId}`;
    const productResult = await fetchFromDependency(productTargetUrl, 'Product Service');

    if (productResult.unreachable) {
        return res.status(503).json({
            success: false,
            status: 503,
            error: "Service Unavailable",
            message: "Product Service is currently unavailable. Order cannot be validated.",
            dependency: "Product Service",
            targetUrl: productTargetUrl,
            details: productResult.isTimeout ? "Connection timed out" : productResult.error
        });
    }

    if (productResult.status === 404 || !productResult.ok) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `Product with ID ${productId} does not exist in Product Service`,
            dependency: "Product Service"
        });
    }

    const productObj = productResult.data && productResult.data.data ? productResult.data.data : productResult.data;

    // 4. Validate stock
    if (productObj.stock !== undefined && productObj.stock < orderQty) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: `Insufficient stock for '${productObj.name}'. Available: ${productObj.stock}, requested: ${orderQty}`
        });
    }

    // 5. Construct and Save new Order
    const orders = readOrders();
    const newOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
    const totalAmount = parseFloat((productObj.price * orderQty).toFixed(2));

    const newOrder = {
        id: newOrderId,
        userId: parseInt(userId, 10),
        user: {
            id: userObj.id,
            name: userObj.name,
            email: userObj.email,
            department: userObj.department || "General"
        },
        productId: parseInt(productId, 10),
        product: {
            id: productObj.id,
            name: productObj.name,
            price: productObj.price,
            category: productObj.category || "General"
        },
        quantity: orderQty,
        totalAmount: totalAmount,
        status: "CONFIRMED",
        createdAt: new Date().toISOString()
    };

    orders.push(newOrder);
    writeOrders(orders);

    console.log(`[Order-Service] Order #${newOrderId} confirmed for User ${userObj.name} (${userObj.id}) and Product ${productObj.name} (${productObj.id})`);

    res.status(201).json({
        success: true,
        message: "Order successfully placed and verified across microservices",
        data: newOrder
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 404,
        error: "Not Found",
        message: `Endpoint ${req.method} ${req.url} does not exist on Order Service`
    });
});

// Start Server
ensureDataStorage();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Order-Service] Running independently on port ${PORT}`);
    console.log(`[Order-Service] User Service URL: ${USER_SERVICE_URL}`);
    console.log(`[Order-Service] Product Service URL: ${PRODUCT_SERVICE_URL}`);
    console.log(`[Order-Service] Endpoints available at http://localhost:${PORT}/orders`);
});
