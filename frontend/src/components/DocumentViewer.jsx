import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * DocumentViewer - Universal file viewer component
 * Supports: PDF, Images, Videos, Audio, Code/Text files
 */
const DocumentViewer = ({ 
  fileUrl, 
  fileName, 
  mimeType, 
  onClose,
  isEncrypted = false,
  decryptedBlob = null 
}) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const codeRef = useRef(null);
  const containerRef = useRef(null);

  // Generate blob URL from decrypted blob or directly from URL
  useEffect(() => {
    let createdBlobUrl = null;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setTextContent('');

    const loadContent = async () => {
      try {
        if (decryptedBlob) {
          createdBlobUrl = URL.createObjectURL(decryptedBlob);
          if (!cancelled) setBlobUrl(createdBlobUrl);
          return;
        }

        if (!fileUrl) return;

        if (isTextFile(mimeType)) {
          const response = await fetch(fileUrl);
          const text = await response.text();
          if (!cancelled) setTextContent(text);
        }

        if (!cancelled) setBlobUrl(fileUrl);
      } catch (err) {
        console.error('Error loading file:', err);
        if (!cancelled) setError('Failed to load file content');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadContent();

    return () => {
      cancelled = true;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [fileUrl, decryptedBlob, mimeType]);

  // Highlight code after text content loads
  useEffect(() => {
    if (textContent && codeRef.current && isCodeFile(fileName)) {
      hljs.highlightElement(codeRef.current);
    }
  }, [textContent, fileName]);

  // Determine file type
  const isTextFile = (mime) => {
    return mime?.startsWith('text/') || 
           mime === 'application/json' ||
           mime === 'application/javascript' ||
           mime === 'application/xml';
  };

  const isCodeFile = (name) => {
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', 
                           '.css', '.scss', '.html', '.xml', '.json', '.yaml', '.yml', '.md',
                           '.sh', '.bash', '.sql', '.php', '.rb', '.go', '.rs', '.swift'];
    return codeExtensions.some(ext => name?.toLowerCase().endsWith(ext));
  };

  const isPDF = () => mimeType === 'application/pdf';
  const isImage = () => mimeType?.startsWith('image/');
  const isVideo = () => mimeType?.startsWith('video/');
  const isAudio = () => mimeType?.startsWith('audio/');
  const isText = () => isTextFile(mimeType);

  // PDF handlers
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF');
    setLoading(false);
  };

  // Zoom controls
  const zoomIn = () => setScale(s => Math.min(s + 0.25, 3.0));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  // Page navigation
  const prevPage = () => setCurrentPage(p => Math.max(p - 1, 1));
  const nextPage = () => setCurrentPage(p => Math.min(p + 1, numPages));

  // Disable right-click
  const handleContextMenu = (e) => e.preventDefault();

  // Render loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mb-4"></div>
          <p className="text-cyan-300 font-mono">LOADING_DOCUMENT...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="bg-gray-800/90 rounded-xl border border-red-500/30 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-red-400 font-mono mb-2">VIEWER_ERROR</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={onClose} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-mono">
            CLOSE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-sm"
      onContextMenu={handleContextMenu}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-cyan-500/30">
        <div className="flex items-center gap-4">
          <h3 className="text-cyan-300 font-mono text-sm truncate max-w-[300px]">{fileName}</h3>
          {isEncrypted && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-mono rounded border border-green-500/30">
              🔐 DECRYPTED
            </span>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls for PDF/Image */}
          {(isPDF() || isImage()) && (
            <div className="flex items-center gap-1 mr-4">
              <button onClick={zoomOut} className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded" title="Zoom Out">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                </svg>
              </button>
              <span className="text-cyan-300 text-sm font-mono w-16 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={zoomIn} className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded" title="Zoom In">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button onClick={resetZoom} className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded text-xs font-mono" title="Reset">
                FIT
              </button>
            </div>
          )}
          
          {/* Page navigation for PDF */}
          {isPDF() && numPages && (
            <div className="flex items-center gap-2 mr-4">
              <button onClick={prevPage} disabled={currentPage <= 1} className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded disabled:opacity-30">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-cyan-300 text-sm font-mono">{currentPage} / {numPages}</span>
              <button onClick={nextPage} disabled={currentPage >= numPages} className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded disabled:opacity-30">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Close button */}
          <button 
            onClick={onClose} 
            className="p-2 text-red-400 hover:bg-red-500/20 rounded"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4"
      >
        {/* PDF Viewer */}
        {isPDF() && blobUrl && (
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="text-cyan-300 font-mono">LOADING_PDF...</div>
            }
          >
            <Page 
              pageNumber={currentPage} 
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        )}

        {/* Image Viewer */}
        {isImage() && blobUrl && (
          <div className="max-w-full max-h-full overflow-auto">
            <img 
              src={blobUrl}
              alt={fileName}
              className="max-w-none select-none"
              style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
              draggable={false}
              crossOrigin="anonymous"
              onError={(e) => {
                console.error('Image load error:', e);
                console.log('Image URL was:', blobUrl);
                // Try without crossOrigin if it fails
                if (e.target.crossOrigin) {
                  e.target.crossOrigin = null;
                  e.target.src = blobUrl;
                }
              }}
              onLoad={() => console.log('Image loaded successfully:', blobUrl)}
            />
          </div>
        )}

        {/* Video Player */}
        {isVideo() && blobUrl && (
          <video 
            src={blobUrl}
            controls
            controlsList="nodownload nofullscreen"
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            disablePictureInPicture
          >
            Your browser does not support video playback.
          </video>
        )}

        {/* Audio Player */}
        {isAudio() && blobUrl && (
          <div className="bg-gray-800/80 rounded-xl p-8 border border-cyan-500/30">
            <div className="w-32 h-32 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-16 h-16 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="text-cyan-300 font-mono text-center mb-4 truncate max-w-[300px]">{fileName}</h3>
            <audio 
              src={blobUrl}
              controls
              controlsList="nodownload"
              className="w-full"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        )}

        {/* Text/Code Viewer */}
        {isText() && textContent && (
          <div className="w-full max-w-4xl bg-gray-900/90 rounded-lg border border-cyan-500/30 overflow-hidden">
            <div className="px-4 py-2 bg-gray-800/50 border-b border-cyan-500/20">
              <span className="text-cyan-300 font-mono text-sm">{fileName}</span>
            </div>
            <pre className="p-4 overflow-auto max-h-[70vh] text-sm">
              <code 
                ref={codeRef}
                className={isCodeFile(fileName) ? `language-${getLanguageFromFilename(fileName)}` : ''}
              >
                {textContent}
              </code>
            </pre>
          </div>
        )}

        {/* Unsupported format */}
        {!isPDF() && !isImage() && !isVideo() && !isAudio() && !isText() && (
          <div className="text-center bg-gray-800/80 rounded-xl p-8 border border-yellow-500/30">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-yellow-400 font-mono mb-2">PREVIEW_UNAVAILABLE</h3>
            <p className="text-gray-400 text-sm">This file format cannot be previewed in the browser.</p>
            <p className="text-gray-500 text-xs mt-2">File type: {mimeType || 'Unknown'}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-900/80 border-t border-cyan-500/30 text-center">
        <p className="text-xs text-gray-500 font-mono">
          FileForge Document Viewer • Right-click disabled • Secure viewing mode
        </p>
      </div>
    </div>
  );
};

// Helper to detect language from filename
function getLanguageFromFilename(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  const langMap = {
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'h': 'c',
    'css': 'css', 'scss': 'scss', 'html': 'html', 'xml': 'xml',
    'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown',
    'sh': 'bash', 'bash': 'bash', 'sql': 'sql', 'php': 'php',
    'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'swift': 'swift'
  };
  return langMap[ext] || 'plaintext';
}

export default DocumentViewer;
