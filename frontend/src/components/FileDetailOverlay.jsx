import { motion } from 'framer-motion';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const FileDetailOverlay = ({ file, onDeselect, onDownload, onPreview, onDelete }) => {
  const navigate = useNavigate();

  const handleShare = useCallback(() => {
    navigate(`/share/${file.uuid}`);
  }, [file, navigate]);

  if (!file) return null;

  const { originalName, mimetype, size, createdAt, downloads, expiresAt } = file;
  const fileType = mimetype?.split('/')[1]?.toUpperCase() || 'BINARY';
  const sizeMB = (size / 1024 / 1024).toFixed(2);
  const createdDate = new Date(createdAt).toLocaleDateString();
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.98 }}
      className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[640px]"
    >
      <div className="group/card relative rounded-[2.5rem] border border-white/10 shadow-2xl shadow-black/40">
        {/* BG Gradients & Effects */}
        <div className="absolute -inset-0.5 rounded-[2.5rem] bg-gradient-to-tr from-cyan-600/30 to-indigo-600/30 blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>
        <div className="relative bg-black/60 backdrop-blur-2xl rounded-[2.5rem] p-8 overflow-hidden">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 min-w-0 pr-6">
              <h2 className="text-3xl font-bold tracking-tighter text-white mb-2 truncate" title={originalName}>
                {originalName}
              </h2>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="font-mono px-2 py-0.5 rounded-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {fileType}
                </span>
                <span>{sizeMB} MB</span>
                <span>Created: {createdDate}</span>
              </div>
            </div>
            <button 
              onClick={onDeselect}
              className="bg-white/5 hover:bg-white/10 p-2.5 rounded-full transition-all border border-transparent hover:border-white/20"
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <ActionButton icon="preview" text="Preview" onClick={() => onPreview(file)} />
            <ActionButton icon="download" text="Download" onClick={() => onDownload(file)} />
            <ActionButton icon="share" text="Share" onClick={handleShare} />
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10 text-center">
            <DetailItem label="Downloads" value={downloads || 0} />
            <DetailItem label="Status" value={isExpired ? 'Expired' : 'Active'} isExpired={isExpired} />
            <DetailItem label="Expires In" value="30 Days" />
          </div>

          {/* Footer / Danger Zone */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to permanently delete this file? This action cannot be undone.')) {
                  onDelete(file.uuid);
                }
              }}
              className="text-red-500/60 hover:text-red-500 text-xs uppercase tracking-widest font-bold transition-colors"
            >
              Delete File
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ActionButton = ({ icon, text, onClick }) => {
  const icons = {
    preview: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    download: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    share: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
  };
  return (
    <button
      onClick={onClick}
      className="group flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-4 rounded-xl border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-2.5 text-sm"
    >
      {icons[icon]}
      <span className="tracking-wide">{text}</span>
    </button>
  )
};

const DetailItem = ({ label, value, isExpired }) => (
  <div className="flex flex-col">
    <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</span>
    <span className={`text-lg font-semibold ${isExpired ? 'text-red-400' : 'text-white'}`}>{value}</span>
  </div>
);

export default FileDetailOverlay;
