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
const PORT = process.env.PRODUCT_SERVICE_PORT || process.env.PORT || 3002;
const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || null;

let isMongoConnected = false;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[Product-Service ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Seed data
const initialProducts = [
    { id: 501, name: "Engineering Physics Textbook", price: 650, stock: 25, category: "Books" },
    { id: 502, name: "Scientific Calculator FX-991CW", price: 1200, stock: 15, category: "Stationery" },
    { id: 503, name: "Campus ID Card Lanyard", price: 150, stock: 50, category: "Accessories" }
];

// Local File Persistence Helpers
const ensureDataStorage = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialProducts, null, 2), 'utf-8');
        console.log('[Product-Service] Initial product database initialized with seed data.');
    }
};

const readFileProducts = () => {
    ensureDataStorage();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[Product-Service Error] Failed reading data:', err.message);
        return [];
    }
};

const writeFileProducts = (products) => {
    ensureDataStorage();
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf-8');
};

// Mongoose Schema & Model
let ProductModel = null;
if (mongoose) {
    const productSchema = new mongoose.Schema({
        id: { type: Number, required: true, unique: true },
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        stock: { type: Number, default: 0, min: 0 },
        category: { type: String, default: "General" },
        createdAt: { type: String, default: () => new Date().toISOString() },
        updatedAt: { type: String }
    }, { versionKey: false });

    ProductModel = mongoose.models.Product || mongoose.model('Product', productSchema);
}

// Database Connection & Initial Seeding
const initMongoDB = async () => {
    if (!MONGODB_URI || !mongoose) {
        console.log('[Product-Service] No MONGODB_URI provided. Running in persistent local JSON storage mode.');
        return;
    }

    try {
        console.log(`[Product-Service] Connecting to MongoDB Atlas...`);
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        isMongoConnected = true;
        console.log(`[Product-Service] Connected to MongoDB Atlas! Host: ${mongoose.connection.host}, DB: ${mongoose.connection.name}`);

        const count = await ProductModel.countDocuments();
        if (count === 0) {
            console.log('[Product-Service] Seeding initial products into MongoDB Atlas...');
            await ProductModel.insertMany(initialProducts);
            console.log(`[Product-Service] Seeded ${initialProducts.length} initial products into MongoDB Atlas.`);
        }
    } catch (err) {
        isMongoConnected = false;
        console.warn(`[Product-Service Notice] MongoDB connection failed (${err.message}). Falling back to local storage.`);
    }
};

// Universal Data Access Helpers
const getAllProducts = async () => {
    if (isMongoConnected && ProductModel) {
        try {
            return await ProductModel.find({}, { _id: 0 }).lean();
        } catch (e) {
            console.error('[Product-Service] MongoDB read failed, using local file:', e.message);
        }
    }
    return readFileProducts();
};

const getProductById = async (productId) => {
    if (isMongoConnected && ProductModel) {
        try {
            return await ProductModel.findOne({ id: productId }, { _id: 0 }).lean();
        } catch (e) {
            console.error('[Product-Service] MongoDB read failed, using local file:', e.message);
        }
    }
    const products = readFileProducts();
    return products.find(p => p.id === productId);
};

// Health & Info endpoint
app.get(['/', '/health'], (req, res) => {
    res.json({
        service: "Product Service",
        status: "UP",
        port: PORT,
        database: isMongoConnected ? "MongoDB Atlas (Connected)" : "Local JSON Storage (Active)",
        mongoConnected: isMongoConnected,
        mongoHost: isMongoConnected && mongoose.connection ? mongoose.connection.host : null,
        mongoDatabase: isMongoConnected && mongoose.connection ? mongoose.connection.name : null,
        timestamp: new Date().toISOString(),
        endpoints: {
            getAll: `GET /products`,
            getOne: `GET /products/:id`,
            create: `POST /products`,
            update: `PUT /products/:id`,
            delete: `DELETE /products/:id`
        }
    });
});

