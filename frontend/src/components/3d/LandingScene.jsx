import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// Floating tech particles/debris
const TechParticles = ({ count = 200 }) => {
  const mesh = useRef();
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Random positions in a sphere
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -50 + Math.random() * 100;
      const yFactor = -50 + Math.random() * 100;
      const zFactor = -50 + Math.random() * 100;
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
    }
    return temp;
  }, [count]);

  useFrame((state) => {
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle;
      t = particle.t += speed / 2;
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);
      
      dummy.position.set(
        (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
      );
      dummy.scale.set(s, s, s);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[null, null, count]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshPhongMaterial color="#6366f1" emissive="#4f46e5" toneMapped={false} />
      </instancedMesh>
    </>
  );
};

// Main Scene Component
const LandingScene = ({ scrollY }) => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
        <fog attach="fog" args={['#0f172a', 5, 20]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#818cf8" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#c084fc" />
        
        {/* Dynamic Stars */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* Floating Particles that give depth */}
        <Float speed={2} rotationIntensity={1} floatIntensity={1}>
           <TechParticles count={300} />
        </Float>

        {/* Post Processing for Glow */}
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} radius={0.6} />
        </EffectComposer>
        
        <Rig scrollY={scrollY} />
      </Canvas>
    </div>
  );
};

// Camera Rig to move based on scroll
const Rig = ({ scrollY }) => {
  useFrame((state) => {
    // Smoothly interpolate camera position based on scroll
    // Converting pixels to arbitrary 3D units
    const targetZ = 10 - (scrollY * 0.015); 
    const targetY = -(scrollY * 0.005);
    
    // Add some mouse parallax if possible, for now just scroll
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, Math.max(2, targetZ), 0.05);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.05);
    
    state.camera.lookAt(0, 0, 0);
  });
  return null;
};

export default LandingScene;
