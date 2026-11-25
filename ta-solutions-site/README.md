# TA Solutions — immersive 3D site

A premium, scroll-driven website for TA Solutions. A procedural robot, **TA-01**,
sleeps inside a glass capsule in the hero. Hold (or click) the capsule to hatch
it — it then flies with you through the page: weaving through the manifesto type
(the words light up cyan as it passes), orbiting and "scanning" the frosted
service cards, thinking beside the approach section and landing on the dock next
to the contact form.

**Stack:** React 19 · Vite · Three.js via React Three Fiber + Drei · Lenis smooth
scroll · Framer Motion · Zustand.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the build
```

Node 18+ recommended.

## Deploy

- **Vercel:** import the repo, set the root directory to `ta-solutions-site`. `vercel.json` is included.
- **Netlify:** set the base directory to `ta-solutions-site`. `netlify.toml` is included (build `npm run build`, publish `dist`).

Optional contact form backend: copy `.env.example` to `.env` and set
`VITE_FORM_ENDPOINT` (Formspree, Basin, your own API…). Without it the form
opens the visitor's mail client addressed to `SITE.email`.

## Swapping in Higgsfield images

All images go through **`src/config/images.js`**. Each slot renders a labelled
placeholder until you give it a `src`:

1. Export from Higgsfield (WebP recommended).
2. Drop the file in `public/higgsfield/`.
3. Set the slot's `src`, e.g. `src: '/higgsfield/service-automation.webp'`.

See `public/higgsfield/README.md` for every slot, the recommended size and a
prompt brief. Search the code for `HIGGSFIELD` to see where each one renders.

## Editing copy

All text (headline, services, approach steps, contact details) lives in
**`src/config/site.js`**. Replace the placeholder email before launch.

## How it's built

```
src/
  config/        site copy + Higgsfield image slots
  three/
    Experience.jsx   fixed WebGL layer (above content, pointer-events: none), procedural lighting
    Director.jsx     scroll/mouse choreography + hatch state machine
    Robot.jsx        the procedural robot (primitives only, joint-animated)
    Capsule.jsx      glass egg, energy field, progress ring, shatter + shockwave
    materials.js     small custom shaders (energy shell, progress ring)
  sections/      Hero, Manifesto, Services, Approach, Contact, Footer
  components/    Nav, HUD, cursor, capsule hit-area, reveal helpers, ImageSlot
  hooks/         device capabilities, Lenis, pointer
  lib/           store (React state + per-frame runtime), Web Audio UI sounds
```

**Choreography.** Sections opt in with data attributes, and the Director blends
between them by distance from the viewport centre, so the robot always follows
the real layout:

| Attribute | Effect |
|---|---|
| `data-robot="target" data-target="#id" data-at="fx,fy"` | sit at a point inside an element |
| `data-robot="path" data-path="x0,y0,x1,y1"` (`data-path-m` for mobile) | glide across the viewport while the section scrolls; `data-weave` adds a depth weave |
| `data-robot="orbit"` | circle the hovered / most central `[data-robot-card]` |
| `data-pose` | `idle`, `fly`, `scan`, `wave`, `think` |
| `class="robot-lit"` on a heading | its words glow cyan near the robot |

**Interactions.** Hold the capsule ~1.3 s (a quick click/tap or Enter/Space
auto-completes; scrolling past the hero auto-releases it). The robot's head
tracks the cursor, it drifts toward the mouse, dodges if you get too close, and
does a happy spin if you click near it. UI sounds are synthesised with Web Audio
(no files) and stay off until the sound toggle is switched on.

## Performance & fallbacks

- Three.js is code-split: the page paints before the 3D chunk loads.
- **High tier** (desktop): real glass transmission, motion trail, DPR up to 1.75.
- **Low tier** (phones, small screens, ≤4 cores): cheaper glass, no trail, DPR ≤ 1.4.
- The glass transmission pass is unmounted once the robot is out.
- `prefers-reduced-motion`: native scroll (no Lenis), damped robot motion, CSS animations off.
- No WebGL: the Higgsfield `robotFallback` render is shown in the hero instead.
- Testing overrides: `?quality=low`, `?quality=high`, `?webgl=0`.
