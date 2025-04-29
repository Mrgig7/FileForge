import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import ShareForm from '../components/ShareForm';

const FileDetails = () => {
  const { id } = useParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShareForm, setShowShareForm] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const { token, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Track scroll for parallax effects
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Fetch file details
  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!isAuthenticated) {
        navigate('/login?returnTo=/dashboard');
        return;
      }
      
      try {
        const response = await fetch(`http://localhost:3000/api/dashboard/file/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'File not found' : 'Failed to fetch file details');
        }
        
        const data = await response.json();
        setFile(data.file);
      } catch (err) {
        console.error('Error fetching file details:', err);
        setError(err.message || 'Failed to load file details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFileDetails();
  }, [id, isAuthenticated, token, navigate]);
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Handle delete
  const handleDelete = async () => {
    if (!file || !window.confirm('Are you sure you want to delete this file?')) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:3000/api/dashboard/file/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      navigate('/dashboard', { state: { message: 'File deleted successfully' } });
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete file');
    }
  };
  
  // Copy link to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };
  
  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-dark-bg-primary overflow-hidden text-dark-text-primary">
      <Header />
      
      <main className="relative py-20">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute -top-40 -right-40 w-96 h-96 bg-dark-accent-primary rounded-full opacity-10 blur-3xl"
            style={{ transform: `translateY(${scrollY * 0.1}px)` }}
          ></div>
          <div 
            className="absolute top-1/3 -left-20 w-72 h-72 bg-blue-500 rounded-full opacity-10 blur-3xl"
            style={{ transform: `translateY(${scrollY * -0.05}px)` }}
          ></div>
          <div 
            className="absolute -bottom-40 left-1/3 w-80 h-80 bg-indigo-500 rounded-full opacity-10 blur-3xl"
            style={{ transform: `translateY(${scrollY * 0.2}px)` }}
          ></div>
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDQydjQySDM2VjE4eiIgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-10"></div>
        </div>
        
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="mb-8">
            <Link to="/dashboard" className="flex items-center text-dark-text-secondary hover:text-dark-accent-primary transition-colors group">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" 
                className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-t-2 border-b-2 border-dark-accent-primary animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-dark-bg-primary"></div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 border border-red-500/30 text-red-500 p-6 rounded-lg">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            </div>
          ) : file ? (
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-xl blur opacity-20"></div>
                  <div className="relative bg-dark-bg-secondary/80 backdrop-blur-sm rounded-xl overflow-hidden border border-dark-border/60 shadow-dark-xl glassmorphism">
                    <div className="p-6 sm:p-8">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
                        <div className="flex-shrink-0">
                          <div className="w-20 h-20 rounded-2xl bg-dark-accent-primary/20 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-dark-accent-primary">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <h1 className="text-2xl font-semibold text-dark-text-primary break-all leading-tight">
                            {file.filename}
                          </h1>
                          <div className="mt-2 flex flex-wrap gap-3">
                            <span className="text-sm px-3 py-1 bg-dark-bg-primary/60 rounded-full border border-dark-border/40 text-dark-text-secondary">
                              {formatBytes(file.size)}
                            </span>
                            <span className="text-sm px-3 py-1 bg-dark-bg-primary/60 rounded-full border border-dark-border/40 text-dark-text-secondary">
                              Uploaded {formatDate(file.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm uppercase tracking-wider text-dark-text-secondary font-medium mb-3">Download Link</h3>
                          <div className="flex items-center mt-1 bg-dark-bg-primary/40 border border-dark-border/60 rounded-lg overflow-hidden">
                            <input 
                              type="text" 
                              value={file.downloadLink}
                              readOnly
                              className="bg-transparent flex-grow px-4 py-3 outline-none text-dark-text-primary"
                            />
                            <button 
                              className={`px-4 py-3 font-medium transition-colors ${copySuccess ? 'text-green-400' : 'text-dark-accent-primary hover:text-dark-accent-secondary'}`}
                              onClick={() => copyToClipboard(file.downloadLink)}
                            >
                              {copySuccess ? (
                                <span className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Copied!
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                  </svg>
                                  Copy
                                </span>
                              )}
                            </button>
                          </div>
                          <p className="mt-2 text-sm text-dark-text-secondary">
                            Anyone with this link can download the file
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {file.sender && (
                            <div>
                              <h3 className="text-sm uppercase tracking-wider text-dark-text-secondary font-medium mb-2">Shared By</h3>
                              <p className="text-dark-text-primary bg-dark-bg-primary/40 border border-dark-border/60 rounded-lg px-4 py-3">
                                {file.sender}
                              </p>
                            </div>
                          )}
                          
                          {file.receiver && (
                            <div>
                              <h3 className="text-sm uppercase tracking-wider text-dark-text-secondary font-medium mb-2">Shared To</h3>
                              <p className="text-dark-text-primary bg-dark-bg-primary/40 border border-dark-border/60 rounded-lg px-4 py-3">
                                {file.receiver}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 pt-6 border-t border-dark-border/60">
                          <a
                            href={file.downloadLink}
                            className="group relative overflow-hidden px-6 py-3 bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-lg transition-all duration-300 shadow-lg shadow-dark-accent-primary/20"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-[105%] transition-transform duration-700 ease-in-out"></span>
                            <span className="flex items-center gap-2 relative z-10">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </span>
                          </a>
                          
                          <button
                            className="relative group px-6 py-3 bg-transparent border border-dark-border text-dark-text-primary hover:border-dark-accent-primary font-medium rounded-lg transition-all duration-300"
                            onClick={() => setShowShareForm(!showShareForm)}
                          >
                            <span className="relative z-10 flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {showShareForm ? 'Cancel Sharing' : 'Email File'}
                            </span>
                            <span className="absolute inset-0 bg-dark-accent-primary/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 rounded-lg"></span>
                          </button>
                          
                          <button
                            className="relative group px-6 py-3 bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-500/20 font-medium rounded-lg transition-all duration-300"
                            onClick={handleDelete}
                          >
                            <span className="relative z-10 flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete File
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-span-1">
                {showShareForm && (
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-xl blur opacity-20"></div>
                    <div className="relative bg-dark-bg-secondary/80 backdrop-blur-sm rounded-xl overflow-hidden border border-dark-border/60 shadow-dark-xl glassmorphism">
                      <div className="p-6">
                        <h2 className="text-xl font-semibold mb-4 text-dark-text-primary">Share via Email</h2>
                        <ShareForm fileUuid={file.uuid} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-xl blur opacity-20"></div>
              <div className="relative bg-dark-bg-secondary/80 backdrop-blur-sm rounded-xl overflow-hidden border border-dark-border/60 shadow-dark-xl glassmorphism p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-dark-text-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-semibold text-dark-text-primary mb-2">File Not Found</h2>
                <p className="text-dark-text-secondary mb-6">
                  The file you're looking for doesn't exist or has been deleted.
                </p>
                <Link to="/dashboard" className="inline-block group relative overflow-hidden px-6 py-3 bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-lg transition-all duration-300 shadow-lg shadow-dark-accent-primary/20">
                  <span className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-[105%] transition-transform duration-700 ease-in-out"></span>
                  <span className="flex items-center gap-2 relative z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Back to Dashboard
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FileDetails; 