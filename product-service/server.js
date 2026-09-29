require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PRODUCT_SERVICE_PORT || process.env.PORT || 3002;
const DATA_FILE = path.join(__dirname, 'data', 'products.json');

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[Product-Service ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Database Persistence Helpers (Data Ownership: Product Service owns its data)
const ensureDataStorage = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        const initialProducts = [
            { id: 501, name: "Engineering Physics Textbook", price: 650, stock: 25, category: "Books" },
            { id: 502, name: "Scientific Calculator FX-991CW", price: 1200, stock: 15, category: "Stationery" },
            { id: 503, name: "Campus ID Card Lanyard", price: 150, stock: 50, category: "Accessories" }
        ];
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialProducts, null, 2), 'utf-8');
        console.log('[Product-Service] Initial product database initialized with seed data.');
    }
};

const readProducts = () => {
    ensureDataStorage();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[Product-Service Error] Failed reading data:', err.message);
        return [];
    }
};

const writeProducts = (products) => {
    ensureDataStorage();
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf-8');
};

// Health & Info endpoint
app.get(['/', '/health'], (req, res) => {
    res.json({
        service: "Product Service",
        status: "UP",
        port: PORT,
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
app.get('/products', (req, res) => {
    const products = readProducts();
    res.status(200).json({
        success: true,
        count: products.length,
        data: products
    });
});

// GET /products/:id - Retrieve product by ID
app.get('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const products = readProducts();
    const product = products.find(p => p.id === productId);

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
app.post('/products', (req, res) => {
    const { name, price, stock, category } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Fields 'name' and 'price' are required."
        });
    }

    const products = readProducts();
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

    products.push(newProduct);
    writeProducts(products);

    res.status(201).json({
        success: true,
        message: "Product successfully created",
        data: newProduct
    });
});

// PUT /products/:id - Update existing product
app.put('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const products = readProducts();
    const index = products.findIndex(p => p.id === productId);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `Product with ID ${req.params.id} not found`
        });
    }

    const { name, price, stock, category } = req.body;
    products[index] = {
        ...products[index],
        ...(name && { name: name.trim() }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(stock !== undefined && { stock: parseInt(stock, 10) }),
        ...(category && { category: category.trim() }),
        updatedAt: new Date().toISOString()
    };

    writeProducts(products);

    res.status(200).json({
        success: true,
        message: `Product ${productId} successfully updated`,
        data: products[index]
    });
});

// DELETE /products/:id - Delete product
app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const products = readProducts();
    const index = products.findIndex(p => p.id === productId);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `Product with ID ${req.params.id} not found`
        });
    }

    const deleted = products.splice(index, 1)[0];
    writeProducts(products);

    res.status(200).json({
        success: true,
        message: `Product ${productId} successfully deleted`,
        data: deleted
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Product-Service] Running independently on port ${PORT}`);
    console.log(`[Product-Service] Endpoints available at http://localhost:${PORT}/products`);
});
