import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';

// API base URL from environment or fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the return URL from query params or default to dashboard
  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('returnTo') || '/';

  // Test the API connectivity when component mounts
  useEffect(() => {
    async function testApiConnection() {
      try {
        // Fix: Ensure no duplicate '/api/' in the path
        // If API_BASE_URL already ends with /api, just add /test, otherwise use /api/test
        const testUrl = API_BASE_URL.endsWith('/api') 
          ? `${API_BASE_URL}/test`
          : `${API_BASE_URL}/api/test`;
        
        console.log(`Testing API connection at: ${testUrl}`);
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log(`API test response status: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log('API test successful:', data);
        } else {
          console.error('API test failed');
        }
      } catch (error) {
        console.error('API test error:', error);
      }
    }
    
    testApiConnection();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnUrl);
    }
  }, [isAuthenticated, navigate, returnUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setError('');
    setIsLoading(true);
    
    try {
      // Try the API test login endpoint first
      const loginUrl = '/api/test-login';
      console.log(`Sending login request to test endpoint: ${loginUrl}`);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });
      
      console.log(`Login response status: ${response.status}`);
      console.log(`Response headers:`, Object.fromEntries([...response.headers]));
      
      // Check for non-JSON responses first
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // For debugging - log the text response to see what was actually returned
        const textResponse = await response.text();
        console.error(`Received non-JSON response: ${textResponse.substring(0, 100)}...`);
        
        // Log the full response for debugging
        console.error(`Full response URL: ${response.url}`);
        console.error(`Full response status: ${response.status} ${response.statusText}`);
        console.error(`Full response type: ${response.type}`);
        
        throw new Error(`Server returned non-JSON response: ${contentType || 'unknown content type'}`);
      }
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to connect to server' }));
        throw new Error(data.error || `Login failed: ${response.status}`);
      }
      
      let data;
      try {
        // If we reach here, we need to clone the response since we can't use it twice
        const clonedResponse = response.clone();
        data = await clonedResponse.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Server returned invalid JSON response');
      }
      
      if (!data.token) {
        throw new Error('No token received from server');
      }
      
      console.log('Login successful, received token');
      console.log('Token type:', typeof data.token);
      console.log('Token prefix:', data.token.substring(0, 10));
      
      // Ensure we have valid user data
      const userData = data.user || {
        id: 'temp-id',
        name: email.split('@')[0],
        email: email
      };
      
      // Store token in localStorage
      localStorage.setItem('token', data.token);
      
      // Update auth context
      login(userData, data.token);
      
      // Redirect to the return URL
      navigate(returnUrl);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg-primary overflow-hidden text-dark-text-primary">
      <Header />
      
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-dark-accent-primary rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-indigo-500 rounded-full opacity-10 blur-3xl"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDQydjQySDM2VjE4eiIgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-10"></div>
      </div>
      
      <main className="py-32 px-4 relative z-10">
        <div className="container mx-auto max-w-md">
          <div className="relative">
            {/* Glow effect behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-dark-accent-secondary rounded-2xl blur-xl opacity-20 transform -rotate-3 scale-105 animate-pulse-shadow"></div>
            
            {/* Card */}
            <div className="relative bg-dark-bg-secondary/80 backdrop-blur-md rounded-2xl border border-dark-border/60 shadow-dark-xl overflow-hidden transform transition-all duration-300 hover:shadow-dark-accent-primary/10">
              <div className="absolute inset-0 bg-gradient-to-br from-dark-accent-primary/5 to-dark-accent-secondary/5 opacity-80"></div>
              
              <div className="relative py-10 px-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-2 text-dark-text-primary">
                    Welcome Back
                  </h2>
                  <p className="text-dark-text-secondary">
                    Sign in to your FileForge account
                  </p>
                </div>
                
                {returnUrl !== '/' && (
                  <div className="mb-6 p-4 rounded-lg bg-dark-accent-primary/10 border border-dark-accent-primary/20 text-dark-text-primary text-sm flex items-center">
                    <svg className="w-5 h-5 mr-2 text-dark-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>You'll be redirected back after logging in.</span>
                  </div>
                )}
                
                {error && (
                  <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-6 max-w-sm mx-auto">
                  <div className="group relative">
                    <label htmlFor="email" className="block text-sm font-medium text-dark-text-secondary mb-2 transition-colors group-focus-within:text-dark-accent-primary">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-text-secondary">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                        </svg>
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-dark-border bg-dark-bg-primary/50 rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all duration-200 text-dark-text-primary placeholder-dark-text-secondary/50"
                        placeholder="your@email.com"
                        disabled={isLoading}
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-200">
                        <span className="w-2 h-2 rounded-full bg-dark-accent-primary"></span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="group relative">
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="password" className="block text-sm font-medium text-dark-text-secondary transition-colors group-focus-within:text-dark-accent-primary">
                        Password
                      </label>
                      <a href="#" className="text-xs text-dark-accent-primary hover:text-dark-accent-secondary transition-colors">
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-text-secondary">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                      </div>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-dark-border bg-dark-bg-primary/50 rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all duration-200 text-dark-text-primary placeholder-dark-text-secondary/50"
                        placeholder="••••••••"
                        disabled={isLoading}
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-200">
                        <span className="w-2 h-2 rounded-full bg-dark-accent-primary"></span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="group relative w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-white bg-gradient-to-r from-dark-accent-primary to-dark-accent-secondary hover:from-dark-accent-primary/90 hover:to-dark-accent-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dark-accent-primary focus:ring-offset-dark-bg-secondary transition-all duration-200 shadow-lg hover:shadow-dark-accent-primary/30 transform hover:-translate-y-0.5"
                    >
                      <span className="absolute inset-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out"></span>
                      <span className="relative flex items-center">
                        {isLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Signing In...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                            </svg>
                            <span>Sign In</span>
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                </form>
                
                <div className="mt-8 text-center">
                  <p className="text-sm text-dark-text-secondary">
                    Don't have an account?{' '}
                    <Link to="/register" className="font-medium text-dark-accent-primary hover:text-dark-accent-secondary transition-colors">
                      Sign up now
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login; 