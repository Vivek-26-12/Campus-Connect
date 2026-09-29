const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.warn('[MongoDB Notice] MONGO_URI or MONGODB_URI not defined. Persistent disk storage will be active.');
        return null;
    }

    console.log(`[MongoDB] Connecting to database (${uri})...`);
    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log(`[MongoDB Connected] Host: ${conn.connection.host}, Database: ${conn.connection.name}`);
        return conn;
    } catch (err) {
        console.warn(`[MongoDB Notice] Atlas connection failed (${err.message}). Persistent disk storage is active.`);
        return null;
    }
};

module.exports = connectDB;
