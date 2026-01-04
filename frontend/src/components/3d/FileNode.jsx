import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Float, MeshTransmissionMaterial, Edges, Ring } from '@react-three/drei'
import { motion } from 'framer-motion-3d'
import * as THREE from 'three'

export default function FileNode({ file, index, total, setFocus, isFocused, isBlur }) {
  const [hovered, setHovered] = useState(false)
  const mesh = useRef()
  
  // Layout logic
  const spacing = 3.5
  const cols = 4
  const row = Math.floor(index / cols)
  const col = index % cols
  const x = (col - (cols - 1) / 2) * spacing
  const y = -(row - (Math.floor(total / cols)) / 2) * spacing - (col % 2 * 0.5) // Staggered grid

  const handlePointerOver = (e) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  
  const handlePointerOut = () => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }

  const handleClick = (e) => {
      e.stopPropagation()
      setFocus(file)
  }

  const baseColor = getFileColor(file.mimetype)

  return (
    <Float 
        speed={isFocused ? 0 : 1.5} 
        rotationIntensity={isFocused ? 0 : 0.2} 
        floatIntensity={isFocused ? 0 : 0.4}
        floatingRange={[-0.1, 0.1]}
    >
      <motion.group
        position={[x, y, 0]}
        initial={{ scale: 0, z: -50 }}
        animate={{ 
          scale: isFocused ? 1.1 : (isBlur ? 0.8 : (hovered ? 1.05 : 1)),
          z: isFocused ? 0 : (isBlur ? -5 : (hovered ? 1 : 0)), // Don't come too close, camera moves instead
          rotateY: isFocused ? 0 : (hovered ? 0.1 : 0),
        }}
        transition={{ type: "spring", stiffness: 150, damping: 20 }}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Monolith Body */}
        <mesh ref={mesh}>
          <boxGeometry args={[2, 3.5, 0.2]} />
          <MeshTransmissionMaterial 
            backside
            samples={4}
            thickness={0.8}
            chromaticAberration={0.3}
            anisotropy={0.3}
            distortion={0.2}
            distortionScale={0.3}
            temporalDistortion={0.1}
            clearcoat={1}
            attenuationDistance={0.5}
            attenuationColor={baseColor}
            color="#ffffff"
            background={new THREE.Color('#050510')}
          />
          <Edges color={hovered ? "white" : baseColor} threshold={15} scale={1.005} opacity={hovered ? 0.8 : 0.3} transparent />
        </mesh>
        
        {/* Digital Data Ring - Revolves around the monolith */}
        <group rotation={[Math.PI / 2, 0, 0]} position={[0, -1.8, 0]}>
            <motion.mesh animate={{ rotateZ: 360 }} transition={{ repeat: Infinity, duration: 10, ease: "linear" }}>
                <ringGeometry args={[1.2, 1.25, 32]} />
                <meshBasicMaterial color={baseColor} opacity={hovered ? 0.6 : 0.2} transparent side={THREE.DoubleSide} />
            </motion.mesh>
        </group>

        {/* Floating Icons/Particles inside (Simulated) */}
        <mesh position={[0, 0.5, 0]}>
             <planeGeometry args={[1, 1]} />
             <meshBasicMaterial color={baseColor} transparent opacity={0.1} />
        </mesh>

        {/* Text Label - Clean Typography */}
        <group position={[0, -1.2, 0.15]}>
            <Text
                fontSize={0.18}
                color="white"
                anchorX="center"
                anchorY="middle"
                maxWidth={1.8}
                font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
            >
                {file.originalName?.length > 12
                    ? file.originalName.substring(0, 10) + '...' 
                    : (file.originalName || file.filename)}
            </Text>
            <Text
                position={[0, -0.25, 0]}
                fontSize={0.08}
                color="#888888"
                anchorX="center"
                anchorY="middle"
                letterSpacing={0.1}
            >
                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.mimetype ? file.mimetype.split('/')[1].toUpperCase() : 'FILE'}
            </Text>
        </group>
        
        {/* Selection Glow */}
        {isFocused && (
            <mesh position={[0, 0, -0.2]}>
                <planeGeometry args={[2.5, 4]} />
                <meshBasicMaterial color={baseColor} transparent opacity={0.2} />
            </mesh>
        )}
      </motion.group>
    </Float>
  )
}

function getFileColor(mimeType) {
    if (!mimeType) return '#94a3b8';
    if (mimeType.includes('image')) return '#22d3ee'; // Cyan
    if (mimeType.includes('pdf')) return '#f472b6'; // Pink
    if (mimeType.includes('video')) return '#818cf8'; // Indigo
    if (mimeType.includes('audio')) return '#fbbf24'; // Amber
    if (mimeType.includes('text')) return '#34d399'; // Emerald
    return '#a78bfa'; // Violet
}
