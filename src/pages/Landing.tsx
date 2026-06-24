import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../public.css'

function avatarColors(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return { bg: `hsl(${h} 28% 19%)`, fg: `hsl(${h} 52% 74%)` }
}

const PEEK_ROWS = [
  { name: 'Andy Meng', sub: 'Founder & CEO @ Stealth · ex-Google', selected: true },
  { name: 'Anas Almasri', sub: 'Incoming @ MongoDB · ML → systems', selected: false },
  { name: 'Angela Chang', sub: 'Investor @ Accel · ex-Founder', selected: false },
]

const HOW_STEPS = [
  { n: '01', title: 'Drop in your guest list', desc: "Paste attendees from your event page or a CSV. It's organized in seconds — and nothing ever leaves your session." },
  { n: '02', title: 'Get the full picture', desc: 'GuestLens adds public professional context to every name, so a wall of strangers becomes a room you actually recognize.' },
  { n: '03', title: 'Find who to meet', desc: 'Filter as you type, or ask AI in plain language — "who\'s a founder?" Open a profile and walk over with something to say.' },
]

const PRIVACY_POINTS = [
  { t: 'Public information only', d: "Nothing private, nothing behind a login." },
  { t: 'Your list stays yours', d: "Guest lists live in your session — we don't store them." },
  { t: 'Aggregate, never individual', d: 'Room-level stats only — never a label on a person.' },
]

