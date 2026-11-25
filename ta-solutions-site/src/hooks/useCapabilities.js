import { useEffect, useState } from 'react'

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}

/**
 * Decides how much 3D the device gets.
 *  tier 'high' – full glass transmission, more particles
 *  tier 'low'  – phones / low-core devices: cheaper materials, capped DPR
 *  webgl false – static Higgsfield render fallback
 */
export function useCapabilities() {
  const get = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const small = window.innerWidth < 820
    const cores = navigator.hardwareConcurrency || 4
    // ?quality=low|high overrides auto-detection; ?webgl=0 previews the image fallback.
    const q = new URLSearchParams(window.location.search)
    const forced = q.get('quality')
    const tier = forced === 'low' || forced === 'high' ? forced : coarse || small || cores <= 4 ? 'low' : 'high'
    return { reduced, coarse, small, tier, webgl: q.get('webgl') !== '0' && hasWebGL() }
  }
  const [caps, setCaps] = useState(get)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setCaps(get())
    mq.addEventListener('change', update)
    let t
    const onResize = () => {
      clearTimeout(t)
      t = setTimeout(update, 200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return caps
}
