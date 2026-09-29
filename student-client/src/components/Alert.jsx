import React from 'react';

export default function Alert({ alert, onClose }) {
    if (!alert) return null;

    const isSuccess = alert.type === 'success';

    return (
        <div className={`global-toast ${isSuccess ? 'toast-success' : 'toast-error'}`}>
            <span className="toast-icon">{isSuccess ? '✅' : '⚠️'}</span>
            <span className="toast-message">{alert.message}</span>
            <button className="toast-close" onClick={onClose}>&times;</button>
        </div>
    );
}
