import { motion } from 'framer-motion'

const ease = [0.16, 1, 0.3, 1]

/** Fade/slide content in once when it enters the viewport. */
export function Reveal({ children, delay = 0, y = 28, as = 'div', className, ...rest }) {
  const M = motion[as]
  return (
    <M
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 1.1, ease, delay }}
      {...rest}
    >
      {children}
    </M>
  )
}

/**
 * Splits a line into words that rise in with a stagger.
 * The *wrapper* is observed (the words start clipped by their masks,
 * so observing them directly would never report as visible).
 */
export function SplitLine({ text, delay = 0, className = '' }) {
  const words = text.split(' ')
  return (
    <motion.span
      className={`split-line ${className}`}
      aria-label={text}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-5% 0px' }}
    >
      {words.map((w, i) => (
        <span className="split-word" key={i} aria-hidden="true">
          <motion.span
            variants={{ hidden: { y: '110%' }, show: { y: '0%' } }}
            transition={{ duration: 1.1, ease, delay: delay + i * 0.06 }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? '\u00a0' : ''}
        </span>
      ))}
    </motion.span>
  )
}

export { ease }
