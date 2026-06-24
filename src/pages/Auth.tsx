import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../public.css'

const AUTH_POINTS = [
  'Match a 200-person guest list in minutes',
  'Ask AI who to meet — founders, engineers, investors',
  'Public data only, your list stays in your session',
]

export default function Auth() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const initialMode = pathname === '/signin' ? 'signin' : 'signup'
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')

  const isSignUp = mode === 'signup'

  function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    // No real auth — redirect to onboarding (which goes to app)
    navigate('/onboarding')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08090B', color: '#EDEFF2', fontFamily: "'Schibsted Grotesk', system-ui, sans-serif" }}>
      <div className="pub-auth-shell">
        {/* BRAND SIDE */}
        <div className="pub-auth-brand">
          <Link className="pub-logo" to="/">
            <div className="pub-logo-icon" style={{ width: 22, height: 22 }}><div className="pub-logo-dot" /></div>
            <div className="pub-logo-name" style={{ fontSize: 17 }}>Guest<span>Lens</span></div>
          </Link>
          <div>
            <div className="pub-auth-brand-headline">
              The fastest way to know who's in the room.
            </div>
            {AUTH_POINTS.map((p) => (
              <div key={p} className="pub-auth-point">
                <span className="pub-check">✓</span>
                <span className="pub-auth-point-text">{p}</span>
              </div>
            ))}
          </div>
          <div className="pub-auth-brand-footnote">Public search data only · No scraping</div>
        </div>

        {/* FORM SIDE */}
        <div className="pub-auth-form-side">
          <div className="pub-auth-form-wrap">
            <div className="pub-auth-tabs">
              <button
                className={`pub-auth-tab${mode === 'signin' ? ' active' : ''}`}
                onClick={() => setMode('signin')}
              >
                Sign in
              </button>
              <button
                className={`pub-auth-tab${mode === 'signup' ? ' active' : ''}`}
                onClick={() => setMode('signup')}
              >
                Sign up
              </button>
            </div>

            <h2 className="pub-auth-h2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="pub-auth-sub">
              {isSignUp
                ? 'Free to start — 50 enrichments a month, no card.'
                : 'Sign in to pick up where you left off.'}
            </p>

            {/* Google button — redirects straight to onboarding */}
            <button className="pub-auth-google-btn" onClick={() => navigate('/onboarding')}>
              <span className="pub-auth-google-g">G</span> Continue with Google
            </button>

            <div className="pub-auth-divider">
              <div className="pub-auth-divider-line" />
              <span className="pub-auth-divider-text">OR</span>
              <div className="pub-auth-divider-line" />
            </div>

            <form onSubmit={handleContinue}>
              <div className="pub-auth-field-label">Email</div>
              <input
                className="pub-auth-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              <button type="submit" className="pub-auth-submit">
                {isSignUp ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <p className="pub-auth-legal">
              {isSignUp ? 'No credit card required. ' : ''}
              By continuing you agree to only use guest lists you're allowed to access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
