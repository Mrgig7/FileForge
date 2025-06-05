import { useState, useRef, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { fileApi } from '../services/api';

// API base URL from environment or fallback to production URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app/api';

const FileUploader = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [uploadedFileData, setUploadedFileData] = useState(null);
  const [emailData, setEmailData] = useState({
    from: '',
    to: '',
    subject: 'File shared from FileForge',
    message: 'I have shared a file with you via FileForge.'
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useContext(AuthContext);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size > 100 * 1024 * 1024) {
      setError('File size must be less than 100MB');
      setFile(null);
      e.target.value = ''; // Reset input
      return;
    }
    setFile(selectedFile);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.size > 100 * 1024 * 1024) {
      setError('File size must be less than 100MB');
      setFile(null);
      return;
    }
    setFile(droppedFile);
    setError('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const uploadFile = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('myfile', file);

    // Add user ID to the form data if available
    if (user && user.id) {
      formData.append('userId', user.id);
    }

    setUploading(true);
    setProgress(0);
    setUploadComplete(false);

    try {
      const data = await fileApi.uploadFile(formData);
      
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setProgress(100);
      setUploadComplete(true);
      setUploadedFileData(data.file);

      // Set default email from if user is logged in
      if (user && user.email) {
        setEmailData(prev => ({
          ...prev,
          from: user.email
        }));
      }

      // Show email form after upload completes
      setTimeout(() => {
        setShowEmailForm(true);
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to upload file');
    } finally {
      setTimeout(() => {
        setUploading(false);
      }, 500);
    }
  };

  const handleEmailInput = (e) => {
    const { name, value } = e.target;
    setEmailData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const sendEmail = async () => {
    if (!emailData.from || !emailData.to) {
      setError('From and To email addresses are required');
      return;
    }

    setSendingEmail(true);
    setError('');

    try {
      await fileApi.sendFile(
        uploadedFileData.uuid,
        emailData.to,
        emailData.from
      );

      setEmailSent(true);

      // Close the modal after email is sent (after showing success)
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(uploadedFileData);
        }
      }, 2000);

    } catch (error) {
      console.error('Email error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const skipEmail = () => {
    setShowEmailForm(false);
    if (onSuccess) {
      onSuccess(uploadedFileData);
    }
  };

  // Simulate progress animation
  useEffect(() => {
    let progressInterval;

    if (uploading && progress < 90) {
      progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + (10 - prev / 10), 90));
      }, 300);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [uploading, progress]);

  const getFileIcon = () => {
    if (!file) return null;

    const extension = file.name.split('.').pop().toLowerCase();

    switch (extension) {
      case 'pdf':
        return (
          <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'doc':
      case 'docx':
        return (
          <svg className="w-8 h-8 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return (
          <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-dark-text-secondary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-xl blur opacity-20"></div>
        <div className="relative bg-dark-bg-secondary/80 backdrop-blur-sm rounded-xl overflow-hidden border border-dark-border/60 shadow-dark-xl glassmorphism p-6">
          {/* Header with close button */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-dark-text-primary">
              {showEmailForm ? "Send File by Email" : "Upload File"}
            </h3>
            <button
              onClick={onClose}
              className="text-dark-text-secondary hover:text-dark-text-primary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {showEmailForm ? (
            // Email Form
            <div className="mt-4">
              {emailSent ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-green-100">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-dark-text-primary mb-2">Email Sent Successfully!</h3>
                  <p className="text-dark-text-secondary text-center mb-6">
                    Your file has been shared with {emailData.to}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="text-dark-text-secondary mb-4">
                      Your file was uploaded successfully. Share it via email:
                    </p>
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                        <p className="text-red-500 text-sm">{error}</p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-dark-text-secondary text-sm mb-1">From</label>
                        <input
                          type="email"
                          name="from"
                          value={emailData.from}
                          onChange={handleEmailInput}
                          placeholder="your@email.com"
                          className="w-full bg-dark-bg-primary border border-dark-border rounded-lg px-4 py-2 text-dark-text-primary focus:ring-2 focus:ring-dark-accent-primary/50 focus:border-dark-accent-primary outline-none transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-dark-text-secondary text-sm mb-1">To</label>
                        <input
                          type="email"
                          name="to"
                          value={emailData.to}
                          onChange={handleEmailInput}
                          placeholder="recipient@email.com"
                          className="w-full bg-dark-bg-primary border border-dark-border rounded-lg px-4 py-2 text-dark-text-primary focus:ring-2 focus:ring-dark-accent-primary/50 focus:border-dark-accent-primary outline-none transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-dark-text-secondary text-sm mb-1">Subject</label>
                        <input
                          type="text"
                          name="subject"
                          value={emailData.subject}
                          onChange={handleEmailInput}
                          className="w-full bg-dark-bg-primary border border-dark-border rounded-lg px-4 py-2 text-dark-text-primary focus:ring-2 focus:ring-dark-accent-primary/50 focus:border-dark-accent-primary outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-dark-text-secondary text-sm mb-1">Message</label>
                        <textarea
                          name="message"
                          value={emailData.message}
                          onChange={handleEmailInput}
                          rows="3"
                          className="w-full bg-dark-bg-primary border border-dark-border rounded-lg px-4 py-2 text-dark-text-primary focus:ring-2 focus:ring-dark-accent-primary/50 focus:border-dark-accent-primary outline-none transition"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={skipEmail}
                      className="text-dark-text-secondary hover:text-dark-text-primary"
                    >
                      Skip
                    </button>
                    <button
                      onClick={sendEmail}
                      disabled={sendingEmail}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-dark-accent-primary hover:bg-dark-accent-secondary text-white transition-colors ${
                        sendingEmail ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                    >
                      {sendingEmail ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                          </svg>
                          Send Email
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* File Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
                  dragActive
                    ? 'border-dark-accent-primary bg-dark-accent-primary/5'
                    : 'border-dark-border hover:border-dark-accent-primary/50 hover:bg-dark-bg-primary/30'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />

                {file ? (
                  <div className="py-6">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-dark-accent-primary/10">
                        {getFileIcon()}
                      </div>
                      <p className="text-lg font-medium text-dark-text-primary mb-2">{file.name}</p>
                      <p className="text-sm text-dark-text-secondary">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="relative mb-6">
                      <span className="absolute -inset-8 bg-dark-accent-primary rounded-full opacity-20 blur-2xl"></span>
                      <svg className="mx-auto h-16 w-16 text-dark-text-secondary animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-dark-text-primary mb-2">Drag & Drop Your File Here</h3>
                    <p className="text-dark-text-secondary mb-4">or click to browse your files</p>
                    <p className="text-xs text-dark-text-secondary">Maximum file size: 100MB</p>
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}

              {/* Upload progress */}
              {uploading && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-dark-text-secondary">Uploading...</span>
                    <span className="text-sm text-dark-text-secondary">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-dark-bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Upload success message */}
              {uploadComplete && !uploading && (
                <div className="mt-6 flex items-center bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <p className="text-green-500 text-sm">File uploaded successfully!</p>
                </div>
              )}

              {/* Upload button */}
              <div className="mt-6">
                <button
                  onClick={uploadFile}
                  disabled={!file || uploading || uploadComplete}
                  className={`w-full py-2.5 text-white rounded-lg flex items-center justify-center transition-colors ${
                    !file || uploading || uploadComplete
                      ? 'bg-dark-bg-primary text-dark-text-secondary cursor-not-allowed'
                      : 'bg-dark-accent-primary hover:bg-dark-accent-secondary'
                  }`}
                >
                  {uploading ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : uploadComplete ? (
                    'Complete!'
                  ) : (
                    'Upload File'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;