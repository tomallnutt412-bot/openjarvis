import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ease } from './Reveal'

/** Short branded curtain while fonts + WebGL warm up. */
export default function Intro() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1300)
    return () => clearTimeout(t)
  }, [])
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(12px)' }}
          transition={{ duration: 0.9, ease }}
        >
          <motion.div
            className="intro__mark"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease }}
          >
            <span className="intro__egg" />
            <span className="intro__word">TA Solutions</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
