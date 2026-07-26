import { SignIn, SignUp } from '@clerk/react'
import { Link, useLocation } from 'react-router-dom'
import '../public.css'

const AUTH_POINTS = [
  'Match a 200-person guest list in minutes',
  'Ask AI who to meet — founders, engineers, investors',
  'Public data only, your list stays in your session',
]

export default function Auth() {
  const { pathname } = useLocation()
  const isSignUp = pathname.startsWith('/signup')

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
            <h2 className="pub-auth-h2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="pub-auth-sub">
              {isSignUp
                ? 'Free to start — 50 enrichments a month, no card.'
                : 'Sign in to pick up where you left off.'}
            </p>

            {isSignUp ? <SignUp routing="path" path="/signup" signInUrl="/signin" fallbackRedirectUrl="/app" /> : <SignIn routing="path" path="/signin" signUpUrl="/signup" fallbackRedirectUrl="/app" />}

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
