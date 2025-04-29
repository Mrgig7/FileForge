import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';

const DownloadFile = () => {
  const { uuid } = useParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Fetch file info
  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/files/${uuid}`, {
          method: 'HEAD',
        });
        
        if (!response.ok) {
          throw new Error('File not found or has expired');
        }
        
        const contentDisposition = response.headers.get('content-disposition');
        const filename = contentDisposition 
          ? contentDisposition.split('filename=')[1].replace(/['"]/g, '')
          : 'download';
        const contentLength = response.headers.get('content-length');
        
        setFile({
          filename,
          size: contentLength,
          formattedSize: formatBytes(Number(contentLength) || 0),
          downloadUrl: `http://localhost:3000/api/files/${uuid}`
        });
      } catch (err) {
        console.error('Error fetching file:', err);
        setError(err.message || 'Failed to fetch file information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFileInfo();
  }, [uuid]);
  
  // Auto download countdown
  useEffect(() => {
    if (!file || countdown <= 0) return;
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
      
      if (countdown === 1) {
        handleDownload();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, file]);
  
  const handleDownload = () => {
    if (!file || isDownloading) return;
    
    setIsDownloading(true);
    window.location.href = file.downloadUrl;
    
    // Reset downloading status after a delay
    setTimeout(() => {
      setIsDownloading(false);
    }, 3000);
  };
  
  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            {loading ? (
              <div className="text-center bg-white rounded-lg shadow-md p-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
                <p className="mt-2 text-gray-600">Loading file information...</p>
              </div>
            ) : error ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="rounded-full bg-red-100 p-3 w-14 h-14 flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <Link to="/" className="btn btn-primary">
                  Back to Home
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-primary-600 px-6 py-4">
                  <h1 className="text-xl font-bold text-white">
                    Your file is ready to download
                  </h1>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center justify-center p-6 mb-4">
                    <div className="rounded-full bg-primary-100 p-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-primary-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="mb-6 text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-1">
                      {file.filename}
                    </h2>
                    <p className="text-gray-600">
                      {file.formattedSize}
                    </p>
                  </div>
                  
                  {countdown > 0 ? (
                    <div className="text-center mb-6">
                      <p className="text-gray-600">
                        Your download will begin automatically in {countdown} {countdown === 1 ? 'second' : 'seconds'}
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div 
                          className="bg-primary-600 h-2.5 rounded-full transition-all duration-1000" 
                          style={{ width: `${(5 - countdown) * 20}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center mb-6">
                      <p className="text-gray-600">
                        {isDownloading 
                          ? 'Your download has started...' 
                          : 'If your download doesn\'t start automatically, click the button below.'}
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={handleDownload}
                    className="btn btn-primary w-full py-3"
                    disabled={isDownloading}
                  >
                    {isDownloading ? 'Downloading...' : 'Download Now'}
                  </button>
                  
                  <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500">
                      Powered by FileForge
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DownloadFile; 