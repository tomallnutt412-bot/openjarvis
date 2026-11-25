import { SITE } from '../config/site'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <strong>
            TA <em>Solutions</em>
          </strong>
          <span>Intelligence, engineered.</span>
        </div>
        <div className="footer__meta">
          <span>{SITE.location}</span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </div>
        <nav className="footer__social" aria-label="Social">
          {SITE.socials.map((s) => (
            <a key={s.label} href={s.href}>
              {s.label}
            </a>
          ))}
        </nav>
        <small className="footer__legal">© {new Date().getFullYear()} {SITE.name}. All rights reserved.</small>
      </div>
    </footer>
  )
}
