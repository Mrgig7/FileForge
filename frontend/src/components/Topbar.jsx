import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import ProfileAvatar from './ProfileAvatar';

const Topbar = () => {
  const { user } = useContext(AuthContext);

  return (
    <header className="h-16 px-8 border-b border-white/10 bg-black/30 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between">
      {/* Search */}
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-xl leading-5 bg-white/5 backdrop-blur text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 sm:text-sm transition-all duration-200"
            placeholder="Search files..."
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
             <kbd className="hidden sm:inline-block border border-zinc-700 rounded px-1.5 text-[10px] font-medium text-zinc-500 opacity-70">⌘K</kbd>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-zinc-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-background"></span>
        </button>

        <div className="h-6 w-px bg-zinc-800"></div>

        {/* Profile */}
        <div className="flex items-center gap-3">
           <div className="text-right hidden md:block">
              <div className="text-sm font-medium text-white leading-none mb-1">{user?.name || "User"}</div>
              <div className="text-xs text-zinc-500 leading-none">Pro Plan</div>
           </div>
           <ProfileAvatar user={user} size="sm" />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
