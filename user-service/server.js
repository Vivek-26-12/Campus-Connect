require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.USER_SERVICE_PORT || process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[User-Service ${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Database Persistence Helpers (Data Ownership: User Service owns its data)
const ensureDataStorage = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        const initialUsers = [
            { id: 101, name: "Aarav Patel", email: "aarav@campus.edu", department: "Computer Science", role: "Student" },
            { id: 102, name: "Priya Sharma", email: "priya@campus.edu", department: "Information Technology", role: "Faculty" },
            { id: 103, name: "Rohan Verma", email: "rohan@campus.edu", department: "Software Engineering", role: "Student" }
        ];
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
        console.log('[User-Service] Initial user database initialized with seed data.');
    }
};

const readUsers = () => {
    ensureDataStorage();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[User-Service Error] Failed reading data:', err.message);
        return [];
    }
};

const writeUsers = (users) => {
    ensureDataStorage();
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
};

// Health and Info endpoint
app.get(['/', '/health'], (req, res) => {
    res.json({
        service: "User Service",
        status: "UP",
        port: PORT,
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
app.get('/users', (req, res) => {
    const users = readUsers();
    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

// GET /users/:id - Retrieve user by ID
app.get('/users/:id', (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const users = readUsers();
    const user = users.find(u => u.id === userId);

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
app.post('/users', (req, res) => {
    const { name, email, department, role } = req.body;

    if (!name || !email) {
        return res.status(400).json({
            success: false,
            status: 400,
            error: "Bad Request",
            message: "Fields 'name' and 'email' are required."
        });
    }

    const users = readUsers();
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

    users.push(newUser);
    writeUsers(users);

    res.status(201).json({
        success: true,
        message: "User successfully created",
        data: newUser
    });
});

// PUT /users/:id - Update existing user
app.put('/users/:id', (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const users = readUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `User with ID ${req.params.id} not found`
        });
    }

    const { name, email, department, role } = req.body;
    users[index] = {
        ...users[index],
        ...(name && { name: name.trim() }),
        ...(email && { email: email.trim().toLowerCase() }),
        ...(department && { department: department.trim() }),
        ...(role && { role: role.trim() }),
        updatedAt: new Date().toISOString()
    };

    writeUsers(users);

    res.status(200).json({
        success: true,
        message: `User ${userId} successfully updated`,
        data: users[index]
    });
});

// DELETE /users/:id - Remove user
app.delete('/users/:id', (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const users = readUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            status: 404,
            error: "Not Found",
            message: `User with ID ${req.params.id} not found`
        });
    }

    const deleted = users.splice(index, 1)[0];
    writeUsers(users);

    res.status(200).json({
        success: true,
        message: `User ${userId} successfully deleted`,
        data: deleted
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[User-Service] Running independently on port ${PORT}`);
    console.log(`[User-Service] Endpoints available at http://localhost:${PORT}/users`);
});
