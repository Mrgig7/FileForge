import React from 'react';

const Loading = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-gradient-to-br from-dark-bg-primary to-dark-bg-secondary">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/img/logo.png" alt="FileForge" className="w-14 h-14 animate-pulse-shadow" />
          </div>
        </div>
        
        <div className="flex space-x-2 justify-center items-center">
          <div className="loader-dots flex">
            <div className="h-2.5 w-2.5 bg-indigo-600 rounded-full"></div>
            <div className="h-2.5 w-2.5 bg-indigo-600 rounded-full"></div>
            <div className="h-2.5 w-2.5 bg-indigo-600 rounded-full"></div>
            <div className="h-2.5 w-2.5 bg-indigo-600 rounded-full"></div>
          </div>
        </div>
        
        <h2 className="mt-6 text-xl font-semibold text-gray-200">Loading your files...</h2>
        <p className="mt-2 text-gray-400 max-w-md mx-auto">
          Preparing your secure file experience with FileForge
        </p>
      </div>
    </div>
  );
};

export default Loading; 