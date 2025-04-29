import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ProfileAvatar from './ProfileAvatar';

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

  // If not authenticated or no token, redirect to login from protected routes
  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/profile'];
    if ((!isAuthenticated || !token) && protectedRoutes.includes(location.pathname)) {
      navigate('/login');
    }
  }, [isAuthenticated, token, location.pathname, navigate]);

  return (
    <header className="bg-dark-bg-secondary border-b border-dark-border/40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src="/img/logo.png" alt="FileForge Logo" className="h-8 w-auto" />
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center">
              <Link
                to="/"
                className={`px-3 py-1.5 text-sm transition-colors ${
                  activeItem === '/' 
                    ? 'text-white bg-dark-accent-primary rounded-lg' 
                    : 'text-dark-text-secondary hover:text-white'
                }`}
              >
                Home
              </Link>
              
              {isAuthenticated && (
                <Link
                  to="/dashboard"
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    activeItem === '/dashboard'
                      ? 'text-white bg-dark-accent-primary rounded-lg'
                      : 'text-dark-text-secondary hover:text-white'
                  }`}
                >
                  Dashboard
                </Link>
              )}
            </nav>

            {/* Auth Button or Profile Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-dark-bg-primary/50 transition-colors"
                >
                  <ProfileAvatar user={user} size="sm" />
                  <span className="text-sm text-dark-text-secondary">{user?.name || 'User'}</span>
                  <svg className={`w-4 h-4 text-dark-text-secondary transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-dark-bg-secondary border border-dark-border rounded-lg shadow-lg py-1 z-50">
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-dark-text-secondary hover:bg-dark-bg-primary/50 hover:text-white transition-colors"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-dark-text-secondary hover:bg-dark-bg-primary/50 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 text-sm text-dark-text-secondary hover:text-white transition-colors"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 