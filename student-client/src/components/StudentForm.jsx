import React, { useState, useEffect } from 'react';
import { createStudent, updateStudent } from '../services/studentService';

export default function StudentForm({ studentToEdit, isOpen, onClose, onSuccess, showAlert }) {
    const isEditMode = Boolean(studentToEdit);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        course: '',
        semester: ''
    });

    const [clientErrors, setClientErrors] = useState({});
    const [serverError, setServerError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (studentToEdit) {
            setFormData({
                name: studentToEdit.name || '',
                email: studentToEdit.email || '',
                course: studentToEdit.course || '',
                semester: studentToEdit.semester !== undefined ? String(studentToEdit.semester) : ''
            });
        } else {
            setFormData({
                name: '',
                email: '',
                course: '',
                semester: ''
            });
        }
        setClientErrors({});
        setServerError(null);
    }, [studentToEdit, isOpen]);

    if (!isOpen) return null;

    // Client-side validation mirroring backend rules
    const validateForm = () => {
        const errors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formData.name.trim()) {
            errors.name = "Student name is required.";
        }

        if (!formData.email.trim()) {
            errors.email = "Email address is required.";
        } else if (!emailRegex.test(formData.email.trim())) {
            errors.email = "Please enter a valid email address (e.g. user@example.com).";
        }

        if (!formData.course.trim()) {
            errors.course = "Course is required.";
        }

        const sem = Number(formData.semester);
        if (!formData.semester || isNaN(sem) || sem < 1 || !Number.isInteger(sem)) {
            errors.semester = "Semester must be a positive integer (>= 1).";
        }

        setClientErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear specific field error as user types
        if (clientErrors[name]) {
            setClientErrors(prev => ({ ...prev, [name]: null }));
        }
        setServerError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError(null);

        // Run client-side validation
        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        const payload = {
            name: formData.name.trim(),
            email: formData.email.trim(),
            course: formData.course.trim(),
            semester: parseInt(formData.semester, 10)
        };

        if (isEditMode) {
            const studentId = studentToEdit.id || studentToEdit._id;
            const { data, error } = await updateStudent(studentId, payload);

            setSubmitting(false);
            if (error) {
                if (error.status === 400) {
                    setServerError(error.message);
                } else if (error.status === 404) {
                    setServerError("Student not found. It may have been deleted.");
                } else {
                    setServerError("Unable to update student. Please check the backend connection.");
                }
                return;
            }

            showAlert("Student updated successfully!", "success");
            onSuccess();
            onClose();
        } else {
            const { data, error } = await createStudent(payload);

            setSubmitting(false);
            if (error) {
                if (error.status === 400) {
                    setServerError(error.message);
                } else {
                    setServerError("Unable to create student. Please try again.");
                }
                return;
            }

            showAlert("Student created successfully!", "success");
            onSuccess();
            onClose();
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isEditMode ? "Edit Student" : "Add New Student"}</h2>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>

                {/* Specific Backend 400 / 404 Error Display */}
                {serverError && (
                    <div className="form-alert error-alert" role="alert">
                        <span className="alert-icon">⚠️</span>
                        <div>
                            <strong>Error:</strong> {serverError}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <div className="form-group">
                        <label htmlFor="name">Full Name <span className="req">*</span></label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g. Aarav Patel"
                            className={clientErrors.name ? "input-error" : ""}
                        />
                        {clientErrors.name && <span className="field-error-msg">{clientErrors.name}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address <span className="req">*</span></label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="e.g. aarav@example.com"
                            className={clientErrors.email ? "input-error" : ""}
                        />
                        {clientErrors.email && <span className="field-error-msg">{clientErrors.email}</span>}
                        <small className="field-hint">Must be unique across all students</small>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="course">Course / Department <span className="req">*</span></label>
                            <input
                                type="text"
                                id="course"
                                name="course"
                                value={formData.course}
                                onChange={handleChange}
                                placeholder="e.g. Computer Science"
                                className={clientErrors.course ? "input-error" : ""}
                            />
                            {clientErrors.course && <span className="field-error-msg">{clientErrors.course}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="semester">Semester <span className="req">*</span></label>
                            <input
                                type="number"
                                id="semester"
                                name="semester"
                                min="1"
                                max="12"
                                value={formData.semester}
                                onChange={handleChange}
                                placeholder="1 - 8"
                                className={clientErrors.semester ? "input-error" : ""}
                            />
                            {clientErrors.semester && <span className="field-error-msg">{clientErrors.semester}</span>}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? "Saving..." : (isEditMode ? "Update Student" : "Save Student")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
