import { Link } from 'react-router-dom';
import { useState } from 'react';
import { fileApi } from '../services/api';

const FileCard = ({ file, onDelete }) => {
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(file.downloadLink);
    setShowLinkCopied(true);
    setTimeout(() => setShowLinkCopied(false), 2000);
  };
  
  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTo) || !emailRegex.test(emailFrom)) {
      setError('Please enter valid email addresses.');
      setSending(false);
      return;
    }

    try {
      const response = await fileApi.sendFile(file.uuid, emailTo, emailFrom);
      
      if (response.success) {
        setSuccess('File shared successfully! The recipient will receive an email shortly.');
        setEmailTo('');
        setEmailFrom('');
        setTimeout(() => {
          setShowShareForm(false);
          setSuccess('');
        }, 3000);
      } else {
        throw new Error(response.error || 'Failed to share file');
      }
    } catch (err) {
      console.error('Share error:', err);
      setError(err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to share file. Please try again.');
    } finally {
      setSending(false);
    }
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div className="group relative bg-dark-bg-secondary/40 backdrop-blur-sm rounded-xl border border-dark-border/60 shadow-dark-xl glassmorphism overflow-hidden transition-all duration-300 hover:border-dark-accent-primary/50">
      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-accent-primary/0 to-dark-accent-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative z-10 p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">
              {file.originalName || file.fileName}
            </h3>
            <p className="text-sm text-dark-text-secondary mt-1">
              {formatFileSize(file.size)} • Uploaded {formatDate(file.createdAt)}
            </p>
          </div>
          
          <div className="flex gap-2 ml-4">
            <button 
              className="p-2 text-dark-text-secondary hover:text-dark-accent-primary transition-colors rounded-lg hover:bg-dark-bg-primary/50"
              onClick={handleCopyLink}
              title="Copy link"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4 5 0 011.242 7.244l-4.5 4.5a4 5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4 5 0 00-6.364-6.364l-4.5 4.5a4 5 0 001.242 7.244" />
              </svg>
            </button>
            
            <button 
              className="p-2 text-dark-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-dark-bg-primary/50"
              onClick={() => onDelete(file.uuid)}
              title="Delete file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-dark-bg-primary/50 rounded-xl p-3 text-center border border-dark-border/50">
            <p className="text-2xl font-semibold text-dark-accent-primary">{file.downloads}</p>
            <p className="text-xs text-dark-text-secondary">Downloads</p>
          </div>
          
          <div className="bg-dark-bg-primary/50 rounded-xl p-3 text-center border border-dark-border/50">
            <p className="text-sm font-medium text-white truncate">{file.uuid}</p>
            <p className="text-xs text-dark-text-secondary">Unique ID</p>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="text-sm">
            <div className="flex items-center mb-2">
              <span className="text-dark-text-secondary mr-2">Status:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                file.active 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {file.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="mb-2">
              <span className="text-dark-text-secondary mr-2">Link:</span>
              <span className="text-dark-text-secondary text-sm break-all">{file.downloadLink}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleCopyLink}
            className="flex-1 px-4 py-2 bg-dark-bg-primary/70 hover:bg-dark-bg-primary text-white rounded-xl text-center text-sm font-medium transition-all duration-300 border border-dark-border/50 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
            </svg>
            {showLinkCopied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => setShowShareForm(prev => !prev)}
            className="flex-1 px-4 py-2 bg-dark-accent-primary hover:bg-dark-accent-secondary text-white rounded-xl text-center text-sm font-medium transition-all duration-300"
          >
            Share Again
          </button>
        </div>

        {/* Share Form */}
        {showShareForm && (
          <form onSubmit={handleShare} className="mt-4 space-y-3">
            <div>
              <input
                type="email"
                placeholder="Recipient's email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                required
                className="w-full px-3 py-2 bg-dark-bg-primary border border-dark-border/50 rounded-lg text-dark-text-primary placeholder-dark-text-secondary focus:outline-none focus:border-dark-accent-primary/50"
              />
            </div>
            <div>
              <input
                type="email"
                placeholder="Your email"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                required
                className="w-full px-3 py-2 bg-dark-bg-primary border border-dark-border/50 rounded-lg text-dark-text-primary placeholder-dark-text-secondary focus:outline-none focus:border-dark-accent-primary/50"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-400">{success}</p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="w-full px-4 py-2 bg-dark-accent-primary text-white text-sm font-medium rounded-lg hover:bg-dark-accent-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default FileCard; 