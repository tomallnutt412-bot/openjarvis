import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CONTACT, SERVICES, SITE } from '../config/site'
import { sound } from '../lib/sound'
import ImageSlot from '../components/ImageSlot'
import { Reveal, SplitLine, ease } from '../components/Reveal'

const ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT

export default function Contact() {
  const [services, setServices] = useState([])
  const [budget, setBudget] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error

  const toggle = (id) => {
    sound.click()
    setServices((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const submit = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      name: fd.get('name'),
      email: fd.get('email'),
      company: fd.get('company'),
      message: fd.get('message'),
      services: services.join(', '),
      budget,
    }
    sound.click()
    if (!ENDPOINT) {
      // No backend configured: hand off to the visitor's mail client.
      const body = Object.entries(data)
        .map(([k, v]) => `${k}: ${v || '-'}`)
        .join('\n')
      window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
        `New project — ${data.company || data.name}`,
      )}&body=${encodeURIComponent(body)}`
      setState('sent')
      return
    }
    try {
      setState('sending')
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(String(res.status))
      setState('sent')
      sound.hatch()
    } catch {
      setState('error')
    }
  }

  return (
    <section
      id="contact"
      className="contact"
      data-section="contact"
      data-robot="target"
      data-target="#contact-dock"
      data-at="0.5,0.5"
      data-pose="wave"
      data-z="0.4"
    >
      <div className="container contact__grid">
        <div className="contact__copy">
          <Reveal className="kicker">
            <span>( 03 )</span> Contact
          </Reveal>
          <h2 className="contact__title robot-lit">
            <SplitLine text={CONTACT.title[0]} />
            <br />
            <SplitLine text={CONTACT.title[1]} className="serif" delay={0.1} />
          </h2>
          <Reveal as="p" className="section-lede" delay={0.1}>
            {CONTACT.sub}
          </Reveal>
          <Reveal className="contact__direct" delay={0.2}>
            <span>Prefer email?</span>
            <a href={`mailto:${SITE.email}`} onMouseEnter={sound.hover}>
              {SITE.email}
            </a>
          </Reveal>
          {/* The robot lands here at the end of the journey */}
          <div id="contact-dock" className="contact__dock" aria-hidden="true">
            <span className="contact__dock-ring" />
          </div>
        </div>

        <Reveal className="contact__panel glass" y={40}>
          {/* HIGGSFIELD: subtle texture behind the form (config/images.js → contactTexture) */}
          <div className="contact__texture" aria-hidden="true">
            <ImageSlot slot="contactTexture" />
          </div>
          <AnimatePresence mode="wait">
            {state === 'sent' ? (
              <motion.div
                key="sent"
                className="contact__sent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease }}
              >
                <span className="contact__sent-icon" aria-hidden="true" />
                <h3>Transmission received.</h3>
                <p>Thanks — we will be in touch within one business day.</p>
                <button className="btn btn--glass glass" onClick={() => setState('idle')}>
                  Send another
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                className="form"
                onSubmit={submit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="form__row">
                  <label className="field">
                    <span>Name</span>
                    <input name="name" required autoComplete="name" placeholder="Ada Lovelace" />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input name="email" type="email" required autoComplete="email" placeholder="ada@company.com" />
                  </label>
                </div>
                <label className="field">
                  <span>Company</span>
                  <input name="company" autoComplete="organization" placeholder="Company or project" />
                </label>
                <fieldset className="field">
                  <legend>What can we help with?</legend>
                  <div className="chips">
                    {SERVICES.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        className={`chip ${services.includes(s.title) ? 'is-on' : ''}`}
                        aria-pressed={services.includes(s.title)}
                        onClick={() => toggle(s.title)}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="field">
                  <legend>Budget</legend>
                  <div className="chips">
                    {CONTACT.budgets.map((b) => (
                      <button
                        type="button"
                        key={b}
                        className={`chip ${budget === b ? 'is-on' : ''}`}
                        aria-pressed={budget === b}
                        onClick={() => {
                          sound.click()
                          setBudget(b)
                        }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="field">
                  <span>Project</span>
                  <textarea name="message" rows={4} required placeholder="A few lines about your goals, timeline and what success looks like." />
                </label>
                <div className="form__foot">
                  <button type="submit" className="btn btn--dark" disabled={state === 'sending'} onMouseEnter={sound.hover}>
                    {state === 'sending' ? 'Sending…' : 'Start a project'}
                    <span className="btn__arrow" aria-hidden="true">→</span>
                  </button>
                  {state === 'error' ? (
                    <p className="form__error">
                      Something went wrong — email us at <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
                    </p>
                  ) : (
                    <p className="form__note">No spam. No sales scripts. Just a reply from a human.</p>
                  )}
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  )
}
