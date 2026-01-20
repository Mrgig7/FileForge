import { useRef, useState, useCallback, memo, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Float, MeshTransmissionMaterial, Edges, RoundedBox } from '@react-three/drei'
import { motion } from 'framer-motion-3d'
import * as THREE from 'three'

const FileNode = memo(function FileNode({ file, index, total, setFocus, isFocused, isBlur }) {
  const [hovered, setHovered] = useState(false)
  const mesh = useRef()
  const scanRef = useRef()
  
  // Memoize layout calculations - Improved grid spacing
  const { x, y } = useMemo(() => {
    const spacingX = 4.5
    const spacingY = 5.5
    const cols = 5
    const row = Math.floor(index / cols)
    const col = index % cols
    return {
      x: (col - (cols - 1) / 2) * spacingX,
      y: -(row - (Math.floor(total / cols)) / 2) * spacingY
    }
  }, [index, total])

  // Data scan animation - persistent but faster on hover
  useFrame((state) => {
    if (scanRef.current) {
        const speed = hovered ? 3 : 1.5
        scanRef.current.position.y = Math.sin(state.clock.elapsedTime * speed) * 1.8
    }
  })

  const handlePointerOver = useCallback((e) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }, [hovered])
  
  const handlePointerOut = useCallback(() => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }, [])

  const handleClick = useCallback((e) => {
      e.stopPropagation()
      setFocus(file)
  }, [file, setFocus])

  const baseColor = useMemo(() => getFileColor(file.mimetype), [file.mimetype])
  
  const displayName = useMemo(() => {
    const name = file.originalName || file.filename
    return name?.length > 18 ? name.substring(0, 15) + '...' : name
  }, [file.originalName, file.filename])

  const fileInfo = useMemo(() => {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2)
    const type = file.mimetype ? file.mimetype.split('/')[1].toUpperCase() : 'FILE'
    return `${sizeMB} MB • ${type}`
  }, [file.size, file.mimetype])

  return (
    <Float 
        speed={isFocused ? 0 : 2} 
        rotationIntensity={isFocused ? 0 : 0.05} 
        floatIntensity={isFocused ? 0 : 0.15}
    >
      <motion.group
        position={[x, y, 0]}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: isFocused ? 1.25 : (isBlur ? 0.75 : (hovered ? 1.08 : 1)),
          z: isFocused ? 3 : (hovered ? 0.5 : 0),
          rotateY: hovered ? 0.15 : 0,
          opacity: isBlur ? 0.4 : 1
        }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Main Glass Tile - High End material */}
        <RoundedBox args={[3.2, 4.8, 0.1]} radius={0.12} smoothness={4} ref={mesh}>
          <MeshTransmissionMaterial 
            backside
            samples={12} // Reduced samples slightly for performance
            thickness={0.2}
            chromaticAberration={0.02}
            anisotropy={0.1}
            distortion={0}
            distortionScale={0}
            temporalDistortion={0}
            clearcoat={1}
            attenuationDistance={1.2}
            attenuationColor={baseColor}
            color="#ffffff"
            roughness={0.05} // Increased slightly for better text contrast
            transmission={0.95} // Slightly less transparent for body
            transparent
            opacity={0.8}
            ior={1.2}
          />
        </RoundedBox>

        {/* Sharp Holographic Perimeter */}
        <Edges 
            threshold={15} 
            color={hovered || isFocused ? "white" : baseColor} 
            opacity={hovered ? 0.8 : 0.25} 
            transparent 
            scale={1.005}
        />

        {/* Dynamic Inner Scan Line */}
        <mesh ref={scanRef} position={[0, 0, 0.06]}>
            <planeGeometry args={[3.0, 0.015]} />
            <meshBasicMaterial color="white" transparent opacity={hovered ? 0.4 : 0.1} />
        </mesh>

        {/* Content Layers - Moved forward to prevent z-fighting */}
        <group position={[0, 0, 0.15]}> 
            {/* Minimalist Icon Indicator */}
            <group position={[0, 1.2, 0]}>
                <mesh>
                    <ringGeometry args={[0.35, 0.4, 64]} />
                    <meshBasicMaterial color={baseColor} transparent opacity={0.4} />
                </mesh>
                <mesh position={[0, 0, -0.01]}>
                    <circleGeometry args={[0.3, 32]} />
                    <meshBasicMaterial color={baseColor} transparent opacity={0.05} />
                </mesh>
            </group>
            
            {/* Primary Data Label */}
            <Text
                position={[0, -0.8, 0.01]} // Small offset from container
                fontSize={0.24}
                color="white"
                anchorX="center"
                anchorY="middle"
                maxWidth={2.8}
                font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                outlineWidth={0.002}
                outlineColor="#000000"
            >
                {displayName}
            </Text>
            
            {/* Meta Data Label */}
            <Text
                position={[0, -1.4, 0.01]}
                fontSize={0.1}
                color={baseColor}
                anchorX="center"
                anchorY="middle"
                letterSpacing={0.15}
                opacity={0.9}
            >
                {fileInfo}
            </Text>

            {/* Expire / Status Marker */}
            <mesh position={[-1.2, 2.0, 0.01]}>
                <circleGeometry args={[0.08, 32]} />
                <meshBasicMaterial 
                    color={file.expiresAt && new Date(file.expiresAt) < new Date() ? "#ff4d4d" : "#00ff88"} 
                    transparent
                    opacity={0.8}
                />
            </mesh>
        </group>

        {/* Selection Aura */}
        {isFocused && (
            <group>
                <mesh position={[0, 0, -0.4]}>
                    <planeGeometry args={[7, 10]} />
                    <meshBasicMaterial 
                        color={baseColor} 
                        transparent 
                        opacity={0.06} 
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
                <ContactShadows 
                    position={[0, -2.6, 0]}
                    opacity={0.6}
                    scale={10}
                    blur={3}
                    far={10}
                    color={baseColor}
                />
            </group>
        )}
      </motion.group>
    </Float>
  )
})

function getFileColor(mimeType) {
    if (!mimeType) return '#94a3b8';
    if (mimeType.includes('image')) return '#0ea5e9'; // Better Blue
    if (mimeType.includes('pdf')) return '#e11d48'; // Better Red
    if (mimeType.includes('video')) return '#8b5cf6'; // Better Purple
    if (mimeType.includes('audio')) return '#f59e0b'; // Better Amber
    if (mimeType.includes('text')) return '#10b981'; // Better Emerald
    return '#6366f1'; // Indigo
}

export default FileNode
