import {
  AlertCircle,
  ArrowUpRight,
  Brain,
  Download,
  FileSearch,
  Link2,
  Loader2,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import {
  askPeople,
  enrichGuests,
  type AskResponse,
  type EnrichResponse,
  type LinkedInResult,
} from './api'
import './App.css'
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

function App() {
  const [guestText, setGuestText] = useState('')
  const [eventContext, setEventContext] = useState('')
  const [runState, setRunState] = useState<RunState>('idle')
  const [askState, setAskState] = useState<AskState>('idle')
  const [error, setError] = useState('')
  const [askError, setAskError] = useState('')
  const [result, setResult] = useState<EnrichResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskResponse | null>(null)
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false)

  const attendees = useMemo(() => parseGuestList(guestText), [guestText])
  const linkedInById = useMemo(() => {
    return new Map(result?.linkedIn.map((item) => [item.attendeeId, item]) || [])
  }, [result])

  const people = useMemo<Person[]>(() => {
    return attendees.map((attendee) => ({
      ...attendee,
      linkedIn: linkedInById.get(attendee.id),
    }))
  }, [attendees, linkedInById])

  const localMatches = useMemo(() => getLocalMatches(people, question), [people, question])
  const localMatchById = useMemo(() => new Map(localMatches.map((match) => [match.id, match])), [localMatches])
  const aiMatchById = useMemo(() => new Map(answer?.matches.map((match) => [match.id, match]) || []), [answer])
  const activeSearch = question.trim().length > 0
  const visiblePeople = useMemo(() => {
    if (!activeSearch) return people

    const orderedIds = new Set<string>()
    localMatches.forEach((match) => orderedIds.add(match.id))
    answer?.matches.forEach((match) => orderedIds.add(match.id))

    return people.filter((person) => orderedIds.has(person.id))
  }, [activeSearch, answer, localMatches, people])
  const selectedPerson =
    people.find((person) => person.id === selectedId)

  async function handleEnrich() {
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
    setAskError('')

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
    } catch (caught) {
      setAskError(caught instanceof Error ? caught.message : 'AI search failed.')
      setAskState('error')
    }
  }

  function handleQuestionChange(value: string) {
    setQuestion(value)
    setAnswer(null)
    setAskError('')
    setAskState('idle')
  }

  function selectPerson(id: string) {
    setSelectedId(id)
    setProfileDrawerOpen(true)
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

  return (
    <main className="app-shell">
      <div className="liquid-bg" aria-hidden="true" />

      <motion.header
        className="app-header glass-panel"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div>
          <p className="brand">GuestLens</p>
          <h1>Find the right people to meet.</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost-button" onClick={() => setGuestText(sampleLumaGuestList)}>
            <FileSearch size={18} />
            Luma sample
          </button>
          <button type="button" className="primary-button" onClick={handleEnrich} disabled={!attendees.length || runState === 'loading'}>
            {runState === 'loading' ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            Build network
          </button>
        </div>
      </motion.header>

      {result && (
        <motion.section
          className="stats-bar glass-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <EnrichStatsBar result={result} />
        </motion.section>
      )}

      <section className="network-layout">
        <motion.aside
          className="source-panel glass-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
        >
          <PanelTitle title="Source" count={`${attendees.length} names`} />
          <label className="field">
            Event context
            <input
              value={eventContext}
              onChange={(event) => setEventContext(event.target.value)}
              placeholder="Waterloo, ON (optional — defaults to Canada)"
            />
          </label>
          <label className="field stretch">
            Guest list
            <textarea
              value={guestText}
              onChange={(event) => {
                setGuestText(event.target.value)
                setResult(null)
                setAnswer(null)
                setQuestion('')
                setSelectedId(null)
              }}
              placeholder="Paste the Luma guest list here..."
            />
          </label>
          <div className="source-actions">
            <button type="button" className="ghost-button" onClick={() => setGuestText('')}>
              <X size={16} />
              Clear
            </button>
            <button type="button" className="ghost-button" onClick={exportCsv} disabled={!result}>
              <Download size={16} />
              Export
            </button>
          </div>
          {runState === 'error' && <ErrorMessage message={error} />}
          {result?.search && !result.search.ok && (
            <WarningMessage
              title="LinkedIn lookup unavailable"
              message={result.search.message}
              hint={result.search.hint}
            />
          )}
        </motion.aside>

        <motion.section
          className="people-panel glass-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.14, ease: 'easeOut' }}
        >
          <div className="ai-search">
            <Brain size={20} />
            <input
              value={question}
              onChange={(event) => handleQuestionChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAsk()
              }}
              placeholder="Ask: who studies computer science, who is a founder, who works in AI..."
            />
            <button
              type="button"
              className="primary-button icon-button"
              onClick={handleAsk}
              disabled={!result || !question.trim() || askState === 'loading'}
              aria-label="Search people"
            >
              {askState === 'loading' ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            </button>
          </div>

          {askState === 'error' && <ErrorMessage message={askError} />}
          {answer && (
            <div className="ai-answer">
              <strong>{answer.matches.length ? `${answer.matches.length} AI suggested` : 'No AI-only matches'}</strong>
              <span>{answer.answer}</span>
            </div>
          )}

          <PanelTitle
            title={activeSearch ? 'Search results' : 'People'}
            count={
              result?.cache && result.cache.hits > 0
                ? `${visiblePeople.length} shown · ${result.cache.hits} from cache`
                : `${visiblePeople.length} shown`
            }
          />

          {!attendees.length ? (
            <EmptyState />
          ) : activeSearch && !visiblePeople.length ? (
            <NoSearchResults query={question} canAskAi={Boolean(result)} />
          ) : (
            <div className="people-list">
              {visiblePeople.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  selected={person.id === selectedPerson?.id}
                  matchReason={getMatchReason(person.id, localMatchById, aiMatchById)}
                  onSelect={() => selectPerson(person.id)}
                />
              ))}
            </div>
          )}
        </motion.section>

        <motion.aside
          className="profile-panel glass-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2, ease: 'easeOut' }}
        >
          <ProfileInspector person={selectedPerson} />
        </motion.aside>
      </section>

      {profileDrawerOpen && selectedPerson && (
        <div className="profile-drawer-backdrop" role="presentation" onClick={() => setProfileDrawerOpen(false)}>
          <aside className="profile-drawer glass-panel" role="dialog" aria-modal="true" aria-label={`${selectedPerson.fullName} profile`} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="ghost-button drawer-close" onClick={() => setProfileDrawerOpen(false)} aria-label="Close profile">
              <X size={17} />
            </button>
            <ProfileInspector person={selectedPerson} />
          </aside>
        </div>
      )}
    </main>
  )
}

