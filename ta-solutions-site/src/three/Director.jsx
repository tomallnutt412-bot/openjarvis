import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Robot } from './Robot'
import { Capsule } from './Capsule'
import { runtime, useStore } from '../lib/store'
import { sound } from '../lib/sound'
import { clamp, damp, lerp, smooth, easeOutBack } from '../lib/math'

/*
 * ─────────────────────────────────────────────────────────────
 *  The Director choreographs the robot across the page.
 *
 *  Sections opt in with data attributes (all coordinates are in
 *  *screen* space, so the robot always tracks the real layout):
 *
 *   data-robot="target"  data-target="<selector>"  data-at="fx,fy"
 *        → sit at a point inside the target element's rect
 *   data-robot="path"    data-path="x0,y0,x1,y1"  [data-path-m="…"]
 *        → glide across the viewport (fractions of vw/vh) as the
 *          section scrolls through. data-weave adds a fly-through
 *          depth weave (used for the big manifesto type).
 *   data-robot="orbit"
 *        → circle the hovered (or most central) [data-robot-card]
 *
 *  Optional: data-pose="idle|fly|scan|wave|think", data-z="n"
 *
 *  Each section's point is blended by how close the section is to
 *  the viewport centre, so transitions are continuous.
 * ─────────────────────────────────────────────────────────────
 */

const nums = (s) => (s ? s.split(',').map(Number) : null)

function sectionPoint(el, r, vw, vh, t, time, small) {
  const mode = el.dataset.robot
  const pose = el.dataset.pose || 'idle'
  const z = Number(el.dataset.z || 0)

  if (mode === 'path') {
    const p = nums((small && el.dataset.pathM) || el.dataset.path) || [0.2, 0.5, 0.8, 0.5]
    const e = smooth(t)
    let x = lerp(p[0], p[2], e) * vw
    let y = lerp(p[1], p[3], e) * vh
    let zz = z
    if (el.dataset.weave) {
      y += Math.sin(e * Math.PI * 3) * vh * 0.06
      zz += Math.sin(e * Math.PI * 2) * 2.2
    }
    return { x, y, z: zz, pose }
  }

  if (mode === 'orbit') {
    const hovered = useStore.getState().hoveredService
    const cards = el.querySelectorAll('[data-robot-card]')
    let card = hovered ? el.querySelector(`[data-robot-card="${hovered}"]`) : null
    if (!card) {
      let best = Infinity
      cards.forEach((c) => {
        const cr = c.getBoundingClientRect()
        const d = Math.abs(cr.top + cr.height / 2 - vh * 0.5)
        if (d < best) {
          best = d
          card = c
        }
      })
    }
    if (!card) return { x: vw / 2, y: vh / 2, z, pose }
    const cr = card.getBoundingClientRect()
    const a = time * 0.85
    const rx = small ? cr.width * 0.36 : cr.width * 0.58 + 40
    return {
      x: cr.left + cr.width / 2 + Math.cos(a) * rx,
      y: cr.top + cr.height * 0.42 + Math.sin(a * 2) * cr.height * 0.12,
      z: z + Math.sin(a) * 2.4,
      pose: 'scan',
      look: [cr.left + cr.width / 2, cr.top + cr.height / 2],
      card,
    }
  }

  // target
  const target = el.dataset.target ? document.querySelector(el.dataset.target) : el
  const tr = target ? target.getBoundingClientRect() : r
  const at = nums((small && el.dataset.atM) || el.dataset.at) || [0.5, 0.5]
  return { x: tr.left + tr.width * at[0], y: tr.top + tr.height * at[1], z, pose }
}

