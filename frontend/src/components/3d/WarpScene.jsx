import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Stars, Sparkles, Float } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

function WarpTunnel() {
  const starsRef = useRef()
  
  useFrame((state, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.z += delta * 0.2
    }
  })

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
        <Stars 
            ref={starsRef} 
            radius={50} 
            depth={50} 
            count={5000} 
            factor={4} 
            saturation={0} 
            fade 
            speed={3} 
        />
    </group>
  )
}

function EnergyCore() {
    return (
        <Float speed={5} rotationIntensity={2} floatIntensity={1}>
            <mesh>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color="#4f46e5" wireframe transparent opacity={0.3} />
            </mesh>
            <mesh scale={[0.8, 0.8, 0.8]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.8} />
            </mesh>
        </Float>
    )
}

export default function WarpScene() {
  return (
    <Canvas 
      camera={{ position: [0, 0, 10], fov: 60 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
      dpr={[1, 2]}
      gl={{ antialias: false, toneMappingExposure: 1.2 }}
    >
      <color attach="background" args={['#020204']} />
      
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        
        {/* Speeding Particles */}
        <Sparkles count={500} scale={20} size={4} speed={4} opacity={0.8} color="#818cf8" />
        <WarpTunnel />

        {/* Central Core */}
        <EnergyCore />

        {/* Post Processing */}
        <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.5} mipmapBlur intensity={2} radius={0.6} />
            <Noise opacity={0.05} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
