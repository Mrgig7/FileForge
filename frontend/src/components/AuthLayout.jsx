import { motion } from 'framer-motion';
import AuthScene from './3d/AuthScene';

const AuthLayout = ({ children, speed = 1, isWarping = false }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white flex items-center justify-center">
      {/* 3D Background Layer */}
      <div className="absolute inset-0 z-0">
        <AuthScene speed={speed} isWarping={isWarping} />
      </div>

      {/* Content Layer */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/20 relative overflow-hidden group">
            {/* Dynamic decorative glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-3xl blur-md opacity-50 group-hover:opacity-100 transition duration-500"></div>
            
            <div className="relative z-20">
                {children}
            </div>
        </div>
      </motion.div>
      
      {/* Overlay for Warp Flash */}
        {isWarping && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-white mix-blend-overlay pointer-events-none"
            />
        )}
    </div>
  );
};

export default AuthLayout;
