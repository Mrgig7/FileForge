import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // New state for 3D warp effect
  const [warpSpeed, setWarpSpeed] = useState(1);
  const [isWarping, setIsWarping] = useState(false);

  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    setWarpSpeed(20);
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setIsLoading(false);
      setWarpSpeed(1);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      setWarpSpeed(1);
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      setWarpSpeed(1);
      return;
    }
    
    try {
      const result = await register(name, email, password, confirmPassword);
      
      if (result.success) {
        setSuccess(result.message || 'Registration successful! You can now log in.');
        
        setIsWarping(true);
        setWarpSpeed(50);

        // Clear form after successful registration
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        
        // Redirect to login after 2 seconds - ensure correct URL path
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
        setWarpSpeed(1);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Registration error:', err);
      setWarpSpeed(1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout speed={warpSpeed} isWarping={isWarping}>
        <div className="text-center mb-8">
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
            Join the Network
            </h2>
            <p className="text-gray-400">Initialize your secure digital identity.</p>
        </div>

        {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm backdrop-blur-sm">
            {error}
            </div>
        )}
        
        {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm backdrop-blur-sm">
            {success}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest pl-1">Identity (Full Name)</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    placeholder="John Doe"
                    required
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest pl-1">Coordinates (Email)</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setWarpSpeed(2 + e.target.value.length * 0.2);
                    }}
                    onBlur={() => setWarpSpeed(1)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    placeholder="user@fileforge.io"
                    required
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest pl-1">Access Key</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                        placeholder="••••••••"
                        required
                        minLength={6}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest pl-1">Verify Key</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                        placeholder="••••••••"
                        required
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
                {isLoading ? 'Processing...' : 'Create Identity'}
            </button>
        </form>

        <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                Already registered? <span className="text-purple-400 hover:underline">Access Terminal</span>
            </Link>
        </div>
    </AuthLayout>
  );
};

export default Register;