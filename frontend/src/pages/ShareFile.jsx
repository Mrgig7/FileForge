import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import FileUploader from '../components/FileUploader';
import ShareForm from '../components/ShareForm';

const ShareFile = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const { isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track scroll for parallax effects
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  useEffect(() => {
    // Check if a file UUID was passed via location state
    if (location.state?.fileUuid) {
      // Fetch file details based on UUID
      const fetchFileDetails = async () => {
        try {
          const response = await fetch(`http://localhost:3000/api/files/${location.state.fileUuid}`);
          if (response.ok) {
            const data = await response.json();
            setUploadedFile(data.file);
          }
        } catch (error) {
          console.error("Error fetching file details:", error);
        }
      };
      
      fetchFileDetails();
    }
    
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate('/login?returnTo=/share');
    }
  }, [isAuthenticated, navigate, location.state]);
  
  const handleUploadSuccess = (file) => {
    setUploadedFile(file);
  };

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
  
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
        
        <div className="container relative mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-dark-accent-primary to-blue-400 gradient-animate mb-12 text-center">
            Share a File
          </h1>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex flex-col">
              {!uploadedFile ? (
                <div className="h-full">
                  <FileUploader onUploadSuccess={handleUploadSuccess} />
                </div>
              ) : (
                <div className="h-full">
                  <div className="relative h-full">
                    <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-xl blur opacity-20"></div>
                    <div className="relative bg-dark-bg-secondary/80 backdrop-blur-sm rounded-xl overflow-hidden border border-dark-border/60 shadow-dark-xl glassmorphism p-6 h-full">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-dark-text-primary">File Ready to Share</h2>
                        <div className="bg-dark-accent-primary/20 text-dark-accent-primary rounded-full p-1">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 p-4 bg-dark-accent-primary/10 text-dark-accent-primary rounded-lg mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>{location.state?.fileUuid ? 'File Loaded Successfully' : 'Upload Complete!'}</span>
                      </div>
                      
                      <div className="mb-6">
                        <h3 className="text-sm uppercase tracking-wider text-dark-text-secondary font-medium mb-3">File Details</h3>
                        <div className="flex items-center bg-dark-bg-primary/40 border border-dark-border/60 rounded-lg p-4">
                          <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-dark-accent-primary/20 flex items-center justify-center mr-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-dark-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-dark-text-primary font-medium mb-1">{uploadedFile.originalName || uploadedFile.fileName}</p>
                            <p className="text-sm text-dark-text-secondary">
                              {formatBytes(uploadedFile.size)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <h3 className="text-sm uppercase tracking-wider text-dark-text-secondary font-medium mb-3">Direct Link</h3>
                        <div className="flex items-center mt-1 bg-dark-bg-primary/40 border border-dark-border/60 rounded-lg overflow-hidden">
                          <input 
                            type="text" 
                            value={uploadedFile.downloadLink}
                            readOnly
                            className="bg-transparent flex-grow px-4 py-3 outline-none text-dark-text-primary text-sm"
                          />
                          <button 
                            className={`px-4 py-3 font-medium transition-colors ${copySuccess ? 'text-green-400' : 'text-dark-accent-primary hover:text-dark-accent-secondary'}`}
                            onClick={() => copyToClipboard(uploadedFile.downloadLink)}
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
                      
                      <div className="mt-auto">
                        <button 
                          className="w-full group relative overflow-hidden px-6 py-3 bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-lg transition-all duration-300 shadow-lg shadow-dark-accent-primary/20"
                          onClick={() => setUploadedFile(null)}
                        >
                          <span className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-[105%] transition-transform duration-700 ease-in-out"></span>
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Upload Another File
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col">
              {uploadedFile && (
                <div className="relative h-full">
                  <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-xl blur opacity-20"></div>
                  <div className="relative bg-dark-bg-secondary/80 backdrop-blur-sm rounded-xl overflow-hidden border border-dark-border/60 shadow-dark-xl glassmorphism p-6 h-full">
                    <h2 className="text-xl font-semibold mb-6 text-dark-text-primary">Share via Email</h2>
                    <ShareForm fileUuid={uploadedFile.uuid} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ShareFile; 