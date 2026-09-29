const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Student = require('../models/Student');

// Fallback disk-backed storage file (ensures persistence across server restarts even if Atlas connection is offline)
const DATA_FILE = path.join(__dirname, '..', 'data', 'students.json');

// Ensure data folder and file exists
const ensureFallbackFile = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        const initialStudents = [
            { id: 1, name: "Aarav Patel", email: "aarav@example.com", course: "Computer Science", semester: 5 },
            { id: 2, name: "Priya Sharma", email: "priya@example.com", course: "Information Technology", semester: 3 },
            { id: 3, name: "Rohan Verma", email: "rohan@example.com", course: "Software Engineering", semester: 6 }
        ];
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialStudents, null, 2), 'utf-8');
    }
};

const readFallbackData = () => {
    ensureFallbackFile();
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
};

const writeFallbackData = (data) => {
    ensureFallbackFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

// Check if Mongoose is actively connected to MongoDB
const isMongoConnected = () => mongoose.connection.readyState === 1;

// Helper to query student by integer ID or Mongo ObjectId
const findStudentQuery = (idParam) => {
    if (!isNaN(idParam)) {
        return { id: parseInt(idParam, 10) };
    }
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        return { _id: idParam };
    }
    return null;
};

/**
 * GET /students
 * List all students
 */
