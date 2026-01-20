import { useState, useRef, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { fileApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { 
    prepareEncryptedUpload, 
    createShareLink, 
    isEncryptionSupported 
} from '../utils/encryption';
import { removeMetadata, supportsMetadataRemoval, mayHaveSensitiveMetadata } from '../utils/metadata';

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
    subject: 'Transmitted Secure File via FileForge',
    message: 'Access the encrypted data packet here.'
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useContext(AuthContext);

  // Security Options State
  const [securityOptions, setSecurityOptions] = useState({
    enableEncryption: true, // Encryption on by default
    removeMetadata: false, // Strip EXIF/metadata
    maxDownloads: null, // null = unlimited
    deleteAfterFirstAccess: false,
    expiresAfter: '24h', // '1h', '6h', '24h', '7d', '30d'
    viewOnly: false
  });
  const [encryptionKey, setEncryptionKey] = useState(null); // Store key for share link
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Get the share link (with encryption key if encrypted)
  const getShareLink = () => {
    if (!uploadedFileData) return '';
    if (uploadedFileData.shareLink) {
      return uploadedFileData.shareLink;
    }
    return `${window.location.origin}/files/${uploadedFileData.uuid}`;
  };

  // Copy link to clipboard
  const copyShareLink = async () => {
    const link = getShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size > 100 * 1024 * 1024) {
      setError('MAXSIZE_EXCEEDED: 100MB LIMIT');
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
      setError('MAXSIZE_EXCEEDED: 100MB LIMIT');
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
      setError('NO_FILE_DETECTED');
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadComplete(false);
    setEncryptionKey(null);

    try {
      const formData = new FormData();
      let keyBase64 = null;
      let encryptionIV = null;
      let fileToUpload = file;

      // Step 1: Remove metadata if enabled
      if (securityOptions.removeMetadata && supportsMetadataRemoval(file.type)) {
        setProgress(2);
        console.log('Removing metadata from file...');
        fileToUpload = await removeMetadata(file);
        console.log('Metadata removed');
      }

      // Step 2: Handle encryption if enabled
      if (securityOptions.enableEncryption && isEncryptionSupported()) {
        setProgress(5);
        console.log('Encrypting file client-side...');
        
        const { encryptedFile, iv, keyBase64: key } = await prepareEncryptedUpload(fileToUpload);
        keyBase64 = key;
        encryptionIV = iv;
        
        formData.append('myfile', encryptedFile);
        formData.append('isEncrypted', 'true');
        formData.append('encryptionIV', iv);
        
        setProgress(20);
        console.log('File encrypted successfully');
      } else {
        formData.append('myfile', fileToUpload);
      }

      // Add user ID if authenticated
      if (user && user.id) {
        formData.append('userId', user.id);
      }

      // Add security options
      if (securityOptions.maxDownloads) {
        formData.append('maxDownloads', securityOptions.maxDownloads.toString());
      }
      formData.append('deleteAfterFirstAccess', securityOptions.deleteAfterFirstAccess.toString());
      formData.append('expiresAfter', securityOptions.expiresAfter);
      formData.append('viewOnly', securityOptions.viewOnly.toString());

      setProgress(30);
      const data = await fileApi.uploadFile(formData);
      
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setProgress(100);
      setUploadComplete(true);
      
      // Store the encryption key for share link
      if (keyBase64) {
        setEncryptionKey(keyBase64);
        // Create the share link with encryption key in fragment
        const shareLink = createShareLink(data.file.uuid, keyBase64);
        data.file.shareLink = shareLink;
        console.log('Share link with encryption key:', shareLink);
      }
      
      setUploadedFileData(data.file);

      if (user && user.email) {
        setEmailData(prev => ({ ...prev, from: user.email }));
      }

      setTimeout(() => setShowEmailForm(true), 1500);
    } catch (error) {
      console.error('Upload uplink failed:', error);
      setError(error.response?.data?.error || 'UPLINK_FAILED');
    } finally {
      setTimeout(() => setUploading(false), 500);
    }
  };

  const handleEmailInput = (e) => {
    const { name, value } = e.target;
    setEmailData(prev => ({ ...prev, [name]: value }));
  };

  const sendEmail = async () => {
    if (!emailData.from || !emailData.to) {
      setError('MISSING_COORDINATES: FROM/TO REQUIRED');
      return;
    }

    setSendingEmail(true);
    setError('');

    try {
      await fileApi.sendFile(uploadedFileData.uuid, emailData.to, emailData.from);
      setEmailSent(true);
      setTimeout(() => onSuccess && onSuccess(uploadedFileData), 2000);
    } catch (error) {
      console.error('Transmission failed:', error);
      setError('TRANSMISSION_FAILED');
    } finally {
      setSendingEmail(false);
    }
  };

  // Simulated upload progress
  useEffect(() => {
    let interval;
    if (uploading && progress < 90) {
      interval = setInterval(() => {
        setProgress(prev => Math.min(prev + (Math.random() * 10), 90));
      }, 200);
    }
    return () => clearInterval(interval);
  }, [uploading, progress]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0, opacity: 0, rotateX: 20 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="relative w-full max-w-lg mx-4 perspective-1000"
        >
           {/* Holographic Glowing Border */}
           <div className={`absolute -inset-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-xl blur-md opacity-75 ${dragActive ? 'animate-pulse' : ''}`}></div>

          <div className="relative bg-black/90 rounded-xl border border-cyan-500/30 overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]">
             {/* Holographic Grid Background inside Modal */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

            <div className="relative p-6 z-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-cyan-400 tracking-widest font-mono uppercase text-shadow-glow">
                  {showEmailForm ? ">> SECURE_TRANSMISSION" : ">> INITIATE_UPLOAD"}
                </h3>
                <button onClick={onClose} className="text-cyan-500/50 hover:text-cyan-400 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {showEmailForm ? (
                <div className="space-y-4 font-mono">
                  {emailSent ? (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="text-center py-8"
                    >
                      <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 border border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h4 className="text-green-400 text-lg">TRANSMISSION COMPLETE</h4>
                      <p className="text-gray-400 text-xs mt-2">DATA PACKET DELIVERED</p>
                    </motion.div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <input name="from" value={emailData.from} onChange={handleEmailInput} placeholder="SENDER_ID (Email)" className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded p-3 text-cyan-100 placeholder-cyan-700/50 outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all" />
                        <input name="to" value={emailData.to} onChange={handleEmailInput} placeholder="RECIPIENT_ID (Email)" className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded p-3 text-cyan-100 placeholder-cyan-700/50 outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all" />
                        <textarea name="message" value={emailData.message} onChange={handleEmailInput} rows="3" placeholder="ENCRYPTED_MESSAGE" className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded p-3 text-cyan-100 placeholder-cyan-700/50 outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all" />
                      </div>
                      
                      {/* Share Link Actions */}
                      <div className="mt-4 p-3 bg-gray-800/50 border border-cyan-500/20 rounded-lg">
                        <p className="text-xs text-gray-400 font-mono mb-2">SHARE_LINK:</p>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            readOnly 
                            value={getShareLink()} 
                            className="flex-1 bg-gray-900/50 border border-cyan-500/20 rounded px-3 py-2 text-cyan-300 text-xs font-mono truncate"
                          />
                          <button 
                            onClick={copyShareLink}
                            className={`px-3 py-2 rounded text-xs font-mono transition-all ${linkCopied ? 'bg-green-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                          >
                            {linkCopied ? '✓ COPIED' : 'COPY'}
                          </button>
                          <button 
                            onClick={() => setShowQRModal(true)}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-mono"
                          >
                            QR
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 pt-4">
                         <button onClick={() => onSuccess && onSuccess(uploadedFileData)} className="flex-1 py-3 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-900/20 transition-colors uppercase text-sm tracking-wider">
                           Skip Protocol
                         </button>
                         <button onClick={sendEmail} disabled={sendingEmail} className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-all uppercase text-sm tracking-wider font-bold">
                           {sendingEmail ? "Transmitting..." : "Engage Uplink"}
                         </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                <div 
                  className={`relative border-2 border-dashed rounded-lg p-10 text-center transition-all duration-300 group ${dragActive ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02]' : 'border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/5'}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                   {/* Scanning line animation */}
                   <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                     <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-scan"></div>
                   </div>

                   <input type="file" className="hidden" onChange={handleFileChange} ref={fileInputRef} />
                   
                   {file ? (
                     <div className="text-cyan-300">
                        <div className="mx-auto w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4 border border-cyan-500/50">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div className="font-mono text-sm">{file.name}</div>
                        <div className="text-xs text-cyan-500/70 mt-1">{formatBytes(file.size)}</div>
                     </div>
                   ) : (
                     <div className="space-y-4">
                       <div className="relative mx-auto w-20 h-20">
                          <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping" />
                          <div className="relative z-10 w-full h-full bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/50">
                            <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          </div>
                       </div>
                       <p className="text-cyan-300 font-mono text-sm tracking-widest uppercase">Drop Packet Here</p>
                       <p className="text-cyan-600 text-xs">or click to initialize browser</p>
                     </div>
                   )}
                </div>

                {/* Security Options Panel - Show when file is selected */}
                {file && !showEmailForm && (
                  <div className="mt-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowSecurityPanel(!showSecurityPanel); }}
                      className="w-full flex items-center justify-between text-purple-400 text-sm font-mono uppercase tracking-wider"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        SECURITY_OPTIONS
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${showSecurityPanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showSecurityPanel && (
                      <div className="mt-4 space-y-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {/* Encryption Toggle */}
                        <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-cyan-300 font-mono flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            ENCRYPT_FILE
                          </span>
                          <div className={`relative w-12 h-6 rounded-full transition-colors ${securityOptions.enableEncryption ? 'bg-green-500' : 'bg-gray-700'}`}>
                            <input 
                              type="checkbox" 
                              className="sr-only"
                              checked={securityOptions.enableEncryption}
                              onChange={(e) => setSecurityOptions(prev => ({ ...prev, enableEncryption: e.target.checked }))}
                            />
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${securityOptions.enableEncryption ? 'translate-x-6' : ''}`}></div>
                          </div>
                        </label>

                        {/* Remove Metadata Toggle */}
                        <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-cyan-300 font-mono flex items-center gap-2">
                            <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                            STRIP_METADATA
                            {file && mayHaveSensitiveMetadata(file) && (
                              <span className="text-xs text-yellow-400 ml-1">⚠️</span>
                            )}
                          </span>
                          <div className={`relative w-12 h-6 rounded-full transition-colors ${securityOptions.removeMetadata ? 'bg-pink-500' : 'bg-gray-700'}`}>
                            <input 
                              type="checkbox" 
                              className="sr-only"
                              checked={securityOptions.removeMetadata}
                              onChange={(e) => setSecurityOptions(prev => ({ ...prev, removeMetadata: e.target.checked }))}
                            />
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${securityOptions.removeMetadata ? 'translate-x-6' : ''}`}></div>
                          </div>
                        </label>

                        {/* Delete After First Access */}
                        <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-cyan-300 font-mono flex items-center gap-2">
                            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            SELF_DESTRUCT
                          </span>
                          <div className={`relative w-12 h-6 rounded-full transition-colors ${securityOptions.deleteAfterFirstAccess ? 'bg-red-500' : 'bg-gray-700'}`}>
                            <input 
                              type="checkbox" 
                              className="sr-only"
                              checked={securityOptions.deleteAfterFirstAccess}
                              onChange={(e) => setSecurityOptions(prev => ({ ...prev, deleteAfterFirstAccess: e.target.checked }))}
                            />
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${securityOptions.deleteAfterFirstAccess ? 'translate-x-6' : ''}`}></div>
                          </div>
                        </label>

                        {/* View Only Mode */}
                        <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-cyan-300 font-mono flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            VIEW_ONLY
                          </span>
                          <div className={`relative w-12 h-6 rounded-full transition-colors ${securityOptions.viewOnly ? 'bg-blue-500' : 'bg-gray-700'}`}>
                            <input 
                              type="checkbox" 
                              className="sr-only"
                              checked={securityOptions.viewOnly}
                              onChange={(e) => setSecurityOptions(prev => ({ ...prev, viewOnly: e.target.checked }))}
                            />
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${securityOptions.viewOnly ? 'translate-x-6' : ''}`}></div>
                          </div>
                        </label>

                        {/* Max Downloads */}
                        <div className="flex items-center justify-between">
                          <span className="text-cyan-300 font-mono flex items-center gap-2">
                            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            MAX_DOWNLOADS
                          </span>
                          <select 
                            value={securityOptions.maxDownloads || 'unlimited'}
                            onChange={(e) => setSecurityOptions(prev => ({ ...prev, maxDownloads: e.target.value === 'unlimited' ? null : parseInt(e.target.value) }))}
                            className="bg-gray-800 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 text-xs font-mono"
                          >
                            <option value="unlimited">UNLIMITED</option>
                            <option value="1">1</option>
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="100">100</option>
                          </select>
                        </div>

                        {/* Expiration Time */}
                        <div className="flex items-center justify-between">
                          <span className="text-cyan-300 font-mono flex items-center gap-2">
                            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            EXPIRES_AFTER
                          </span>
                          <select 
                            value={securityOptions.expiresAfter}
                            onChange={(e) => setSecurityOptions(prev => ({ ...prev, expiresAfter: e.target.value }))}
                            className="bg-gray-800 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 text-xs font-mono"
                          >
                            <option value="1h">1 HOUR</option>
                            <option value="6h">6 HOURS</option>
                            <option value="24h">24 HOURS</option>
                            <option value="7d">7 DAYS</option>
                            <option value="30d">30 DAYS</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </>
              )}

              {uploading && (
                <div className="mt-6">
                  <div className="flex justify-between text-xs font-mono text-cyan-400 mb-2">
                    <span>UPLINK_STATUS</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1 bg-cyan-900 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs font-mono">
                  ERROR: {error}
                </div>
              )}

              {!showEmailForm && (
                <motion.button 
                  onClick={uploadFile}
                  disabled={!file || uploading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full mt-6 py-4 rounded font-bold tracking-widest uppercase text-sm transition-all ${!file || uploading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_30px_rgba(8,145,178,0.4)]'}`}
                >
                  {uploading ? "ESTABLISHING LINK..." : "INITIATE UPLOAD"}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
        
        <style jsx="true">{`
          @keyframes scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          .animate-scan {
            animation: scan 2s linear infinite;
          }
        `}</style>
      </div>
      
      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowQRModal(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 border border-purple-500/50 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-[0_0_50px_rgba(168,85,247,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h3 className="text-purple-400 font-mono text-lg mb-4 flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                SCAN_TO_DOWNLOAD
              </h3>
              
              <div className="bg-white p-4 rounded-xl inline-block mb-4">
                <QRCodeSVG 
                  value={getShareLink()} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              {uploadedFileData && (
                <p className="text-gray-400 text-sm font-mono mb-4 truncate">
                  {uploadedFileData.originalName || 'FILE_READY'}
                </p>
              )}
              
              {encryptionKey && (
                <div className="text-xs text-green-400 font-mono mb-4 flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  E2E Encrypted
                </div>
              )}
              
              <div className="flex gap-3">
                <button 
                  onClick={copyShareLink}
                  className={`flex-1 py-2 rounded text-sm font-mono transition-all ${linkCopied ? 'bg-green-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                >
                  {linkCopied ? '✓ COPIED!' : 'COPY LINK'}
                </button>
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 py-2 border border-purple-500/30 text-purple-400 rounded hover:bg-purple-900/20 text-sm font-mono"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FileUploader;
