export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (t) => t * t * (3 - 2 * t)
export const easeOutBack = (t, s = 1.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
/** Frame-rate independent damping factor. */
export const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt)