export function Director({ caps }) {
  const robot = useRef()
  const capsule = useRef()
  const ctrl = useMemo(
    () => ({ boot: 0, lookX: 0, lookY: 0, pose: 'idle', velX: 0, velY: 0, poke: -10, excite: 0 }),
    [],
  )
  const online = useStore((s) => s.phase === 'online')
  const cur = useRef({ x: 0, y: 0, z: 0, init: false, sx: 0, sy: 0 })
  const cache = useRef({ anchors: [], lit: [], frame: 0, scanned: null })

  // Poke the robot: tap/click near it for a happy spin.
  useEffect(() => {
    const onDown = (e) => {
      if (useStore.getState().phase !== 'online') return
      if (e.target.closest('a,button,input,textarea,select,label,[data-capsule]')) return
      const c = cur.current
      if (Math.hypot(e.clientX - c.sx, e.clientY - c.sy) < 130) {
        cache.current.pokeRequest = true
        sound.click()
        sound.toggleOn()
      }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [ctrl])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const realDt = Math.min(rawDt, 0.25) // charge uses real time so slow frames don't stall it
    const t = state.clock.elapsedTime
    const { camera, size } = state
    const vw = size.width
    const vh = size.height
    const small = vw < 820
    const vp = state.viewport.getCurrentViewport(camera, [0, 0, 0])
    const k = vp.width / vw // world units per px at z=0
    const st = useStore.getState()

    // ── refresh DOM anchors every ~half second ──
    const cch = cache.current
    if (cch.pokeRequest) {
      ctrl.poke = t
      cch.pokeRequest = false
    }
    if (cch.frame++ % 30 === 0) {
      cch.anchors = Array.from(document.querySelectorAll('[data-robot]'))
      // individual word spans that glow when the robot passes
      cch.lit = Array.from(document.querySelectorAll('.robot-lit .split-word > span, .robot-lit .mask > span'))
    }

    // ── charge / hatch state machine ──
    if (st.phase === 'dormant' || st.phase === 'charging') {
      if (runtime.holding) runtime.charge += realDt / 1.35
      else if (runtime.autoCharge) runtime.charge += realDt / 0.8
      else runtime.charge = Math.max(0, runtime.charge - realDt * 0.9)
      runtime.charge = clamp(runtime.charge)
      sound.humSet(runtime.charge)
      if (runtime.charge > 0 && st.phase === 'dormant') st.setPhase('charging')
      if (runtime.charge === 0 && st.phase === 'charging') st.setPhase('dormant')
      if (runtime.charge >= 1) {
        runtime.hatchTime = t
        runtime.holding = false
        runtime.autoCharge = false
        sound.humStop()
        sound.hatch()
        st.setPhase('hatching')
      }
    }
    if (st.phase === 'hatching' && t - runtime.hatchTime > 1.6) st.setPhase('online')

    const hatched = runtime.hatchTime >= 0
    const hp = hatched ? clamp((t - runtime.hatchTime - 0.15) / 1.3) : 0
    const boot = hatched ? clamp(easeOutBack(hp, 1.2), 0, 1.08) : 0.04 + runtime.charge * 0.25
    ctrl.boot = Math.min(1, boot)

    // ── capsule follows its DOM slot ──
    const slot = document.querySelector('[data-capsule]')
    const baseScale = (vp.height * (small ? 0.2 : 0.25)) / 2.4
    let slotX = vw * 0.7
    let slotY = vh * 0.5
    if (slot) {
      const sr = slot.getBoundingClientRect()
      slotX = sr.left + sr.width / 2
      slotY = sr.top + sr.height / 2
      // auto-release when the visitor scrolls past without hatching
      if (!hatched && sr.bottom < vh * 0.35) runtime.autoCharge = true
    }
    if (capsule.current) {
      capsule.current.position.set((slotX - vw / 2) * k, -(slotY - vh / 2) * k, 0)
      capsule.current.scale.setScalar(baseScale * 0.92)
      capsule.current.visible = slotY > -vh * 0.6 && slotY < vh * 1.6
    }

    // ── compute target in screen space ──
    let tx = slotX
    let ty = slotY
    let tz = 0
    let pose = 'idle'
    let look = null
    let scannedCard = null
    if (hatched) {
      let wsum = 0
      let ax = 0
      let ay = 0
      let az = 0
      let bestW = 0
      const sig = vh * 0.38
      for (const el of cch.anchors) {
        const r = el.getBoundingClientRect()
        const cy = vh * 0.5
        const d = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0
        const w = Math.exp(-((d / sig) ** 2))
        if (w < 0.002) continue
        const prog = clamp((cy - r.top) / Math.max(1, r.height))
        const p = sectionPoint(el, r, vw, vh, prog, t, small)
        ax += p.x * w
        ay += p.y * w
        az += p.z * w
        wsum += w
        if (w > bestW) {
          bestW = w
          pose = p.pose
          look = p.look || null
          scannedCard = p.card || null
        }
      }
      if (wsum > 0) {
        tx = ax / wsum
        ty = ay / wsum
        tz = az / wsum
      }
      // keep the robot comfortably on screen
      const m = small ? 50 : 90
      tx = clamp(tx, m, vw - m)
      ty = clamp(ty, m + 40, vh - m)

      // mouse influence + playful dodge
      const motion = caps.reduced ? 0.3 : 1
      tx += runtime.pointer.x * vw * 0.04 * motion
      ty -= runtime.pointer.y * vh * 0.03 * motion
      const dx = cur.current.sx - runtime.pointer.px
      const dy = cur.current.sy - runtime.pointer.py
      const dist = Math.hypot(dx, dy)
      if (dist < 160 && dist > 1 && !caps.coarse) {
        const push = (160 - dist) * 0.55 * motion
        tx += (dx / dist) * push
        ty += (dy / dist) * push
      }
      ctrl.excite = lerp(ctrl.excite, dist < 220 ? 1 - dist / 220 : 0, damp(5, dt))
    } else {
      // dormant: curled up inside the egg, rising slightly as it charges
      ty -= runtime.charge * 6
      pose = 'idle'
    }
    // newly hatched robot rises out of the shell
    if (hatched && hp < 1) {
      tx = lerp(slotX, tx, smooth(hp))
      ty = lerp(slotY - vh * 0.04, ty, smooth(hp))
      tz = lerp(0.6, tz, smooth(hp))
      pose = 'wave'
    }
    if (st.phase === 'online' && pose === 'idle' && t - ctrl.poke < 1.6) pose = 'wave'
    ctrl.pose = pose

    // ── damp toward target (world space) ──
    const c = cur.current
    const factor = (camera.position.z - tz) / camera.position.z
    const wx = (tx - vw / 2) * k * factor
    const wy = -(ty - vh / 2) * k * factor
    if (!c.init) {
      c.x = wx
      c.y = wy
      c.z = tz
      c.init = true
    }
    const lam = !hatched ? 30 : caps.reduced ? 6 : 2.6
    const px = c.x
    const py = c.y
    c.x = lerp(c.x, wx, damp(lam, dt))
    c.y = lerp(c.y, wy, damp(lam, dt))
    c.z = lerp(c.z, tz, damp(lam * 0.8, dt))
    ctrl.velX = lerp(ctrl.velX, (c.x - px) / Math.max(dt, 1e-3), damp(6, dt))
    ctrl.velY = lerp(ctrl.velY, (c.y - py) / Math.max(dt, 1e-3), damp(6, dt))

    // screen position of robot (for pointer logic + CSS effects)
    const f2 = camera.position.z / (camera.position.z - c.z)
    c.sx = (c.x / k) * f2 + vw / 2
    c.sy = (-c.y / k) * f2 + vh / 2

    // ── head look target ──
    const lx = look ? look[0] : runtime.pointer.px || vw / 2
    const ly = look ? look[1] : runtime.pointer.py || vh / 2
    ctrl.lookX = clamp((lx - c.sx) / (vw * 0.35), -1, 1)
    ctrl.lookY = clamp(-(ly - c.sy) / (vh * 0.4), -1, 1)

    if (robot.current) {
      robot.current.position.set(c.x, c.y, c.z)
      const dormantScale = 0.78 + runtime.charge * 0.06
      const s = hatched ? lerp(dormantScale, 1, smooth(hp)) : dormantScale
      robot.current.scale.setScalar(baseScale * s)
    }

    // ── let the DOM react to the robot ──
    // (coordinates are local to each word, so it works whatever transforms the word has)
    for (const el of cch.lit) {
      const r = el.getBoundingClientRect()
      if (r.bottom < -50 || r.top > vh + 50) continue
      el.style.setProperty('--lx', `${(c.sx - r.left).toFixed(1)}px`)
      el.style.setProperty('--ly', `${(c.sy - r.top).toFixed(1)}px`)
      el.style.setProperty('--rp', hatched ? '1' : '0')
    }
    if (scannedCard !== cch.scanned) {
      cch.scanned?.removeAttribute('data-scanned')
      scannedCard?.setAttribute('data-scanned', '')
      cch.scanned = scannedCard
    }
  })

  return (
    <>
      <group ref={capsule}>
        <Capsule tier={caps.tier} reduced={caps.reduced} />
      </group>
      <Robot ref={robot} ctrl={ctrl} tier={caps.tier} reduced={caps.reduced} trail={online} />
    </>
  )
}
