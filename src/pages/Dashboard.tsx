import { UserButton, useAuth } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard, getEvents, getNetworkPeople } from '../api'
import '../Panel.css'

export default function Dashboard() {
  const { getToken } = useAuth(); const navigate = useNavigate()
  const [query, setQuery] = useState(''); const [eventId, setEventId] = useState(''); const [status, setStatus] = useState(''); const [repeatsOnly, setRepeatsOnly] = useState(false)
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: async () => getDashboard(await getToken()) })
  const events = useQuery({ queryKey: ['events'], queryFn: async () => getEvents(await getToken()) })
  const networkInput = useMemo(() => ({ query, eventId, status, repeatsOnly }), [query, eventId, status, repeatsOnly])
  const network = useQuery({ queryKey: ['network', networkInput], queryFn: async () => getNetworkPeople(await getToken(), networkInput) })
  const stats = [['Events', summary.data?.events ?? 0], ['People in your network', summary.data?.people ?? 0], ['Profiles resolved', summary.data?.resolved ?? 0], ['Repeat people', summary.data?.repeats ?? 0]]
  return <main className="app-shell gl-dashboard">
    <header className="gl-header"><div className="gl-logo"><div className="gl-logo-icon"><div className="gl-logo-dot" /></div><div className="gl-logo-name">Guest<span>Lens</span></div><div className="gl-logo-tagline">// your event network</div></div><div className="gl-header-actions"><button className="gl-btn-ghost" onClick={() => navigate('/app/events/new')}>＋ New event</button><UserButton /></div></header>
    <section className="gl-stats">{stats.map(([label, value]) => <div className="gl-stat-cell" key={String(label)}><div className="gl-stat-label">{label}</div><div className="gl-stat-value">{value}</div></div>)}</section>
    <div className="gl-dashboard-grid">
      <section className="gl-dashboard-card gl-event-history"><div className="gl-panel-header"><div><div className="gl-panel-title">Event history</div><div className="gl-dashboard-subtitle">Your recent lookups</div></div><button className="gl-btn-ghost" onClick={() => navigate('/app/events/new')}>New event</button></div><div className="gl-history-list">{events.isLoading ? <div className="gl-dashboard-empty">Loading events…</div> : !events.data?.events.length ? <div className="gl-dashboard-empty">No events yet. Start by building your first network.</div> : events.data.events.map((event) => <button className="gl-history-row" key={event.id} onClick={() => navigate(`/app/events/${event.id}`)}><div><strong>{event.name}</strong><span>{event.context || 'Canada'} · {event.people} people · {event.resolved} resolved</span></div><span>Open →</span></button>)}</div></section>
      <section className="gl-dashboard-card gl-network-search"><div className="gl-panel-header"><div><div className="gl-panel-title">Your network</div><div className="gl-dashboard-subtitle">Search everyone across your events</div></div><div className="gl-panel-count">{network.data?.people.length ?? 0} shown</div></div>
        <div className="gl-network-controls"><input className="gl-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, company, school, role…" /><select className="gl-input" value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">All events</option>{events.data?.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><select className="gl-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="resolved">Resolved</option><option value="pending">Pending</option><option value="ambiguous">Needs review</option></select><label className="gl-repeat-filter"><input type="checkbox" checked={repeatsOnly} onChange={(event) => setRepeatsOnly(event.target.checked)} /> Repeat people only</label></div>
        <div className="gl-network-results">{network.isLoading ? <div className="gl-dashboard-empty">Searching your network…</div> : !network.data?.people.length ? <div className="gl-dashboard-empty">No people match these filters.</div> : network.data.people.map((person) => <article className="gl-network-row" key={person.identity_key}><div className="gl-network-avatar">{person.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="gl-network-copy"><strong>{person.displayName}</strong><span>{person.profile.headline?.value || person.profile.company?.value || (person.resolved ? 'Public profile resolved' : 'Profile pending')}</span><small>{person.eventCount > 1 ? `Seen in ${person.eventCount} events: ${person.events.map((event) => event.name).join(', ')}` : `Seen in ${person.events[0]?.name || '1 event'}`}{person.identityConfidence === 'low' ? ' · name-only match' : ''}</small></div>{person.linkedinUrl && <a className="gl-li-link" href={person.linkedinUrl} target="_blank" rel="noreferrer">↗</a>}</article>)}</div>
      </section>
    </div>
  </main>
}
