import { useEffect } from 'react'
import Lenis from 'lenis'
import { runtime } from '../lib/store'

let instance = null
export const getLenis = () => instance

/** Smooth scroll. Disabled for reduced-motion users (native scroll instead). */
export function useLenis(enabled) {
  useEffect(() => {
    if (!enabled) return
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.9 })
    instance = lenis
    lenis.on('scroll', (e) => {
      runtime.scrollVelocity = e.velocity
    })
    let raf
    const loop = (t) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      instance = null
    }
  }, [enabled])
}

/** Scroll to a selector, using Lenis when available. */
export function scrollToTarget(selector) {
  const el = document.querySelector(selector)
  if (!el) return
  if (instance) instance.scrollTo(el, { offset: -20, duration: 1.6 })
  else el.scrollIntoView({ behavior: 'smooth' })
}
