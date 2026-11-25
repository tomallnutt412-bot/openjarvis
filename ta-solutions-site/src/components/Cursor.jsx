import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'

/** Soft custom cursor for fine pointers. Grows over interactive elements; labels the capsule. */
export default function Cursor() {
  const dot = useRef()
  const ring = useRef()
  const label = useRef()
  const phase = useStore((s) => s.phase)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    document.documentElement.classList.add('has-cursor')
    let x = innerWidth / 2
    let y = innerHeight / 2
    let rx = x
    let ry = y
    let raf
    const move = (e) => {
      x = e.clientX
      y = e.clientY
      const t = e.target
      const capsule = t.closest?.('[data-capsule]')
      const hot = t.closest?.('a,button,input,textarea,select,[data-hot]')
      ring.current?.classList.toggle('is-hot', !!hot && !capsule)
      ring.current?.classList.toggle('is-capsule', !!capsule)
    }
    const loop = () => {
      rx += (x - rx) * 0.18
      ry += (y - ry) * 0.18
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    const down = () => ring.current?.classList.add('is-down')
    const up = () => ring.current?.classList.remove('is-down')
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [])

  return (
    <>
      <div className="cursor-ring" ref={ring} aria-hidden="true">
        <span ref={label}>{phase === 'online' ? '' : 'Hold'}</span>
      </div>
      <div className="cursor-dot" ref={dot} aria-hidden="true" />
    </>
  )
}
