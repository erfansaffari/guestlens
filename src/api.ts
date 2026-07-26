import type { Attendee } from './guestParser'

export type Field = { value: string; source: string; confidence: 'high' | 'medium' | 'low' }
export type Candidate = { id: string; url: string; title: string; snippet: string; thumbnailUrl?: string; score: number; rank: number; evidence: Record<string, unknown>; fields: Record<string, Field> }
export type Person = { id: string; displayName: string; status: 'pending' | 'processing' | 'resolved' | 'ambiguous' | 'not_found' | 'failed' | 'budget_paused'; confidence: string | null; matchScore: number | null; linkedinUrl: string | null; profile: Record<string, Field | undefined>; userConfirmed: boolean; candidates: Candidate[] }
export type EventAttendee = { attendeeId: string; originalName: string; person: Person }
export type AttendeesResponse = { event: { id: string; name: string; context: string | null }; page: number; limit: number; total: number; attendees: EventAttendee[] }
export type Progress = { total: number; resolved: number; ambiguous: number; notFound: number; pending: number; failed: number; budgetPaused: number }
export type AskResponse = { answer: string; matches: Array<{ personId: string; reason: string }> }
export type DashboardSummary = { events: number; people: number; resolved: number; repeats: number }
export type EventSummary = { id: string; name: string; context: string | null; createdAt: string; updatedAt: string; people: number; resolved: number }
export type NetworkPerson = { identity_key: string; displayName: string; linkedinUrl: string | null; profile: Record<string, Field>; resolved: boolean; eventCount: number; events: Array<{ id: string; name: string }>; identityConfidence: 'high' | 'low' }

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) } })
  const body = await response.json().catch(() => ({})) as T & { error?: string; detail?: string }
  if (!response.ok) throw new Error(body.detail || body.error || 'Request failed.')
  return body
}

export function importEvent(token: string | null, eventName: string, attendees: Attendee[], eventContext?: string) {
  return request<{ eventId: string; total: number; cached: number; queued: number }>('/api/events/import', token, { method: 'POST', body: JSON.stringify({ eventName, eventContext, attendees: attendees.map((attendee) => ({ id: attendee.id, fullName: attendee.fullName })) }) })
}
export function getAttendees(token: string | null, eventId: string, page = 1) { return request<AttendeesResponse>(`/api/events/${eventId}/attendees?page=${page}&limit=50`, token) }
export function getProgress(token: string | null, eventId: string) { return request<Progress>(`/api/events/${eventId}/progress`, token) }
export function confirmPerson(token: string | null, personId: string, input: { candidateId?: string; linkedinUrl?: string }) { return request<{ ok: true; linkedinUrl: string }>(`/api/people/${personId}/confirm`, token, { method: 'POST', body: JSON.stringify(input) }) }
export function unresolvePerson(token: string | null, personId: string) { return request<{ ok: true }>(`/api/people/${personId}/unresolve`, token, { method: 'POST', body: '{}' }) }
export function enrichImage(token: string | null, personId: string) { return request<{ ok: true }>(`/api/people/${personId}/enrich-image`, token, { method: 'POST', body: '{}' }) }
export function refreshPerson(token: string | null, personId: string) { return request<{ ok: true }>(`/api/people/${personId}/refresh`, token, { method: 'POST', body: '{}' }) }
export function askEvent(token: string | null, eventId: string, question: string) { return request<AskResponse>(`/api/events/${eventId}/ask`, token, { method: 'POST', body: JSON.stringify({ question }) }) }
export function getDashboard(token: string | null) { return request<DashboardSummary>('/api/dashboard', token) }
export function getEvents(token: string | null) { return request<{ events: EventSummary[] }>('/api/events', token) }
export function getNetworkPeople(token: string | null, input: { query?: string; eventId?: string; status?: string; repeatsOnly?: boolean }) { const params = new URLSearchParams(); if (input.query) params.set('query', input.query); if (input.eventId) params.set('eventId', input.eventId); if (input.status) params.set('status', input.status); if (input.repeatsOnly) params.set('repeatsOnly', 'true'); return request<{ people: NetworkPerson[] }>(`/api/network/people?${params}`, token) }