// GET /products - Retrieve all products
app.get('/products', async (req, res) => {
    const products = await getAllProducts();
    res.status(200).json({
        success: true,
        count: products.length,
        data: products
    });
});

// GET /products/:id - Retrieve product by ID
app.get('/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const product = await getProductById(productId);

    if (!product) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `Product with ID ${req.params.id} not found`
        });
    }

    res.status(200).json({
        success: true,
        data: product
    });
});

// POST /products - Create new product
app.post('/products', async (req, res) => {
    const { name, price, stock, category } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Fields 'name' and 'price' are required."
        });
    }

    const products = await getAllProducts();
    const newId = req.body.id ? parseInt(req.body.id, 10) : (products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 501);

    if (products.some(p => p.id === newId)) {
        return res.status(409).json({
            success: false,
            status: 409,
            error: "Conflict",
            message: `Product with ID ${newId} already exists.`
        });
    }

    const newProduct = {
        id: newId,
        name: name.trim(),
        price: parseFloat(price),
        stock: stock !== undefined ? parseInt(stock, 10) : 10,
        category: category ? category.trim() : "General",
        createdAt: new Date().toISOString()
    };

    if (isMongoConnected && ProductModel) {
        try {
            await ProductModel.create(newProduct);
        } catch (e) {
            console.error('[Product-Service] Failed to save to MongoDB:', e.message);
        }
    }

    const fileProducts = readFileProducts();
    fileProducts.push(newProduct);
    writeFileProducts(fileProducts);

    res.status(201).json({
        success: true,
        message: "Product successfully added to catalog",
        data: newProduct
    });
});

// PUT /products/:id - Update existing product
app.put('/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const existing = await getProductById(productId);

    if (!existing) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `Product with ID ${req.params.id} not found`
        });
    }

    const { name, price, stock, category } = req.body;
    const updates = {
        ...(name && { name: name.trim() }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(stock !== undefined && { stock: parseInt(stock, 10) }),
        ...(category && { category: category.trim() }),
        updatedAt: new Date().toISOString()
    };

    let updatedProduct = null;
    if (isMongoConnected && ProductModel) {
        try {
            updatedProduct = await ProductModel.findOneAndUpdate({ id: productId }, updates, { new: true, select: '-_id' }).lean();
        } catch (e) {
            console.error('[Product-Service] MongoDB update failed:', e.message);
        }
    }

    const fileProducts = readFileProducts();
    const index = fileProducts.findIndex(p => p.id === productId);
    if (index !== -1) {
        fileProducts[index] = { ...fileProducts[index], ...updates };
        writeFileProducts(fileProducts);
        if (!updatedProduct) updatedProduct = fileProducts[index];
    }

    res.status(200).json({
        success: true,
        message: `Product ${productId} successfully updated`,
        data: updatedProduct
    });
});

// DELETE /products/:id - Remove product
app.delete('/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const existing = await getProductById(productId);

    if (!existing) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `Product with ID ${req.params.id} not found`
        });
    }

    if (isMongoConnected && ProductModel) {
        try {
            await ProductModel.findOneAndDelete({ id: productId });
        } catch (e) {
            console.error('[Product-Service] MongoDB delete failed:', e.message);
        }
    }

    const fileProducts = readFileProducts();
    const index = fileProducts.findIndex(p => p.id === productId);
    if (index !== -1) {
        fileProducts.splice(index, 1);
        writeFileProducts(fileProducts);
    }

    res.status(200).json({
        success: true,
        message: `Product ${productId} successfully deleted from catalog`,
        data: existing
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 404,
        error: "Not Found",
        message: `Endpoint ${req.method} ${req.url} does not exist on Product Service`
    });
});

// Start Server
ensureDataStorage();
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Product-Service] Running independently on port ${PORT}`);
    console.log(`[Product-Service] Endpoints available at http://localhost:${PORT}/products`);
    await initMongoDB();
});

module.exports = app;
