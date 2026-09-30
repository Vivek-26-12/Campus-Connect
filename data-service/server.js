/**
 * CampusConnect Data & Persistence Microservice (5th Microservice)
 * Responsible for centralized MongoDB Atlas connection management, data synchronization,
 * cross-collection queries, updates, and database diagnostics.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

let mongoose = null;
try {
    mongoose = require('mongoose');
} catch (e) {
    // optional fallback
}

const app = express();
const PORT = process.env.DATA_SERVICE_PORT || process.env.PORT || 3004;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || null;

let isMongoConnected = false;
let mongoConnectionError = null;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[Data-Service ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// -------------------------------------------------------------
// Mongoose Schemas & Models
// -------------------------------------------------------------
let UserModel, ProductModel, OrderModel;

if (mongoose) {
    const userSchema = new mongoose.Schema({
        id: { type: Number, required: true, unique: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        department: { type: String, default: "General" },
        role: { type: String, default: "Student" },
        createdAt: { type: String, default: () => new Date().toISOString() },
        updatedAt: { type: String }
    }, { versionKey: false, timestamps: true });

    const productSchema = new mongoose.Schema({
        id: { type: Number, required: true, unique: true },
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        stock: { type: Number, default: 0, min: 0 },
        category: { type: String, default: "General" },
        createdAt: { type: String, default: () => new Date().toISOString() },
        updatedAt: { type: String }
    }, { versionKey: false, timestamps: true });

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
    }, { versionKey: false, timestamps: true });

    UserModel = mongoose.models.User || mongoose.model('User', userSchema);
    ProductModel = mongoose.models.Product || mongoose.model('Product', productSchema);
    OrderModel = mongoose.models.Order || mongoose.model('Order', orderSchema);
}

// -------------------------------------------------------------
// Database Connection
// -------------------------------------------------------------
const connectMongoDB = async () => {
    if (!MONGODB_URI || !mongoose) {
        console.warn('[Data-Service] MONGODB_URI not provided. Running in memory / mock connection mode.');
        return;
    }

    try {
        console.log(`[Data-Service] Connecting to MongoDB Atlas (${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')})...`);
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        isMongoConnected = true;
        mongoConnectionError = null;
        console.log(`[Data-Service Connected] Host: ${mongoose.connection.host}, DB: ${mongoose.connection.name}`);
    } catch (err) {
        isMongoConnected = false;
        mongoConnectionError = err.message;
        console.error(`[Data-Service Error] MongoDB Atlas connection failed: ${err.message}`);
    }
};

// -------------------------------------------------------------
// Endpoints
// -------------------------------------------------------------

// 1. GET /health - Connection & Health Status
app.get(['/', '/health'], async (req, res) => {
    let pingTimeMs = null;
    if (isMongoConnected && mongoose.connection?.db) {
        try {
            const start = Date.now();
            await mongoose.connection.db.admin().ping();
            pingTimeMs = Date.now() - start;
        } catch (e) {
            pingTimeMs = null;
        }
    }

    res.status(200).json({
        service: "Data & Persistence Service",
        role: "5th Microservice (MongoDB Atlas Connection & Data Sync Manager)",
        status: "UP",
        port: PORT,
        database: {
            connected: isMongoConnected,
            driver: mongoose ? `Mongoose ${mongoose.version}` : 'Not Loaded',
            host: isMongoConnected ? mongoose.connection.host : null,
            name: isMongoConnected ? mongoose.connection.name : null,
            pingMs: pingTimeMs,
            error: mongoConnectionError
        },
        timestamp: new Date().toISOString()
    });
});

// 2. GET /status - Detailed Collection Statistics
app.get('/status', async (req, res) => {
    if (!isMongoConnected) {
        return res.status(503).json({
            success: false,
            status: 503,
            message: "MongoDB Atlas is not connected.",
            error: mongoConnectionError
        });
    }

    try {
        const [userCount, productCount, orderCount] = await Promise.all([
            UserModel.countDocuments(),
            ProductModel.countDocuments(),
            OrderModel.countDocuments()
        ]);

        res.status(200).json({
            success: true,
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            collections: {
                users: userCount,
                products: productCount,
                orders: orderCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. POST /seed - Seed Initial Data into MongoDB Atlas
app.post('/seed', async (req, res) => {
    if (!isMongoConnected) {
        return res.status(503).json({
            success: false,
            message: "Cannot seed data: MongoDB Atlas is not connected."
        });
    }

    try {
        const initialUsers = [
            { id: 101, name: "Aarav Patel", email: "aarav@campus.edu", department: "Computer Science", role: "Student" },
            { id: 102, name: "Priya Sharma", email: "priya@campus.edu", department: "Information Technology", role: "Faculty" },
            { id: 103, name: "Rohan Verma", email: "rohan@campus.edu", department: "Software Engineering", role: "Student" }
        ];

        const initialProducts = [
            { id: 501, name: "Engineering Physics Textbook", price: 650, stock: 25, category: "Books" },
            { id: 502, name: "Scientific Calculator FX-991CW", price: 1200, stock: 15, category: "Stationery" },
            { id: 503, name: "Campus ID Card Lanyard", price: 150, stock: 50, category: "Accessories" }
        ];

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

        // Upsert users
        for (const u of initialUsers) {
            await UserModel.findOneAndUpdate({ id: u.id }, u, { upsert: true, new: true });
        }
        // Upsert products
        for (const p of initialProducts) {
            await ProductModel.findOneAndUpdate({ id: p.id }, p, { upsert: true, new: true });
        }
        // Upsert orders
        for (const o of initialOrders) {
            await OrderModel.findOneAndUpdate({ id: o.id }, o, { upsert: true, new: true });
        }

        const counts = {
            users: await UserModel.countDocuments(),
            products: await ProductModel.countDocuments(),
            orders: await OrderModel.countDocuments()
        };

        res.status(200).json({
            success: true,
            message: "Initial dataset successfully seeded and synced into MongoDB Atlas!",
            collections: counts
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. PATCH /update - Universal Updater (Update any collection & document)
app.patch('/update', async (req, res) => {
    if (!isMongoConnected) {
        return res.status(503).json({ success: false, message: "MongoDB Atlas is not connected." });
    }

    const { collection, filter, update } = req.body;

    if (!collection || !filter || !update) {
        return res.status(400).json({
            success: false,
            message: "Body must contain 'collection' ('users'|'products'|'orders'), 'filter' object, and 'update' object."
        });
    }

    let Model = null;
    if (collection === 'users') Model = UserModel;
    else if (collection === 'products') Model = ProductModel;
    else if (collection === 'orders') Model = OrderModel;
    else {
        return res.status(400).json({ success: false, message: `Unknown collection '${collection}'` });
    }

    try {
        const result = await Model.findOneAndUpdate(filter, { ...update, updatedAt: new Date().toISOString() }, { new: true });
        if (!result) {
            return res.status(404).json({ success: false, message: "No document matched the provided filter." });
        }

        res.status(200).json({
            success: true,
            message: `Document in '${collection}' successfully updated.`,
            data: result
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. GET /overview - Cross-Collection System Aggregates
app.get('/overview', async (req, res) => {
    if (!isMongoConnected) {
        return res.status(503).json({ success: false, message: "MongoDB Atlas is not connected." });
    }

    try {
        const [users, products, orders] = await Promise.all([
            UserModel.find().lean(),
            ProductModel.find().lean(),
            OrderModel.find().lean()
        ]);

        const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const inventoryValuation = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        res.status(200).json({
            success: true,
            overview: {
                totalUsers: users.length,
                totalProducts: products.length,
                totalStockItems: totalStock,
                inventoryValuationINR: inventoryValuation,
                totalOrdersPlaced: orders.length,
                totalRevenueINR: totalRevenue
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Data-Service] Running independently on port ${PORT}`);
    await connectMongoDB();
});

module.exports = app;
