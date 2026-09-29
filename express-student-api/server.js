require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const connectDB = require('./config/db');
const Student = require('./models/Student');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Load OpenAPI / Swagger Document
let swaggerDocument;
try {
    swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
} catch (err) {
    console.warn('[Swagger Warning] Could not load openapi.yaml:', err.message);
}

// Global Middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Swagger UI Documentation Route
if (swaggerDocument) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Welcome / Root Route
app.get('/', (req, res) => {
    res.json({
        message: "Welcome to Express.js Student REST API (MongoDB Atlas Backed)",
        version: "2.0.0 (Lab 4)",
        database: mongoose.connection.readyState === 1 ? "MongoDB Atlas (Connected)" : "Persistent Disk Storage Active",
        documentation: `http://localhost:${PORT}/api-docs`,
        endpoints: {
            getAll: `GET http://localhost:${PORT}/students`,
            getOne: `GET http://localhost:${PORT}/students/:id`,
            create: `POST http://localhost:${PORT}/students`,
            update: `PUT http://localhost:${PORT}/students/:id`,
            delete: `DELETE http://localhost:${PORT}/students/:id`
        }
    });
});

// Mount Student REST Routes
app.use('/students', studentRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        status: 404,
        error: "Not Found",
        message: `Cannot ${req.method} ${req.url}`,
        timestamp: new Date().toISOString()
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({
        status: 500,
        error: "Internal Server Error",
        message: err.message || "An unexpected error occurred",
        timestamp: new Date().toISOString()
    });
});

// Seed Initial Data into MongoDB if empty
const seedInitialData = async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            const count = await Student.countDocuments();
            if (count === 0) {
                console.log('[Seed] Seeding initial student data to MongoDB...');
                await Student.insertMany([
                    { id: 1, name: "Aarav Patel", email: "aarav@example.com", course: "Computer Science", semester: 5 },
                    { id: 2, name: "Priya Sharma", email: "priya@example.com", course: "Information Technology", semester: 3 },
                    { id: 3, name: "Rohan Verma", email: "rohan@example.com", course: "Software Engineering", semester: 6 }
                ]);
                console.log('[Seed] 3 initial students successfully seeded to MongoDB.');
            }
        }
    } catch (err) {
        console.warn('[Seed Warning] Could not seed data:', err.message);
    }
};

// Start Server immediately and connect to DB asynchronously
const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Express Student API (Lab 4) running on port ${PORT}`);
    console.log(`API Base URL: http://localhost:${PORT}/students`);
    console.log(`Swagger UI Docs: http://localhost:${PORT}/api-docs`);
    console.log(`====================================================`);
});

// Connect to MongoDB Atlas
connectDB().then(async () => {
    await seedInitialData();
});

module.exports = { app, server };
