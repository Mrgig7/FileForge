import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { fileApi } from '../services/api';
import Header from '../components/Header';
import FileUploader from '../components/FileUploader';
import DocumentViewer from '../components/DocumentViewer';
import Scene from '../components/3d/Scene';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// API base URL from environment or fallback to production URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app';

const Dashboard = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // Lifted state
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
  const navigate = useNavigate();

  // Fetch files logic
  const fetchFiles = async () => {
    setLoading(true);
    try {
      if (!token) throw new Error('Authentication required');
      
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
        if (response.status === 401) {
           navigate('/login');
           return;
        }
        throw new Error('Failed to fetch');
      }

      const data = await response.json();
      const filesData = data.files || [];
      const totalSize = filesData.reduce((sum, file) => sum + file.size, 0);

      setFiles(filesData);
      setStats({ totalFiles: filesData.length, totalSize, totalDownloads: 0 });
    } catch (err) {
      console.error('Error:', err);
      setError('Could not load data stream.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) fetchFiles();
  }, [isAuthenticated, token]);

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.filename?.toLowerCase().includes(searchQuery.toLowerCase());
    // Use expiresAt field (files now expire after 30 days by default)
    const isExpired = file.expiresAt ? new Date(file.expiresAt) < new Date() : false;
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'active') return matchesSearch && !isExpired;
    if (activeTab === 'expired') return matchesSearch && isExpired;
    return matchesSearch;
  });

  const handleUploadSuccess = async () => {
    setShowUploader(false);
    await fetchFiles();
  };

  const handleDeleteFile = async (uuid) => {
    try {
      await fileApi.deleteFile(uuid);
      setSelectedFile(null);
      await fetchFiles();
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleDownload = async (file) => {
    try {
      const filename = file.originalName || file.filename;
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      // Use native fetch instead of Axios for reliable binary data handling
      console.log('Downloading via fetch API:', file.uuid);
      const response = await fetch(`${apiUrl}/files/${file.uuid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Downloaded blob size:', blob.size, 'type:', blob.type);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error', err);
      alert('Failed to download file. Please try again.');
    }
  };

  const handlePreview = async (file) => {
    try {
      // Derive mime type from filename extension
      const getMimeType = (filename) => {
        const ext = filename?.split('.').pop()?.toLowerCase();
        const mimeMap = {
          // Images
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
          'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
          // Documents
          'pdf': 'application/pdf',
          // Video
          'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
          // Audio
          'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
          // Text/Code
          'txt': 'text/plain', 'html': 'text/html', 'css': 'text/css',
          'js': 'text/javascript', 'jsx': 'text/javascript', 
          'ts': 'text/typescript', 'tsx': 'text/typescript',
          'json': 'application/json', 'xml': 'application/xml',
          'md': 'text/markdown', 'py': 'text/x-python', 'java': 'text/x-java',
          'c': 'text/x-c', 'cpp': 'text/x-c++', 'h': 'text/x-c'
        };
        return mimeMap[ext] || 'application/octet-stream';
      };

      const fileName = file.originalName || file.filename;
      const mimeType = getMimeType(fileName);
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      // Use native fetch instead of Axios for reliable binary data handling
      console.log('Fetching preview via fetch API:', file.uuid);
      const response = await fetch(`${apiUrl}/files/${file.uuid}/preview`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Preview blob size:', blob.size, 'type:', blob.type);
      
      const url = URL.createObjectURL(blob);
      setViewerData({ url, mimeType, fileName });
      setShowViewer(true);
    } catch (err) {
      console.error('Preview error', err);
      alert('Could not preview this file. It may have been deleted or expired.');
    }
  };

  const closeViewer = () => {
    if (viewerData.url) {
      URL.revokeObjectURL(viewerData.url);
    }
    setShowViewer(false);
    setViewerData({ url: null, mimeType: null });
  };

  return (
    <div className="h-screen w-full bg-[#050510] overflow-hidden text-white relative font-sans">
      <Header />

      {/* 3D Scene Background */}
      <div className="absolute inset-0 z-0">
          <Scene 
              files={filteredFiles} 
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
              onDownload={handleDownload}
              onDelete={handleDeleteFile}
          />
      </div>

      {/* HUD Overlay - Top Left: Search & Filter */}
      <motion.div 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute top-24 left-6 z-10 flex flex-col gap-4 w-80 pointer-events-none"
      >
         <div className="pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-lg">
            <h1 className="text-xl font-bold mb-4 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
               SYSTEM DATA
            </h1>
            
            <div className="relative mb-4 group">
               <input
                  type="text"
                  placeholder="SEARCH_QUERY..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 pl-10 text-sm focus:border-cyan-500/50 focus:outline-none transition-colors uppercase tracking-widest"
               />
               <svg className="w-4 h-4 text-cyan-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </div>

            <div className="flex gap-2 text-xs">
               {['all', 'active', 'expired'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`flex-1 py-1.5 rounded uppercase tracking-wider transition-all border ${
                     activeTab === tab 
                     ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                     : 'bg-transparent border-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'
                   }`}
                 >
                   {tab}
                 </button>
               ))}
            </div>
         </div>
      </motion.div>

      {/* Cinema Mode Detail Overlay */}
      <AnimatePresence>
        {selectedFile && (
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
            >
                <div className="bg-[#0a0a12]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 w-[500px] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    {/* Glowing effect inside card */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-1">
                                {selectedFile.originalName}
                            </h2>
                            <p className="text-xs text-cyan-400 uppercase tracking-widest font-mono">
                                {selectedFile.mimetype || 'UNKNOWN_MODULE'} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <button 
                            onClick={() => setSelectedFile(null)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                            <span className="block text-[10px] text-gray-500 uppercase">Status</span>
                            <span className="text-sm font-medium text-green-400 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                Active
                            </span>
                         </div>
                         <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                            <span className="block text-[10px] text-gray-500 uppercase">Uploaded</span>
                            <span className="text-sm font-medium text-gray-300">
                                {new Date(selectedFile.createdAt).toLocaleDateString()}
                            </span>
                         </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => handlePreview(selectedFile)}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] active:scale-95 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            VIEW DATA
                        </button>
                        <button 
                            onClick={() => handleDownload(selectedFile)}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            RETRIEVE DATA
                        </button>
                        <button 
                            onClick={() => {
                                if(confirm('Purge this asset?')) handleDeleteFile(selectedFile.uuid);
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-3 rounded-xl transition-colors border border-red-500/20"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* FAB - Bottom Right: Upload */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowUploader(true)}
        className="absolute bottom-10 right-10 z-20 w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] border border-white/20 transition-all group"
      >
         <div className="absolute inset-0 rounded-full border border-white/30 animate-ping opacity-20"></div>
         <svg className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
         </svg>
      </motion.button>

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
           <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
              <p className="text-cyan-500 font-mono tracking-widest text-sm animate-pulse">INITIALIZING ENVIRONMENT...</p>
           </div>
        </div>
      )}

      {/* Uploader Modal */}
      <AnimatePresence>
        {showUploader && (
          <FileUploader
            onClose={() => setShowUploader(false)}
            onSuccess={handleUploadSuccess}
          />
        )}
      </AnimatePresence>

      {/* Document Viewer Modal */}
      {showViewer && viewerData.url && (
        <DocumentViewer
          fileUrl={viewerData.url}
          fileName={viewerData.fileName}
          mimeType={viewerData.mimeType}
          onClose={closeViewer}
        />
      )}
    </div>
  );
};

export default Dashboard;