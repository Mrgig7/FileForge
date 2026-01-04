import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import DocumentViewer from '../components/DocumentViewer';
import { 
    getKeyFromUrl, 
    importKeyFromBase64, 
    decryptFile, 
    downloadBlob,
    isEncryptionSupported 
} from '../utils/encryption';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const DownloadFile = () => {
  const { uuid } = useParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [isDownloading, setIsDownloading] = useState(false);
  const [decryptionStatus, setDecryptionStatus] = useState(''); // '', 'decrypting', 'success', 'error'
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [decryptedBlob, setDecryptedBlob] = useState(null);
  
  // Fetch file info using the new /info endpoint
  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/files/${uuid}/info`);
        const data = await response.json();
        
        if (!response.ok) {
          // Handle specific error codes
          if (response.status === 410) {
            throw new Error(data.error || 'This file has expired or been deleted');
          }
          throw new Error(data.error || 'File not found');
        }
        
        const fileInfo = data.file;
        setIsEncrypted(fileInfo.isEncrypted);
        setIsViewOnly(fileInfo.viewOnly);
        
        // Check if encryption key is needed but missing
        if (fileInfo.isEncrypted && !getKeyFromUrl()) {
          throw new Error('This file is encrypted. Decryption key is missing from the URL.');
        }
        
        setFile({
          uuid: fileInfo.uuid,
          filename: fileInfo.originalName,
          size: fileInfo.size,
          formattedSize: fileInfo.formattedSize,
          mimeType: fileInfo.mimeType,
          isEncrypted: fileInfo.isEncrypted,
          encryptionIV: fileInfo.encryptionIV, // Store IV for decryption
          viewOnly: fileInfo.viewOnly,
          expiresAt: fileInfo.expiresAt,
          maxDownloads: fileInfo.maxDownloads,
          downloads: fileInfo.downloads,
          deleteAfterFirstAccess: fileInfo.deleteAfterFirstAccess,
          downloadUrl: `${API_BASE_URL}/files/${uuid}`,
          previewUrl: `${API_BASE_URL}/files/${uuid}/preview`
        });
        
        // For view-only files, set preview URL
        if (fileInfo.viewOnly) {
          setPreviewUrl(`${API_BASE_URL}/files/${uuid}/preview`);
        }
        
      } catch (err) {
        console.error('Error fetching file:', err);
        setError(err.message || 'Failed to fetch file information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFileInfo();
  }, [uuid]);
  
  // Auto download countdown (only for non-encrypted, non-view-only files)
  useEffect(() => {
    if (!file || countdown <= 0 || isEncrypted || isViewOnly) return;
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
      
      if (countdown === 1) {
        handleDownload();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, file, isEncrypted, isViewOnly]);
  
  const handleDownload = async () => {
    if (!file || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      if (file.isEncrypted) {
        // Handle encrypted file download
        setDecryptionStatus('decrypting');
        
        const keyBase64 = getKeyFromUrl();
        if (!keyBase64) {
          throw new Error('Decryption key not found in URL');
        }
        
        // Import the key
        const key = await importKeyFromBase64(keyBase64);
        
        // Fetch the encrypted file
        const response = await fetch(file.downloadUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to download encrypted file');
        }
        
        const encryptedData = await response.arrayBuffer();
        
        // Get IV from file state (which was set from file info response)
        const ivBase64 = file.encryptionIV;
        if (!ivBase64) {
          throw new Error('Encryption IV not found. Cannot decrypt file.');
        }
        
        // Decrypt the file
        const decryptedBlob = await decryptFile(encryptedData, key, ivBase64, file.mimeType);
        
        // Download the decrypted file
        downloadBlob(decryptedBlob, file.filename);
        
        setDecryptionStatus('success');
      } else {
        // Handle regular file download
        window.location.href = file.downloadUrl;
      }
    } catch (err) {
      console.error('Download error:', err);
      setDecryptionStatus('error');
      setError(err.message || 'Download failed');
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
        setDecryptionStatus('');
      }, 3000);
    }
  };
  
  // Helper to get IV from server (we'll need a dedicated endpoint or include in file info)
  // Open document viewer
  const handleViewDocument = async () => {
    if (file.isEncrypted) {
      // For encrypted files, we need to decrypt first
      try {
        setDecryptionStatus('decrypting');
        const keyBase64 = getKeyFromUrl();
        if (!keyBase64) {
          throw new Error('Decryption key not found');
        }
        
        const key = await importKeyFromBase64(keyBase64);
        const response = await fetch(file.downloadUrl);
        const encryptedData = await response.arrayBuffer();
        const blob = await decryptFile(encryptedData, key, file.encryptionIV, file.mimeType);
        
        setDecryptedBlob(blob);
        setDecryptionStatus('success');
        setShowViewer(true);
      } catch (err) {
        console.error('Decryption error:', err);
        setError(err.message || 'Failed to decrypt file');
        setDecryptionStatus('error');
      }
    } else {
      // For non-encrypted files, just show the viewer
      setShowViewer(true);
    }
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

  // Render file preview for view-only mode
  const renderPreview = () => {
    if (!isViewOnly || !previewUrl) return null;
    
    const mimeType = file?.mimeType || '';
    
    if (mimeType.startsWith('image/')) {
      return (
        <div className="relative">
          <img 
            src={previewUrl} 
            alt={file.filename}
            className="max-w-full max-h-[500px] mx-auto rounded-lg shadow-lg"
            onContextMenu={(e) => e.preventDefault()} // Disable right-click
          />
          <div className="absolute inset-0 pointer-events-none select-none"></div>
        </div>
      );
    }
    
    if (mimeType === 'application/pdf') {
      return (
        <iframe
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-[600px] rounded-lg shadow-lg"
          title={file.filename}
          sandbox="allow-same-origin"
        />
      );
    }
    
    if (mimeType.startsWith('video/')) {
      return (
        <video 
          src={previewUrl}
          controls
          controlsList="nodownload"
          className="max-w-full max-h-[500px] mx-auto rounded-lg shadow-lg"
          onContextMenu={(e) => e.preventDefault()}
        >
          Your browser does not support video playback.
        </video>
      );
    }
    
    if (mimeType.startsWith('audio/')) {
      return (
        <audio 
          src={previewUrl}
          controls
          controlsList="nodownload"
          className="w-full"
          onContextMenu={(e) => e.preventDefault()}
        >
          Your browser does not support audio playback.
        </audio>
      );
    }
    
    return (
      <div className="text-center p-8 bg-gray-100 rounded-lg">
        <p className="text-gray-600">Preview not available for this file type.</p>
        <p className="text-sm text-gray-500 mt-2">This file is view-only and cannot be downloaded.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black text-white">
      <Header />
      
      <main className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {loading ? (
              <div className="text-center bg-gray-800/50 backdrop-blur rounded-xl border border-cyan-500/30 p-8">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
                <p className="mt-4 text-cyan-300 font-mono">INITIALIZING_DOWNLOAD_PROTOCOL...</p>
              </div>
            ) : error ? (
              <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-red-500/30 p-8 text-center">
                <div className="rounded-full bg-red-500/20 p-4 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-red-400 mb-2 font-mono">ACCESS_DENIED</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <Link to="/" className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-mono transition-all shadow-[0_0_20px_rgba(8,145,178,0.4)]">
                  RETURN_HOME
                </Link>
              </div>
            ) : isViewOnly ? (
              // View-Only Mode UI
              <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-blue-500/30 overflow-hidden">
                <div className="bg-blue-600/20 border-b border-blue-500/30 px-6 py-4 flex items-center gap-3">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <h1 className="text-lg font-bold text-blue-300 font-mono">VIEW_ONLY_MODE</h1>
                </div>
                
                <div className="p-6">
                  <div className="mb-4 text-center">
                    <h2 className="text-xl font-semibold text-white mb-1">{file.filename}</h2>
                    <p className="text-gray-400">{file.formattedSize}</p>
                    <p className="text-xs text-blue-400 mt-2 font-mono">🔒 This file is view-only and cannot be downloaded</p>
                  </div>
                  
                  <div className="mt-6">
                    {renderPreview()}
                  </div>
                  
                  {/* Security Notice */}
                  {file.deleteAfterFirstAccess && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                      <p className="text-red-400 text-sm font-mono">⚠️ This file will be deleted after this viewing session</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Normal/Encrypted Download UI
              <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-cyan-500/30 overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.1)]">
                <div className="bg-cyan-600/20 border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isEncrypted ? (
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    <h1 className="text-lg font-bold text-cyan-300 font-mono">
                      {isEncrypted ? 'ENCRYPTED_FILE_READY' : 'FILE_READY_FOR_DOWNLOAD'}
                    </h1>
                  </div>
                  {isEncrypted && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded-full border border-green-500/30">
                      E2E ENCRYPTED
                    </span>
                  )}
                </div>
                
                <div className="p-6">
                  <div className="flex items-center justify-center p-6 mb-4">
                    <div className="rounded-full bg-cyan-500/20 p-4 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                      <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="mb-6 text-center">
                    <h2 className="text-xl font-semibold text-white mb-1">{file.filename}</h2>
                    <p className="text-gray-400">{file.formattedSize}</p>
                    
                    {/* File metadata */}
                    <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                      {file.maxDownloads && (
                        <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/20 font-mono">
                          {file.downloads}/{file.maxDownloads} downloads
                        </span>
                      )}
                      {file.deleteAfterFirstAccess && (
                        <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded border border-red-500/20 font-mono">
                          Self-destructs after download
                        </span>
                      )}
                      {file.expiresAt && (
                        <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20 font-mono">
                          Expires: {new Date(file.expiresAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Countdown or status */}
                  {countdown > 0 && !isEncrypted ? (
                    <div className="text-center mb-6">
                      <p className="text-gray-400 font-mono text-sm">
                        Auto-download in {countdown} {countdown === 1 ? 'second' : 'seconds'}
                      </p>
                      <div className="w-full bg-gray-700 rounded-full h-1 mt-2 overflow-hidden">
                        <div 
                          className="bg-cyan-400 h-1 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(6,182,212,0.8)]" 
                          style={{ width: `${(5 - countdown) * 20}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : decryptionStatus === 'decrypting' ? (
                    <div className="text-center mb-6">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-green-400 mr-2"></div>
                      <p className="text-green-400 font-mono inline">DECRYPTING_FILE...</p>
                    </div>
                  ) : null}
                  
                  {/* Download button */}
                  <button
                    onClick={handleDownload}
                    className={`w-full py-4 rounded-lg font-bold tracking-wider uppercase text-sm transition-all font-mono ${
                      isDownloading 
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                        : isEncrypted
                          ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.4)]'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_30px_rgba(8,145,178,0.4)]'
                    }`}
                    disabled={isDownloading}
                  >
                    {isDownloading 
                      ? (decryptionStatus === 'decrypting' ? 'DECRYPTING...' : 'DOWNLOADING...') 
                      : isEncrypted 
                        ? 'DECRYPT & DOWNLOAD' 
                        : 'DOWNLOAD NOW'
                    }
                  </button>
                  
                  {/* View Document button */}
                  <button
                    onClick={handleViewDocument}
                    className="w-full mt-3 py-3 rounded-lg font-bold tracking-wider uppercase text-sm transition-all font-mono border-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:border-purple-400"
                   disabled={isDownloading}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      VIEW DOCUMENT IN BROWSER
                    </span>
                  </button>
                  
                  {/* Encryption notice */}
                  {isEncrypted && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-xs font-mono text-center">
                        🔐 This file is end-to-end encrypted. Decryption happens locally in your browser.
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500 font-mono">Powered by FileForge • Zero-Knowledge Architecture</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Document Viewer Modal */}
      {showViewer && file && (
        <DocumentViewer
          fileUrl={file.isEncrypted ? null : file.previewUrl}
          fileName={file.filename}
          mimeType={file.mimeType}
          isEncrypted={file.isEncrypted}
          decryptedBlob={decryptedBlob}
          onClose={() => {
            setShowViewer(false);
            setDecryptedBlob(null);
          }}
        />
      )}
    </div>
  );
};

export default DownloadFile;