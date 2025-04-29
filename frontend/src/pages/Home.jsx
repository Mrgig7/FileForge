import { Link } from 'react-router-dom';
import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const { isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const testimonialsRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    // Track scroll position for parallax effects
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);

    // Simple animation for elements when they come into view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('.animate-on-scroll');
    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      sections.forEach((section) => {
        observer.unobserve(section);
      });
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleUploadClick = () => {
    if (!isAuthenticated) {
      navigate('/login?returnTo=/share');
    } else {
      navigate('/share');
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg-primary overflow-hidden text-dark-text-primary">
      <Header />
      
      <main>
        {/* Hero Section with advanced effects */}
        <section ref={heroRef} className="relative py-28 overflow-hidden">
          {/* Animated background elements with glassmorphism */}
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute -top-40 -right-40 w-96 h-96 bg-dark-accent-primary rounded-full opacity-10 blur-3xl"
              style={{ transform: `translateY(${scrollY * 0.1}px)` }}
            ></div>
            <div 
              className="absolute top-1/3 -left-20 w-72 h-72 bg-blue-500 rounded-full opacity-10 blur-3xl"
              style={{ transform: `translateY(${scrollY * -0.05}px)` }}
            ></div>
            <div 
              className="absolute -bottom-40 left-1/3 w-80 h-80 bg-indigo-500 rounded-full opacity-10 blur-3xl"
              style={{ transform: `translateY(${scrollY * 0.2}px)` }}
            ></div>
            
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDQydjQySDM2VjE4eiIgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-10"></div>
          </div>
          
          <div className="container relative mx-auto px-4 max-w-full lg:max-w-screen-2xl">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-16">
              <div className="lg:w-1/2 animate-on-scroll opacity-0 transition-all duration-1000 transform translate-y-10">
                <h1 className="text-5xl lg:text-7xl font-bold mb-8 leading-tight">
                  Secure File Sharing
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-dark-accent-primary to-blue-400 gradient-animate">Made Simple</span>
                </h1>
                <p className="text-xl text-dark-text-secondary mb-10 max-w-xl">
                  Upload, share, and manage your files with confidence. FileForge provides a secure and 
                  effortless way to send files to anyone, anywhere.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-5">
                  <button 
                    onClick={handleUploadClick}
                    className="group relative overflow-hidden px-8 py-4 text-lg bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-dark-accent-primary/20"
                  >
                    <span className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-[105%] transition-transform duration-700 ease-in-out"></span>
                    <span className="flex items-center gap-2 relative z-10">
                      <svg className="w-5 h-5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                      </svg>
                      Upload File Now
                    </span>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/register')}
                    className="relative group px-8 py-4 text-lg bg-transparent border border-dark-border text-dark-text-primary hover:border-dark-accent-primary font-medium rounded-xl transition-all duration-300"
                  >
                    <span className="relative z-10">Create Free Account</span>
                    <span className="absolute inset-0 bg-dark-accent-primary/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 rounded-xl"></span>
                  </button>
                </div>
                
                <div className="mt-12 flex items-center space-x-6">
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-dark-border bg-dark-bg-secondary flex items-center justify-center overflow-hidden shadow-lg">
                        <span className="text-xs font-medium text-dark-text-primary">{String.fromCharCode(64 + i)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-dark-text-secondary">
                    <span className="font-bold text-dark-text-primary">10,000+</span> people trust FileForge
                  </div>
                </div>
              </div>
              
              <div className="lg:w-1/2 animate-on-scroll opacity-0 transition-all duration-1000 delay-300 transform translate-y-10">
                <div className="relative">
                  <div className="absolute -inset-2 bg-gradient-to-r from-dark-accent-primary to-blue-500 rounded-2xl blur-xl opacity-20 transform -rotate-6 scale-105 animate-pulse-shadow"></div>
                  <div className="relative bg-dark-bg-secondary/40 backdrop-blur-sm p-8 rounded-2xl border border-dark-border/60 shadow-dark-xl glassmorphism">
                    <div 
                      className="flex flex-col items-center text-center p-8 border-2 border-dashed border-dark-border rounded-xl cursor-pointer hover:border-dark-accent-primary transition-colors" 
                      onClick={handleUploadClick}
                    >
                      <div className="relative mb-6">
                        <span className="absolute -inset-8 bg-dark-accent-primary rounded-full opacity-20 blur-2xl"></span>
                        <svg className="w-20 h-20 text-dark-text-primary relative" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                      </div>
                      <h3 className="text-2xl font-medium text-dark-text-primary mb-2">Drop file to upload</h3>
                      <p className="text-dark-text-secondary mb-4">or click to browse</p>
                      <div className="grid grid-cols-4 gap-3 w-full max-w-sm mt-2">
                        {['DOCX', 'XLSX', 'PDF', 'JPG'].map(format => (
                          <div key={format} className="bg-dark-bg-primary/50 rounded-lg py-2 text-dark-text-secondary text-xs font-medium border border-dark-border/50">
                            {format}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-dark-text-secondary mt-6">Up to 100MB • Files are encrypted</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Stats Section */}
        <section className="py-16 bg-dark-bg-secondary border-y border-dark-border relative overflow-hidden">
          {/* Animated stars in background */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  width: `${Math.random() * 2 + 1}px`,
                  height: `${Math.random() * 2 + 1}px`,
                  opacity: Math.random() * 0.5,
                  animation: `pulse ${Math.random() * 4 + 2}s infinite alternate`
                }}
              ></div>
            ))}
          </div>
          
          <div className="container relative mx-auto px-4 max-w-full lg:max-w-screen-2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 animate-on-scroll opacity-0 transition-all duration-700">
              {[
                { number: '2M+', label: 'Files Shared', icon: 
                  <svg className="w-10 h-10 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                },
                { number: '50TB+', label: 'Data Transferred', icon: 
                  <svg className="w-10 h-10 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                },
                { number: '99.9%', label: 'Uptime', icon: 
                  <svg className="w-10 h-10 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                },
                { number: '256-bit', label: 'AES Encryption', icon: 
                  <svg className="w-10 h-10 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
              ].map((stat, i) => (
                <div key={i} 
                  className="relative bg-gradient-to-br from-dark-bg-primary to-dark-bg-secondary border border-dark-border/80 rounded-2xl overflow-hidden shadow-dark-lg transform transition-all duration-300 hover:-translate-y-1 hover:shadow-dark-xl group"
                >
                  {/* Accent glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-dark-accent-primary/10 to-dark-accent-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Content */}
                  <div className="relative z-10 p-8 flex flex-col items-center">
                    <div className="mb-4 text-dark-accent-primary">{stat.icon}</div>
                    <h3 className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.number}</h3>
                    <div className="h-1 w-12 bg-gradient-to-r from-dark-accent-primary to-dark-accent-secondary rounded-full mb-3"></div>
                    <p className="text-dark-text-secondary">{stat.label}</p>
                  </div>
                  
                  {/* Border glow effect */}
                  <div className="absolute inset-0 border-2 border-dark-accent-primary/0 rounded-2xl group-hover:border-dark-accent-primary/40 transition-colors duration-300"></div>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section ref={featuresRef} className="py-24 bg-dark-bg-primary relative overflow-hidden">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDQydjQySDM2VjE4eiIgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-10"></div>
          
          <div className="container mx-auto px-4 max-w-full lg:max-w-screen-2xl relative">
            <div className="text-center max-w-3xl mx-auto mb-16 animate-on-scroll opacity-0 transition-all duration-700">
              <h2 className="text-4xl font-bold mb-6 text-dark-text-primary">How FileForge Works</h2>
              <p className="text-xl text-dark-text-secondary">Our platform is designed to make file sharing as simple and secure as possible, without sacrificing functionality.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
                  title: "1. Upload Your Files",
                  description: "Simply drag and drop your files or browse to select. FileForge supports all major file formats including documents, images, videos, and more.",
                  color: "from-blue-400 to-blue-500"
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
                  title: "2. Share Instantly",
                  description: "Get a unique link to share with anyone, or send directly via email. Recipients don't need an account to download your files.",
                  color: "from-dark-accent-primary to-dark-accent-secondary"
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
                  title: "3. Track & Manage",
                  description: "Monitor download statistics, manage access permissions, and set expiry dates. You maintain complete control over your shared files.",
                  color: "from-indigo-400 to-indigo-500"
                }
              ].map((feature, i) => (
                <div key={i} className="flex flex-col items-center text-center animate-on-scroll opacity-0 transition-all duration-700 p-8 rounded-2xl border border-dark-border/40 bg-dark-bg-secondary/30 hover:bg-dark-bg-secondary/50 hover:border-dark-accent-primary/50 transition-all duration-300 transform hover:-translate-y-1" style={{ transitionDelay: `${i * 200}ms` }}>
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-gradient-to-r opacity-20 blur-xl rounded-full" style={{ background: `linear-gradient(to right, ${feature.color.split(' ')[0].replace('from-', '')}, ${feature.color.split(' ')[1].replace('to-', '')})` }}></div>
                    <div className={`w-20 h-20 bg-gradient-to-r ${feature.color} rounded-full flex items-center justify-center shadow-lg relative`}>
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        {feature.icon}
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold mb-4 text-dark-text-primary">{feature.title}</h3>
                  <p className="text-dark-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section ref={testimonialsRef} className="py-24 bg-dark-bg-secondary border-y border-dark-border relative overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-dark-bg-secondary to-dark-bg-primary opacity-50"></div>
          
          <div className="container relative mx-auto px-4 max-w-full lg:max-w-screen-2xl">
            <div className="text-center max-w-3xl mx-auto mb-16 animate-on-scroll opacity-0 transition-all duration-700">
              <h2 className="text-4xl font-bold mb-6 text-dark-text-primary">What Our Users Say</h2>
              <p className="text-xl text-dark-text-secondary">Join thousands of satisfied users who trust FileForge every day.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "FileForge has transformed how our team shares files with clients. The interface is intuitive and the security features give us peace of mind.",
                  author: "Sarah Johnson",
                  role: "Marketing Director"
                },
                {
                  quote: "I've tried many file sharing services, but FileForge is by far the most reliable. The tracking features are a game-changer for my business.",
                  author: "Michael Chen",
                  role: "Graphic Designer"
                },
                {
                  quote: "The speed and simplicity of FileForge is impressive. I can securely share large files with my clients without any technical hassles.",
                  author: "Alex Rodriguez",
                  role: "Photographer"
                }
              ].map((testimonial, i) => (
                <div key={i} className="glassmorphism p-8 rounded-2xl shadow-dark-lg animate-on-scroll opacity-0 transition-all duration-700 transform hover:scale-105 border border-dark-border/50" style={{ transitionDelay: `${i * 200}ms` }}>
                  <div className="flex items-center space-x-1 text-yellow-400 mb-6">
                    {[1, 2, 3, 4, 5].map(star => (
                      <svg key={star} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                      </svg>
                    ))}
                  </div>
                  <p className="text-dark-text-primary mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-dark-accent-primary/30 to-dark-accent-secondary/30 rounded-full flex items-center justify-center border border-dark-border">
                      <span className="text-xl font-bold text-dark-text-primary">{testimonial.author[0]}</span>
                    </div>
                    <div className="ml-4">
                      <h4 className="font-semibold text-dark-text-primary">{testimonial.author}</h4>
                      <p className="text-dark-text-secondary text-sm">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-br from-dark-bg-primary via-dark-accent-secondary/30 to-dark-bg-primary text-dark-text-primary relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-dark-accent-primary rounded-full opacity-10 blur-3xl"></div>
            <div className="absolute bottom-0 left-20 w-72 h-72 bg-dark-accent-secondary rounded-full opacity-10 blur-3xl"></div>
            
            {/* Floating particles */}
            {[...Array(15)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-2 h-2 rounded-full bg-dark-accent-primary/30"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `float ${Math.random() * 10 + 10}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 5}s`
                }}
              ></div>
            ))}
          </div>
          
          <div className="container relative mx-auto px-4 max-w-full lg:max-w-screen-2xl text-center">
            <div className="max-w-3xl mx-auto animate-on-scroll opacity-0 transition-all duration-700 glassmorphism p-10 rounded-2xl border border-dark-border/50 shadow-dark-xl">
              <h2 className="text-4xl font-bold mb-6 text-dark-text-primary">Ready to start sharing?</h2>
              <p className="text-xl mb-10 text-dark-text-secondary">
                Join thousands of users who trust FileForge for their file sharing needs. Create your free account today and experience the difference.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button 
                  onClick={handleUploadClick}
                  className="relative overflow-hidden group px-8 py-4 text-lg bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-dark-accent-primary/20"
                >
                  <span className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-[105%] transition-transform duration-700 ease-in-out"></span>
                  <span className="relative z-10 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    Upload Now
                  </span>
                </button>
                <button 
                  onClick={() => navigate('/register')}
                  className="relative group px-8 py-4 text-lg bg-transparent border border-dark-border text-dark-text-primary hover:border-dark-accent-primary font-medium rounded-xl transition-all duration-300"
                >
                  <span className="relative z-10">Sign Up Free</span>
                  <span className="absolute inset-0 bg-dark-accent-primary/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 rounded-xl"></span>
                </button>
              </div>
              <p className="mt-8 text-sm text-dark-text-secondary">No credit card required • Free plan available</p>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer with modern design */}
      <footer className="bg-dark-bg-secondary border-t border-dark-border py-16">
        <div className="container mx-auto px-4 max-w-full lg:max-w-screen-2xl">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-3xl font-bold mb-6 text-dark-text-primary">FileForge</h3>
              <p className="text-dark-text-secondary mb-6 max-w-md">Secure file sharing for everyone. Transfer large files quickly, easily, and with enterprise-grade security.</p>
              <div className="flex space-x-4">
                {['facebook', 'twitter', 'instagram', 'linkedin'].map(social => (
                  <a key={social} href="#" className="w-10 h-10 rounded-full bg-dark-bg-primary flex items-center justify-center hover:bg-dark-accent-primary transition-colors">
                    <span className="sr-only">{social}</span>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-2.861c0-1.881-2.002-1.722-2.002 0v2.861h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-6 text-dark-text-primary">Company</h4>
              <ul className="space-y-3">
                {['About', 'Features', 'Pricing', 'Careers', 'Blog'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-dark-text-secondary hover:text-dark-accent-primary transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-6 text-dark-text-primary">Support</h4>
              <ul className="space-y-3">
                {['Help Center', 'Contact Us', 'Privacy', 'Terms', 'Cookies Policy'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-dark-text-secondary hover:text-dark-accent-primary transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="border-t border-dark-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-dark-text-secondary">© {new Date().getFullYear()} FileForge. All rights reserved.</p>
            <div className="mt-4 md:mt-0">
              <p className="text-dark-text-secondary text-sm">Built with ❤️ for secure file sharing</p>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Add custom style for animations */}
      <style jsx="true">{`
        .animate-fade-in {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        
        .floating {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Home; 