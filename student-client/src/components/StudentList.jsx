import React, { useState } from 'react';
import { deleteStudent } from '../services/studentService';

export default function StudentList({
    students,
    loading,
    error,
    onRefresh,
    onEditStudent,
    onOpenAddModal,
    showAlert
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    const handleDelete = async (student) => {
        const studentId = student.id || student._id;
        const confirmDelete = window.confirm(`Are you sure you want to delete student "${student.name}" (ID: ${studentId})?`);
        if (!confirmDelete) return;

        setDeletingId(studentId);
        const { success, error } = await deleteStudent(studentId);
        setDeletingId(null);

        if (success) {
            showAlert(`Student "${student.name}" deleted successfully.`, "success");
            onRefresh();
        } else {
            showAlert(error?.message || "Failed to delete student.", "error");
        }
    };

    // Filter students by query
    const filteredStudents = (students || []).filter(student => {
        const q = searchQuery.toLowerCase();
        return (
            student.name?.toLowerCase().includes(q) ||
            student.email?.toLowerCase().includes(q) ||
            student.course?.toLowerCase().includes(q) ||
            String(student.id).includes(q)
        );
    });

    return (
        <div className="card list-card">
            <div className="list-toolbar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search students by name, email, or course..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>&times;</button>
                    )}
                </div>

                <div className="toolbar-actions">
                    <button className="btn btn-secondary" onClick={onRefresh} title="Refresh from Database">
                        🔄 Refresh
                    </button>
                    <button className="btn btn-primary" onClick={onOpenAddModal}>
                        + Add Student
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="state-container loading-state">
                    <div className="spinner"></div>
                    <p>Loading students from MongoDB Atlas...</p>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <div className="state-container error-state">
                    <div className="error-icon">⚠️</div>
                    <h3>Unable to load data. Please try again.</h3>
                    <p>{error.message || "Failed to communicate with REST API."}</p>
                    <button className="btn btn-primary" onClick={onRefresh}>
                        Retry Connection
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredStudents.length === 0 && (
                <div className="state-container empty-state">
                    <div className="empty-icon">🎓</div>
                    <h3>No students found</h3>
                    <p>{searchQuery ? "No matches found for your search query." : "There are currently no students in the database."}</p>
                    {searchQuery ? (
                        <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>Clear Filter</button>
                    ) : (
                        <button className="btn btn-primary" onClick={onOpenAddModal}>Add Your First Student</button>
                    )}
                </div>
            )}

            {/* Students Table */}
            {!loading && !error && filteredStudents.length > 0 && (
                <div className="table-responsive">
                    <table className="student-table">
                        <thead>
                            <tr>
                                <th style={{ width: '80px' }}>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Course / Department</th>
                                <th style={{ width: '120px' }}>Semester</th>
                                <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map((student) => {
                                const idVal = student.id || student._id;
                                const isDeleting = deletingId === idVal;

                                return (
                                    <tr key={idVal} className={isDeleting ? "row-deleting" : ""}>
                                        <td>
                                            <span className="id-badge">#{idVal}</span>
                                        </td>
                                        <td>
                                            <div className="student-name">{student.name}</div>
                                        </td>
                                        <td>
                                            <span className="student-email">{student.email}</span>
                                        </td>
                                        <td>
                                            <span className="course-badge">{student.course}</span>
                                        </td>
                                        <td>
                                            <span className="sem-badge">Sem {student.semester}</span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-action btn-edit"
                                                    onClick={() => onEditStudent(student)}
                                                    title="Edit student"
                                                    disabled={isDeleting}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    className="btn-action btn-delete"
                                                    onClick={() => handleDelete(student)}
                                                    title="Delete student"
                                                    disabled={isDeleting}
                                                >
                                                    {isDeleting ? "..." : "🗑️ Delete"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
