import axios from 'axios';

// API base URL from environment or fallback to production URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// File related API calls
export const fileApi = {
  // Get all files for the current user
  getAllFiles: async () => {
    const response = await api.get('/files/user-files');
    return response.data.files;
  },

  // Upload a file
  uploadFile: async (formData) => {
    // Ensure the file is being sent with the correct field name
    if (!formData.get('myfile')) {
      const file = formData.get('file');
      if (file) {
        formData.delete('file');
        formData.append('myfile', file);
      }
    }
    
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