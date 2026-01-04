import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import ProfileAvatar from '../components/ProfileAvatar';
import ProfileScene from '../components/3d/ProfileScene';
import { motion } from 'framer-motion';

const Profile = () => {
  const { user, updateProfile, token } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    profilePic: null
  });
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
      if (user.profilePic) {
        setPreviewUrl(user.profilePic);
      }
    }
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        setError('Image exists standard dimensions. Max 5MB.');
        return;
      }
      setFormData(prev => ({ ...prev, profilePic: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfilePicture = async (file) => {
    if (!file) return null;
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const img = new Image();
            img.src = reader.result;
            img.onload = async () => {
              try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 800;
                if (width > height && width > MAX_SIZE) {
                  height = Math.round((height * MAX_SIZE) / width);
                  width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                  width = Math.round((width * MAX_SIZE) / height);
                  height = MAX_SIZE;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                const contentType = compressedDataUrl.split(';')[0].split(':')[1];
                
                const response = await fetch('/api/profile/upload-base64', {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ imageData: compressedDataUrl, contentType }),
                });
                
                if (!response.ok) throw new Error('Upload failed');
                const result = await response.json();
                if (result.user?.profilePic) localStorage.setItem('profilePicUrl', result.user.profilePic);
                resolve(result);
              } catch (err) { reject(err); }
            };
            img.onerror = () => reject(new Error('Image load failed'));
          } catch (error) { reject(error); }
        };
        reader.readAsDataURL(file);
      });
    } catch (error) { throw error; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (formData.newPassword || formData.confirmNewPassword) {
        if (!formData.currentPassword) throw new Error('Current password required');
        if (formData.newPassword !== formData.confirmNewPassword) throw new Error('Passwords do not match');
        if (formData.newPassword.length < 6) throw new Error('Password too short (min 6)');
      }

      if (!token) throw new Error('Auth Token Missing');

      let profileUpdateResult;
      if (formData.profilePic instanceof File) {
        const uploadResult = await uploadProfilePicture(formData.profilePic);
        if (uploadResult?.success) {
            profileUpdateResult = uploadResult;
            if (uploadResult.user?.profilePic) setPreviewUrl(uploadResult.user.profilePic);
        }
      }
      
      if (!profileUpdateResult) {
        profileUpdateResult = await updateProfile({
          name: formData.name,
          email: formData.email,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        });
      }

      setSuccess(profileUpdateResult.message || 'Profile Updated');
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmNewPassword: '' }));
    } catch (err) {
      setError(err.message || 'Update Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#050510] overflow-hidden text-white relative font-sans">
      <Header />
      
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
         <ProfileScene />
      </div>

      <main className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl pointer-events-auto"
        >
          <div className="bg-[#0a0a12]/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
             
             {/* Decorative Top Line */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

             <div className="flex flex-col md:flex-row gap-8 items-start">
                 
                 {/* Left Column: Avatar & Status */}
                 <div className="flex flex-col items-center gap-4 w-full md:w-1/3">
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-cyan-500 to-purple-600 shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-shadow duration-300">
                             <div className="w-full h-full rounded-full overflow-hidden bg-black/50 backdrop-blur">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <ProfileAvatar user={user} size="lg" className="w-full h-full" />
                                )}
                             </div>
                        </div>
                        <label className="absolute bottom-1 right-1 bg-cyan-600 hover:bg-cyan-500 p-2 rounded-full cursor-pointer shadow-lg transition-colors border border-white/20">
                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </label>
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white tracking-wide">{user?.name}</h2>
                        <p className="text-xs text-cyan-400 font-mono tracking-widest uppercase">COMMANDER</p>
                    </div>
                 </div>

                 {/* Right Column: Form */}
                 <div className="flex-1 w-full">
                    <h1 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        PROFILE CONFIGURATION
                    </h1>

                    {error && (
                        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                             <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-6 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm flex items-center gap-2">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                             <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-widest text-gray-400 pl-1">Name</label>
                                <input 
                                    type="text" 
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:outline-none transition-all placeholder-gray-600"
                                    placeholder="Enter Name"
                                />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-widest text-gray-400 pl-1">Email</label>
                                <input 
                                    type="email" 
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:outline-none transition-all placeholder-gray-600"
                                    placeholder="Enter Email"
                                />
                             </div>
                        </div>

                        <div className="pt-4 pb-2 border-t border-white/5">
                            <h3 className="text-sm font-medium text-gray-300 mb-4">Security Protocol</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-widest text-gray-400 pl-1">Current Password</label>
                                    <input 
                                        type="password" 
                                        value={formData.currentPassword}
                                        onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:outline-none transition-all placeholder-gray-600"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-widest text-gray-400 pl-1">New Password</label>
                                    <input 
                                        type="password" 
                                        value={formData.newPassword}
                                        onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:outline-none transition-all placeholder-gray-600"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>UPDATING...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                        <span>SAVE CHANGES</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                 </div>
             </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Profile;