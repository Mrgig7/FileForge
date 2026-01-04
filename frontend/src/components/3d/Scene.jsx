import { Canvas } from '@react-three/fiber'
import { Suspense, useState, useEffect } from 'react'
import { Html, Loader, Environment, Sparkles, ContactShadows, Stars } from '@react-three/drei'
import CameraRig from './CameraRig'
import FileNode from './FileNode'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'

// Check if WebGL is available
const isWebGLAvailable = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
};

// Fallback 2D File List Component
const FallbackFileList = ({ files, selectedFile, onSelect }) => {
  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    const icons = {
      pdf: '📄', doc: '📝', docx: '📝', txt: '📝',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
      mp4: '🎬', mov: '🎬', avi: '🎬', webm: '🎬',
      mp3: '🎵', wav: '🎵', ogg: '🎵',
      zip: '📦', rar: '📦', '7z': '📦',
    };
    return icons[ext] || '📁';
  };

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#0d1025] to-[#050510] overflow-auto pt-20 pb-10 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file, i) => (
            <div
              key={file.uuid || i}
              onClick={() => onSelect(file)}
              className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border ${
                selectedFile?.uuid === file.uuid
                  ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getFileIcon(file.originalName || file.filename)}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate text-sm">
                    {file.originalName || file.filename}
                  </h3>
                  <p className="text-gray-500 text-xs">{file.formattedSize || `${(file.size / 1024 / 1024).toFixed(2)} MB`}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={`px-2 py-0.5 rounded-full ${file.active !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {file.active !== false ? 'Active' : 'Expired'}
                </span>
                <span className="text-gray-500">{file.downloads || 0} downloads</span>
              </div>
            </div>
          ))}
        </div>
        {files.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No files found. Upload your first file!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Scene({ files, selectedFile, onSelect, onDownload, onDelete }) {
  const [webGLSupported, setWebGLSupported] = useState(true);

  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
  }, []);

  // Fallback to 2D list if WebGL is not available
  if (!webGLSupported) {
    return <FallbackFileList files={files} selectedFile={selectedFile} onSelect={onSelect} />;
  }

  // Clear selection on background click
  const handleBackgroundClick = (e) => {
    // Only fire if the click wasn't on a file object
    onSelect(null);
  }

  return (
    <Canvas 
      camera={{ position: [0, 0, 15], fov: 40 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
      dpr={[1, 2]}
      gl={{ antialias: false, toneMappingExposure: 1.2 }}
      onPointerMissed={handleBackgroundClick}
      onCreated={({ gl }) => {
        // Check if context was created successfully
        if (!gl.getContext()) {
          setWebGLSupported(false);
        }
      }}
    >
      <color attach="background" args={['#030508']} />
      <fog attach="fog" args={['#030508', 8, 30]} />

      <Suspense fallback={<Html center><Loader /></Html>}>
        {/* Cinematic Environment */}
        <Environment preset="night" blur={0.6} background={false} />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 5, 10]} intensity={2} color="#4f46e5" distance={20} />
        <pointLight position={[-10, -5, -10]} intensity={1} color="#ec4899" distance={20} />
        
        {/* Deep Space Particles */}
        <Sparkles count={800} scale={25} size={1} speed={0.2} opacity={0.4} color="#a5b4fc" />
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={1} fade speed={0.5} />

        <CameraRig focusMode={!!selectedFile}>
            <group>
                {files.map((file, i) => (
                    <FileNode 
                        key={file.uuid || i} 
                        file={file} 
                        index={i} 
                        total={files.length}
                        setFocus={onSelect} 
                        isFocused={selectedFile?.uuid === file.uuid}
                        isBlur={selectedFile && selectedFile.uuid !== file.uuid}
                    />
                ))}
            </group>
        </CameraRig>
        
        <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />

        {/* Post Processing */}
        <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.2} radius={0.5} />
            <Noise opacity={0.05} />
            <Vignette eskil={false} offset={0.1} darkness={1.0} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
