import * as THREE from 'three'

export const CYAN = new THREE.Color('#19d3f5')
export const CYAN_HOT = new THREE.Color('#7ff3ff')

/** Fresnel energy shell that brightens as the capsule charges. */
export function makeEnergyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uCharge: { value: 0 },
      uAlpha: { value: 1 },
      uColor: { value: CYAN.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vP = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uCharge, uAlpha; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        float scan = smoothstep(0.94, 1.0, sin(vP.y * 16.0 - uTime * (2.0 + uCharge * 8.0)) * 0.5 + 0.5);
        float hex = smoothstep(0.96, 1.0, sin(vP.x * 30.0 + uTime) * sin(vP.y * 30.0 - uTime));
        float a = f * (0.22 + uCharge * 1.1) + scan * (0.06 + 0.4 * uCharge) + hex * 0.25 * uCharge;
        gl_FragColor = vec4(uColor * (1.0 + uCharge * 0.6), clamp(a, 0.0, 1.0) * uAlpha);
      }`,
  })
}

/** Flat ring that fills clockwise with charge progress. */
export function makeProgressRingMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: CYAN.clone() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uProgress, uTime, uAlpha; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float ang = fract(atan(p.x, p.y) / 6.28318 + 1.0);
        float on = step(ang, uProgress);
        float tick = step(0.5, fract(ang * 48.0)) * 0.35;
        float idle = 0.18 + 0.08 * sin(uTime * 2.0 + ang * 6.28);
        float a = mix(idle * (0.6 + tick), 1.0, on);
        gl_FragColor = vec4(mix(vec3(0.55, 0.62, 0.7), uColor, max(on, 0.25)), a * uAlpha);
      }`,
  })
}
