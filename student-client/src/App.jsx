import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import StudentList from './components/StudentList';
import StudentForm from './components/StudentForm';
import Alert from './components/Alert';
import { getAllStudents } from './services/studentService';
import { API_BASE_URL } from './config/api';
import './App.css';

export default function App() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [alert, setAlert] = useState(null);

    const showAlert = (message, type = 'success') => {
        setAlert({ message, type });
        setTimeout(() => {
            setAlert(null);
        }, 4500);
    };

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await getAllStudents();
        setLoading(false);

        if (error) {
            setError(error);
        } else {
            setStudents(data || []);
        }
    }, []);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    const handleOpenAdd = () => {
        setStudentToEdit(null);
        setIsFormOpen(true);
    };

    const handleEditStudent = (student) => {
        setStudentToEdit(student);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setStudentToEdit(null);
    };

    return (
        <div className="app-layout">
            <Navbar onOpenAddModal={handleOpenAdd} totalStudents={students.length} />

            <main className="main-content">
                <div className="container">
                    {/* Top SOA Architecture Banner */}
                    <div className="architecture-banner">
                        <div className="banner-badge">Web Services &amp; SOA Lab 4</div>
                        <div className="banner-details">
                            <span className="banner-item">
                                <strong>API Base URL:</strong> <code>{API_BASE_URL}</code>
                            </span>
                            <span className="banner-divider">•</span>
                            <span className="banner-item">
                                <strong>Architecture:</strong> Client (React) &rarr; REST API (Express.js) &rarr; Database (MongoDB Atlas)
                            </span>
                        </div>
                    </div>

                    {/* Student List View */}
                    <StudentList
                        students={students}
                        loading={loading}
                        error={error}
                        onRefresh={fetchStudents}
                        onEditStudent={handleEditStudent}
                        onOpenAddModal={handleOpenAdd}
                        showAlert={showAlert}
                    />
                </div>
            </main>

            {/* Add / Edit Student Modal */}
            <StudentForm
                isOpen={isFormOpen}
                studentToEdit={studentToEdit}
                onClose={handleCloseForm}
                onSuccess={fetchStudents}
                showAlert={showAlert}
            />

            {/* Floating Global Toast Notification */}
            <Alert alert={alert} onClose={() => setAlert(null)} />

            <footer className="footer">
                <p>Web Services &amp; SOA Laboratory &bull; Lab 4 Full-Stack Integration &bull; Student CRUD Client</p>
            </footer>
        </div>
    );
}
