import { IMAGES } from '../config/images'

/**
 * Renders a Higgsfield image slot from config/images.js.
 * When the slot has no `src` yet, shows a clearly-labelled placeholder
 * (name + recommended size/brief) so you can see exactly where it lands.
 */
export default function ImageSlot({ slot, className = '', style, eager = false }) {
  const img = IMAGES[slot]
  if (!img) return null
  if (img.src) {
    return (
      <img
        className={`img-slot ${className}`}
        src={img.src}
        alt={img.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={style}
      />
    )
  }
  return (
    <div className={`img-slot img-placeholder ${className}`} style={style} role="img" aria-label={`${img.label} placeholder`}>
      <div className="img-placeholder__grid" />
      <div className="img-placeholder__meta">
        <span className="img-placeholder__tag">Higgsfield</span>
        <strong>{img.label}</strong>
        <small>{img.hint}</small>
        <code>config/images.js → {slot}</code>
      </div>
    </div>
  )
}
