// Central API Base URL configuration
// Never hard-code full URLs across components - always derive from API_BASE_URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/students';
