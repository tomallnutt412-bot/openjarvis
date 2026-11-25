import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { makeEnergyMaterial, makeProgressRingMaterial, CYAN } from './materials'
import { runtime, useStore } from '../lib/store'
import { clamp } from '../lib/math'

/*
 * The glass "egg" the robot hatches from.
 *  - Glass shell (real transmission on high-tier devices, cheap fresnel glass on low)
 *  - Fresnel energy field that intensifies with charge
 *  - Docking pedestal with a progress ring
 *  - On hatch: shell dissolves, shards burst outward, a shockwave ring expands
 * Everything is in robot-local units; the Director scales the parent group.
 */

const SHARDS = 42
const R = 1.28 // egg radius
const EGG_Y = 1.22 // vertical stretch
// Transmission buffer background ≈ page colour (the canvas itself is transparent).
const GLASS_BG = new THREE.Color('#eef2f3')

export function Capsule({ tier, reduced }) {
  const online = useStore((s) => s.phase === 'online')
  const shell = useRef()
  const shellMat = useRef()
  const energy = useMemo(makeEnergyMaterial, [])
  const ring = useMemo(makeProgressRingMaterial, [])
  const shards = useRef()
  const wave = useRef()
  const waveMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    [],
  )
  const shardMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#e9fbff',
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.7,
        clearcoat: 1,
        envMapIntensity: 2.4,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const shardData = useMemo(
    () =>
      Array.from({ length: SHARDS }, () => {
        const dir = new THREE.Vector3().randomDirection()
        dir.y = dir.y * EGG_Y
        return {
          dir,
          start: dir.clone().normalize().multiply(new THREE.Vector3(R, R * EGG_Y, R)),
          speed: 2.2 + Math.random() * 3.2,
          spin: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
          size: 0.12 + Math.random() * 0.22,
        }
      }),
    [],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const phase = useStore.getState().phase
    const charge = runtime.charge
    const hatched = runtime.hatchTime >= 0
    const since = hatched ? t - runtime.hatchTime : -1

    energy.uniforms.uTime.value = t
    energy.uniforms.uCharge.value = hatched ? 1 : charge
    ring.uniforms.uTime.value = t
    ring.uniforms.uProgress.value = hatched ? 1 : charge

    // shell: tremble while charging, then dissolve
    if (shell.current) {
      const shake = reduced ? 0 : charge * charge * 0.045
      shell.current.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)
      const breathe = 1 + Math.sin(t * 1.4) * 0.006 + charge * 0.03
      const pop = hatched ? 1 + clamp(since / 0.35) * 0.18 : 1
      shell.current.scale.set(breathe * pop, breathe * pop * EGG_Y, breathe * pop)
      const vis = hatched ? 1 - clamp(since / 0.3) : 1
      shell.current.visible = vis > 0.01
      energy.uniforms.uAlpha.value = vis
      if (shellMat.current) {
        const base = tier === 'high' ? 1 : 0.22
        shellMat.current.opacity = vis * base
        if (tier === 'high') shellMat.current.transparent = vis < 1
      }
    }

    // shards
    if (shards.current) {
      const active = hatched && since < 2.2
      shards.current.visible = active
      if (active) {
        const p = since
        shardData.forEach((s, i) => {
          const travel = s.speed * (1 - Math.exp(-p * 2.2))
          dummy.position.copy(s.start).addScaledVector(s.dir, travel)
          dummy.position.y -= p * p * 0.6
          dummy.rotation.set(s.spin.x * p, s.spin.y * p, s.spin.z * p)
          dummy.scale.setScalar(s.size * clamp(1 - p / 2.2))
          dummy.updateMatrix()
          shards.current.setMatrixAt(i, dummy.matrix)
        })
        shards.current.instanceMatrix.needsUpdate = true
        shardMat.opacity = 0.75 * clamp(1 - p / 2.2)
      }
    }

    // shockwave
    if (wave.current) {
      const p = hatched ? clamp(since / 0.9) : 0
      wave.current.visible = hatched && p < 1
      wave.current.scale.setScalar(0.5 + p * 4)
      waveMat.opacity = (1 - p) * 0.6
    }

    ring.uniforms.uAlpha.value = phase === 'online' ? 0.55 : 1
  })

  return (
    <group>
      {/* ── glass shell (unmounted once online so the transmission pass stops) ── */}
      {!online && (
      <group ref={shell}>
        <mesh>
          <sphereGeometry args={[R, tier === 'high' ? 64 : 40, tier === 'high' ? 64 : 40]} />
          {tier === 'high' ? (
            <MeshTransmissionMaterial
              ref={shellMat}
              samples={6}
              background={GLASS_BG}
              thickness={0.35}
              roughness={0.02}
              transmission={1}
              ior={1.25}
              chromaticAberration={0.08}
              anisotropy={0.2}
              distortion={0.15}
              distortionScale={0.4}
              temporalDistortion={0.08}
              clearcoat={1}
              attenuationDistance={2.5}
              attenuationColor="#e6fbff"
              color="#ffffff"
              backside={false}
            />
          ) : (
            // Low tier: no transmission pass — a faint, reflective shell; the energy field supplies the rim.
            <meshPhysicalMaterial
              ref={shellMat}
              color="#eaf7fb"
              roughness={0.05}
              metalness={0}
              transparent
              opacity={0.22}
              clearcoat={1}
              envMapIntensity={2.4}
              depthWrite={false}
            />
          )}
        </mesh>
        {/* energy field */}
        <mesh material={energy} scale={0.96}>
          <sphereGeometry args={[R, 48, 48]} />
        </mesh>
      </group>
      )}

      {/* ── pedestal ── */}
      <group position={[0, -R * EGG_Y - 0.08, 0]}>
        <mesh position={[0, -0.06, 0]}>
          <cylinderGeometry args={[1.05, 1.2, 0.12, 64]} />
          <meshPhysicalMaterial color="#f6f8fa" roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={1.2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={ring}>
          <ringGeometry args={[0.8, 0.98, 96]} />
        </mesh>
        <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={waveMat}>
          <ringGeometry args={[0.95, 1.0, 96]} />
        </mesh>
      </group>

      {/* ── shards ── */}
      <instancedMesh ref={shards} args={[null, null, SHARDS]} material={shardMat} visible={false} frustumCulled={false}>
        <tetrahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </group>
  )
}
