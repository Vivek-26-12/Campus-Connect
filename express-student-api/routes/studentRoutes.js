const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { validateCreateStudent, validateUpdateStudent } = require('../middleware/validation');

// GET /students - List all students
router.get('/', studentController.getAllStudents);

// GET /students/:id - Get student by ID
router.get('/:id', studentController.getStudentById);

// POST /students - Create new student with validation
router.post('/', validateCreateStudent, studentController.createStudent);

// PUT /students/:id - Update student by ID with validation
router.put('/:id', validateUpdateStudent, studentController.updateStudent);

// PATCH /students/:id - Partial update student by ID with validation
router.patch('/:id', validateUpdateStudent, studentController.updateStudent);

// DELETE /students/:id - Delete student by ID
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
