import { lazy, Suspense, useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { useCapabilities } from './hooks/useCapabilities'
import { useLenis } from './hooks/useLenis'
import { usePointer } from './hooks/usePointer'
import { useStore } from './lib/store'
import Nav from './components/Nav'
import Cursor from './components/Cursor'
import Hud from './components/Hud'
import Intro from './components/Intro'
import Hero from './sections/Hero'
import Manifesto from './sections/Manifesto'
import Services from './sections/Services'
import Approach from './sections/Approach'
import Contact from './sections/Contact'
import Footer from './sections/Footer'

// The 3D layer is code-split so the page paints before three.js downloads.
const Experience = lazy(() => import('./three/Experience'))

export default function App() {
  const caps = useCapabilities()
  useLenis(!caps.reduced)
  usePointer()

  // Track which section is centred (drives HUD copy).
  useEffect(() => {
    const setSection = useStore.getState().setSection
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSection(e.target.dataset.section)),
      { rootMargin: '-50% 0px -50% 0px' },
    )
    document.querySelectorAll('[data-section]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div className={`app tier-${caps.tier} ${caps.webgl ? 'has-webgl' : 'no-webgl'}`}>
        <div className="bg" aria-hidden="true">
          <div className="bg__orb bg__orb--a" />
          <div className="bg__orb bg__orb--b" />
          <div className="bg__grid" />
          <div className="bg__grain" />
        </div>

        <Intro />
        <Nav />
        <main>
          <Hero webgl={caps.webgl} />
          <Manifesto />
          <Services />
          <Approach />
          <Contact />
        </main>
        <Footer />
        {caps.webgl ? <Hud /> : null}
        <Cursor />

        {caps.webgl ? (
          <Suspense fallback={null}>
            <Experience caps={caps} />
          </Suspense>
        ) : null}
      </div>
    </MotionConfig>
  )
}
