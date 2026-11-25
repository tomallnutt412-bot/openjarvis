import { motion } from 'framer-motion'
import { HERO } from '../config/site'
import { scrollToTarget } from '../hooks/useLenis'
import { sound } from '../lib/sound'
import CapsuleTrigger from '../components/CapsuleTrigger'
import ImageSlot from '../components/ImageSlot'
import { ease } from '../components/Reveal'

const rise = (d) => ({
  initial: { y: '105%' },
  animate: { y: '0%' },
  transition: { duration: 1.3, ease, delay: 1.0 + d },
})

export default function Hero({ webgl }) {
  return (
    <section
      id="top"
      className="hero"
      data-section="hero"
      data-robot="target"
      data-target="[data-capsule]"
      data-at="0.5,0.45"
      data-pose="idle"
    >
      {/* HIGGSFIELD: soft atmospheric backdrop (config/images.js → heroBackdrop) */}
      <div className="hero__backdrop" aria-hidden="true">
        <ImageSlot slot="heroBackdrop" eager />
      </div>

      <div className="hero__grid container">
        <div className="hero__copy">
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease, delay: 0.9 }}
          >
            <span className="eyebrow__dot" /> {HERO.eyebrow}
          </motion.p>
          <h1 className="hero__title robot-lit">
            <span className="mask">
              <motion.span {...rise(0)}>{HERO.titleA}</motion.span>
            </span>
            <span className="mask">
              <motion.span className="serif" {...rise(0.1)}>
                {HERO.titleB}
              </motion.span>
            </span>
          </h1>
          <motion.p
            className="hero__sub"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease, delay: 1.35 }}
          >
            {HERO.sub}
          </motion.p>
          <motion.div
            className="hero__ctas"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease, delay: 1.5 }}
          >
            <a
              href="#contact"
              className="btn btn--dark"
              onMouseEnter={sound.hover}
              onClick={(e) => {
                e.preventDefault()
                sound.click()
                scrollToTarget('#contact')
              }}
            >
              {HERO.primaryCta}
              <span className="btn__arrow" aria-hidden="true">→</span>
            </a>
            <a
              href="#services"
              className="btn btn--glass glass"
              onMouseEnter={sound.hover}
              onClick={(e) => {
                e.preventDefault()
                sound.click()
                scrollToTarget('#services')
              }}
            >
              {HERO.secondaryCta}
            </a>
          </motion.div>
        </div>

        <div className="hero__stage">
          <CapsuleTrigger webgl={webgl} />
        </div>
      </div>

      <motion.div
        className="scroll-cue"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 1 }}
        aria-hidden="true"
      >
        <span>Scroll</span>
        <i />
      </motion.div>
    </section>
  )
}
