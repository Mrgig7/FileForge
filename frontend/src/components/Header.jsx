import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ProfileAvatar from './ProfileAvatar';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const { isAuthenticated, logout, user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [activeItem, setActiveItem] = useState('/');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Protected route check
  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/profile'];
    if ((!isAuthenticated || !token) && protectedRoutes.includes(location.pathname)) {
      navigate('/login');
    }
  }, [isAuthenticated, token, location.pathname, navigate]);

  return (
    <>
      <motion.nav 
        initial={{ y: -100, x: "-50%", opacity: 0 }}
        animate={{ y: 24, x: "-50%", opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="fixed top-0 left-1/2 z-50 flex items-center gap-2 p-2 rounded-full bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      >
        {/* Logo Section */}
        <Link to="/" className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform">
          <img src="/img/logo.png" alt="FF" className="w-6 h-6 object-contain brightness-200" />
        </Link>
        
        {/* Navigation Section */}
        <div className="flex items-center bg-white/5 rounded-full px-1 py-1 border border-white/5">
           {[
             { path: '/', label: 'Home', icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
             )},
             ...(isAuthenticated ? [{ path: '/dashboard', label: 'Dashboard', icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
             )}] : [])
           ].map((link) => (
             <Link
               key={link.path}
               to={link.path}
               className={`relative px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all duration-300 ${activeItem === link.path ? 'text-white' : 'text-gray-400 hover:text-white'}`}
             >
               {activeItem === link.path && (
                  <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white/10 rounded-full border border-white/5"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
               )}
               <span className="relative z-10">{link.icon}</span>
               <span className="relative z-10">{link.label}</span>
             </Link>
           ))}
        </div>

        {/* User / Action Section */}
        {isAuthenticated ? (
          <div className="relative ml-2">
            <button
               onClick={() => setShowProfileMenu(!showProfileMenu)}
               className="flex items-center gap-2 pr-4 pl-1 py-1 rounded-full bg-gradient-to-r from-gray-800 to-gray-900 border border-white/10 hover:border-white/20 transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <ProfileAvatar user={user} size="sm" />
              <div className="flex flex-col items-start leading-none">
                 <span className="text-xs font-bold text-white max-w-[80px] truncate">{user?.name}</span>
                 <span className="text-[10px] text-green-400">ONLINE</span>
              </div>
            </button>
            
             <AnimatePresence>
                {showProfileMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                    exit={{ opacity: 0, y: 10, scale: 0.9, x: "-50%" }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="absolute top-16 left-1/2 w-56 bg-[#050510]/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden z-50 ring-1 ring-white/5"
                  >
                    {/* Decorative Gradient Top */}
                    <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-70" />
                    
                    <div className="p-2 space-y-1">
                      <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 border-b border-white/5">
                        Account
                      </div>
                      
                      <Link 
                        to="/profile" 
                        onClick={() => setShowProfileMenu(false)}
                        className="group flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
                      >
                         <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-cyan-500/20 text-gray-400 group-hover:text-cyan-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                         </div>
                         <span className="font-medium">Profile Settings</span>
                      </Link>

                      <button 
                        onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                        className="group flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-300 hover:text-red-200 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                      >
                         <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-red-500/20 text-gray-400 group-hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                         </div>
                         <span className="font-medium">Disconnect</span>
                      </button>
                    </div>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>
        ) : (
          <Link
            to="/login"
            className="ml-2 px-6 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.4)]"
          >
            Sign In
          </Link>
        )}
      </motion.nav>
    </>
  );
};

export default Header; 