const FEATURES = [
  { icon: '◇', title: 'AI semantic search', desc: 'Ask "who works in AI" or "who\'s a founder" and Claude surfaces the matches with reasons.' },
  { icon: '⚡', title: 'Instant local filter', desc: 'Type and the directory narrows in real time across every field — zero latency, zero credits.' },
  { icon: '▤', title: 'Profile inspector', desc: 'Headline, company, school, followers and bio for any guest, right beside the list.' },
  { icon: '↧', title: 'CSV export', desc: 'Take the enriched directory with you for follow-ups, intros and CRM notes.' },
  { icon: '∑', title: 'Aggregate name estimate', desc: 'Room-level M / F / ? balance from first names. Counts only — never per person.' },
  { icon: '⟳', title: 'Cache-aware usage', desc: 'Repeat lookups come from cache, so your monthly enrichments stretch much further.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const howRef = useRef<HTMLDivElement>(null)
  const privacyRef = useRef<HTMLDivElement>(null)

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    const el = ref.current
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08090B', color: '#EDEFF2', fontFamily: "'Schibsted Grotesk', system-ui, sans-serif" }}>
      {/* NAV */}
      <nav className="pub-nav">
        <div className="pub-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="pub-logo-icon"><div className="pub-logo-dot" /></div>
          <div className="pub-logo-name">Guest<span>Lens</span></div>
        </div>
        <div className="pub-nav-links">
          <button className="pub-nav-link" onClick={() => scrollTo(howRef)}>How it works</button>
          <Link className="pub-nav-link" to="/pricing">Pricing</Link>
          <button className="pub-nav-link" onClick={() => scrollTo(privacyRef)}>Privacy</button>
          <div className="pub-nav-divider" />
          <Link className="pub-nav-signin" to="/signin">Sign in</Link>
          <Link className="pub-btn-cta" to="/signup">Get started</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="pub-hero">
        <div>
          <div className="pub-eyebrow">// NETWORKING INTELLIGENCE</div>
          <h1 className="pub-h1">
            Find the right people to meet —{' '}
            <span className="muted">before you walk in.</span>
          </h1>
          <p className="pub-lead">
            Paste an event's guest list. GuestLens matches each name to a likely LinkedIn profile from public search, then lets you filter instantly or ask AI who to talk to — founders, engineers, investors, whoever you need.
          </p>
          <div className="pub-hero-ctas">
            <Link className="pub-btn-hero" to="/signup">Get started — free</Link>
            <Link className="pub-btn-ghost-hero" to="/app">Try the live demo ↗</Link>
          </div>
          <div className="pub-trust-pill">
            <span className="pub-trust-dot" />
            Public search data only · No LinkedIn scraping · Your list never leaves the session
          </div>
        </div>

        {/* App peek */}
        <div className="pub-peek">
          <div className="pub-peek-stats">
            <div className="pub-peek-stat">
              <div className="pub-peek-stat-label">GUESTS</div>
              <div className="pub-peek-stat-value">13</div>
            </div>
            <div className="pub-peek-stat" style={{ flex: 1.2 }}>
              <div className="pub-peek-stat-label">LINKEDIN</div>
              <div className="pub-peek-stat-value">11 / 13</div>
            </div>
            <div className="pub-peek-stat" style={{ flex: 1.2 }}>
              <div className="pub-peek-stat-label">ESTIMATE</div>
              <div className="pub-peek-stat-value accent">8M·4F·1?</div>
            </div>
          </div>
          <div className="pub-peek-search">
            <div className="pub-peek-search-icon"><div className="pub-peek-search-dot" /></div>
            <div className="pub-peek-search-text">who works in AI…</div>
            <div className="pub-peek-ai-tag">ASK AI</div>
          </div>
          <div className="pub-peek-rows">
            {PEEK_ROWS.map((row) => {
              const c = avatarColors(row.name)
              const parts = row.name.split(' ')
              const initials = (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
              return (
                <div key={row.name} className={`pub-peek-row${row.selected ? ' selected' : ''}`}>
                  <div className="pub-peek-avatar" style={{ background: c.bg, color: c.fg }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pub-peek-name">{row.name}</div>
                    <div className="pub-peek-sub">{row.sub}</div>
                  </div>
                  <span className="pub-peek-found" />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* TRUST STRIP */}
      <div className="pub-trust-strip">
        <div className="pub-trust-label">BUILT FOR</div>
        <div className="pub-trust-list">
          <span>Meetup hosts</span>
          <span>Conference attendees</span>
          <span>Community managers</span>
          <span>Founders raising</span>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="pub-section-alt" ref={howRef}>
        <div className="pub-section">
          <div className="pub-eyebrow">// HOW IT WORKS</div>
          <h2 className="pub-h2">Three steps, about five minutes.</h2>
          <div className="pub-steps-grid">
            {HOW_STEPS.map((s) => (
              <div key={s.n} className="pub-step-card">
                <div className="pub-step-n">{s.n}</div>
                <div className="pub-step-title">{s.title}</div>
                <div className="pub-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRIVACY */}
      <div ref={privacyRef}>
        <div className="pub-section">
          <div className="pub-privacy-grid">
            <div className="pub-privacy-left">
              <div className="pub-eyebrow">// PRIVACY BY DESIGN</div>
              <h2 className="pub-h2">Privacy isn't a feature — it's the default.</h2>
              <p className="pub-privacy-desc">
                GuestLens only works with public, professional information, and only for lists you're allowed to use. We keep individuals private and insights aggregate.
              </p>
            </div>
            <div className="pub-privacy-points">
              {PRIVACY_POINTS.map((p) => (
                <div key={p.t} className="pub-privacy-card">
                  <span className="pub-check">✓</span>
                  <div>
                    <div className="pub-privacy-card-title">{p.t}</div>
                    <div className="pub-privacy-card-desc">{p.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div className="pub-section-alt">
        <div className="pub-section" style={{ paddingTop: 72 }}>
          <h2 className="pub-h2" style={{ marginBottom: 40 }}>Everything you need to work a room.</h2>
          <div className="pub-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="pub-feature-card">
                <div className="pub-feature-icon">{f.icon}</div>
                <div className="pub-feature-title">{f.title}</div>
                <div className="pub-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA BAND */}
      <div className="pub-cta-band">
        <div className="pub-cta-inner">
          <h2 className="pub-cta-h2">Walk in already knowing the room.</h2>
          <p className="pub-cta-sub">Free to start — 50 enrichments a month, no card required.</p>
          <div className="pub-cta-actions">
            <Link className="pub-btn-hero" to="/signup">Create free account</Link>
            <button className="pub-btn-outline" onClick={() => navigate('/pricing')}>See plans</button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="pub-footer">
        <div className="pub-footer-grid">
          <div>
            <div className="pub-logo" style={{ marginBottom: 14, cursor: 'default' }}>
              <div className="pub-logo-icon" style={{ width: 18, height: 18 }}><div className="pub-logo-dot" style={{ width: 5, height: 5 }} /></div>
              <div className="pub-logo-name" style={{ fontSize: 15 }}>Guest<span>Lens</span></div>
            </div>
            <div className="pub-footer-brand-desc">Networking intelligence from public search. Not affiliated with Luma or LinkedIn.</div>
          </div>
          <div>
            <div className="pub-footer-col-label">Product</div>
            <div className="pub-footer-links">
              <button className="pub-footer-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Overview</button>
              <Link className="pub-footer-link" to="/pricing">Pricing</Link>
              <Link className="pub-footer-link" to="/app">Launch app</Link>
            </div>
          </div>
          <div>
            <div className="pub-footer-col-label">Resources</div>
            <div className="pub-footer-links">
              <button className="pub-footer-link" onClick={() => scrollTo(howRef)}>How it works</button>
              <button className="pub-footer-link" onClick={() => scrollTo(privacyRef)}>Privacy</button>
            </div>
          </div>
          <div>
            <div className="pub-footer-col-label">Legal</div>
            <div className="pub-footer-links">
              <span className="pub-footer-link" style={{ cursor: 'default', color: '#565C64' }}>Privacy policy</span>
              <span className="pub-footer-link" style={{ cursor: 'default', color: '#565C64' }}>Terms of use</span>
              <span className="pub-footer-link" style={{ cursor: 'default', color: '#565C64' }}>Disclaimer</span>
            </div>
          </div>
        </div>
        <div className="pub-footer-copy">© 2026 GuestLens · Data from public search results.</div>
      </footer>
    </div>
  )
}
