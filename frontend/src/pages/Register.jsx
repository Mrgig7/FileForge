import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }
    
    try {
      const result = await register(name, email, password, confirmPassword);
      
      if (result.success) {
        setSuccess(result.message || 'Registration successful! You can now log in.');
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
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg-primary overflow-hidden text-dark-text-primary">
      <Header />
      
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-20 -right-40 w-96 h-96 bg-indigo-600 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-20 w-96 h-96 bg-dark-accent-secondary rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-dark-accent-primary rounded-full opacity-10 blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDQydjQySDM2VjE4eiIgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-10"></div>
        
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-dark-accent-primary/40 rounded-full animate-float"></div>
        <div className="absolute top-3/4 left-2/3 w-3 h-3 bg-dark-accent-secondary/40 rounded-full animate-float animation-delay-2000"></div>
        <div className="absolute top-1/3 left-3/4 w-2 h-2 bg-indigo-400/40 rounded-full animate-float animation-delay-1000"></div>
      </div>
      
      <main className="py-24 px-4 relative z-10">
        <div className="container mx-auto max-w-md">
          <div className="relative">
            {/* Glow effect behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-dark-accent-primary to-dark-accent-secondary rounded-2xl blur-xl opacity-20 transform rotate-2 scale-105 animate-pulse-shadow"></div>
            
            {/* Card */}
            <div className="relative bg-dark-bg-secondary/80 backdrop-blur-md rounded-2xl border border-dark-border/60 shadow-dark-xl overflow-hidden transform transition-all duration-300 hover:shadow-dark-accent-primary/10">
              <div className="absolute inset-0 bg-gradient-to-br from-dark-accent-primary/5 to-dark-accent-secondary/5 opacity-80"></div>
              
              <div className="relative py-10 px-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-2 text-dark-text-primary">
                    Create Account
                  </h2>
                  <p className="text-dark-text-secondary">
                    Join FileForge and start sharing securely
                  </p>
                </div>
                
                {error && (
                  <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                
                {success && (
                  <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>{success}</span>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-5 max-w-sm mx-auto">
                  <div className="group relative">
                    <label htmlFor="name" className="block text-sm font-medium text-dark-text-secondary mb-2 transition-colors group-focus-within:text-dark-accent-primary">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-text-secondary">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                      </div>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-dark-border bg-dark-bg-primary/50 rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all duration-200 text-dark-text-primary placeholder-dark-text-secondary/50"
                        placeholder="John Doe"
                        disabled={isLoading}
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-200">
                        <span className="w-2 h-2 rounded-full bg-dark-accent-primary"></span>
                      </div>
                    </div>
                  </div>
                  
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
                    <label htmlFor="password" className="block text-sm font-medium text-dark-text-secondary mb-2 transition-colors group-focus-within:text-dark-accent-primary">
                      Password
                    </label>
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
                        minLength={6}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-200">
                        <span className="w-2 h-2 rounded-full bg-dark-accent-primary"></span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-dark-text-secondary flex items-center">
                      <svg className="w-3.5 h-3.5 mr-1 text-dark-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      Must be at least 6 characters
                    </p>
                  </div>
                  
                  <div className="group relative">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-dark-text-secondary mb-2 transition-colors group-focus-within:text-dark-accent-primary">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-text-secondary">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                      </div>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                  
                  <div className="pt-4">
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
                            <span>Creating Account...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                            </svg>
                            <span>Create Account</span>
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                  
                  <div className="relative py-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dark-border"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-2 bg-dark-bg-secondary text-dark-text-secondary text-xs">or continue with</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" className="group flex items-center justify-center py-2.5 px-4 border border-dark-border rounded-lg bg-dark-bg-primary hover:bg-dark-bg-primary/80 transition-all duration-200">
                      <svg className="w-5 h-5 mr-2 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"></path>
                      </svg>
                      <span className="text-sm text-dark-text-primary">Google</span>
                    </button>
                    <button type="button" className="group flex items-center justify-center py-2.5 px-4 border border-dark-border rounded-lg bg-dark-bg-primary hover:bg-dark-bg-primary/80 transition-all duration-200">
                      <svg className="w-5 h-5 mr-2 text-dark-text-primary" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z"></path>
                      </svg>
                      <span className="text-sm text-dark-text-primary">Facebook</span>
                    </button>
                  </div>
                </form>
                
                <div className="mt-8 text-center">
                  <p className="text-sm text-dark-text-secondary">
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-dark-accent-primary hover:text-dark-accent-secondary transition-colors">
                      Sign in now
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Add custom animations */}
      <style jsx="true">{`
        @keyframes float {
          0% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-10px) translateX(5px); }
          100% { transform: translateY(0px) translateX(0px); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
};

export default Register; 