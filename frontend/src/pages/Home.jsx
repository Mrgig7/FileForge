import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import LandingScene from '../components/3d/LandingScene';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';

const Home = () => {
  const { isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.8]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleUploadClick = () => {
    if (!isAuthenticated) {
      navigate('/login?returnTo=/share');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div ref={containerRef} className="min-h-[300vh] bg-dark-bg-primary text-white selection:bg-indigo-500/30">
      <Header />
      
      {/* 3D Background - Fixed */}
      <LandingScene scrollY={scrollY} />

      {/* Hero Section */}
      <section className="fixed inset-0 flex items-center justify-center pointer-events-none z-10">
        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="container mx-auto px-4 text-center pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <h1 className="text-7xl md:text-9xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 filter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              FILE FORGE
            </h1>
            <p className="text-xl md:text-2xl text-blue-100/70 max-w-2xl mx-auto mb-10 font-light tracking-wide">
              The universal portal for your digital assets. <br/>
              Secure. Instant. Infinite.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <motion.button 
                onClick={handleUploadClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full overflow-hidden transition-all hover:bg-white/20 hover:border-white/40 hover:shadow-[0_0_30px_rgba(129,140,248,0.3)]"
              >
                <span className="relative z-10 text-white font-medium tracking-widest uppercase text-sm">
                  Initialize Upload
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.button>
              
              {!isAuthenticated && (
                <motion.button 
                  onClick={() => navigate('/register')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 text-sm font-medium tracking-widest uppercase text-white/60 hover:text-white transition-colors"
                >
                  Create Identity
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Scroll Content - Spaced out to allow 3D parallax */}
      <div className="relative z-20 pt-[100vh] pointer-events-none">
        {/* Features Grid */}
        <section className="min-h-screen flex items-center py-20 pointer-events-auto">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: "Encrypted Vault", desc: "Military-grade AES-256 encryption protects every byte.", color: "from-blue-500" },
                { title: "Warp Speed", desc: "Global CDN ensures your files travel at the speed of light.", color: "from-purple-500" },
                { title: "Neural Link", desc: "AI-powered organization automatically categorizes content.", color: "from-pink-500" }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{  margin: "-100px" }}
                  transition={{ delay: i * 0.2 }}
                  className="group relative p-8 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden hover:border-white/20 transition-colors"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  <h3 className="text-2xl font-bold mb-4 text-white">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA "Warp" Section */}
        <section className="min-h-[50vh] flex items-center justify-center pb-40 pointer-events-auto">
           <motion.div
             initial={{ opacity: 0, scale: 0.8 }}
             whileInView={{ opacity: 1, scale: 1 }}
             className="text-center"
           >
              <h2 className="text-5xl md:text-7xl font-bold mb-8 text-white">Ready for Lift Off?</h2>
              <button 
                onClick={() => navigate('/register')}
                className="px-12 py-6 bg-white text-black rounded-full font-bold text-xl tracking-wider hover:scale-110 transition-transform duration-300 shadow-[0_0_50px_rgba(255,255,255,0.4)]"
              >
                ENTER HYPERSPACE
              </button>
           </motion.div>
        </section>
      </div>

    </div>
  );
};

export default Home; 