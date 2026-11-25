// ─────────────────────────────────────────────────────────────
//  HIGGSFIELD IMAGE SLOTS
//  ----------------------------------------------------------------
//  Every image on the site is routed through this file.
//  To swap in a Higgsfield render:
//    1. Export the image (WebP or AVIF recommended, see sizes below)
//    2. Drop it into  /public/higgsfield/
//    3. Set `src` below to '/higgsfield/<file-name>'
//  While `src` is null, a labelled placeholder is rendered instead,
//  so you can always see where each image will land.
// ─────────────────────────────────────────────────────────────

export const IMAGES = {
  // Soft, out-of-focus atmosphere behind the hero (very subtle — sits at ~35% opacity).
  // Suggested: 2560×1440, pale pearl / cyan haze, no hard subjects.
  heroBackdrop: {
    src: null, // e.g. '/higgsfield/hero-backdrop.webp'
    alt: '',
    label: 'Hero backdrop',
    hint: '2560×1440 · pearl haze, soft cyan light leaks',
  },

  // Shown INSTEAD of the live 3D robot when WebGL is unavailable.
  // Suggested: 1200×1500 transparent PNG/WebP of the robot render.
  robotFallback: {
    src: null, // e.g. '/higgsfield/robot-render.webp'
    alt: 'TA Solutions robot assistant',
    label: 'Robot reference render',
    hint: '1200×1500 · transparent PNG/WebP · white ceramic robot, cyan visor',
  },

  // Service card visuals (shown inside each frosted card). 1200×900 each.
  serviceAdvertising: {
    src: null,
    alt: 'Advertising visual',
    label: 'Service · Advertising',
    hint: '1200×900 · abstract glass billboard / signal waves',
  },
  serviceWebsites: {
    src: null,
    alt: 'Website creation visual',
    label: 'Service · Websites',
    hint: '1200×900 · floating glass UI panels',
  },
  serviceAutomation: {
    src: null,
    alt: 'AI automation visual',
    label: 'Service · Automation',
    hint: '1200×900 · luminous node network / flowing pipes',
  },
  serviceContent: {
    src: null,
    alt: 'Content creation visual',
    label: 'Service · Content',
    hint: '1200×900 · prism splitting light into frames',
  },
  serviceConsultation: {
    src: null,
    alt: 'Business consultation visual',
    label: 'Service · Consultation',
    hint: '1200×900 · calm glass chess piece / compass',
  },

  // Large image in the Approach section. 1600×2000 portrait.
  approachVisual: {
    src: null,
    alt: 'TA Solutions studio',
    label: 'Approach visual',
    hint: '1600×2000 · robot hand meets human hand, soft studio light',
  },

  // Subtle texture blended over the contact panel. 2000×1200, tileable-ish.
  contactTexture: {
    src: null,
    alt: '',
    label: 'Contact texture',
    hint: '2000×1200 · frosted glass grain / caustics',
  },
}

// Optional texture applied to the procedural robot's ceramic shell
// (a seamless panel-line / micro-detail map, 1024×1024, greyscale).
// Leave null to keep the clean procedural finish.
export const ROBOT_PANEL_TEXTURE = null // e.g. '/higgsfield/robot-panels.png'
