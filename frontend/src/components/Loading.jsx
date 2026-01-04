import React, { useState, useEffect } from 'react';
import WarpScene from './3d/WarpScene';
import { motion, AnimatePresence } from 'framer-motion';

const LOADING_TEXTS = [
    "INITIALIZING HYPERSPACE UPLINK...",
    "DECRYPTING BIO-SIGNATURE VECTORS...",
    "CALIBRATING NEURAL INTERFACE...",
    "SYNCHRONIZING QUANTUM STORAGE...",
    "ESTABLISHING SECURE PROTOCOL..."
];

const Loading = () => {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        setTextIndex(prev => (prev + 1) % LOADING_TEXTS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#020204] overflow-hidden">
      {/* 3D Warp Tunnel Background */}
      <WarpScene />

      {/* Foreground UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
         <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center relative z-10 p-8"
         >
            {/* Logo/Icon Area - Replaced by 3D Core in Scene, but we add a label here */}
            <div className="mb-12">
               <div className="w-24 h-24 mx-auto rounded-full border border-cyan-500/30 animate-ping absolute top-0 left-1/2 -translate-x-1/2"></div>
               <div className="w-32 h-32 mx-auto rounded-full border border-indigo-500/20 animate-pulse absolute top-[-1rem] left-1/2 -translate-x-1/2"></div>
            </div>

            <AnimatePresence mode="wait">
                <motion.h2 
                    key={textIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 font-mono"
                >
                    {LOADING_TEXTS[textIndex]}
                </motion.h2>
            </AnimatePresence>

            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: "100%" }}
               transition={{ duration: 4, repeat: Infinity }}
               className="h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mt-6 w-64 mx-auto rounded-full opacity-70"
            />
            
            <p className="mt-4 text-xs text-gray-500 tracking-[0.2em] uppercase">
               FILEFORGE SECURE ENVIRONMENT
            </p>
         </motion.div>
      </div>
    </div>
  );
};

export default Loading; 