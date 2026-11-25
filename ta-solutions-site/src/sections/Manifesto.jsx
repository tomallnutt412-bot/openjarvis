import { MANIFESTO } from '../config/site'
import { SplitLine, Reveal } from '../components/Reveal'

/**
 * Oversized type the robot flies *through*: it weaves across the lines
 * (data-robot="path" + data-weave) and the letters light up cyan
 * around it (.robot-lit uses the robot's screen position).
 */
export default function Manifesto() {
  return (
    <section
      className="manifesto"
      data-section="manifesto"
      data-robot="path"
      data-path="0.06,0.22,0.94,0.74"
      data-path-m="0.85,0.2,0.18,0.8"
      data-weave="1"
      data-pose="fly"
    >
      {/* The type pins in place while the robot flies through it over ~2 screens of scroll. */}
      <div className="manifesto__pin">
      <div className="container">
        <Reveal className="kicker">
          <span>( 00 )</span> Manifesto
        </Reveal>
        <h2 className="manifesto__type robot-lit">
          {MANIFESTO.map((line, i) => (
            <span className={`manifesto__line ${i % 2 ? 'is-indent' : ''}`} key={i}>
              <SplitLine text={line} delay={i * 0.08} />
            </span>
          ))}
        </h2>
        <Reveal className="manifesto__note" delay={0.2}>
          <p>
            AI is only impressive when it is useful. We pair senior strategy with hands-on engineering to put
            intelligent systems to work where they matter most: revenue, time and customer experience.
          </p>
        </Reveal>
      </div>
      </div>
    </section>
  )
}
