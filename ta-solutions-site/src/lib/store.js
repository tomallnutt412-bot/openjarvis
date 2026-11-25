import { create } from 'zustand'

/**
 * React-facing state (things that change rarely and drive UI).
 * phase: 'dormant' → 'charging' → 'hatching' → 'online'
 */
export const useStore = create((set) => ({
  phase: 'dormant',
  soundOn: false,
  hoveredService: null,
  section: 'hero',
  setPhase: (phase) => set({ phase }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  setHoveredService: (hoveredService) => set({ hoveredService }),
  setSection: (section) => set({ section }),
}))

/**
 * Per-frame mutable values. Written by DOM listeners and read inside
 * useFrame — deliberately NOT React state so nothing re-renders at 60fps.
 */
export const runtime = {
  pointer: { x: 0, y: 0, px: 0, py: 0 }, // normalised -1..1 and raw px
  charge: 0, // 0..1 hold-to-hatch progress
  holding: false,
  autoCharge: false, // a short click auto-completes the charge
  hatchTime: -1, // clock time when hatch began
  scrollVelocity: 0,
}
