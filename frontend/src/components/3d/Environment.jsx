import { Stars, Environment as DreiEnvironment } from '@react-three/drei'

export default function Environment() {
  return (
    <>
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <DreiEnvironment preset="city" />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#4f46e5" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ec4899" />
    </>
  )
}
