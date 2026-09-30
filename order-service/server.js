require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

let mongoose = null;
try {
    mongoose = require('mongoose');
} catch (e) {
    // optional fallback
}

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || process.env.PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || null;

// Configurable Service URLs for inter-service communication (Docker container names or 127.0.0.1)
const USER_SERVICE_URL = (process.env.USER_SERVICE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const PRODUCT_SERVICE_URL = (process.env.PRODUCT_SERVICE_URL || 'http://127.0.0.1:3002').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '3500', 10);

const DATA_FILE = path.join(__dirname, 'data', 'orders.json');
let isMongoConnected = false;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[Order-Service ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Seed data
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

// Database Persistence Helpers (Data Ownership: Order Service owns its data)
const ensureDataStorage = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialOrders, null, 2), 'utf-8');
        console.log('[Order-Service] Initial order database initialized with seed data.');
    }
};

const readFileOrders = () => {
    ensureDataStorage();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[Order-Service Error] Failed reading data:', err.message);
        return [];
    }
};

const writeFileOrders = (orders) => {
    ensureDataStorage();
    fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf-8');
};

// Mongoose Schema & Model
let OrderModel = null;
if (mongoose) {
    const orderSchema = new mongoose.Schema({
        id: { type: Number, required: true, unique: true },
        userId: { type: Number, required: true },
        user: { type: Object, default: {} },
        productId: { type: Number, required: true },
        product: { type: Object, default: {} },
        quantity: { type: Number, default: 1, min: 1 },
        totalAmount: { type: Number, required: true },
        status: { type: String, default: "CONFIRMED" },
        createdAt: { type: String, default: () => new Date().toISOString() }
    }, { versionKey: false });

    OrderModel = mongoose.models.Order || mongoose.model('Order', orderSchema);
}

// Database Connection & Initial Seeding
const initMongoDB = async () => {
    if (!MONGODB_URI || !mongoose) {
        console.log('[Order-Service] No MONGODB_URI provided. Running in persistent local JSON storage mode.');
        return;
    }

    try {
        console.log(`[Order-Service] Connecting to MongoDB Atlas...`);
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        isMongoConnected = true;
        console.log(`[Order-Service] Connected to MongoDB Atlas! Host: ${mongoose.connection.host}, DB: ${mongoose.connection.name}`);

        const count = await OrderModel.countDocuments();
        if (count === 0) {
            console.log('[Order-Service] Seeding initial orders into MongoDB Atlas...');
            await OrderModel.insertMany(initialOrders);
            console.log(`[Order-Service] Seeded ${initialOrders.length} initial orders into MongoDB Atlas.`);
        }
    } catch (err) {
        isMongoConnected = false;
        console.warn(`[Order-Service Notice] MongoDB connection failed (${err.message}). Falling back to local storage.`);
    }
};

const getAllOrders = async () => {
    if (isMongoConnected && OrderModel) {
        try {
            return await OrderModel.find({}, { _id: 0 }).lean();
        } catch (e) {
            console.error('[Order-Service] MongoDB read failed, using local file:', e.message);
        }
    }
    return readFileOrders();
};

const getOrderById = async (orderId) => {
    if (isMongoConnected && OrderModel) {
        try {
            return await OrderModel.findOne({ id: orderId }, { _id: 0 }).lean();
        } catch (e) {
            console.error('[Order-Service] MongoDB read failed, using local file:', e.message);
        }
    }
    const orders = readFileOrders();
    return orders.find(o => o.id === orderId);
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

        let data = null;
        try {
            data = await response.json();
        } catch (jsonErr) {
            data = null;
        }

        return {
            ok: response.ok,
            status: response.status,
            data
        };
    } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
        console.error(`[Order-Service Error] Failed to reach ${serviceName} (${url}): ${err.message}`);
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
        database: isMongoConnected ? "MongoDB Atlas (Connected)" : "Local JSON Storage (Active)",
        mongoConnected: isMongoConnected,
        mongoHost: isMongoConnected && mongoose.connection ? mongoose.connection.host : null,
        mongoDatabase: isMongoConnected && mongoose.connection ? mongoose.connection.name : null,
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
app.get('/orders', async (req, res) => {
    const orders = await getAllOrders();
    res.status(200).json({
        success: true,
        count: orders.length,
        data: orders
    });
});