const getAllStudents = async (req, res) => {
    try {
        if (isMongoConnected()) {
            const students = await Student.find().sort({ id: 1 });
            return res.status(200).json(students);
        }

        // Fallback persistent storage
        const students = readFallbackData();
        return res.status(200).json(students);
    } catch (err) {
        res.status(500).json({
            status: 500,
            error: "Internal Server Error",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * GET /students/:id
 * Get single student by ID
 */
const getStudentById = async (req, res) => {
    try {
        const idParam = req.params.id;

        if (isMongoConnected()) {
            const query = findStudentQuery(idParam);
            if (!query) {
                return res.status(400).json({
                    status: 400,
                    error: "Bad Request",
                    message: "Student ID must be a valid integer or ObjectId",
                    timestamp: new Date().toISOString()
                });
            }

            const student = await Student.findOne(query);
            if (!student) {
                return res.status(404).json({
                    status: 404,
                    error: "Not Found",
                    message: `Student with ID ${idParam} was not found`,
                    timestamp: new Date().toISOString()
                });
            }

            return res.status(200).json(student);
        }

        // Fallback persistent storage
        const numericId = parseInt(idParam, 10);
        if (isNaN(numericId)) {
            return res.status(400).json({
                status: 400,
                error: "Bad Request",
                message: "Student ID must be a valid integer",
                timestamp: new Date().toISOString()
            });
        }

        const students = readFallbackData();
        const student = students.find(s => s.id === numericId);
        if (!student) {
            return res.status(404).json({
                status: 404,
                error: "Not Found",
                message: `Student with ID ${idParam} was not found`,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(200).json(student);
    } catch (err) {
        res.status(500).json({
            status: 500,
            error: "Internal Server Error",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * POST /students
 * Create a new student with unique email constraint
 */
const createStudent = async (req, res) => {
    try {
        const { name, email, course, semester } = req.body;
        const normalizedEmail = email ? email.trim().toLowerCase() : email;

        if (isMongoConnected()) {
            const newStudent = new Student({
                name: name ? name.trim() : name,
                email: normalizedEmail,
                course: course ? course.trim() : course,
                semester: semester !== undefined ? parseInt(semester, 10) : semester
            });

            await newStudent.save();
            return res.status(201).json(newStudent);
        }

        // Fallback persistent storage with unique email constraint
        const students = readFallbackData();
        const emailExists = students.some(s => s.email && s.email.toLowerCase() === normalizedEmail);
        if (emailExists) {
            return res.status(400).json({
                status: 400,
                error: "Bad Request",
                message: "A student with this email already exists",
                errors: [{ field: "email", message: "Email is already registered" }],
                timestamp: new Date().toISOString()
            });
        }

        const nextId = students.reduce((max, s) => Math.max(max, s.id || 0), 0) + 1;
        const newStudent = {
            id: nextId,
            name: name.trim(),
            email: normalizedEmail,
            course: course.trim(),
            semester: parseInt(semester, 10)
        };

        students.push(newStudent);
        writeFallbackData(students);

        return res.status(201).json(newStudent);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                status: 400,
                error: "Bad Request",
                message: "A student with this email already exists",
                errors: [{ field: "email", message: "Email is already registered" }],
                timestamp: new Date().toISOString()
            });
        }

        res.status(500).json({
            status: 500,
            error: "Internal Server Error",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * PUT/PATCH /students/:id
 * Update existing student by ID
 */
const updateStudent = async (req, res) => {
    try {
        const idParam = req.params.id;

        if (isMongoConnected()) {
            const query = findStudentQuery(idParam);
            if (!query) {
                return res.status(400).json({
                    status: 400,
                    error: "Bad Request",
                    message: "Student ID must be a valid integer or ObjectId",
                    timestamp: new Date().toISOString()
                });
            }

            const updateData = {};
            if (req.body.name !== undefined) updateData.name = req.body.name.trim();
            if (req.body.email !== undefined) updateData.email = req.body.email.trim().toLowerCase();
            if (req.body.course !== undefined) updateData.course = req.body.course.trim();
            if (req.body.semester !== undefined) updateData.semester = parseInt(req.body.semester, 10);

            const updatedStudent = await Student.findOneAndUpdate(
                query,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!updatedStudent) {
                return res.status(404).json({
                    status: 404,
                    error: "Not Found",
                    message: `Student with ID ${idParam} was not found`,
                    timestamp: new Date().toISOString()
                });
            }

            return res.status(200).json(updatedStudent);
        }

        // Fallback persistent storage
        const numericId = parseInt(idParam, 10);
        if (isNaN(numericId)) {
            return res.status(400).json({
                status: 400,
                error: "Bad Request",
                message: "Student ID must be a valid integer",
                timestamp: new Date().toISOString()
            });
        }

        const students = readFallbackData();
        const index = students.findIndex(s => s.id === numericId);
        if (index === -1) {
            return res.status(404).json({
                status: 404,
                error: "Not Found",
                message: `Student with ID ${idParam} was not found`,
                timestamp: new Date().toISOString()
            });
        }

        // If email changed, check uniqueness
        if (req.body.email) {
            const newEmail = req.body.email.trim().toLowerCase();
            const duplicate = students.some((s, idx) => idx !== index && s.email.toLowerCase() === newEmail);
            if (duplicate) {
                return res.status(400).json({
                    status: 400,
                    error: "Bad Request",
                    message: "A student with this email already exists",
                    errors: [{ field: "email", message: "Email is already registered" }],
                    timestamp: new Date().toISOString()
                });
            }
        }

        const existing = students[index];
        students[index] = {
            id: existing.id,
            name: req.body.name !== undefined ? req.body.name.trim() : existing.name,
            email: req.body.email !== undefined ? req.body.email.trim().toLowerCase() : existing.email,
            course: req.body.course !== undefined ? req.body.course.trim() : existing.course,
            semester: req.body.semester !== undefined ? parseInt(req.body.semester, 10) : existing.semester
        };

        writeFallbackData(students);
        return res.status(200).json(students[index]);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                status: 400,
                error: "Bad Request",
                message: "A student with this email already exists",
                errors: [{ field: "email", message: "Email is already registered" }],
                timestamp: new Date().toISOString()
            });
        }

        res.status(500).json({
            status: 500,
            error: "Internal Server Error",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * DELETE /students/:id
 * Delete student by ID
 */
const deleteStudent = async (req, res) => {
    try {
        const idParam = req.params.id;

        if (isMongoConnected()) {
            const query = findStudentQuery(idParam);
            if (!query) {
                return res.status(400).json({
                    status: 400,
                    error: "Bad Request",
                    message: "Student ID must be a valid integer or ObjectId",
                    timestamp: new Date().toISOString()
                });
            }

            const deletedStudent = await Student.findOneAndDelete(query);
            if (!deletedStudent) {
                return res.status(404).json({
                    status: 404,
                    error: "Not Found",
                    message: `Student with ID ${idParam} was not found`,
                    timestamp: new Date().toISOString()
                });
            }

            return res.status(204).send();
        }

        // Fallback persistent storage
        const numericId = parseInt(idParam, 10);
        if (isNaN(numericId)) {
            return res.status(400).json({
                status: 400,
                error: "Bad Request",
                message: "Student ID must be a valid integer",
                timestamp: new Date().toISOString()
            });
        }

        const students = readFallbackData();
        const index = students.findIndex(s => s.id === numericId);
        if (index === -1) {
            return res.status(404).json({
                status: 404,
                error: "Not Found",
                message: `Student with ID ${idParam} was not found`,
                timestamp: new Date().toISOString()
            });
        }

        students.splice(index, 1);
        writeFallbackData(students);

        return res.status(204).send();
    } catch (err) {
        res.status(500).json({
            status: 500,
            error: "Internal Server Error",
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
};
