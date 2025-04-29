import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { fileApi } from '../services/api';
import Header from '../components/Header';
import FileCard from '../components/FileCard';
import FileUploader from '../components/FileUploader';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    totalDownloads: 0
  });
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const dashboardRef = useRef(null);
  
  const { isAuthenticated, token, login } = useContext(AuthContext);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Simple animation for elements when they come into view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('.animate-on-scroll');
    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      sections.forEach((section) => {
        observer.unobserve(section);
      });
    };
  }, []);
  
  // Fetch files from backend
  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get token from context
      if (!token) {
        console.error('Missing authentication token');
        throw new Error('Authentication required');
      }
      
      console.log('Using token for dashboard API call:', token ? 'Token exists' : 'No token');
      console.log('Current user in AuthContext:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
      
      // Try to fetch files
      let response = await fetch('http://localhost:3000/api/dashboard', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      // If token is invalid, try to refresh authentication
      if (!response.ok && response.status === 401) {
        console.log('Token authentication failed, attempting to refresh authentication');
        
        // Redirect to login if authentication fails
        navigate('/login', { state: { from: '/dashboard', message: 'Session expired. Please login again.' } });
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch files' }));
        throw new Error(errorData.error || `Failed to fetch files: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('Fetched files from dashboard API:', data);
      
      // Use the files array from the response
      const filesData = data.files || [];
      
      if (filesData.length === 0) {
        console.log('No files found for the current user');
      } else {
        console.log(`Found ${filesData.length} files for the current user`);
      }
      
      // Calculate stats from files
      const totalSize = filesData.reduce((sum, file) => sum + file.size, 0);
      const totalFiles = filesData.length;
      
      setFiles(filesData);
      setStats({
        totalFiles,
        totalSize,
        totalDownloads: 0 // This would come from your backend if you track downloads
      });
    } catch (err) {
      console.error('Error fetching files:', err);
      setError('Failed to load your files. Please try again.');
      
      // If authentication error, redirect to login
      if (err.message.includes('Authentication required') || err.message.includes('Auth token invalid')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    
    // Load files when authenticated and token is available
    const loadFiles = async () => {
      try {
        await fetchFiles();
      } catch (err) {
        console.error("Error in initial data fetch:", err);
      }
    };
    
    loadFiles();
  }, [isAuthenticated, token]); // Add token to dependency array

  // Filter files based on search query and active tab
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.filename?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Since we don't have active/expired status in the backend model,
    // we'll consider files older than 24 hours as expired
    const isExpired = new Date(file.createdAt) < new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'active') return matchesSearch && !isExpired;
    if (activeTab === 'expired') return matchesSearch && isExpired;
    
    return matchesSearch;
  });
  
  // Handle file upload success
  const handleUploadSuccess = async () => {
    setShowUploader(false);
    await fetchFiles(); // Refresh the files list
  };
  
  // Handle file deletion
  const handleDeleteFile = async (uuid) => {
    try {
      await fileApi.deleteFile(uuid);
      await fetchFiles(); // Refresh the files list
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to delete file. Please try again.');
    }
  };

  // Handle file download
  const handleDownload = async (uuid, filename) => {
    try {
      const blob = await fileApi.downloadFile(uuid);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg-primary overflow-hidden text-dark-text-primary">
      <Header />
      
      {/* Quick Actions Bar */}
      <div className="bg-dark-bg-secondary border-b border-dark-border/40">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Storage Usage */}
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-dark-bg-primary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-full"
                    style={{ width: `${Math.min((stats.totalSize / (1024 * 1024 * 1024)) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm text-dark-text-secondary">
                  {(stats.totalSize / (1024 * 1024)).toFixed(1)} MB Used
                </span>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-dark-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-dark-text-secondary">{stats.totalFiles} Files</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-dark-text-secondary">
                    {filteredFiles.filter(f => new Date(f.createdAt) >= new Date(Date.now() - 24 * 60 * 60 * 1000)).length} Active
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowUploader(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-dark-accent-primary hover:bg-dark-accent-secondary text-white rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                New Upload
              </button>
            </div>
          </div>
        </div>
      </div>

      <main ref={dashboardRef}>
        {/* Files Section */}
        <section className="py-8 bg-dark-bg-primary relative overflow-hidden">
          <div className="container relative mx-auto px-4 max-w-full lg:max-w-screen-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h2 className="text-3xl font-bold text-dark-text-primary">My Files</h2>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                {/* Tabs */}
                <div className="flex bg-dark-bg-secondary rounded-xl p-1 border border-dark-border/50">
                  {['all', 'active', 'expired'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                        activeTab === tab
                          ? 'bg-dark-accent-primary text-white'
                          : 'text-dark-text-secondary hover:text-white'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-bg-secondary border border-dark-border/50 rounded-xl text-dark-text-primary placeholder-dark-text-secondary focus:outline-none focus:border-dark-accent-primary/50 transition-colors"
                  />
                  <svg className="w-5 h-5 text-dark-text-secondary absolute right-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-dark-accent-primary"></div>
                <p className="mt-2 text-dark-text-secondary">Loading your files...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                {error}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 bg-dark-accent-primary/20 rounded-full blur-xl"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24 text-dark-text-secondary relative">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <h3 className="mt-2 text-xl font-medium text-dark-text-primary">
                  {searchQuery ? 'No files found' : 'No files yet'}
                </h3>
                <p className="mt-1 text-dark-text-secondary">
                  {searchQuery 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Upload your first file to get started'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowUploader(true)}
                    className="mt-6 px-6 py-3 bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-xl transition-colors flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    Upload a File
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFiles.map(file => (
                  <FileCard 
                    key={file.uuid}
                    file={file}
                    onDelete={() => handleDeleteFile(file.uuid)}
                    onDownload={() => handleDownload(file.uuid, file.originalName || file.filename)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* File Uploader Modal */}
      {showUploader && (
        <FileUploader
          onClose={() => setShowUploader(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
};

export default Dashboard; 