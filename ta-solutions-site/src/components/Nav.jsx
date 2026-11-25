import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { sound } from '../lib/sound'
import { scrollToTarget } from '../hooks/useLenis'
import { SITE } from '../config/site'
import { ease } from './Reveal'

const LINKS = [
  ['Services', '#services'],
  ['Approach', '#approach'],
  ['Contact', '#contact'],
]

export default function Nav() {
  const soundOn = useStore((s) => s.soundOn)
  const toggleSound = useStore((s) => s.toggleSound)

  const go = (e, href) => {
    e.preventDefault()
    sound.click()
    scrollToTarget(href)
  }

  return (
    <motion.header
      className="nav"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1.2, ease, delay: 0.6 }}
    >
      <a href="#top" className="nav__brand" onClick={(e) => go(e, '#top')} aria-label={`${SITE.name} home`}>
        <span className="nav__mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <span>
          TA <em>Solutions</em>
        </span>
      </a>
      <nav className="nav__links glass" aria-label="Primary">
        {LINKS.map(([label, href]) => (
          <a key={href} href={href} onClick={(e) => go(e, href)} onMouseEnter={sound.hover}>
            {label}
          </a>
        ))}
      </nav>
      <div className="nav__right">
        <button
          className={`sound-toggle glass ${soundOn ? 'is-on' : ''}`}
          onClick={() => {
            toggleSound()
            // play confirmation after the state flips on
            setTimeout(() => sound.toggleOn(), 0)
          }}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute interface sounds' : 'Enable interface sounds'}
        >
          <span className="sound-toggle__bars" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="sound-toggle__label">{soundOn ? 'Sound on' : 'Sound off'}</span>
        </button>
        <a href="#contact" className="btn btn--dark btn--sm" onClick={(e) => go(e, '#contact')} onMouseEnter={sound.hover}>
          Start a project
        </a>
      </div>
    </motion.header>
  )
}
