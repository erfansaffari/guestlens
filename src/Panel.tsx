import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserButton, useAuth } from '@clerk/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { askEvent, confirmPerson, enrichImage, getAttendees, getProgress, importEvent, refreshPerson, unresolvePerson, type EventAttendee, type Person } from './api'
import { parseGuestList, sampleLumaGuestList } from './guestParser'
import './Panel.css'

const SEARCH_FIELDS = ['headline', 'company', 'school', 'location', 'role', 'followers', 'bio', 'snippet'] as const

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?'
}

function Avatar({ person, large = false }: { person: Person; large?: boolean }) {
  const image = person.profile.image?.value
  const className = large ? 'gl-avatar-lg' : 'gl-avatar'
  return <div className={className} style={!image ? { background: '#263024', color: 'var(--accent)' } : undefined}>
    {image ? <img src={image} alt={`${person.displayName}'s public profile`} referrerPolicy="no-referrer" /> : initials(person.displayName)}
  </div>
}

function statusText(status: Person['status']) {
  return status === 'not_found' ? 'No public profile found' : status.replace('_', ' ')
}

function textMatch(person: Person, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return null
  if (person.displayName.toLowerCase().includes(q)) return 'name'
  return SEARCH_FIELDS.find((field) => person.profile[field]?.value.toLowerCase().includes(q)) || null
}

function downloadCsv(attendees: EventAttendee[]) {
  const headers = ['Name', 'Headline', 'Company', 'School', 'Location', 'Summary', 'LinkedIn URL']
  const escape = (value?: string | null) => `"${(value || '').replaceAll('"', '""')}"`
  const rows = attendees.map(({ person }) => [person.displayName, person.profile.headline?.value, person.profile.company?.value, person.profile.school?.value, person.profile.location?.value, person.profile.bio?.value || person.profile.snippet?.value, person.linkedinUrl].map(escape).join(','))
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }))
  link.download = 'guestlens-network.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1079px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1079px)')
    const update = () => setNarrow(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
}

