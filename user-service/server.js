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
const PORT = process.env.USER_SERVICE_PORT || process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || null;

let isMongoConnected = false;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[User-Service ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Seed data
const initialUsers = [
    { id: 101, name: "Aarav Patel", email: "aarav@campus.edu", department: "Computer Science", role: "Student" },
    { id: 102, name: "Priya Sharma", email: "priya@campus.edu", department: "Information Technology", role: "Faculty" },
    { id: 103, name: "Rohan Verma", email: "rohan@campus.edu", department: "Software Engineering", role: "Student" }
];

// Local File Persistence Helpers
const ensureDataStorage = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
        console.log('[User-Service] Initial user database initialized with seed data.');
    }
};

const readFileUsers = () => {
    ensureDataStorage();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[User-Service Error] Failed reading data:', err.message);
        return [];
    }
};

const writeFileUsers = (users) => {
    ensureDataStorage();
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
};

// Mongoose Schema & Model
let UserModel = null;
if (mongoose) {
    const userSchema = new mongoose.Schema({
        id: { type: Number, required: true, unique: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        department: { type: String, default: "General" },
        role: { type: String, default: "Student" },
        createdAt: { type: String, default: () => new Date().toISOString() },
        updatedAt: { type: String }
    }, { versionKey: false });

    UserModel = mongoose.models.User || mongoose.model('User', userSchema);
}

// Database Connection & Initial Seeding
const initMongoDB = async () => {
    if (!MONGODB_URI || !mongoose) {
        console.log('[User-Service] No MONGODB_URI provided. Running in persistent local JSON storage mode.');
        return;
    }

    try {
        console.log(`[User-Service] Connecting to MongoDB Atlas...`);
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        isMongoConnected = true;
        console.log(`[User-Service] Connected to MongoDB Atlas! Host: ${mongoose.connection.host}, DB: ${mongoose.connection.name}`);

        // Seed initial data to MongoDB if collection is empty
        const count = await UserModel.countDocuments();
        if (count === 0) {
            console.log('[User-Service] Seeding initial users into MongoDB Atlas...');
            await UserModel.insertMany(initialUsers);
            console.log(`[User-Service] Seeded ${initialUsers.length} initial users into MongoDB Atlas.`);
        }
    } catch (err) {
        isMongoConnected = false;
        console.warn(`[User-Service Notice] MongoDB connection failed (${err.message}). Falling back to local storage.`);
    }
};

// Universal Data Access Helpers
const getAllUsers = async () => {
    if (isMongoConnected && UserModel) {
        try {
            return await UserModel.find({}, { _id: 0 }).lean();
        } catch (e) {
            console.error('[User-Service] MongoDB read failed, using local file:', e.message);
        }
    }
    return readFileUsers();
};

const getUserById = async (userId) => {
    if (isMongoConnected && UserModel) {
        try {
            return await UserModel.findOne({ id: userId }, { _id: 0 }).lean();
        } catch (e) {
            console.error('[User-Service] MongoDB read failed, using local file:', e.message);
        }
    }
    const users = readFileUsers();
    return users.find(u => u.id === userId);
};

// Health and Info endpoint
app.get(['/', '/health'], (req, res) => {
    res.json({
        service: "User Service",
        status: "UP",
        port: PORT,
        database: isMongoConnected ? "MongoDB Atlas (Connected)" : "Local JSON Storage (Active)",
        mongoConnected: isMongoConnected,
        mongoHost: isMongoConnected && mongoose.connection ? mongoose.connection.host : null,
        mongoDatabase: isMongoConnected && mongoose.connection ? mongoose.connection.name : null,
        timestamp: new Date().toISOString(),
        endpoints: {
            getAll: `GET /users`,
            getOne: `GET /users/:id`,
            create: `POST /users`,
            update: `PUT /users/:id`,
            delete: `DELETE /users/:id`
        }
    });
});

// GET /users - Retrieve all users
app.get('/users', async (req, res) => {
    const users = await getAllUsers();
    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

// GET /users/:id - Retrieve user by ID
app.get('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const user = await getUserById(userId);

    if (!user) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `User with ID ${req.params.id} not found`
        });
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

// POST /users - Create new user
app.post('/users', async (req, res) => {
    const { name, email, department, role } = req.body;

    if (!name || !email) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Fields 'name' and 'email' are required."
        });
    }

    const users = await getAllUsers();
    const newId = req.body.id ? parseInt(req.body.id, 10) : (users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 101);

    if (users.some(u => u.id === newId)) {
        return res.status(409).json({
            success: false,
            status: 409,
            error: "Conflict",
            message: `User with ID ${newId} already exists.`
        });
    }

    const newUser = {
        id: newId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department ? department.trim() : "General",
        role: role ? role.trim() : "Student",
        createdAt: new Date().toISOString()
    };

    if (isMongoConnected && UserModel) {
        try {
            await UserModel.create(newUser);
        } catch (e) {
            console.error('[User-Service] Failed to save to MongoDB:', e.message);
        }
    }

    // Always keep local disk storage in sync
    const fileUsers = readFileUsers();
    fileUsers.push(newUser);
    writeFileUsers(fileUsers);

    res.status(201).json({
        success: true,
        message: "User successfully created",
        data: newUser
    });
});

// PUT /users/:id - Update existing user
app.put('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const existing = await getUserById(userId);

    if (!existing) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `User with ID ${req.params.id} not found`
        });
    }

    const { name, email, department, role } = req.body;
    const updates = {
        ...(name && { name: name.trim() }),
        ...(email && { email: email.trim().toLowerCase() }),
        ...(department && { department: department.trim() }),
        ...(role && { role: role.trim() }),
        updatedAt: new Date().toISOString()
    };

    let updatedUser = null;
    if (isMongoConnected && UserModel) {
        try {
            updatedUser = await UserModel.findOneAndUpdate({ id: userId }, updates, { new: true, select: '-_id' }).lean();
        } catch (e) {
            console.error('[User-Service] MongoDB update failed:', e.message);
        }
    }

    const fileUsers = readFileUsers();
    const index = fileUsers.findIndex(u => u.id === userId);
    if (index !== -1) {
        fileUsers[index] = { ...fileUsers[index], ...updates };
        writeFileUsers(fileUsers);
        if (!updatedUser) updatedUser = fileUsers[index];
    }

    res.status(200).json({
        success: true,
        message: `User ${userId} successfully updated`,
        data: updatedUser
    });
});

// DELETE /users/:id - Remove user
app.delete('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const existing = await getUserById(userId);

    if (!existing) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `User with ID ${req.params.id} not found`
        });
    }

    if (isMongoConnected && UserModel) {
        try {
            await UserModel.findOneAndDelete({ id: userId });
        } catch (e) {
            console.error('[User-Service] MongoDB delete failed:', e.message);
        }
    }

    const fileUsers = readFileUsers();
    const index = fileUsers.findIndex(u => u.id === userId);
    if (index !== -1) {
        fileUsers.splice(index, 1);
        writeFileUsers(fileUsers);
    }

    res.status(200).json({
        success: true,
        message: `User ${userId} successfully deleted`,
        data: existing
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 404,
        error: "Not Found",
        message: `Endpoint ${req.method} ${req.url} does not exist on User Service`
    });
});

// Start Server
ensureDataStorage();
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[User-Service] Running independently on port ${PORT}`);
    console.log(`[User-Service] Endpoints available at http://localhost:${PORT}/users`);
    await initMongoDB();
});

module.exports = app;
