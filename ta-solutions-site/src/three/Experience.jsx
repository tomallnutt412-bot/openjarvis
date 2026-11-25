import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, AdaptiveDpr } from '@react-three/drei'
import { Director } from './Director'

/**
 * Fixed, full-viewport WebGL layer that sits above the page content
 * (pointer-events: none) so the robot can fly over headlines and cards.
 * Lighting is fully procedural (Lightformers) — no HDR downloads.
 */
export default function Experience({ caps }) {
  const high = caps.tier === 'high'
  return (
    <div className="webgl" aria-hidden="true">
      <Canvas
        dpr={[1, high ? 1.75 : 1.4]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 10], fov: 35, near: 0.1, far: 60 }}
        eventSource={undefined}
        style={{ pointerEvents: 'none' }}
      >
        <AdaptiveDpr pixelated={false} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 6]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-6, -2, -4]} intensity={1.2} color="#7ae8ff" />
        <pointLight position={[0, -3, 3]} intensity={6} distance={10} color="#19d3f5" />
        <Environment resolution={high ? 256 : 128} frames={1}>
          <color attach="background" args={['#eef2f5']} />
          <Lightformer form="rect" intensity={3} position={[0, 5, -2]} scale={[10, 3, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={2} position={[-5, 1, 1]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
          <Lightformer form="rect" intensity={1.6} position={[5, 0, 2]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
          <Lightformer form="ring" intensity={4} color="#7ae8ff" position={[0, 0, 6]} scale={3} />
          <Lightformer form="rect" intensity={0.8} color="#0b1220" position={[0, -5, 0]} scale={[10, 10, 1]} rotation-x={-Math.PI / 2} />
        </Environment>
        <Suspense fallback={null}>
          <Director caps={caps} />
        </Suspense>
      </Canvas>
    </div>
  )
}
