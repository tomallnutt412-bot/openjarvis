// Tiny procedural UI sound kit (Web Audio, no files to load).
// All sounds are silent unless the visitor enables sound in the nav.
import { useStore } from './store'

let ctx = null
let master = null
let hum = null

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.18
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

const enabled = () => useStore.getState().soundOn

function blip({ freq = 880, to = freq, dur = 0.08, type = 'sine', gain = 0.4, delay = 0 }) {
  if (!enabled()) return
  const a = audio()
  if (!a) return
  const t = a.currentTime + delay
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const sound = {
  hover: () => blip({ freq: 1800, to: 2200, dur: 0.05, gain: 0.08 }),
  click: () => blip({ freq: 520, to: 340, dur: 0.09, type: 'triangle', gain: 0.25 }),
  toggleOn: () => {
    blip({ freq: 660, dur: 0.08, gain: 0.2 })
    blip({ freq: 990, dur: 0.12, gain: 0.2, delay: 0.07 })
  },
  hatch: () => {
    ;[523, 659, 784, 1046].forEach((f, i) => blip({ freq: f, dur: 0.5, gain: 0.18, delay: i * 0.06 }))
    blip({ freq: 180, to: 60, dur: 0.6, type: 'sine', gain: 0.4 })
  },
  // Continuous rising hum while charging the capsule.
  humStart() {
    if (!enabled() || hum) return
    const a = audio()
    if (!a) return
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'sawtooth'
    o.frequency.value = 90
    const f = a.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 600
    g.gain.value = 0
    g.gain.linearRampToValueAtTime(0.05, a.currentTime + 0.15)
    o.connect(f).connect(g).connect(master)
    o.start()
    hum = { o, g, f }
  },
  humSet(p) {
    if (!hum || !ctx) return
    hum.o.frequency.setTargetAtTime(90 + p * 260, ctx.currentTime, 0.05)
    hum.f.frequency.setTargetAtTime(600 + p * 2400, ctx.currentTime, 0.05)
  },
  humStop() {
    if (!hum || !ctx) return
    const { o, g } = hum
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
    o.stop(ctx.currentTime + 0.3)
    hum = null
  },
}
