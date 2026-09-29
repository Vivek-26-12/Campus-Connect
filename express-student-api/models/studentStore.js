// In-memory data store for Student resource (Lab 3 requirement)
let students = [
    {
        id: 1,
        name: "Aarav Patel",
        email: "aarav@example.com",
        course: "Computer Science",
        semester: 5
    },
    {
        id: 2,
        name: "Priya Sharma",
        email: "priya@example.com",
        course: "Information Technology",
        semester: 3
    },
    {
        id: 3,
        name: "Rohan Verma",
        email: "rohan@example.com",
        course: "Software Engineering",
        semester: 6
    }
];

let nextId = 4;

const studentStore = {
    // Get all students
    getAll: () => students,

    // Get student by ID
    getById: (id) => students.find(s => s.id === parseInt(id)),

    // Create a new student
    create: (studentData) => {
        const newStudent = {
            id: nextId++,
            name: studentData.name.trim(),
            email: studentData.email.trim(),
            course: studentData.course.trim(),
            semester: parseInt(studentData.semester)
        };
        students.push(newStudent);
        return newStudent;
    },

    // Update student by ID (full update or partial update)
    update: (id, studentData) => {
        const index = students.findIndex(s => s.id === parseInt(id));
        if (index === -1) return null;

        const existing = students[index];
        students[index] = {
            id: existing.id,
            name: studentData.name !== undefined ? studentData.name.trim() : existing.name,
            email: studentData.email !== undefined ? studentData.email.trim() : existing.email,
            course: studentData.course !== undefined ? studentData.course.trim() : existing.course,
            semester: studentData.semester !== undefined ? parseInt(studentData.semester) : existing.semester
        };
        return students[index];
    },

    // Delete student by ID
    delete: (id) => {
        const index = students.findIndex(s => s.id === parseInt(id));
        if (index === -1) return false;
        students.splice(index, 1);
        return true;
    },

    // Check if student exists
    exists: (id) => students.some(s => s.id === parseInt(id))
};

module.exports = studentStore;
