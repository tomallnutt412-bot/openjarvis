import { useRef } from 'react'
import { motion } from 'framer-motion'
import { SERVICES } from '../config/site'
import { useStore } from '../lib/store'
import { sound } from '../lib/sound'
import ImageSlot from '../components/ImageSlot'
import { Reveal, SplitLine, ease } from '../components/Reveal'

function ServiceCard({ s, i }) {
  const ref = useRef()
  const setHovered = useStore((st) => st.setHoveredService)

  // subtle 3D tilt + glare following the pointer
  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
    el.style.setProperty('--tx', `${(y - 0.5) * -6}deg`)
    el.style.setProperty('--ty', `${(x - 0.5) * 8}deg`)
  }
  const onLeave = () => {
    setHovered(null)
    ref.current?.style.setProperty('--tx', '0deg')
    ref.current?.style.setProperty('--ty', '0deg')
  }

  return (
    <motion.article
      ref={ref}
      className={`service-card glass ${i === 0 ? 'is-wide' : ''}`}
      data-robot-card={s.id}
      data-hot
      tabIndex={0}
      onPointerEnter={() => {
        setHovered(s.id)
        sound.hover()
      }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onFocus={() => setHovered(s.id)}
      onBlur={() => setHovered(null)}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 1.1, ease, delay: (i % 2) * 0.12 }}
    >
      <div className="service-card__glare" aria-hidden="true" />
      <div className="service-card__scan" aria-hidden="true" />
      <header className="service-card__head">
        <span className="service-card__index">{s.index}</span>
        <span className="service-card__status">
          <i /> Scanned by TA-01
        </span>
      </header>
      <div className="service-card__media">
        {/* HIGGSFIELD: service visual (config/images.js → {s.image}) */}
        <ImageSlot slot={s.image} />
      </div>
      <div className="service-card__body">
        <h3>{s.title}</h3>
        <p>{s.blurb}</p>
        <ul>
          {s.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </motion.article>
  )
}

export default function Services() {
  return (
    <section id="services" className="services" data-section="services" data-robot="orbit" data-pose="scan">
      <div className="container">
        <div className="section-head">
          <Reveal className="kicker">
            <span>( 01 )</span> Services
          </Reveal>
          <h2 className="section-title robot-lit">
            <SplitLine text="Five ways we put" />
            <br />
            <SplitLine text="AI to work." className="serif" delay={0.1} />
          </h2>
          <Reveal className="section-lede" delay={0.15}>
            Pick one, or let us combine them into a single system. Hover a card — TA-01 will take a closer look.
          </Reveal>
        </div>
        <div className="services__grid">
          {SERVICES.map((s, i) => (
            <ServiceCard key={s.id} s={s} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
