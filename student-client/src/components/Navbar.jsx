import React from 'react';

export default function Navbar({ onOpenAddModal, totalStudents }) {
    return (
        <header className="navbar">
            <div className="navbar-container">
                <div className="brand">
                    <div className="brand-badge">SOA Lab 4</div>
                    <div className="brand-text">
                        <h1>CampusConnect</h1>
                        <span className="brand-subtitle">Student Directory Web Client</span>
                    </div>
                </div>

                <div className="navbar-actions">
                    <div className="stats-pill">
                        <span className="stats-label">Total Records:</span>
                        <span className="stats-count">{totalStudents}</span>
                    </div>
                    <button className="btn btn-primary" onClick={onOpenAddModal}>
                        <span className="btn-icon">+</span> Add Student
                    </button>
                </div>
            </div>
        </header>
    );
}