// GET /orders/:id - Retrieve order by ID
app.get('/orders/:id', async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const order = await getOrderById(orderId);

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

// POST /orders - Inter-service communication & Order Creation
app.post('/orders', async (req, res) => {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Both 'userId' and 'productId' are required to place an order."
        });
    }

    const orderQty = parseInt(quantity || 1, 10);
    if (orderQty <= 0) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Field 'quantity' must be greater than 0."
        });
    }

    // Step 1: Call User Service to validate user
    const userResult = await fetchFromDependency(`${USER_SERVICE_URL}/users/${userId}`, 'User Service');

    if (userResult.unreachable) {
        return res.status(503).json({
            success: false,
            status: 503,
            error: "Service Unavailable",
            message: "User Service is currently unavailable. Order cannot be validated.",
            targetService: "User Service",
            isTimeout: userResult.isTimeout
        });
    }

    if (!userResult.ok || !userResult.data?.data) {
        return res.status(userResult.status === 404 ? 404 : 400).json({
            success: false,
            status: userResult.status,
            error: "Validation Failed",
            message: `User with ID ${userId} does not exist in User Service.`
        });
    }

    const validatedUser = userResult.data.data;

    // Step 2: Call Product Service to validate product
    const productResult = await fetchFromDependency(`${PRODUCT_SERVICE_URL}/products/${productId}`, 'Product Service');

    if (productResult.unreachable) {
        return res.status(503).json({
            success: false,
            status: 503,
            error: "Service Unavailable",
            message: "Product Service is currently unavailable. Order cannot be validated.",
            targetService: "Product Service",
            isTimeout: productResult.isTimeout
        });
    }

    if (!productResult.ok || !productResult.data?.data) {
        return res.status(productResult.status === 404 ? 404 : 400).json({
            success: false,
            status: productResult.status,
            error: "Validation Failed",
            message: `Product with ID ${productId} does not exist in Product Service.`
        });
    }

    const validatedProduct = productResult.data.data;

    // Step 3: Compose Order with validated data
    const orders = await getAllOrders();
    const newOrderId = req.body.id ? parseInt(req.body.id, 10) : (orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1001);

    const newOrder = {
        id: newOrderId,
        userId: validatedUser.id,
        user: {
            id: validatedUser.id,
            name: validatedUser.name,
            email: validatedUser.email,
            department: validatedUser.department
        },
        productId: validatedProduct.id,
        product: {
            id: validatedProduct.id,
            name: validatedProduct.name,
            price: validatedProduct.price,
            category: validatedProduct.category
        },
        quantity: orderQty,
        totalAmount: validatedProduct.price * orderQty,
        status: "CONFIRMED",
        createdAt: new Date().toISOString()
    };

    if (isMongoConnected && OrderModel) {
        try {
            await OrderModel.create(newOrder);
        } catch (e) {
            console.error('[Order-Service] Failed to save to MongoDB:', e.message);
        }
    }

    const fileOrders = readFileOrders();
    fileOrders.push(newOrder);
    writeFileOrders(fileOrders);

    console.log(`[Order-Service] Order #${newOrderId} created successfully! Total: ₹${newOrder.totalAmount}`);

    res.status(201).json({
        success: true,
        message: "Order successfully placed and validated through microservices.",
        data: newOrder
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        status: 404,
        error: "Not Found",
        message: `Endpoint ${req.method} ${req.url} does not exist on Order Service`
    });
});

// Start Server
ensureDataStorage();
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Order-Service] Running independently on port ${PORT}`);
    console.log(`[Order-Service] User Service URL: ${USER_SERVICE_URL}`);
    console.log(`[Order-Service] Product Service URL: ${PRODUCT_SERVICE_URL}`);
    await initMongoDB();
});

module.exports = app;
