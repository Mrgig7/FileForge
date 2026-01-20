import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Environment, Sparkles, Stars, Float, Ring, Torus } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { useFrame } from '@react-three/fiber'

// Floating holographic grid rings
function HolographicRings() {
  const groupRef = useRef()
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime * 0.05
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -5]} rotation={[Math.PI / 4, 0, 0]}>
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.3}>
        <Ring args={[4, 4.05, 128]} material-color="#06b6d4" material-opacity={0.15} material-transparent />
        <Ring args={[4.5, 4.52, 128]} material-color="#8b5cf6" material-opacity={0.1} material-transparent />
        <Ring args={[5, 5.02, 128]} material-color="#3b82f6" material-opacity={0.08} material-transparent />
        <Ring args={[5.5, 5.52, 128]} material-color="#06b6d4" material-opacity={0.05} material-transparent />
      </Float>
    </group>
  )
}

// Subtle floating torus for depth
function FloatingTorus() {
  const torusRef = useRef()
  
  useFrame((state) => {
    if (torusRef.current) {
      torusRef.current.rotation.x = state.clock.elapsedTime * 0.1
      torusRef.current.rotation.y = state.clock.elapsedTime * 0.15
    }
  })

  return (
    <Float speed={0.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <Torus 
        ref={torusRef}
        args={[3, 0.02, 16, 100]} 
        position={[8, 2, -10]}
      >
        <meshBasicMaterial color="#4f46e5" transparent opacity={0.3} />
      </Torus>
      <Torus 
        args={[2, 0.015, 16, 100]} 
        position={[-8, -3, -8]}
        rotation={[Math.PI / 3, 0, 0]}
      >
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.2} />
      </Torus>
    </Float>
  )
}

export default function DashboardScene() {
  return (
    <Canvas 
      camera={{ position: [0, 0, 12], fov: 50 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, toneMappingExposure: 1.1 }}
    >
      <color attach="background" args={['#030508']} />
      <fog attach="fog" args={['#030508', 8, 30]} />

      <Suspense fallback={null}>
        {/* Cinematic Lighting */}
        <Environment preset="night" blur={0.8} background={false} />
        <ambientLight intensity={0.15} />
        <pointLight position={[15, 10, 10]} intensity={1.5} color="#06b6d4" distance={30} />
        <pointLight position={[-15, -5, -10]} intensity={1} color="#8b5cf6" distance={25} />
        <pointLight position={[0, 0, 10]} intensity={0.3} color="#ffffff" distance={20} />
        
        {/* Deep Space Atmosphere */}
        <Stars radius={120} depth={60} count={1500} factor={4} saturation={1} fade speed={0.15} />
        <Sparkles count={200} scale={20} size={1.2} speed={0.08} opacity={0.25} color="#a5b4fc" />
        <Sparkles count={100} scale={15} size={0.8} speed={0.05} opacity={0.15} color="#06b6d4" />

        {/* Central Holographic Elements */}
        <HolographicRings />
        <FloatingTorus />
        
        {/* Post Processing - Subtle for dashboard usage */}
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.6} radius={0.4} />
          <Noise opacity={0.025} />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
