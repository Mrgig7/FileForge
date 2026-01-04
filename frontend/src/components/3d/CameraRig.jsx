import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'

export default function CameraRig({ children }) {
  const group = useRef()
  
  useFrame((state, delta) => {
    // Smooth camera rotation based on mouse position
    easing.dampE(
      group.current.rotation,
      [state.pointer.y / 10, -state.pointer.x / 5, 0],
      0.25,
      delta
    )
  })

  return <group ref={group}>{children}</group>
}
