# Higgsfield drop folder

Put exported Higgsfield images here, then point the matching slot in
`src/config/images.js` at `/higgsfield/<file>`.

| Slot (`config/images.js`) | Suggested file            | Size / format              | Brief |
|---------------------------|---------------------------|----------------------------|-------|
| `heroBackdrop`            | hero-backdrop.webp        | 2560×1440 WebP             | Pale pearl haze, soft cyan light leaks, no hard subject |
| `robotFallback`           | robot-render.webp         | 1200×1500 transparent WebP | White ceramic robot, dark visor, cyan eyes + chest core (shown when WebGL is off) |
| `serviceAdvertising`      | service-advertising.webp  | 1200×900 WebP              | Abstract glass billboard / signal waves |
| `serviceWebsites`         | service-websites.webp     | 1200×900 WebP              | Floating frosted-glass UI panels |
| `serviceAutomation`       | service-automation.webp   | 1200×900 WebP              | Luminous node network / flowing pipes |
| `serviceContent`          | service-content.webp      | 1200×900 WebP              | Prism splitting light into frames |
| `serviceConsultation`     | service-consultation.webp | 1200×900 WebP              | Calm glass chess piece / compass |
| `approachVisual`          | approach.webp             | 1600×2000 WebP             | Robot hand meets human hand, soft studio light |
| `contactTexture`          | contact-texture.webp      | 2000×1200 WebP             | Frosted glass grain / caustics (shown at 12% opacity) |
| `ROBOT_PANEL_TEXTURE`     | robot-panels.png          | 1024×1024 greyscale, tileable | Optional panel-line bump map for the 3D robot shell |
| (index.html `og:image`)   | og-image.jpg              | 1200×630 JPG               | Social share card |

Style notes for consistency: soft daylight, cream/pearl (#f2f1ed) and white
surfaces, a single electric-cyan accent (#19d3f5), lots of negative space.
