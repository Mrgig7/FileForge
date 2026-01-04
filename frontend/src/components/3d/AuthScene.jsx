import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

function WarpTunnel({ speed = 1, isWarping }) {
  const starsRef = useRef()
  
  useFrame((state, delta) => {
    if (!starsRef.current) return
    
    // Rotate stars to create tunnel effect
    starsRef.current.rotation.z += delta * 0.1 * speed
    
    // Move forward (warp effect)
    // We simulate warp by changing fov or moving stars faster
    if (isWarping) {
        starsRef.current.rotation.z += delta * 2 // Fast spin
    }
  })

  return (
    <group ref={starsRef}>
      <Stars 
        radius={50} 
        depth={50} 
        count={7000} 
        factor={isWarping ? 10 : 4} 
        saturation={0} 
        fade 
        speed={speed} 
      />
    </group>
  )
}

function GridTunnel() {
    const gridRef = useRef();
    
    useFrame((state, delta) => {
        if (!gridRef.current) return;
        // Move grid towards camera
        gridRef.current.position.z += delta * 10;
        if (gridRef.current.position.z > 10) {
            gridRef.current.position.z = -20;
        }
    });

    return (
        <group ref={gridRef} position={[0, -5, -20]} rotation={[Math.PI/2, 0, 0]}>
            <gridHelper args={[50, 50, 0xff00ff, 0x4f46e5]} />
        </group>
    )
}

export default function AuthScene({ speed = 1, isWarping = false }) {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.5} />
      
      <WarpTunnel speed={speed} isWarping={isWarping} />
      <GridTunnel />
      
      {/* Fog to hide the end of the tunnel */}
      <fog attach="fog" args={['#050505', 5, 30]} />
    </Canvas>
  )
}
