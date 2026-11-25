import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { runtime, useStore } from '../lib/store'
import { sound } from '../lib/sound'
import ImageSlot from './ImageSlot'

/**
 * Accessible hit-area that sits over the 3D capsule.
 * - Press & hold to charge (1.35s), release early and it drains.
 * - A quick click/tap (or Enter/Space) auto-completes the charge.
 * The 3D capsule positions itself to this element's rect via [data-capsule].
 */
export default function CapsuleTrigger({ webgl }) {
  const phase = useStore((s) => s.phase)
  const downAt = useRef(0)
  const pctRef = useRef()

  useEffect(() => {
    let raf
    const loop = () => {
      if (pctRef.current) pctRef.current.textContent = String(Math.round(runtime.charge * 100)).padStart(2, '0')
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const start = (e) => {
    if (useStore.getState().phase === 'online' || runtime.hatchTime >= 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    downAt.current = performance.now()
    runtime.holding = true
    sound.humStart()
  }
  const end = () => {
    if (!runtime.holding) return
    runtime.holding = false
    const quick = performance.now() - downAt.current < 260
    if (quick) runtime.autoCharge = true
    else if (runtime.charge < 1) sound.humStop()
  }
  const onKey = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && runtime.hatchTime < 0) {
      e.preventDefault()
      sound.humStart()
      runtime.autoCharge = true
    }
  }

  const done = phase === 'online' || phase === 'hatching'

  return (
    <div className={`capsule-slot ${done ? 'is-done' : ''}`}>
      {!webgl ? (
        // HIGGSFIELD: robot render shown when WebGL is unavailable.
        <ImageSlot slot="robotFallback" className="capsule-slot__fallback" eager />
      ) : null}
      <button
        type="button"
        className="capsule-hit"
        data-capsule
        data-hot
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={(e) => runtime.holding && e.buttons === 0 && end()}
        onKeyDown={onKey}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={done ? 'Robot activated' : 'Hold to activate the TA-01 robot'}
        disabled={done || !webgl}
      />
      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div
            key="hint"
            className="capsule-hint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: phase === 'dormant' ? 1.6 : 0 }}
          >
            <span className="capsule-hint__pill glass">
              <span className="capsule-hint__dot" />
              {phase === 'charging' ? (
                <>
                  Charging <b ref={pctRef}>00</b>%
                </>
              ) : (
                <>
                  Hold to activate <b ref={pctRef} hidden />
                </>
              )}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="online"
            className="capsule-hint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <span className="capsule-hint__pill glass is-online">
              <span className="capsule-hint__dot" />
              TA-01 online — scroll to explore
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
