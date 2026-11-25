import { useEffect } from 'react'
import { runtime } from '../lib/store'

/** Writes the global pointer position into runtime for the 3D scene. */
export function usePointer() {
  useEffect(() => {
    const onMove = (e) => {
      runtime.pointer.px = e.clientX
      runtime.pointer.py = e.clientY
      runtime.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      runtime.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
}
