/**
 * Validation Middleware for Student API
 * Validates request body fields: name, email, course, semester
 * Returns HTTP 400 with structured JSON errors if validation fails.
 */
const validateStudent = (isUpdate = false) => {
    return (req, res, next) => {
        const { name, email, course, semester } = req.body;
        const errors = [];

        // Check required fields for POST (creation)
        if (!isUpdate) {
            if (!name && name !== "") errors.push({ field: "name", message: "Name is required" });
            if (!email && email !== "") errors.push({ field: "email", message: "Email is required" });
            if (!course && course !== "") errors.push({ field: "course", message: "Course is required" });
            if (semester === undefined || semester === null) errors.push({ field: "semester", message: "Semester is required" });
        }

        // Validate name if provided
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim() === '') {
                errors.push({ field: "name", message: "Name must be a non-empty string" });
            }
        }

        // Validate email if provided
        if (email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
                errors.push({ field: "email", message: "Email must be a valid email address (e.g., user@example.com)" });
            }
        }

        // Validate course if provided
        if (course !== undefined) {
            if (typeof course !== 'string' || course.trim() === '') {
                errors.push({ field: "course", message: "Course must be a non-empty string" });
            }
        }

        // Validate semester if provided
        if (semester !== undefined) {
            const semesterNum = Number(semester);
            if (!Number.isInteger(semesterNum) || semesterNum <= 0) {
                errors.push({ field: "semester", message: "Semester must be a positive integer greater than 0" });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                status: 400,
                error: "Bad Request",
                message: "Validation failed for request body",
                errors: errors,
                timestamp: new Date().toISOString()
            });
        }

        next();
    };
};

module.exports = {
    validateCreateStudent: validateStudent(false),
    validateUpdateStudent: validateStudent(true)
};
