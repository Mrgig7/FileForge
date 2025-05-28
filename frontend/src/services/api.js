import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined' && token !== 'null') {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('Adding auth header to request:', config.url);
  } else {
    console.log('No valid token found for request:', config.url);
  }
  return config;
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API request failed:', error.response?.status, error.response?.data);

    // If we get a 401, the token is invalid
    if (error.response?.status === 401) {
      console.log('Received 401 - token may be invalid or expired');

      // Clear invalid token
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('profilePicUrl');

      // Redirect to login if we're not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?message=Session expired. Please login again.';
      }
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