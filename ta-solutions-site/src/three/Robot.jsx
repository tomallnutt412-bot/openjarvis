import { forwardRef, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { RoundedBox, Trail } from '@react-three/drei'
import * as THREE from 'three'
import { glowTexture } from './textures'
import { CYAN, CYAN_HOT } from './materials'
import { damp, lerp, clamp } from '../lib/math'
import { ROBOT_PANEL_TEXTURE } from '../config/images'

/*
 * ─────────────────────────────────────────────────────────────
 *  TA-01 — the procedural robot.
 *  Built entirely from primitives so it weighs ~0 KB and can be
 *  animated joint-by-joint. Driven by a mutable `ctrl` object that
 *  the Director writes every frame:
 *    boot   0..1   dormant → fully online
 *    lookX/lookY  -1..1 head target
 *    pose   'idle' | 'fly' | 'scan' | 'wave' | 'think'
 *    velX/velY    world-space velocity (for banking)
 *    poke   clock time of the last poke (spin + happy eyes)
 *    excite 0..1   pointer proximity
 * ─────────────────────────────────────────────────────────────
 */

// Joint targets per pose: [shoulderX, shoulderZ, elbowX, elbowZ] for R arm, then L arm.
// Negative X swings the arm forward; positive Z lifts it outward (mirrored for the left arm).
const POSES = {
  dormant: { r: [-0.6, 0.05, -1.7, 0], l: [-0.6, 0.05, -1.7, 0] },
  idle: { r: [0.05, 0.2, -0.35, 0], l: [0.05, 0.2, -0.35, 0] },
  fly: { r: [0.75, 0.32, -0.15, 0], l: [0.75, 0.32, -0.15, 0] },
  scan: { r: [-1.35, 0.25, -0.15, 0], l: [0.1, 0.22, -0.5, 0] },
  wave: { r: [-0.2, 2.55, -0.2, -0.4], l: [0.05, 0.22, -0.4, 0] },
  think: { r: [-1.05, 0.05, -2.0, 0], l: [-0.35, 0.2, -1.1, 0] },
}

function useMaterials() {
  // Optional Higgsfield panel texture (see config/images.js).
  const panel = ROBOT_PANEL_TEXTURE ? useLoader(THREE.TextureLoader, ROBOT_PANEL_TEXTURE) : null // eslint-disable-line
  return useMemo(() => {
    if (panel) {
      panel.wrapS = panel.wrapT = THREE.RepeatWrapping
    }
    const ceramic = new THREE.MeshPhysicalMaterial({
      color: '#f3f5f8',
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.4,
      sheenColor: new THREE.Color('#cfeffd'),
      envMapIntensity: 1.1,
      bumpMap: panel || null,
      bumpScale: panel ? 0.6 : 0,
    })
    const visor = new THREE.MeshPhysicalMaterial({
      color: '#05080e',
      roughness: 0.08,
      metalness: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
    })
    const joint = new THREE.MeshStandardMaterial({ color: '#2a3340', roughness: 0.35, metalness: 0.85, envMapIntensity: 1.2 })
    const chrome = new THREE.MeshStandardMaterial({ color: '#c9d3dc', roughness: 0.18, metalness: 1, envMapIntensity: 1.4 })
    const emissive = new THREE.MeshBasicMaterial({ color: CYAN.clone(), toneMapped: false })
    const eye = new THREE.MeshBasicMaterial({ color: CYAN_HOT.clone(), toneMapped: false })
    const glow = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: CYAN.clone(),
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    })
    const flame = new THREE.MeshBasicMaterial({
      color: CYAN.clone(),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
    return { ceramic, visor, joint, chrome, emissive, eye, glow, flame }
  }, [panel])
}

function Arm({ side, refs, m }) {
  const s = side === 'r' ? 1 : -1
  return (
    <group position={[0.58 * s, 0.24, 0]}>
      <mesh material={m.joint}>
        <sphereGeometry args={[0.13, 24, 24]} />
      </mesh>
      <group ref={(el) => (refs.current[side + 'Shoulder'] = el)}>
        <mesh material={m.ceramic} position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.1, 0.22, 8, 16]} />
        </mesh>
        <group ref={(el) => (refs.current[side + 'Elbow'] = el)} position={[0, -0.42, 0]}>
          <mesh material={m.joint}>
            <sphereGeometry args={[0.085, 16, 16]} />
          </mesh>
          <mesh material={m.ceramic} position={[0, -0.18, 0]}>
            <capsuleGeometry args={[0.088, 0.18, 8, 16]} />
          </mesh>
          {/* hand */}
          <group position={[0, -0.4, 0]}>
            <mesh material={m.chrome} scale={[1, 1.1, 0.8]}>
              <sphereGeometry args={[0.1, 20, 20]} />
            </mesh>
            <mesh material={m.emissive} position={[0, -0.02, 0.075]}>
              <circleGeometry args={[0.03, 16]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export const Robot = forwardRef(function Robot({ ctrl, tier = 'high', reduced = false, trail = false }, ref) {
  const m = useMaterials()
  const j = useRef({})
  const head = useRef()
  const body = useRef()
  const float = useRef()
  const eyes = useRef([])
  const eyeGlow = useRef()
  const core = useRef()
  const coreGlow = useRef()
  const flame = useRef()
  const thrusterGlow = useRef()
  const antenna = useRef()
  const blink = useRef({ next: 2, t: -1 })
  const spin = useRef(0)

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const boot = ctrl.boot
    const motion = reduced ? 0.25 : 1

    // ── floating & banking ─────────────────────────────────
    if (float.current) {
      float.current.position.y = Math.sin(t * 1.5) * 0.07 * boot * motion
      float.current.rotation.z = lerp(
        float.current.rotation.z,
        clamp(-ctrl.velX * 0.09, -0.45, 0.45) + Math.sin(t * 0.8) * 0.03 * motion,
        damp(4, dt),
      )
      float.current.rotation.x = lerp(float.current.rotation.x, clamp(ctrl.velY * -0.05, -0.3, 0.3) + (1 - boot) * 0.25, damp(4, dt))
      // poke = one joyful spin
      const since = t - ctrl.poke
      const target = since >= 0 && since < 1.1 ? Math.PI * 2 * (1 - Math.pow(1 - since / 1.1, 3)) : 0
      spin.current = since < 1.1 ? target : lerp(spin.current, 0, damp(10, dt))
      float.current.rotation.y = lerp(
        float.current.rotation.y,
        clamp(ctrl.velX * 0.12, -0.6, 0.6) + ctrl.lookX * 0.18 * boot,
        damp(3, dt),
      )
      if (body.current) body.current.rotation.y = spin.current
    }

    // ── head tracking + idle glances ──────────────────────
    if (head.current) {
      const idleGlance = Math.sin(t * 0.37) * 0.22 + Math.sin(t * 0.13 + 1) * 0.12
      const yaw = (ctrl.lookX * 0.75 + (ctrl.pose === 'idle' ? idleGlance * 0.5 : 0)) * boot
      const pitch = -ctrl.lookY * 0.35 * boot + (1 - boot) * 0.55
      head.current.rotation.y = lerp(head.current.rotation.y, yaw, damp(6, dt))
      head.current.rotation.x = lerp(head.current.rotation.x, pitch, damp(6, dt))
      head.current.rotation.z = lerp(head.current.rotation.z, ctrl.pose === 'think' ? 0.18 : Math.sin(t * 0.5) * 0.04 * motion, damp(3, dt))
    }

    // ── arms ──────────────────────────────────────────────
    const pose = POSES[ctrl.pose] || POSES.idle
    const D = POSES.dormant
    for (const side of ['r', 'l']) {
      const sh = j.current[side + 'Shoulder']
      const el = j.current[side + 'Elbow']
      if (!sh || !el) continue
      const s = side === 'r' ? 1 : -1
      const p = pose[side]
      const d = D[side]
      const phase = side === 'r' ? 0 : Math.PI
      const sway = Math.sin(t * 1.3 + phase) * 0.07 * motion * boot
      let shX = lerp(d[0], p[0], boot) + sway
      let shZ = lerp(d[1], p[1], boot) + Math.abs(sway) * 0.5
      let elX = lerp(d[2], p[2], boot) + Math.sin(t * 1.1 + phase) * 0.05 * motion
      let elZ = lerp(d[3], p[3], boot)
      if (ctrl.pose === 'wave' && side === 'r') elZ += Math.sin(t * 9) * 0.45 * boot
      if (ctrl.pose === 'fly') shX += clamp(Math.abs(ctrl.velX) * 0.08, 0, 0.4)
      const k = damp(7, dt)
      sh.rotation.x = lerp(sh.rotation.x, shX, k)
      sh.rotation.z = lerp(sh.rotation.z, shZ * s, k)
      el.rotation.x = lerp(el.rotation.x, elX, k)
      el.rotation.z = lerp(el.rotation.z, elZ * s, k)
    }

    // ── eyes: blink, excitement, happy squint after poke ──
    const b = blink.current
    if (t > b.next) {
      b.t = t
      b.next = t + 2.5 + Math.random() * 3.5
    }
    const bp = t - b.t
    const blinkS = bp >= 0 && bp < 0.14 ? 0.12 : 1
    const happy = t - ctrl.poke < 2 ? 0.45 : 1
    const intensity = 0.15 + boot * (1.6 + ctrl.excite * 1.4)
    m.eye.color.copy(CYAN_HOT).multiplyScalar(intensity)
    eyes.current.forEach((e) => {
      if (!e) return
      e.scale.y = lerp(e.scale.y, blinkS * happy * (1 + ctrl.excite * 0.25), damp(30, dt))
      e.scale.x = lerp(e.scale.x, 1 + (1 - happy) * 0.3, damp(10, dt))
    })
    if (eyeGlow.current) eyeGlow.current.material.opacity = 0.15 + boot * 0.5 + ctrl.excite * 0.3

    // ── chest core pulse ──────────────────────────────────
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4)
    m.emissive.color.copy(CYAN).multiplyScalar(0.3 + boot * (1.2 + pulse * 0.6))
    if (core.current) core.current.scale.setScalar(0.85 + pulse * 0.15 * boot)
    if (coreGlow.current) {
      coreGlow.current.material.opacity = (0.2 + pulse * 0.35) * boot
      coreGlow.current.scale.setScalar(0.7 + pulse * 0.15)
    }
    if (antenna.current) antenna.current.rotation.z = Math.sin(t * 2.1) * 0.08 * motion - ctrl.velX * 0.05

    // ── thruster ──────────────────────────────────────────
    if (flame.current) {
      const flick = 0.85 + Math.random() * 0.15
      const thrust = boot * (0.6 + clamp(Math.hypot(ctrl.velX, ctrl.velY) * 0.15, 0, 0.8))
      flame.current.scale.set(1, (0.6 + thrust) * flick, 1)
      m.flame.opacity = 0.32 * boot * flick
    }
    if (thrusterGlow.current) thrusterGlow.current.material.opacity = 0.45 * boot
  })

  return (
    <group ref={ref}>
      <group ref={float}>
        <group ref={body}>
          {/* ── HEAD ── */}
          <group ref={head} position={[0, 0.74, 0]}>
            <RoundedBox args={[0.82, 0.62, 0.7]} radius={0.24} smoothness={6} material={m.ceramic} />
            {/* visor */}
            <RoundedBox args={[0.68, 0.32, 0.1]} radius={0.05} smoothness={4} position={[0, 0.01, 0.315]} material={m.visor} />
            {/* eyes */}
            {[-0.15, 0.15].map((x, i) => (
              <mesh key={x} ref={(e) => (eyes.current[i] = e)} position={[x, 0.015, 0.368]} material={m.eye}>
                <capsuleGeometry args={[0.035, 0.07, 4, 12]} />
              </mesh>
            ))}
            <sprite ref={eyeGlow} position={[0, 0.015, 0.4]} scale={[0.85, 0.42, 1]} material={m.glow.clone()} />
            {/* ear pods */}
            {[-1, 1].map((s) => (
              <group key={s} position={[0.42 * s, 0, 0]} rotation={[0, 0, (Math.PI / 2) * s]}>
                <mesh material={m.joint}>
                  <cylinderGeometry args={[0.13, 0.13, 0.06, 32]} />
                </mesh>
                <mesh material={m.emissive} position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.07, 0.095, 32]} />
                </mesh>
              </group>
            ))}
            {/* antenna */}
            <group ref={antenna} position={[0.18, 0.3, -0.05]}>
              <mesh material={m.chrome} position={[0, 0.1, 0]}>
                <cylinderGeometry args={[0.012, 0.016, 0.2, 8]} />
              </mesh>
              <mesh material={m.emissive} position={[0, 0.22, 0]}>
                <sphereGeometry args={[0.035, 16, 16]} />
              </mesh>
            </group>
          </group>

          {/* neck */}
          <mesh material={m.joint} position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.1, 0.13, 0.12, 24]} />
          </mesh>

          {/* ── TORSO ── */}
          <mesh material={m.ceramic} scale={[0.54, 0.5, 0.42]} position={[0, 0.02, 0]}>
            <sphereGeometry args={[1, 48, 48]} />
          </mesh>
          {/* waist seam */}
          <mesh material={m.joint} position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.44, 0.022, 12, 64]} />
          </mesh>
          {/* chest core */}
          <group position={[0, 0.08, 0.4]}>
            <mesh material={m.joint} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.04, 32]} />
            </mesh>
            <mesh ref={core} material={m.emissive} position={[0, 0, 0.025]}>
              <sphereGeometry args={[0.07, 24, 24]} />
            </mesh>
            <mesh material={m.chrome} position={[0, 0, 0.012]}>
              <torusGeometry args={[0.1, 0.012, 10, 40]} />
            </mesh>
            <sprite ref={coreGlow} position={[0, 0, 0.06]} scale={[0.6, 0.6, 1]} material={m.glow.clone()} />
          </group>

          {/* ── LOWER BODY / THRUSTER ── */}
          <mesh material={m.ceramic} position={[0, -0.47, 0]}>
            <cylinderGeometry args={[0.32, 0.12, 0.42, 40]} />
          </mesh>
          <mesh material={m.joint} position={[0, -0.7, 0]}>
            <cylinderGeometry args={[0.12, 0.09, 0.06, 32]} />
          </mesh>
          <mesh material={m.emissive} position={[0, -0.735, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.075, 0.014, 10, 32]} />
          </mesh>
          {/* flame: cone pointing down, pivoting at its top so it stretches with thrust */}
          <group ref={flame} position={[0, -0.74, 0]}>
            <mesh material={m.flame} position={[0, -0.225, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.075, 0.45, 24, 1, true]} />
            </mesh>
          </group>
          <sprite ref={thrusterGlow} position={[0, -0.82, 0.05]} scale={[0.55, 0.55, 1]} material={m.glow.clone()} />

          {trail && tier === 'high' && !reduced ? (
            <Trail width={0.9} length={5} decay={1.2} color={'#19d3f5'} attenuation={(w) => w * w}>
              <mesh position={[0, -0.85, 0]} visible={false}>
                <sphereGeometry args={[0.01]} />
              </mesh>
            </Trail>
          ) : null}

          <Arm side="r" refs={j} m={m} />
          <Arm side="l" refs={j} m={m} />
        </group>
      </group>
    </group>
  )
})
