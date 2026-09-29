import axios from 'axios';
import { API_BASE_URL } from '../config/api';

/**
 * Parses axios error and extracts clean error message & field errors
 */
export const extractApiError = (error) => {
    if (!error.response) {
        return {
            status: 0,
            message: "Unable to load data. Please try again. (Network or server unavailable)",
            errors: []
        };
    }

    const { status, data } = error.response;
    let message = data?.message || "An unexpected error occurred.";
    let errors = data?.errors || [];

    if (status === 400) {
        // Validation error from backend
        if (errors.length > 0) {
            message = errors.map(e => e.message).join('. ');
        }
    } else if (status === 404) {
        message = data?.message || "Student not found.";
    } else if (status >= 500) {
        message = "Unable to load data. Please try again. (Server error)";
    }

    return { status, message, errors };
};

/**
 * GET /students - List all students
 */
export const getAllStudents = async () => {
    try {
        const response = await axios.get(API_BASE_URL);
        return { data: response.data, error: null };
    } catch (err) {
        return { data: null, error: extractApiError(err) };
    }
};

/**
 * GET /students/:id - Get student by ID
 */
export const getStudentById = async (id) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/${id}`);
        return { data: response.data, error: null };
    } catch (err) {
        return { data: null, error: extractApiError(err) };
    }
};

/**
 * POST /students - Create new student
 */
export const createStudent = async (studentData) => {
    try {
        const response = await axios.post(API_BASE_URL, studentData);
        return { data: response.data, error: null };
    } catch (err) {
        return { data: null, error: extractApiError(err) };
    }
};

/**
 * PUT /students/:id - Update student
 */
export const updateStudent = async (id, studentData) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/${id}`, studentData);
        return { data: response.data, error: null };
    } catch (err) {
        return { data: null, error: extractApiError(err) };
    }
};

/**
 * DELETE /students/:id - Delete student
 */
export const deleteStudent = async (id) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/${id}`);
        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: extractApiError(err) };
    }
};