function Inspector({ attendee, getToken, refresh, onClose }: { attendee: EventAttendee | null; getToken: () => Promise<string | null>; refresh: () => void; onClose?: () => void }) {
  const [manualUrl, setManualUrl] = useState('')
  const image = useMutation({ mutationFn: async (personId: string) => enrichImage(await getToken(), personId), onSuccess: refresh })
  const profileRefresh = useMutation({ mutationFn: async (personId: string) => refreshPerson(await getToken(), personId), onSuccess: refresh })
  const confirm = useMutation({ mutationFn: async ({ personId, candidateId, linkedinUrl }: { personId: string; candidateId?: string; linkedinUrl?: string }) => confirmPerson(await getToken(), personId, { candidateId, linkedinUrl }), onSuccess: refresh })
  const unresolve = useMutation({ mutationFn: async (personId: string) => unresolvePerson(await getToken(), personId), onSuccess: refresh })
  useEffect(() => {
    if (attendee?.person.linkedinUrl && !attendee.person.profile.image?.value) image.mutate(attendee.person.id)
  // Lazy image lookup is intentionally attached to opening an inspector.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendee?.person.id])

  if (!attendee) return <aside className="gl-inspector"><div className="gl-inspector-empty"><div className="gl-inspector-empty-icon"><span className="gl-inspector-empty-icon-dot" /></div><div className="gl-inspector-empty-title">No profile selected</div><div className="gl-inspector-empty-text">Build the network, then open a person profile from the list.</div></div></aside>
  const person = attendee.person
  const fields = [['Location', person.profile.location?.value], ['Company', person.profile.company?.value], ['School', person.profile.school?.value], ['Role', person.profile.role?.value], ['Followers', person.profile.followers?.value]]
  const limited = person.profile.previewLimited?.value === 'true'
  return <aside className="gl-inspector">
    {onClose && <div className="gl-inspector-close-row"><button className="gl-btn-close" onClick={onClose} aria-label="Close profile">×</button></div>}
    <div className="gl-inspector-body">
      <div className="gl-inspector-hero"><Avatar person={person} large /><div className="gl-inspector-hero-info"><div className="gl-inspector-name">{person.displayName}</div>{person.profile.headline?.value && <div className="gl-inspector-headline">{person.profile.headline.value}</div>}<div className="gl-pending-badge"><span className="gl-pending-dot" />{statusText(person.status)}</div></div></div>
      {fields.some(([, value]) => value) && <div className="gl-inspector-meta">{fields.filter(([, value]) => value).map(([label, value]) => <div key={label}><div className="gl-meta-label">{label}</div><div className="gl-meta-value">{value}</div></div>)}</div>}
      {person.linkedinUrl && <a className="gl-li-btn" href={person.linkedinUrl} target="_blank" rel="noreferrer">↗ Open LinkedIn</a>}
      {limited && <div className="gl-preview-notice"><span className="gl-preview-icon">⚠</span><div className="gl-preview-text">Google returned a limited public preview, so the bio may be incomplete.</div></div>}
      <div className="gl-bio-section"><div className="gl-section-label">Public profile preview</div><div className={person.profile.bio?.value ? 'gl-bio-text' : 'gl-bio-empty'}>{person.profile.bio?.value || person.profile.snippet?.value || 'No public profile details are available yet.'}</div></div>
      <div className="gl-profile-actions"><button className="gl-btn-action" onClick={() => profileRefresh.mutate(person.id)} disabled={profileRefresh.isPending}>↻ {profileRefresh.isPending ? 'Refreshing…' : 'Refresh public data'}</button>{person.linkedinUrl && !person.profile.image?.value && <button className="gl-btn-action" onClick={() => image.mutate(person.id)} disabled={image.isPending}>Find image</button>}</div>
      {person.status === 'ambiguous' && <div className="gl-resolution"><div className="gl-section-label">Possible matches</div>{person.candidates.map((candidate) => <div className="gl-candidate" key={candidate.id}><div><a href={candidate.url} target="_blank" rel="noreferrer">{candidate.fields.headline?.value || candidate.title}</a><p>{candidate.snippet}</p><small>{candidate.score}/100 · {Object.entries(candidate.evidence).filter(([, value]) => value === true).map(([key]) => key.replace('Matched', '')).join(', ')}</small></div><button onClick={() => confirm.mutate({ personId: person.id, candidateId: candidate.id })}>Confirm</button></div>)}</div>}
      {!person.userConfirmed && <form className="gl-manual-confirm" onSubmit={(event) => { event.preventDefault(); confirm.mutate({ personId: person.id, linkedinUrl: manualUrl }) }}><input value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="Paste canonical LinkedIn URL" /><button disabled={!manualUrl || confirm.isPending}>Confirm URL</button></form>}
      <button className="gl-unresolve" onClick={() => unresolve.mutate(person.id)} disabled={unresolve.isPending}>Mark unresolved</button>
      {(confirm.error || unresolve.error || profileRefresh.error) && <p className="gl-error-text">{(confirm.error || unresolve.error || profileRefresh.error)?.message}</p>}
    </div>
  </aside>
}

function Dashboard() {
  const { getToken } = useAuth()
  const navigate = useNavigate(); const { eventId: routeEventId } = useParams()
  const client = useQueryClient()
  const narrow = useNarrowScreen()
  const [guestText, setGuestText] = useState('')
  const [eventContext, setEventContext] = useState('')
  const [eventId, setEventId] = useState<string | null>(routeEventId || null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; matches: Map<string, string> } | null>(null)
  const [error, setError] = useState('')
  const attendees = useMemo(() => parseGuestList(guestText), [guestText])
  const attendeeQuery = useQuery({ queryKey: ['attendees', eventId], queryFn: async () => getAttendees(await getToken(), eventId!), enabled: Boolean(eventId), refetchInterval: eventId ? 12_000 : false })
  const progressQuery = useQuery({ queryKey: ['progress', eventId], queryFn: async () => getProgress(await getToken(), eventId!), enabled: Boolean(eventId), refetchInterval: eventId ? 5_000 : false })
  const refresh = useCallback(() => { void client.invalidateQueries({ queryKey: ['attendees', eventId] }); void client.invalidateQueries({ queryKey: ['progress', eventId] }) }, [client, eventId])
  useEffect(() => { if (!eventId) return; const stream = new EventSource(`/api/events/${eventId}/stream`); stream.addEventListener('person.updated', refresh); return () => stream.close() }, [eventId, refresh])
  useEffect(() => { setEventId(routeEventId || null); setSelectedId(null) }, [routeEventId])
  useEffect(() => { if (!routeEventId || !attendeeQuery.data) return; setEventContext(attendeeQuery.data.event.context || ''); setGuestText(attendeeQuery.data.attendees.map((attendee) => attendee.originalName).join('\n')) }, [routeEventId, attendeeQuery.data])
  const importer = useMutation({ mutationFn: async () => importEvent(await getToken(), eventContext.trim() || 'Untitled event', attendees, eventContext), onSuccess: (result) => { setEventId(result.eventId); navigate(`/app/events/${result.eventId}`); setSelectedId(null); setError('') }, onError: (caught) => setError(caught.message) })
  const ask = useMutation({ mutationFn: async () => askEvent(await getToken(), eventId!, query), onSuccess: (result) => setAiAnswer({ answer: result.answer, matches: new Map(result.matches.map((match) => [match.personId, match.reason])) }), onError: (caught) => setError(caught.message) })
  const current = attendeeQuery.data?.attendees || []
  const shown = current.filter(({ person }) => { const local = textMatch(person, query); return !query.trim() || Boolean(local) || Boolean(aiAnswer?.matches.has(person.id)) })
  const selected = current.find(({ person }) => person.id === selectedId) || null
  const progress = progressQuery.data
  const stats = eventId ? [['Guests', String(progress?.total ?? current.length)], ['Profiles confirmed', String(progress?.resolved ?? 0)], ['Processing', String(progress?.pending ?? 0)], ['Needs review', String((progress?.ambiguous ?? 0) + (progress?.failed ?? 0) + (progress?.budgetPaused ?? 0))]] : []
  const clear = () => { setGuestText(''); setEventContext(''); setEventId(null); setSelectedId(null); setQuery(''); setAiAnswer(null); setError(''); navigate('/app/events/new') }
  return <main className="app-shell">
    <header className="gl-header"><div className="gl-logo"><div className="gl-logo-icon"><div className="gl-logo-dot" /></div><div className="gl-logo-name">Guest<span>Lens</span></div><div className="gl-logo-tagline">// event workspace</div></div><div className="gl-header-actions"><button className="gl-btn-ghost" onClick={() => navigate('/app')}>← Dashboard</button><button className="gl-btn-ghost" onClick={() => setGuestText(sampleLumaGuestList)}>↘ Luma sample</button><button className="gl-btn-accent" disabled={!attendees.length || importer.isPending} onClick={() => importer.mutate()}>{importer.isPending ? 'Building…' : 'Build network'}</button><UserButton /></div></header>
    {stats.length > 0 && <section className="gl-stats">{stats.map(([label, value]) => <div className="gl-stat-cell" key={label}><div className="gl-stat-label">{label}</div><div className="gl-stat-value">{value}</div></div>)}</section>}
    <div className="gl-main">
      <aside className="gl-source"><div className="gl-panel-header"><div className="gl-panel-title">Source</div><div className="gl-panel-count">{attendees.length} names</div></div><div className="gl-source-body"><label className="gl-field-label">Event context</label><input className="gl-input" value={eventContext} onChange={(event) => setEventContext(event.target.value)} placeholder="Waterloo, ON (optional — defaults to Canada)" /><label className="gl-field-label gl-field-gap">Guest list</label><div className="gl-textarea-wrap"><textarea className="gl-textarea" value={guestText} onChange={(event) => { setGuestText(event.target.value); setAiAnswer(null) }} placeholder="Paste the Luma guest list here..." /></div>{error && <div className="gl-error-box"><span className="gl-error-icon">×</span><div className="gl-error-text">{error}</div></div>}</div><div className="gl-source-actions"><button className="gl-btn-clear" onClick={clear}>× Clear</button><button className="gl-btn-action" disabled={!eventId || !current.length} onClick={() => downloadCsv(current)}>↧ Export CSV</button></div></aside>
      <section className="gl-people"><div className="gl-search-area"><div className="gl-search-bar"><div className="gl-search-icon"><div className="gl-search-icon-dot" /></div><input className="gl-search-input" value={query} onChange={(event) => { setQuery(event.target.value); setAiAnswer(null) }} onKeyDown={(event) => { if (event.key === 'Enter' && eventId && query.trim()) ask.mutate() }} disabled={!eventId} placeholder="Ask: who studies CS, who is a founder, who works in AI…  ·  type to filter" /><button className="gl-ask-btn" disabled={!eventId || !query.trim() || ask.isPending} onClick={() => ask.mutate()}>{ask.isPending && <span className="gl-ask-spinner" />}Ask AI</button></div><div className="gl-search-hint">type to filter instantly · press ↵ or Ask AI for semantic matches</div></div>
        {aiAnswer && <div className="gl-ai-answer"><div className="gl-ai-answer-header"><span className="gl-ai-answer-label">◇ AI</span>{aiAnswer.matches.size ? `${aiAnswer.matches.size} AI suggested` : 'No AI-only matches'}</div><div className="gl-ai-answer-text">{aiAnswer.answer}</div></div>}
        <div className="gl-list-header"><div className="gl-list-title">{query.trim() ? 'Search results' : 'People'}</div><div className="gl-list-count">{eventId ? `${shown.length} shown` : 'Paste a guest list'}</div></div>
        <div className="gl-list">{attendeeQuery.isLoading ? <div className="gl-list-inner">{Array.from({ length: 6 }, (_, index) => <div className="gl-skeleton" key={index} />)}</div> : !eventId ? <div className="gl-empty"><div className="gl-empty-icon-box">⌑</div><div className="gl-empty-title">Paste a guest list to start.</div><div className="gl-empty-text">Drop in a Luma guest list, then hit <strong>Build network</strong>. People appear here with photos, headlines and LinkedIn links.</div></div> : !shown.length ? <div className="gl-empty gl-search-empty"><div className="gl-empty-title">No text matches for “{query}”.</div><div className="gl-empty-text">Press ↵ to ask AI across the directory, or refine your filter.</div></div> : <div className="gl-list-inner">{shown.map((attendee) => { const local = textMatch(attendee.person, query); const aiReason = aiAnswer?.matches.get(attendee.person.id); return <button className={`gl-person-row${selectedId === attendee.person.id ? ' selected' : ''}`} key={attendee.attendeeId} onClick={() => setSelectedId(attendee.person.id)}><Avatar person={attendee.person} /><div className="gl-person-info"><div className="gl-person-name">{attendee.person.displayName}</div><div className="gl-person-subtitle">{attendee.person.profile.headline?.value || attendee.person.profile.company?.value || (attendee.person.status === 'pending' ? 'Searching public sources…' : statusText(attendee.person.status))}</div>{(aiReason || local) && <div className="gl-badge">{aiReason ? `AI · ${aiReason}` : `match · ${local}`}</div>}</div><div className="gl-person-end">{attendee.person.status === 'resolved' ? <span className="gl-status-found" title="Profile found" /> : <span className="gl-status-pending" title={statusText(attendee.person.status)} />}{attendee.person.linkedinUrl && <a className="gl-li-link" href={attendee.person.linkedinUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`Open ${attendee.person.displayName} on LinkedIn`}>↗</a>}</div></button> })}</div>}</div>
      </section>
      <aside className="gl-profile-col"><Inspector attendee={selected} getToken={getToken} refresh={refresh} /></aside>
    </div>
    {narrow && selected && <div className="gl-drawer-backdrop" onClick={() => setSelectedId(null)}><div className="gl-drawer" onClick={(event) => event.stopPropagation()}><Inspector attendee={selected} getToken={getToken} refresh={refresh} onClose={() => setSelectedId(null)} /></div></div>}
  </main>
}

export default function Panel() {
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) return <main className="gl-route-loading">Set VITE_CLERK_PUBLISHABLE_KEY to enable GuestLens.</main>
  return <Dashboard />
}
