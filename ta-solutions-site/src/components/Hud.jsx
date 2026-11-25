import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { runtime, useStore } from '../lib/store'

const SECTION_LABEL = {
  hero: 'Docking bay',
  manifesto: 'In transit',
  services: 'Scanning services',
  approach: 'Reviewing approach',
  contact: 'Awaiting your brief',
}

/** Frosted status pill — the robot's "dive computer". */
export default function Hud() {
  const phase = useStore((s) => s.phase)
  const section = useStore((s) => s.section)
  const pct = useRef()
  const bar = useRef()

  useEffect(() => {
    let raf
    const loop = () => {
      const c = Math.round(runtime.charge * 100)
      if (pct.current) pct.current.textContent = `${c}%`
      if (bar.current) bar.current.style.transform = `scaleX(${runtime.charge})`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const status =
    phase === 'online' ? 'Online' : phase === 'hatching' ? 'Booting' : phase === 'charging' ? 'Charging' : 'Standby'

  return (
    <motion.aside
      className={`hud glass phase-${phase}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 1 }}
      aria-live="polite"
    >
      <span className="hud__led" aria-hidden="true" />
      <span className="hud__unit">TA-01</span>
      <span className="hud__sep" aria-hidden="true" />
      <AnimatePresence mode="wait">
        <motion.span
          key={status + (phase === 'online' ? section : '')}
          className="hud__status"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
        >
          {status}
          {phase === 'online' ? <em> · {SECTION_LABEL[section]}</em> : null}
        </motion.span>
      </AnimatePresence>
      {phase === 'charging' || phase === 'dormant' ? (
        <span className="hud__charge" aria-hidden="true">
          <span className="hud__track">
            <span className="hud__bar" ref={bar} />
          </span>
          <span ref={pct} className="hud__pct">0%</span>
        </span>
      ) : null}
    </motion.aside>
  )
}
