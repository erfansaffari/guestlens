import { Link, useNavigate } from 'react-router-dom'
import '../public.css'

const FREE_FEATURES = [
  '50 enrichments / month',
  'Instant local + AI semantic search',
  'Full profile inspector & bios',
  'CSV export',
  'Aggregate room stats',
  'Lists up to 100 guests',
]

const PRO_FEATURES = [
  '500 enrichments / month',
  'Everything in Free',
  'Priority lookups (faster builds)',
  'Lists up to 250 guests',
  'Saved event lists (coming soon)',
  'Email support',
]

export default function Pricing() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#08090B', color: '#EDEFF2', fontFamily: "'Schibsted Grotesk', system-ui, sans-serif" }}>
      {/* NAV */}
      <nav className="pub-nav">
        <Link className="pub-logo" to="/">
          <div className="pub-logo-icon"><div className="pub-logo-dot" /></div>
          <div className="pub-logo-name">Guest<span>Lens</span></div>
        </Link>
        <div className="pub-nav-links">
          <Link className="pub-nav-link" to="/#how">How it works</Link>
          <Link className="pub-nav-link active" to="/pricing">Pricing</Link>
          <Link className="pub-nav-link" to="/#privacy">Privacy</Link>
          <div className="pub-nav-divider" />
          <Link className="pub-nav-signin" to="/signin">Sign in</Link>
          <Link className="pub-btn-cta" to="/signup">Get started</Link>
        </div>
      </nav>

      {/* PRICING CONTENT */}
      <div className="pub-pricing-wrap">
        <div className="pub-pricing-eyebrow">
          <span className="pub-eyebrow">// PLANS</span>
        </div>
        <h1 className="pub-pricing-h1">Usage-based, no surprises.</h1>
        <p className="pub-pricing-sub">
          Every guest you enrich counts once a month. Cached lookups are free. Pick a tier by how many events you run.
        </p>
        <div className="pub-pricing-notice">
          <div className="pub-pricing-pill">
            ◷ Final prices land at public launch — early accounts get founder pricing.
          </div>
        </div>

        <div className="pub-plans-grid">
          {/* FREE */}
          <div className="pub-plan-card">
            <div className="pub-plan-name">Free</div>
            <div className="pub-plan-price">
              <span className="pub-plan-price-num">$0</span>
              <span className="pub-plan-price-period">/ month</span>
            </div>
            <div className="pub-plan-quota"><strong>50</strong> enrichments / month</div>
            <Link className="pub-plan-btn free" to="/signup">Get started free</Link>
            {FREE_FEATURES.map((f) => (
              <div key={f} className="pub-plan-feature">
                <span className="pub-plan-feature-check">✓</span>
                <span className="pub-plan-feature-text">{f}</span>
              </div>
            ))}
          </div>

          {/* PRO */}
          <div className="pub-plan-card featured">
            <div className="pub-plan-badge">COMING SOON</div>
            <div className="pub-plan-name accent">Pro</div>
            <div className="pub-plan-price">
              <span className="pub-plan-price-num">TBD</span>
              <span className="pub-plan-price-period">founder pricing</span>
            </div>
            <div className="pub-plan-quota"><strong>500</strong> enrichments / month</div>
            <Link className="pub-plan-btn pro" to="/signup">Join the Pro waitlist</Link>
            {PRO_FEATURES.map((f) => (
              <div key={f} className="pub-plan-feature">
                <span className="pub-plan-feature-check">✓</span>
                <span className="pub-plan-feature-text">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pub-back-link">
          <button onClick={() => navigate('/')}>← Back to overview</button>
        </div>
      </div>
    </div>
  )
}
