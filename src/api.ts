import type { Attendee } from './guestParser'

export type AggregateEstimate = {
  men: number
  women: number
  unknown: number
  method: string
}

export type LinkedInProfile = {
  title: string
  url: string
  headline: string
  location: string
  company: string
  school: string
  role: string
  followers: string
  bio: string
  summary: string
  snippet: string
  description: string
  experienceSignal: string
  imageUrl: string
  previewLimited: boolean
}

export type LinkedInResult = {
  attendeeId: string
  query: string
  status: string
  profile: LinkedInProfile | null
}

export type EnrichStats = {
  guests: number
  profilesFound: number
  profilesMissing: number
  cacheHits: number
  cacheMisses: number
}

export type SearchStatus =
  | { ok: true }
  | {
      ok: false
      status: string
      message: string
      hint: string
      statusCode?: number
    }

export type EnrichResponse = {
  aggregate: AggregateEstimate
  linkedIn: LinkedInResult[]
  search: SearchStatus
  cache?: {
    hits: number
    misses: number
  }
  stats?: EnrichStats
}

export type AskResponse = {
  answer: string
  matches: Array<{
    id: string
    reason: string
  }>
  fromCache?: boolean
}

export async function enrichGuests(attendees: Attendee[], eventContext: string) {
  const response = await fetch('/api/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attendees: attendees.map(({ id, fullName, company, title, location }) => ({
        id,
        fullName,
        company,
        title,
        location,
      })),
      eventContext,
    }),
  })

  if (!response.ok) {
    if (response.status === 502) {
      throw new Error('The API server is not running. Start it with npm run dev or npm run dev:api.')
    }

    const payload = (await response.json().catch(() => null)) as { detail?: string; error?: string } | null
    throw new Error(payload?.detail || payload?.error || 'The enrichment service could not process this list.')
  }

  return (await response.json()) as EnrichResponse
}

export async function askPeople(
  question: string,
  people: Array<{
    id: string
    fullName: string
    sourceContext?: string
    profile: LinkedInResult['profile']
  }>,
) {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, people }),
  })

  if (!response.ok) {
    if (response.status === 502) {
      throw new Error('The API server is not running. Start it with npm run dev.')
    }

    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || 'The AI search could not run.')
  }

  return (await response.json()) as AskResponse
}
