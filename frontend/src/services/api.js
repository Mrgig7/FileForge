import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// File related API calls
export const fileApi = {
  // Get all files for the current user
  getAllFiles: async () => {
    const response = await api.get('/files/user-files');
    return response.data.files;
  },

  // Upload a file
  uploadFile: async (formData) => {
    const response = await api.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Download a file
  downloadFile: async (uuid) => {
    const response = await api.get(`/files/${uuid}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Send file via email
  sendFile: async (uuid, emailTo, emailFrom) => {
    const response = await api.post('/files/send', {
      uuid,
      emailTo,
      emailFrom
    });
    return response.data;
  },

  // Delete a file
  deleteFile: async (uuid) => {
    const response = await api.delete(`/files/${uuid}`);
    return response.data;
  },

  // Get file statistics
  getStats: async () => {
    const response = await api.get('/files/stats');
    return response.data;
  }
};

export default api; 