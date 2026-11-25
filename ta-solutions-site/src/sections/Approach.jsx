import { APPROACH } from '../config/site'
import ImageSlot from '../components/ImageSlot'
import { Reveal, SplitLine } from '../components/Reveal'

export default function Approach() {
  return (
    <section
      id="approach"
      className="approach"
      data-section="approach"
      data-robot="path"
      data-path="0.86,0.28,0.84,0.72"
      data-path-m="0.82,0.18,0.8,0.3"
      data-z="-0.5"
      data-pose="think"
    >
      <div className="container approach__grid">
        <div className="approach__copy">
          <Reveal className="kicker">
            <span>( 02 )</span> Approach
          </Reveal>
          <h2 className="section-title robot-lit">
            <SplitLine text={APPROACH.title[0]} />
            <br />
            <SplitLine text={APPROACH.title[1]} className="serif" delay={0.1} />
          </h2>
          <Reveal as="p" className="section-lede" delay={0.1}>
            {APPROACH.intro}
          </Reveal>

          <ol className="steps">
            {APPROACH.steps.map((s, i) => (
              <Reveal as="li" className="step glass" key={s.k} delay={i * 0.08}>
                <span className="step__k">{s.k}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>

        <div className="approach__side">
          <Reveal className="approach__visual">
            {/* HIGGSFIELD: portrait visual (config/images.js → approachVisual) */}
            <ImageSlot slot="approachVisual" />
          </Reveal>
          <div className="stats">
            {APPROACH.stats.map((s, i) => (
              <Reveal className="stat glass" key={s.l} delay={i * 0.1}>
                <strong>
                  {s.v}
                  {s.u ? <small> {s.u}</small> : null}
                </strong>
                <span>{s.l}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
