import { useEffect, useMemo, useState } from 'react'
import {
  askPeople,
  enrichGuests,
  type AskResponse,
  type EnrichResponse,
  type LinkedInResult,
} from './api'
import './Panel.css'
import { parseGuestList, sampleLumaGuestList, type Attendee } from './guestParser'

type RunState = 'idle' | 'loading' | 'complete' | 'error'
type AskState = 'idle' | 'loading' | 'complete' | 'error'

type Person = Attendee & {
  linkedIn?: LinkedInResult
}

type LocalMatch = {
  id: string
  reason: string
}

function avatarColors(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return {
    bg: `hsl(${h} 28% 19%)`,
    fg: `hsl(${h} 52% 74%)`,
    ring: `hsl(${h} 34% 30%)`,
  }
}

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function App() {
  const [guestText, setGuestText] = useState('')
  const [eventContext, setEventContext] = useState('')
  const [runState, setRunState] = useState<RunState>('idle')
  const [askState, setAskState] = useState<AskState>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<EnrichResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskResponse | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [askFocused, setAskFocused] = useState(false)

  useEffect(() => {
    const onResize = () => {
      const narrow = window.innerWidth < 1080
      setIsNarrow((prev) => {
        if (narrow !== prev) {
          if (!narrow) setDrawerOpen(false)
          return narrow
        }
        return prev
      })
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const attendees = useMemo(() => parseGuestList(guestText), [guestText])
  const linkedInById = useMemo(
    () => new Map(result?.linkedIn.map((item) => [item.attendeeId, item]) || []),
    [result],
  )

  const people = useMemo<Person[]>(() => {
    return attendees.map((attendee) => ({
      ...attendee,
      linkedIn: linkedInById.get(attendee.id),
    }))
  }, [attendees, linkedInById])

  const localMatches = useMemo(() => getLocalMatches(people, question), [people, question])
  const localMatchById = useMemo(
    () => new Map(localMatches.map((match) => [match.id, match])),
    [localMatches],
  )
  const aiMatchById = useMemo(
    () => new Map(answer?.matches.map((match) => [match.id, match]) || []),
    [answer],
  )

  const activeSearch = question.trim().length > 0

  const visiblePeople = useMemo(() => {
    if (!activeSearch) return people
    const orderedIds = new Set<string>()
    localMatches.forEach((match) => orderedIds.add(match.id))
    answer?.matches.forEach((match) => orderedIds.add(match.id))
    return people.filter((person) => orderedIds.has(person.id))
  }, [activeSearch, answer, localMatches, people])

  const selectedPerson = people.find((person) => person.id === selectedId)

  const built = runState === 'complete'
  const building = runState === 'loading'
  const linkedInUnavailable = Boolean(result && result.search && !result.search.ok)

  async function handleEnrich() {
    if (building || !attendees.length) return
    setRunState('loading')
    setError('')
    setAnswer(null)

    try {
      const response = await enrichGuests(attendees, eventContext)
      setResult(response)
      setRunState('complete')
      setSelectedId((current) => current || attendees[0]?.id || null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setRunState('error')
    }
  }

  async function handleAsk() {
    if (!question.trim() || !people.length || !result) return
    setAskState('loading')

    try {
      const response = await askPeople(
        question,
        people.map((person) => ({
          id: person.id,
          fullName: person.fullName,
          sourceContext: [person.company, person.title, person.location].filter(Boolean).join(' · '),
          profile: person.linkedIn?.profile || null,
        })),
      )
      setAnswer(response)
      setAskState('complete')
      setSelectedId(response.matches[0]?.id || selectedPerson?.id || visiblePeople[0]?.id || null)
    } catch {
      setAskState('idle')
    }
  }

  function handleQuestionChange(value: string) {
    setQuestion(value)
    setAnswer(null)
    setAskState('idle')
  }

  function selectPerson(id: string) {
    setSelectedId(id)
    if (isNarrow) setDrawerOpen(true)
  }

  function handleClear() {
    setGuestText('')
    setResult(null)
    setAnswer(null)
    setQuestion('')
    setSelectedId(null)
    setDrawerOpen(false)
    setRunState('idle')
  }

  function exportCsv() {
    const rows = [
      ['Name', 'Headline', 'Company', 'School', 'Location', 'Summary', 'LinkedIn'],
      ...people.map((person) => [
        person.fullName,
        profileTitle(person),
        person.linkedIn?.profile?.company || '',
        person.linkedIn?.profile?.school || '',
        person.linkedIn?.profile?.location || '',
        person.linkedIn?.profile?.bio || person.linkedIn?.profile?.summary || person.linkedIn?.profile?.description || '',
        person.linkedIn?.profile?.url || '',
      ]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'networking-people.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const stats = result ? buildStats(result, people, linkedInUnavailable) : []

  const countBadge = built
    ? activeSearch
      ? `${visiblePeople.length} shown`
      : `${people.length} shown${result?.cache && result.cache.hits > 0 ? ` · ${result.cache.hits} from cache` : ''}`
    : ''

  return (
    <main className="app-shell">
      {/* HEADER */}
      <header className="gl-header">
        <div className="gl-logo">
          <div className="gl-logo-icon">
            <div className="gl-logo-dot" />
          </div>
          <div className="gl-logo-name">
            Guest<span>Lens</span>
          </div>
          <div className="gl-logo-tagline">// find the right people to meet</div>
        </div>
        <div className="gl-header-actions">
          <button
            type="button"
            className="gl-btn-ghost"
            onClick={() => setGuestText(sampleLumaGuestList)}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent)' }}>↘</span>
            Luma sample
          </button>
          <button
            type="button"
            className="gl-btn-accent"
            onClick={handleEnrich}
            disabled={!attendees.length || building}
          >
            {building && <span className="gl-spinner-dark" />}
            {building ? 'Building…' : 'Build network'}
          </button>
        </div>
      </header>

      {/* STATS STRIP */}
      {built && stats.length > 0 && (
        <div className="gl-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="gl-stat-cell">
              <div className="gl-stat-label">{stat.label}</div>
              <div className={`gl-stat-value${stat.warn ? ' warn' : ''}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* MAIN THREE COLUMNS */}
      <div className="gl-main">
        {/* SOURCE PANEL */}
        <div className="gl-source">
          <div className="gl-panel-header">
            <div className="gl-panel-title">Source</div>
            <div className="gl-panel-count">{attendees.length} names</div>
          </div>

          <div className="gl-source-body">
            <div className="gl-field-label">Event context</div>
            <input
              className="gl-input"
              value={eventContext}
              onChange={(e) => setEventContext(e.target.value)}
              placeholder="Waterloo, ON (optional — defaults to Canada)"
            />

            <div className="gl-field-label gl-field-gap">Guest list</div>
            <div className="gl-textarea-wrap">
              <textarea
                className="gl-textarea"
                value={guestText}
                onChange={(e) => {
                  setGuestText(e.target.value)
                  setResult(null)
                  setAnswer(null)
                  setQuestion('')
                  setSelectedId(null)
                  setRunState('idle')
                }}
                placeholder="Paste the Luma guest list here..."
              />
            </div>

            {runState === 'error' && error && (
              <div className="gl-error-box">
                <span className="gl-error-icon">✕</span>
                <div className="gl-error-text">{error}</div>
              </div>
            )}

            {linkedInUnavailable && (
              <div className="gl-warning-box">
                <div className="gl-warning-title">
                  <span>⚠</span> LinkedIn lookup unavailable
                </div>
                <div className="gl-warning-text">
                  SerpAPI key missing or quota exhausted. Guests still parse from your paste, but profiles can't be enriched.
                </div>
              </div>
            )}
          </div>

          <div className="gl-source-actions">
            <button type="button" className="gl-btn-clear" onClick={handleClear}>
              ✕ Clear
            </button>
            <button
              type="button"
              className="gl-btn-action"
              onClick={exportCsv}
              disabled={!built}
            >
              ↧ Export CSV
            </button>
          </div>
        </div>

        {/* PEOPLE PANEL */}
        <div className="gl-people">
          <div className="gl-search-area">
            <div className={`gl-search-bar${askFocused ? ' focused' : ''}`}>
              <div className="gl-search-icon">
                <div className="gl-search-icon-dot" />
              </div>
              <input
                className="gl-search-input"
                value={question}
                onChange={(e) => handleQuestionChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAsk() }}
                onFocus={() => setAskFocused(true)}
                onBlur={() => setAskFocused(false)}
                disabled={!built}
                placeholder="Ask: who studies CS, who is a founder, who works in AI…  ·  type to filter"
              />
              <button
                type="button"
                className="gl-ask-btn"
                onClick={handleAsk}
                disabled={!built || !question.trim() || askState === 'loading'}
              >
                {askState === 'loading' && <span className="gl-ask-spinner" />}
                Ask AI
              </button>
            </div>
            <div className="gl-search-hint">
              type to filter instantly  ·  press ↵ or Ask AI for semantic matches
            </div>
          </div>

          {answer && (
            <div className="gl-ai-answer">
              <div className="gl-ai-answer-header">
                <span className="gl-ai-answer-label">◇ AI</span>
                {answer.matches.length > 0
                  ? `  ${answer.matches.length} AI suggested`
                  : '  No AI-only matches'}
              </div>
              <div className="gl-ai-answer-text">{answer.answer}</div>
            </div>
          )}

          <div className="gl-list-header">
            <div className="gl-list-title">{activeSearch ? 'Search results' : 'People'}</div>
            {countBadge && <div className="gl-list-count">{countBadge}</div>}
          </div>

          <div className="gl-list">
            {!attendees.length ? (
              <div className="gl-empty">
                <div className="gl-empty-icon-box">⌑</div>
                <div className="gl-empty-title">Paste a guest list to start.</div>
                <div className="gl-empty-text">
                  Drop in a Luma guest list, then hit{' '}
                  <strong>Build network</strong>. People appear here with photos, headlines and LinkedIn links — searchable as you type.
                </div>
              </div>
            ) : activeSearch && !visiblePeople.length ? (
              <div className="gl-empty gl-search-empty">
                <div className="gl-empty-title">No text matches for "{question}".</div>
                <div className="gl-empty-text" style={{ maxWidth: 280 }}>
                  Press ↵ to ask AI for semantic matches across the directory, or refine your filter.
                </div>
              </div>
            ) : (
              <div className="gl-list-inner">
                {visiblePeople.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    selected={person.id === selectedId}
                    matchReason={getMatchReason(person.id, localMatchById, aiMatchById)}
                    hasProfile={built && !linkedInUnavailable}
                    onSelect={() => selectPerson(person.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PROFILE INSPECTOR (desktop) */}
        {!isNarrow && (
          <div className="gl-profile-col">
            <ProfileInspector person={selectedPerson} built={built && !linkedInUnavailable} />
          </div>
        )}
      </div>

      {/* DRAWER (mobile) */}
      {drawerOpen && selectedPerson && (
        <div
          className="gl-drawer-backdrop"
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="gl-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedPerson.fullName} profile`}
            onClick={(e) => e.stopPropagation()}
          >
            <ProfileInspector
              person={selectedPerson}
              built={built && !linkedInUnavailable}
              showClose
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </main>
  )
}

/* ===================== PERSON ROW ===================== */
function PersonRow({
  person,
  selected,
  matchReason,
  hasProfile,
  onSelect,
}: {
  person: Person
  selected: boolean
  matchReason?: string
  hasProfile: boolean
  onSelect: () => void
}) {
  const profile = person.linkedIn?.profile
  const found = hasProfile && Boolean(profile?.url)
  const colors = avatarColors(person.fullName)
  const subtitle = found
    ? profile?.headline || profile?.company || 'Profile found'
    : 'Profile pending'

  return (
    <div
      role="button"
      tabIndex={0}
      className={`gl-person-row${selected ? ' selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() }
      }}
      aria-label={`Open ${person.fullName} profile`}
    >
      <AvatarSmall name={person.fullName} imageUrl={profile?.imageUrl} colors={colors} />

      <div className="gl-person-info">
        <div className="gl-person-name">{person.fullName}</div>
        <div className="gl-person-subtitle">{subtitle}</div>
        {matchReason && <div className="gl-badge">{matchReason}</div>}
      </div>

      <div className="gl-person-end">
        {found
          ? <span className="gl-status-found" title="LinkedIn found" />
          : <span className="gl-status-pending" title="Profile pending" />
        }
        <a
          href={profile?.url || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(person.fullName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="gl-li-link"
          title="LinkedIn"
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      </div>
    </div>
  )
}

/**
 * Only trust images served directly from LinkedIn's CDN.
 * Google-proxied thumbnails (encrypted-tbn0.gstatic.com, etc.) can be
 * a liked post photo or an unrelated person's image — never display those.
 */
function isLinkedInCdnImage(url?: string): boolean {
  if (!url?.trim()) return false
  try {
    const { hostname } = new URL(url)
    return hostname === 'media.licdn.com' || hostname.endsWith('.licdn.com')
  } catch {
    return false
  }
}

/* ===================== AVATAR (small) ===================== */
function AvatarSmall({
  name,
  imageUrl,
  colors,
}: {
  name: string
  imageUrl?: string
  colors: { bg: string; fg: string; ring: string }
}) {
  const [broken, setBroken] = useState(false)
  const initials = getInitials(name)
  const showImage = isLinkedInCdnImage(imageUrl) && !broken

  if (showImage) {
    return (
      <div className="gl-avatar" style={{ background: colors.bg, boxShadow: `0 0 0 1px ${colors.ring} inset` }}>
        <img src={imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </div>
    )
  }

  return (
    <div
      className="gl-avatar"
      style={{ background: colors.bg, color: colors.fg, boxShadow: `0 0 0 1px ${colors.ring} inset` }}
    >
      {initials}
    </div>
  )
}

/* ===================== AVATAR (large) ===================== */
function AvatarLarge({
  name,
  imageUrl,
  colors,
}: {
  name: string
  imageUrl?: string
  colors: { bg: string; fg: string; ring: string }
}) {
  const [broken, setBroken] = useState(false)
  const initials = getInitials(name)
  const showImage = isLinkedInCdnImage(imageUrl) && !broken

  if (showImage) {
    return (
      <div className="gl-avatar-lg" style={{ background: colors.bg, boxShadow: `0 0 0 1px ${colors.ring} inset` }}>
        <img src={imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </div>
    )
  }

  return (
    <div
      className="gl-avatar-lg"
      style={{ background: colors.bg, color: colors.fg, boxShadow: `0 0 0 1px ${colors.ring} inset` }}
    >
      {initials}
    </div>
  )
}

/* ===================== PROFILE INSPECTOR ===================== */
function ProfileInspector({
  person,
  built,
  showClose,
  onClose,
}: {
  person?: Person
  built: boolean
  showClose?: boolean
  onClose?: () => void
}) {
  if (!person) {
    return (
      <div className="gl-inspector">
        {showClose && (
          <div className="gl-inspector-close-row">
            <button type="button" className="gl-btn-close" onClick={onClose}>✕</button>
          </div>
        )}
        <div className="gl-inspector-empty">
          <div className="gl-inspector-empty-icon">
            <div className="gl-inspector-empty-icon-dot" />
          </div>
          <div className="gl-inspector-empty-title">No profile selected</div>
          <div className="gl-inspector-empty-text">
            Build the network, then open a person from the list to inspect their profile.
          </div>
        </div>
      </div>
    )
  }

  const profile = person.linkedIn?.profile
  const found = built && Boolean(profile?.url)
  const colors = avatarColors(person.fullName)
  const headline = profileTitle(person)
  const bio = profile?.bio || profile?.summary || profile?.description || profile?.snippet || ''

  const metaRows: { label: string; value: string }[] = []
  if (found) {
    if (profile?.location) metaRows.push({ label: 'Location', value: profile.location })
    if (profile?.company) metaRows.push({ label: 'Company', value: profile.company })
    if (profile?.school) metaRows.push({ label: 'School', value: profile.school })
    if (profile?.role) metaRows.push({ label: 'Role', value: profile.role })
    if (profile?.followers) metaRows.push({ label: 'Followers', value: profile.followers + ' followers' })
  }

  const guestParts = [person.company, person.title, person.location].filter(Boolean)

  return (
    <div className="gl-inspector">
      {showClose && (
        <div className="gl-inspector-close-row">
          <button type="button" className="gl-btn-close" onClick={onClose}>✕</button>
        </div>
      )}

      <div className="gl-inspector-body">
        {/* Hero */}
        <div className="gl-inspector-hero">
          <AvatarLarge name={person.fullName} imageUrl={profile?.imageUrl} colors={colors} />
          <div className="gl-inspector-hero-info">
            <div className="gl-inspector-name">{person.fullName}</div>
            {found && headline && headline !== 'Profile pending' && (
              <div className="gl-inspector-headline">{headline}</div>
            )}
            {!found && (
              <div className="gl-pending-badge">
                <span className="gl-pending-dot" />
                PROFILE PENDING
              </div>
            )}
          </div>
        </div>

        {/* Meta rows */}
        {metaRows.length > 0 && (
          <div className="gl-inspector-meta">
            {metaRows.map((row) => (
              <div key={row.label}>
                <div className="gl-meta-label">{row.label}</div>
                <div className="gl-meta-value">{row.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* LinkedIn button */}
        {found && profile?.url && (
          <a
            className="gl-li-btn"
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open LinkedIn <span style={{ fontSize: 13 }}>↗</span>
          </a>
        )}

        {/* Preview limited notice */}
        {found && profile?.previewLimited && (
          <div className="gl-preview-notice">
            <span className="gl-preview-icon">◷</span>
            <div className="gl-preview-text">
              Preview limited — Google returned a partial snippet. The full LinkedIn bio wasn't available from search.
            </div>
          </div>
        )}

        {/* Bio */}
        {found && (
          <div className="gl-bio-section">
            <div className="gl-section-label">Bio</div>
            {bio
              ? <div className="gl-bio-text">{bio}</div>
              : <div className="gl-bio-empty">No public LinkedIn bio found from search results.</div>
            }
          </div>
        )}

        {/* From guest list */}
        {guestParts.length > 0 && (
          <div className="gl-guest-section">
            <div className="gl-section-label">From guest list</div>
            <div className="gl-guest-text">{guestParts.join('   ·   ')}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ===================== HELPERS ===================== */
function profileTitle(person: Person) {
  const raw =
    person.linkedIn?.profile?.headline ||
    person.linkedIn?.profile?.title ||
    person.title ||
    person.company ||
    'Profile pending'
  return raw.replace(/\s*-\s*LinkedIn\s*$/i, '').replace(/\s*\|\s*LinkedIn\s*$/i, '')
}

function buildStats(
  result: EnrichResponse,
  people: Person[],
  linkedInUnavailable: boolean,
) {
  const stats = result.stats
  const profilesFound = linkedInUnavailable
    ? 0
    : (stats?.profilesFound ?? result.linkedIn.filter((e) => e.profile?.url).length)
  const total = stats?.guests ?? result.linkedIn.length
  const cacheHits = stats?.cacheHits ?? result.cache?.hits ?? 0
  const cacheMisses = stats?.cacheMisses ?? result.cache?.misses ?? 0
  const { aggregate } = result

  const m = aggregate?.men ?? people.filter((p) => {
    const n = p.fullName.split(' ')[0]?.toLowerCase() || ''
    return maleFirstNames.has(n)
  }).length
  const f = aggregate?.women ?? people.filter((p) => {
    const n = p.fullName.split(' ')[0]?.toLowerCase() || ''
    return femaleFirstNames.has(n)
  }).length
  const u = aggregate?.unknown ?? (total - m - f)

  return [
    { label: 'Guests', value: String(total), warn: false },
    {
      label: 'LinkedIn found',
      value: `${profilesFound} / ${total}`,
      warn: linkedInUnavailable || profilesFound === 0,
    },
    {
      label: 'Serp cache',
      value: linkedInUnavailable
        ? 'unavailable'
        : cacheHits > 0
          ? `${cacheHits} hit · ${cacheMisses} new`
          : `${cacheMisses} searched`,
      warn: linkedInUnavailable,
    },
    { label: 'Name estimate', value: `${m}M · ${f}F · ${u}?`, warn: false },
  ]
}

const maleFirstNames = new Set([
  'james','john','robert','michael','william','david','richard','charles',
  'joseph','thomas','christopher','daniel','paul','mark','donald','george',
  'kenneth','steven','edward','brian','ronald','anthony','kevin','jason',
  'matthew','gary','timothy','jose','larry','jeffrey','frank','scott',
  'eric','stephen','andrew','raymond','gregory','joshua','jerry','dennis',
  'ryan','patrick','peter','samuel','jack','liam','noah','oliver','elijah',
  'amir','aman','ammar','anas','andres','andrew','andy','alex',
])

const femaleFirstNames = new Set([
  'mary','patricia','linda','barbara','elizabeth','jennifer','maria','susan',
  'margaret','dorothy','lisa','nancy','karen','betty','helen','sandra',
  'donna','carol','ruth','sharon','michelle','laura','sarah','kimberly',
  'deborah','jessica','shirley','cynthia','angela','melissa','brenda',
  'amy','anna','rebecca','virginia','kathleen','pamela','martha','debra',
  'amanda','stephanie','carolyn','emma','olivia','ava','isabella','sophia',
  'mia','charlotte','amelia','ana','anastasiia','angela',
])

function getLocalMatches(people: Person[], query: string): LocalMatch[] {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean)
  if (!tokens.length) return []

  return people
    .map((person) => {
      const fields = personSearchFields(person)
      const searchable = fields.map((f) => f.normalized).join(' ')
      const matched = tokens.every((token) => searchable.includes(token))
      if (!matched) return null

      const strongestField =
        fields.find((f) => tokens.some((token) => f.normalized.includes(token)))?.label ||
        'profile context'

      return { id: person.id, reason: `match · ${strongestField}` }
    })
    .filter((m): m is LocalMatch => Boolean(m))
}

function getMatchReason(
  personId: string,
  localMatchById: Map<string, LocalMatch>,
  aiMatchById: Map<string, { id: string; reason: string }>,
) {
  const local = localMatchById.get(personId)
  if (local) return local.reason

  const ai = aiMatchById.get(personId)
  if (ai) return `AI · ${ai.reason}`

  return undefined
}

function personSearchFields(person: Person) {
  const profile = person.linkedIn?.profile
  return [
    { label: 'name', value: person.fullName },
    { label: 'source context', value: [person.company, person.title, person.location].filter(Boolean).join(' ') },
    { label: 'headline', value: profileTitle(person) },
    { label: 'company', value: profile?.company || '' },
    { label: 'school', value: profile?.school || '' },
    { label: 'location', value: profile?.location || '' },
    { label: 'role', value: profile?.role || '' },
    { label: 'bio', value: profile?.bio || profile?.summary || profile?.description || profile?.snippet || '' },
    { label: 'experience', value: profile?.experienceSignal || '' },
  ].map((field) => ({ ...field, normalized: normalizeSearchText(field.value) }))
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export default App
