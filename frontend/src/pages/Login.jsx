import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import AuthLayout from '../components/AuthLayout';

// API base URL from environment or fallback to production URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app/api';

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

  // New state for 3D warp effect
  const [warpSpeed, setWarpSpeed] = useState(1);
  const [isWarping, setIsWarping] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setWarpSpeed(20); // Speed up tunnel on submit

    try {
      // Construct the login URL using API_BASE_URL
      const loginUrl = API_BASE_URL.endsWith('/api')
        ? `${API_BASE_URL}/auth/login`
        : `${API_BASE_URL}/api/auth/login`;

      console.log(`Sending login request to: ${loginUrl}`);

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
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response`);
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to connect to server' }));
        throw new Error(data.error || `Login failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('No token received from server');
      }

      // Success Ritual
      setIsWarping(true); // Trigger warp flash
      setWarpSpeed(50);   // Max speed

      // Delay redirect to let animation play
      setTimeout(() => {
        const userData = data.user || {
            id: 'temp-id',
            name: email.split('@')[0],
            email: email
        };
        localStorage.setItem('token', data.token);
        login(userData, data.token);
        navigate(returnUrl);
      }, 1500);

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
      setWarpSpeed(1); // Reset speed on error
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout speed={warpSpeed} isWarping={isWarping}>
        <div className="text-center mb-10">
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
            Welcome Back
            </h2>
            <p className="text-gray-400">Enter the portal to your digital archive.</p>
        </div>

        {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm backdrop-blur-sm">
            {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest pl-1">Coordinates (Email)</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setWarpSpeed(2 + e.target.value.length * 0.2); // Typing increases speed slightly
                    }}
                    onBlur={() => setWarpSpeed(1)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    placeholder="user@fileforge.io"
                    required
                />
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest pl-1">Access Key (Password)</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    placeholder="••••••••"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isLoading ? 'Initiating Uplink...' : 'Engage'}
            </button>
        </form>

        <div className="mt-8 text-center">
            <Link to="/register" className="text-sm text-gray-400 hover:text-white transition-colors">
                New User? <span className="text-indigo-400 hover:underline">Initialize Registration</span>
            </Link>
        </div>
    </AuthLayout>
  );
};

export default Login;