function EnrichStatsBar({ result }: { result: EnrichResponse }) {
  const stats = result.stats
  const profilesFound = stats?.profilesFound ?? result.linkedIn.filter((entry) => entry.profile?.url).length
  const profilesMissing = stats?.profilesMissing ?? result.linkedIn.length - profilesFound
  const cacheHits = stats?.cacheHits ?? result.cache?.hits ?? 0
  const cacheMisses = stats?.cacheMisses ?? result.cache?.misses ?? 0
  const { aggregate } = result

  return (
    <div className="stats-grid">
      <StatCard label="Guests" value={String(stats?.guests ?? result.linkedIn.length)} />
      <StatCard label="LinkedIn found" value={`${profilesFound} / ${profilesFound + profilesMissing}`} />
      <StatCard label="Serp cache" value={cacheHits > 0 ? `${cacheHits} hit · ${cacheMisses} new` : `${cacheMisses} searched`} />
      <StatCard
        label="Name estimate"
        value={`${aggregate.men}M · ${aggregate.women}F · ${aggregate.unknown}?`}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PanelTitle({ title, count }: { title: string; count: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <span>{count}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-directory">
      <Search size={26} />
      <h2>Paste a guest list to start.</h2>
      <p>After you build the network, people appear here with profile photos, titles, LinkedIn links, and searchable context.</p>
    </div>
  )
}

function NoSearchResults({ query, canAskAi }: { query: string; canAskAi: boolean }) {
  return (
    <div className="empty-directory">
      <Search size={26} />
      <h2>No text matches for “{query}”.</h2>
      <p>{canAskAi ? 'Press the search button or Enter to ask AI for related people.' : 'Build the network first to enable AI suggestions.'}</p>
    </div>
  )
}

function PersonCard({
  person,
  selected,
  matchReason,
  onSelect,
}: {
  person: Person
  selected: boolean
  matchReason?: string
  onSelect: () => void
}) {
  const profile = person.linkedIn?.profile

  return (
    <article
      className={`person-card ${selected ? 'selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      aria-label={`Open ${person.fullName} profile`}
    >
      <ProfileImage name={person.fullName} imageUrl={profile?.imageUrl} />
      <div className="person-main">
        <div>
          <h3>{person.fullName}</h3>
          <p>{profileTitle(person)}</p>
        </div>
        {matchReason && <span className="match-reason">{matchReason}</span>}
      </div>
      <div className="person-actions">
        {profile?.url && (
          <a href={profile.url} target="_blank" rel="noreferrer" aria-label={`${person.fullName} LinkedIn`} onClick={(event) => event.stopPropagation()}>
            <Link2 size={16} />
          </a>
        )}
      </div>
    </article>
  )
}

function ProfileInspector({ person }: { person?: Person }) {
  if (!person) {
    return (
      <div className="profile-empty">
        <UserRound size={28} />
        <h2>No profile selected</h2>
        <p>Build the network, then open a person profile from the list.</p>
      </div>
    )
  }

  const profile = person.linkedIn?.profile
  const meta = [
    { label: 'Location', value: profile?.location },
    { label: 'Company', value: profile?.company },
    { label: 'School', value: profile?.school },
    { label: 'Role', value: profile?.role },
    { label: 'Followers', value: profile?.followers },
  ].filter((item) => Boolean(item.value?.trim()))

  const bio = profile?.bio || profile?.summary || profile?.description || profile?.snippet || ''
  const sourceContext = [person.company, person.title, person.location].filter(Boolean).join(' · ')

  return (
    <div className="profile-detail">
      <div className="profile-hero">
        <ProfileImage name={person.fullName} imageUrl={profile?.imageUrl} />
        <div className="profile-hero-copy">
          <h2>{person.fullName}</h2>
          {profileTitle(person) !== 'Profile pending' && (
            <p className="profile-headline">{profileTitle(person)}</p>
          )}
          {meta.length > 0 && (
            <div className="profile-meta">
              {meta.map((item) => (
                <div key={item.label} className="profile-meta-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {profile?.url && (
        <a className="linkedin-link" href={profile.url} target="_blank" rel="noreferrer">
          Open LinkedIn
          <ArrowUpRight size={15} />
        </a>
      )}

      {bio ? (
        <section className="profile-bio">
          <span>Bio</span>
          {profile?.previewLimited && (
            <p className="profile-preview-note">
              Google only returned a short search preview for this profile, not the full LinkedIn bio.
            </p>
          )}
          <p>{bio}</p>
        </section>
      ) : (
        <section className="profile-bio empty">
          <span>Bio</span>
          <p>No public LinkedIn bio found from search results.</p>
        </section>
      )}

      {sourceContext && (
        <section className="profile-source-context">
          <span>From guest list</span>
          <p>{sourceContext}</p>
        </section>
      )}
    </div>
  )
}

function ProfileImage({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const [broken, setBroken] = useState(false)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const validImage = imageUrl?.trim()

  if (validImage && !broken) {
    return (
      <img
        className="profile-image"
        src={validImage}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }

  return <span className="profile-image fallback">{initials || '?'}</span>
}

function profileTitle(person: Person) {
  const raw =
    person.linkedIn?.profile?.headline ||
    person.linkedIn?.profile?.title ||
    person.title ||
    person.company ||
    'Profile pending'
  return raw.replace(/\s*-\s*LinkedIn\s*$/i, '').replace(/\s*\|\s*LinkedIn\s*$/i, '')
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="error-box">
      <AlertCircle size={18} />
      {message}
    </div>
  )
}

function WarningMessage({ title, message, hint }: { title: string; message: string; hint: string }) {
  return (
    <div className="warning-box">
      <AlertCircle size={18} />
      <div className="warning-copy">
        <strong>{title}</strong>
        <span>{message}</span>
        <span>{hint}</span>
      </div>
    </div>
  )
}

function getLocalMatches(people: Person[], query: string): LocalMatch[] {
  const tokens = normalizeSearchText(query)
    .split(' ')
    .filter(Boolean)

  if (!tokens.length) return []

  return people
    .map((person) => {
      const fields = personSearchFields(person)
      const searchable = fields.map((field) => field.normalized).join(' ')
      const matched = tokens.every((token) => searchable.includes(token))

      if (!matched) return null

      const strongestField =
        fields.find((field) => tokens.some((token) => field.normalized.includes(token)))?.label || 'profile context'

      return {
        id: person.id,
        reason: `Text match in ${strongestField}`,
      }
    })
    .filter((match): match is LocalMatch => Boolean(match))
}

function getMatchReason(
  personId: string,
  localMatchById: Map<string, LocalMatch>,
  aiMatchById: Map<string, { id: string; reason: string }>,
) {
  const local = localMatchById.get(personId)
  if (local) return local.reason

  const ai = aiMatchById.get(personId)
  if (ai) return `AI suggested: ${ai.reason}`

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
  ].map((field) => ({
    ...field,
    normalized: normalizeSearchText(field.value),
  }))
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
