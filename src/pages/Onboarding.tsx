import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../public.css'

const STEPS = [
  {
    eyebrow: 'STEP 1 / 3 · WELCOME',
    title: "You're in. Let's set expectations.",
    body: "A quick reminder before you start: only paste guest lists you're allowed to access — like your own event's Luma page. Here's your free allowance.",
    meter: true,
    search: false,
  },
  {
    eyebrow: 'STEP 2 / 3 · SEARCH',
    title: 'Two ways to find your people.',
    body: 'Filtering is instant and free. Asking AI costs nothing extra — it reuses the profiles you already built.',
    meter: false,
    search: true,
  },
  {
    eyebrow: 'STEP 3 / 3 · READY',
    title: 'Build your first network.',
    body: "We've loaded a sample Luma list so you can try it immediately. Paste your own any time — clearing the list wipes all results from the session.",
    meter: false,
    search: false,
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const cur = STEPS[step]
  const isLast = step === 2

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#08090B',
        color: '#EDEFF2',
        fontFamily: "'Schibsted Grotesk', system-ui, sans-serif",
      }}
    >
      <div className="pub-onb-shell">
        <div className="pub-onb-wrap">
          {/* Progress dots */}
          <div className="pub-onb-dots">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="pub-onb-dot"
                style={{
                  width: i === step ? 34 : 18,
                  background: i <= step ? 'var(--accent, #C9ED5B)' : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>

          <div className="pub-onb-card">
            <div className="pub-onb-eyebrow">{cur.eyebrow}</div>
            <h2 className="pub-onb-h2">{cur.title}</h2>
            <p className="pub-onb-body">{cur.body}</p>

            {/* Step 0: usage meter */}
            {cur.meter && (
              <div className="pub-onb-meter">
                <div className="pub-onb-meter-header">
                  <span className="pub-onb-meter-label">Free plan</span>
                  <span className="pub-onb-meter-count">0 / 50</span>
                </div>
                <div className="pub-onb-progress-track">
                  <div className="pub-onb-progress-fill" />
                </div>
                <div className="pub-onb-meter-note">
                  enrichments this month · resets in 30 days · cached lookups are free
                </div>
              </div>
            )}

            {/* Step 1: search explainer */}
            {cur.search && (
              <div className="pub-onb-search-grid">
                <div className="pub-onb-search-card">
                  <div className="pub-onb-search-label">TYPE TO FILTER</div>
                  <div className="pub-onb-search-text">
                    Instant local search across names, headlines, companies and schools. No credits used.
                  </div>
                </div>
                <div className="pub-onb-search-card ai">
                  <div className="pub-onb-search-label ai">↵ ASK AI</div>
                  <div className="pub-onb-search-text">
                    Ask in plain language — "who's a founder?" — and Claude finds the semantic matches.
                  </div>
                </div>
              </div>
            )}

            <div className="pub-onb-actions">
              {step > 0 && (
                <button className="pub-onb-back" onClick={() => setStep((s) => s - 1)}>
                  Back
                </button>
              )}
              {isLast ? (
                <Link className="pub-onb-next" to="/app">
                  Launch GuestLens →
                </Link>
              ) : (
                <button className="pub-onb-next" onClick={() => setStep((s) => s + 1)}>
                  {step === 0 ? 'Got it' : 'Continue'}
                </button>
              )}
            </div>
          </div>

          <div className="pub-onb-skip">
            <Link to="/app">Skip — take me to the app</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
