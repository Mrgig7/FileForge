import { Canvas } from '@react-three/fiber'
import { Suspense, useState, useEffect, useCallback, useMemo, memo } from 'react'
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

// Fallback 2D File List Component - Memoized
const FallbackFileList = memo(function FallbackFileList({ files, selectedFile, onSelect }) {
  const getFileIcon = useCallback((filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    const iconMap = {
      // Images
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
      // Documents
      'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📝', 'md': '✍️',
      // Spreadsheets
      'xls': '📊', 'xlsx': '📊', 'csv': '📊',
      // Presentations
      'ppt': '投影', 'pptx': '投影',
      // Audio
      'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵', 'flac': '🎵',
      // Video
      'mp4': '🎬', 'mov': '🎬', 'avi': '🎬', 'webm': '🎬',
      // Archives
      'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
      // Code
      'html': ' </>', 'css': '🎨', 'js': '📜', 'jsx': '⚛️', 'ts': '📜', 'tsx': '⚛️', 'json': '📜', 'py': '🐍', 'java': '☕', 'c': '🇨', 'cpp': '🇨++',
      // Default
      'default': '📁'
    };
    return iconMap[ext] || iconMap['default'];
  }, []);

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#020411] via-[#050510] to-[#0a0a1a] overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto pt-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {files.map((file, i) => (
            <div
              key={file.uuid || i}
              onClick={() => onSelect(file)}
              className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border backdrop-blur-xl
                ${selectedFile?.uuid === file.uuid
                  ? 'bg-cyan-500/15 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/5 hover:border-white/20 hover:scale-[1.02]'
              }`}
            >
              <div className="flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="text-4xl mb-4 p-3 rounded-xl bg-white/5">
                      {getFileIcon(file.originalName || file.filename)}
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${file.active !== false ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'}`}>
                      {file.active !== false ? 'Active' : 'Expired'}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-gray-100 truncate mb-1">
                    {file.originalName || file.filename}
                  </h3>
                  <p className="text-xs text-gray-500 font-light">
                    {file.formattedSize || `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                  <span>{file.downloads || 0} downloads</span>
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {files.length === 0 && (
          <div className="text-center py-24">
            <div className="inline-block bg-white/5 p-8 rounded-full">
              <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="mt-6 text-gray-500 text-lg font-light">Your file vault is empty.</p>
            <p className="text-sm text-gray-600">Upload your first file to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
});

// Main Scene Component - Memoized
const Scene = memo(function Scene({ files, selectedFile, onSelect, onDownload, onDelete }) {
  const [webGLSupported, setWebGLSupported] = useState(true);

  useEffect(() => {
    setWebGLSupported(isWebGLAvailable());
  }, []);

  // Fallback to 2D list if WebGL is not available
  if (!webGLSupported) {
    return <FallbackFileList files={files} selectedFile={selectedFile} onSelect={onSelect} />;
  }

  // Clear selection on background click - memoized
  const handleBackgroundClick = useCallback((e) => {
    // Only fire if the click wasn't on a file object
    onSelect(null);
  }, [onSelect])

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
      <color attach="background" args={['#020205']} />
      <fog attach="fog" args={['#020205', 10, 35]} />

      <Suspense fallback={<Html center><Loader /></Html>}>
        {/* Cinematic Environment */}
        <Environment preset="night" blur={0.8} background={false} />
        <ambientLight intensity={0.2} />
        
        {/* Studio Lights */}
        <spotLight position={[20, 20, 10]} angle={0.15} penumbra={1} intensity={2} color="#ffffff" castShadow />
        <pointLight position={[10, 5, 10]} intensity={1.5} color="#4f46e5" distance={30} />
        <pointLight position={[-10, -5, -10]} intensity={1.5} color="#ec4899" distance={30} />
        <pointLight position={[0, 0, 5]} intensity={0.5} color="#ffffff" distance={15} />
        
        {/* Deep Space Atmosphere */}
        <Sparkles count={400} scale={30} size={1} speed={0.1} opacity={0.2} color="#a5b4fc" />
        <Stars radius={150} depth={50} count={2000} factor={4} saturation={1} fade speed={0.2} />

        <CameraRig focusMode={!!selectedFile}>
            <group position={[0, -0.5, 0]}>
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
        
        {/* Ground Shadows for Depth */}
        <ContactShadows 
            position={[0, -8, 0]} 
            resolution={1024} 
            scale={60} 
            blur={2.5} 
            opacity={0.4} 
            far={20} 
            color="#000000" 
        />

        {/* Post Processing - Refined for professional look */}
        <EffectComposer disableNormalPass>
            <Bloom 
                luminanceThreshold={0.5} 
                mipmapBlur 
                intensity={0.8} 
                radius={0.4} 
            />
            <Noise opacity={0.03} />
            <Vignette eskil={false} offset={0.15} darkness={1.1} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
})

export default Scene
