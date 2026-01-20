import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { fileApi } from '../services/api';
import Layout from '../components/Layout';
import FileCard from '../components/FileCard';
import StatsCard from '../components/StatsCard';
import FileUploader from '../components/FileUploader';
import DocumentViewer from '../components/DocumentViewer';
import FileDetailOverlay from '../components/FileDetailOverlay';
import { motion, AnimatePresence } from 'framer-motion';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app';

const Dashboard = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerData, setViewerData] = useState({ url: null, mimeType: null });
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    totalDownloads: 0
  });
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { isAuthenticated, token } = useContext(AuthContext);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      if (!token) return;
      
      console.log("Fetching files from:", API_BASE_URL);
      const dashboardUrl = API_BASE_URL.includes('/api')
        ? `${API_BASE_URL}/dashboard`
        : `${API_BASE_URL}/api/dashboard`;

      const response = await fetch(dashboardUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });

      if (!response.ok) {
        console.error("Fetch failed:", response.status, response.statusText);
        throw new Error('Failed to fetch');
      }

      const data = await response.json();
      console.log("Files fetched:", data.files?.length);
      const filesData = data.files || [];
      const totalSize = filesData.reduce((sum, file) => sum + file.size, 0);
      const totalDownloads = filesData.reduce((sum, file) => sum + (file.downloads || 0), 0);

      setFiles(filesData);
      setStats({ totalFiles: filesData.length, totalSize, totalDownloads });
    } catch (err) {
      console.error('Error fetching files:', err);
      setError('Could not load files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) fetchFiles();
  }, [isAuthenticated, token]);

  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const matchesSearch = file.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           file.filename?.toLowerCase().includes(searchQuery.toLowerCase());
      const isExpired = file.expiresAt ? new Date(file.expiresAt) < new Date() : false;
      
      if (activeTab === 'all') return matchesSearch;
      if (activeTab === 'active') return matchesSearch && !isExpired;
      if (activeTab === 'expired') return matchesSearch && isExpired;
      return matchesSearch;
    });
  }, [files, searchQuery, activeTab]);

  const handleUploadSuccess = useCallback(async () => {
    setShowUploader(false);
    await fetchFiles();
  }, []);

  const handleDeleteFile = useCallback(async (uuid) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      await fileApi.deleteFile(uuid);
      setSelectedFile(null);
      await fetchFiles();
    } catch (err) {
      console.error('Delete error', err);
    }
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Layout>
       {/* Stats Row */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard 
             title="Total Files" 
             value={stats.totalFiles} 
             icon={
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
             }
          />
          <StatsCard 
             title="Storage Used" 
             value={formatBytes(stats.totalSize)} 
             icon={
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
               </svg>
             }
          />
          <StatsCard 
             title="Total Downloads" 
             value={stats.totalDownloads} 
             trend="+12% this week"
             icon={
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
               </svg>
             }
          />
       </div>

       {/* Toolbar */}
       <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl p-1 rounded-xl border border-white/10">
             {['all', 'active', 'expired'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    activeTab === tab 
                    ? 'bg-white/10 text-white shadow-sm border border-white/10' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab}
                </button>
             ))}
          </div>

          <div className="relative w-full md:w-64">
             <input
               type="text"
               placeholder="Filter files..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
             />
             <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
       </div>

       {/* File Grid */}
       {loading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/5 backdrop-blur border border-white/10 skeleton"></div>
            ))}
         </div>
       ) : filteredFiles.length > 0 ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
            {filteredFiles.map((file) => (
              <FileCard 
                key={file.uuid} 
                file={file} 
                onDelete={handleDeleteFile}
              />
            ))}
         </div>
       ) : (
         <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-20 h-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-300 mb-2">No files found</p>
            <p className="text-sm text-gray-500">Upload a file to get started</p>
         </div>
       )}

       {/* FAB */}
       <motion.button
         whileHover={{ scale: 1.05 }}
         whileTap={{ scale: 0.95 }}
         onClick={() => setShowUploader(true)}
         className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-full shadow-lg shadow-cyan-500/30 flex items-center justify-center z-40 transition-all border border-white/20"
       >
         <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
         </svg>
       </motion.button>

       {/* Modals */}
       <AnimatePresence>
         {showUploader && (
           <FileUploader
             onClose={() => setShowUploader(false)}
             onSuccess={handleUploadSuccess}
           />
         )}
         {selectedFile && (
            <FileDetailOverlay
              file={selectedFile}
              onDeselect={() => setSelectedFile(null)}
            />
         )}
       </AnimatePresence>
    </Layout>
  );
};

export default Dashboard;