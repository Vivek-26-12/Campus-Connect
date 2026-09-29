const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONFIG_FILE = path.join(__dirname, 'services.json');

// Load default config from JSON file if available
let fileConfig = {};
try {
    if (fs.existsSync(CONFIG_FILE)) {
        fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
} catch (err) {
    console.warn('[Service Registry] Failed to read config/services.json, using defaults:', err.message);
}

// Service Registry mapping: environment variables take precedence over config file
const registry = {
    userService: {
        id: 'user-service',
        name: 'User Service',
        pathPrefix: '/users',
        url: (process.env.USER_SERVICE_URL || fileConfig.USER_SERVICE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')
    },
    productService: {
        id: 'product-service',
        name: 'Product Service',
        pathPrefix: '/products',
        url: (process.env.PRODUCT_SERVICE_URL || fileConfig.PRODUCT_SERVICE_URL || 'http://127.0.0.1:3002').replace(/\/$/, '')
    },
    orderService: {
        id: 'order-service',
        name: 'Order Service',
        pathPrefix: '/orders',
        url: (process.env.ORDER_SERVICE_URL || fileConfig.ORDER_SERVICE_URL || 'http://127.0.0.1:3003').replace(/\/$/, '')
    }
};

const config = {
    port: parseInt(process.env.GATEWAY_PORT || process.env.PORT || 3000, 10),
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || fileConfig.REQUEST_TIMEOUT_MS || 5000, 10),
    environment: process.env.NODE_ENV || 'development',
    services: registry,
    getServiceByPrefix: (prefix) => {
        return Object.values(registry).find(s => s.pathPrefix === prefix);
    }
};

module.exports = config;
