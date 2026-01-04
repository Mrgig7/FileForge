import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Html, Loader, Environment, Sparkles, Stars, Float, Ring } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { motion } from 'framer-motion-3d'

function HolographicRing() {
  return (
    <group rotation={[Math.PI / 3, 0, 0]}>
       <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
         <Ring args={[3.5, 3.55, 64]} material-color="#06b6d4" material-opacity={0.3} material-transparent />
         <Ring args={[3.8, 3.82, 64]} material-color="#3b82f6" material-opacity={0.2} material-transparent />
         <Ring args={[3, 3.02, 64]} material-color="#8b5cf6" material-opacity={0.1} material-transparent />
       </Float>
    </group>
  )
}

export default function ProfileScene() {
  return (
    <Canvas 
      camera={{ position: [0, 0, 10], fov: 45 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
      dpr={[1, 2]}
      gl={{ antialias: false, toneMappingExposure: 1.2 }}
    >
      <color attach="background" args={['#030508']} />
      <fog attach="fog" args={['#030508', 5, 20]} />

      <Suspense fallback={null}>
        {/* Cinematic Lighting */}
        <Environment preset="night" blur={0.8} background={false} />
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 5, 10]} intensity={2} color="#06b6d4" distance={20} />
        <pointLight position={[-10, -5, -10]} intensity={1} color="#8b5cf6" distance={20} />
        
        {/* Background Atmosphere */}
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={1} fade speed={0.2} />
        <Sparkles count={300} scale={15} size={1.5} speed={0.1} opacity={0.3} color="#a5b4fc" />

        {/* Central Element - Focus for the Form */}
        <HolographicRing />
        
        {/* Post Processing */}
        <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.2} mipmapBlur intensity={0.8} radius={0.5} />
            <Noise opacity={0.03} />
            <Vignette eskil={false} offset={0.1} darkness={1.0} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
