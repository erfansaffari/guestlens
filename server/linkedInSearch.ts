import { getLinkedInCache, getLinkedInImageCache, setLinkedInCache, setLinkedInImageCache } from './cache'
import { extractSearchContext } from './eventContext'
import {
  parseLinkedInProfile,
  pickBestLinkedInResult,
  type SerpOrganicResult,
} from './profileParser'

type Attendee = {
  id: string
  fullName: string
  company?: string
  title?: string
  location?: string
}

export type SearchProbeResult =
  | { ok: true; searchesLeft?: number }
  | {
      ok: false
      statusCode?: number
      status: string
      message: string
      hint: string
    }

export type LinkedInSearchResult = {
  attendeeId: string
  query: string
  profile: {
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
  } | null
  status: string
  fromCache?: boolean
}

type SerpSearchPayload = {
  error?: string
  search_metadata?: { status?: string }
  organic_results?: SerpOrganicResult[]
}

type SerpImageResult = {
  title?: string
  link?: string
  thumbnail?: string
  original?: string
}

type SerpImagesPayload = {
  error?: string
  search_metadata?: { status?: string }
  images_results?: SerpImageResult[]
}

type GoogleCseItem = {
  link?: string
  pagemap?: {
    cse_thumbnail?: Array<{ src?: string }>
    metatags?: Array<{
      'og:image'?: string
      'twitter:image'?: string
    }>
  }
}

type LinkedInProfile = NonNullable<LinkedInSearchResult['profile']>

type SerpAccountPayload = {
  error?: string
  plan_searches_left?: number
  total_searches_left?: number
}

function getSerpApiKey() {
  return process.env.SERPAPI_KEY?.trim() || ''
}

export function buildLinkedInQuery(attendee: Attendee, eventContext?: string) {
  const fragments = [`"${attendee.fullName}"`, 'site:linkedin.com/in']
  const searchContext = extractSearchContext(eventContext)

  if (attendee.company) fragments.push(`"${attendee.company}"`)
  if (attendee.title) fragments.push(`"${attendee.title}"`)

  if (attendee.location?.trim()) {
    fragments.push(`"${attendee.location.trim()}"`)
  } else {
    fragments.push(`"${searchContext || 'Canada'}"`)
  }

  return fragments.join(' ')
}

function getSerpErrorHint(message: string, statusCode?: number) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid api key') || normalized.includes('unauthorized')) {
    return 'Check SERPAPI_KEY in .env matches the key shown at serpapi.com/manage-api-key, then restart npm run dev.'
  }

  if (normalized.includes('run out of searches') || normalized.includes('quota') || normalized.includes('limit')) {
    return 'Your SerpAPI plan ran out of searches. Upgrade the plan or wait for the monthly reset at serpapi.com.'
  }

  if (statusCode === 401 || statusCode === 403) {
    return 'Verify SERPAPI_KEY in .env and that your SerpAPI account is active.'
  }

  return 'Verify SERPAPI_KEY in .env, then restart npm run dev.'
}

function parseSerpFailure(statusCode: number, body: string): Omit<Extract<SearchProbeResult, { ok: false }>, 'ok'> {
  let message = `SerpAPI returned HTTP ${statusCode}.`

  try {
    const parsed = JSON.parse(body) as SerpSearchPayload
    message = parsed.error || message
  } catch {
    if (body.trim()) message = body.trim()
  }

  return {
    statusCode,
    status: `search_error_${statusCode}`,
    message,
    hint: getSerpErrorHint(message, statusCode),
  }
}

function parseSerpPayload(payload: SerpSearchPayload): Omit<Extract<SearchProbeResult, { ok: false }>, 'ok'> | null {
  if (payload.error) {
    return {
      status: 'search_error',
      message: payload.error,
      hint: getSerpErrorHint(payload.error),
    }
  }

  if (payload.search_metadata?.status === 'Error') {
    return {
      status: 'search_error',
      message: 'SerpAPI reported an error for this search.',
      hint: 'Check your SerpAPI dashboard for account status and remaining searches.',
    }
  }

  return null
}

function profileFromOrganicResult(result: SerpOrganicResult, fullName: string) {
  return parseLinkedInProfile(result, fullName)
}

export function linkedInProfileSlug(url: string) {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return match?.[1]?.replace(/\/$/, '').toLowerCase() || ''
}

async function runSerpImageSearch(query: string, apiKey: string) {
  const params = new URLSearchParams({
    engine: 'google_images',
    q: query,
    api_key: apiKey,
    num: '5',
    hl: 'en',
  })

  const response = await fetch(`https://serpapi.com/search.json?${params}`)
  const body = await response.text()

  return { response, body }
}

async function fetchProfileImageViaGoogleCse(query: string) {
  const key = process.env.GOOGLE_API_KEY?.trim()
  const cx = process.env.GOOGLE_CSE_ID?.trim()
  if (!key || !cx) return ''

  try {
    const params = new URLSearchParams({ key, cx, q: query, num: '3' })
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`)
    if (!response.ok) return ''

    const payload = (await response.json()) as { items?: GoogleCseItem[] }
    const firstProfile = (payload.items || []).find((item) => item.link?.includes('linkedin.com/in'))
    const meta = firstProfile?.pagemap?.metatags?.[0]

    return (
      firstProfile?.pagemap?.cse_thumbnail?.[0]?.src ||
      meta?.['og:image'] ||
      meta?.['twitter:image'] ||
      ''
    )
  } catch {
    return ''
  }
}

async function fetchProfileImageViaGoogleImages(
  attendee: Attendee,
  linkedInUrl: string,
  query: string,
  apiKey: string,
) {
  const { response, body } = await runSerpImageSearch(query, apiKey)
  if (!response.ok) return ''

  const payload = JSON.parse(body) as SerpImagesPayload
  if (payload.error || payload.search_metadata?.status === 'Error') return ''

  const profileSlug = linkedInProfileSlug(linkedInUrl)
  const images = payload.images_results || []

  const matched = images.find((image) => {
    const link = image.link?.toLowerCase() || ''
    return profileSlug ? link.includes(profileSlug) : link.includes('linkedin.com/in')
  })

  const fallback = images.find((image) => image.link?.includes('linkedin.com/in'))
  const image = matched || fallback

  return image?.thumbnail || image?.original || ''
}

async function ensureProfileImage(
  profile: LinkedInProfile,
  attendee: Attendee,
  query: string,
  apiKey: string,
) {
  if (profile.imageUrl?.trim()) return profile

  const cachedImage = await getLinkedInImageCache(profile.url)
  if (cachedImage) {
    return { ...profile, imageUrl: cachedImage }
  }

  const cseImage = await fetchProfileImageViaGoogleCse(query)
  if (cseImage) {
    await setLinkedInImageCache(profile.url, cseImage)
    return { ...profile, imageUrl: cseImage }
  }

  const imageUrl = await fetchProfileImageViaGoogleImages(attendee, profile.url, query, apiKey)
  if (imageUrl) {
    await setLinkedInImageCache(profile.url, imageUrl)
    return { ...profile, imageUrl }
  }

  return profile
}

async function runSerpSearch(query: string, apiKey: string) {
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: apiKey,
    num: '5',
    hl: 'en',
  })

  const response = await fetch(`https://serpapi.com/search.json?${params}`)
  const body = await response.text()

  return { response, body }
}

export async function probeSearchAccess(): Promise<SearchProbeResult> {
  const apiKey = getSerpApiKey()

  if (!apiKey) {
    return {
      ok: false,
      status: 'missing_search_config',
      message: 'SerpAPI is not configured.',
      hint: 'Add SERPAPI_KEY to .env from serpapi.com/manage-api-key, then restart the API server.',
    }
  }

  try {
    const response = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(apiKey)}`)
    const body = await response.text()

    if (!response.ok) {
      return { ok: false, ...parseSerpFailure(response.status, body) }
    }

    const payload = JSON.parse(body) as SerpAccountPayload
    if (payload.error) {
      return {
        ok: false,
        status: 'search_error',
        message: payload.error,
        hint: getSerpErrorHint(payload.error),
      }
    }

    return {
      ok: true,
      searchesLeft: payload.total_searches_left ?? payload.plan_searches_left,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error.'
    return {
      ok: false,
      status: 'search_fetch_error',
      message,
      hint: 'Check your network connection and that the API server can reach serpapi.com.',
    }
  }
}

async function fetchLinkedInFromSerp(query: string, apiKey: string, attendee: Attendee) {
  const { response, body } = await runSerpSearch(query, apiKey)

  if (!response.ok) {
    return {
      profile: null,
      status: `search_error_${response.status}`,
    }
  }

  const payload = JSON.parse(body) as SerpSearchPayload
  if (parseSerpPayload(payload)) {
    return {
      profile: null,
      status: 'search_error',
    }
  }

  const bestProfile = pickBestLinkedInResult(payload.organic_results || [], attendee.fullName)

  if (!bestProfile) {
    return {
      profile: null,
      status: 'ok',
    }
  }

  const profile = await ensureProfileImage(
    profileFromOrganicResult(bestProfile, attendee.fullName),
    attendee,
    query,
    apiKey,
  )

  return {
    profile,
    status: 'ok',
  }
}

export async function searchLinkedInCandidate(
  attendee: Attendee,
  eventContext?: string,
): Promise<LinkedInSearchResult> {
  const query = buildLinkedInQuery(attendee, eventContext)
  const apiKey = getSerpApiKey()

  if (!apiKey || attendee.fullName.trim().split(/\s+/).length < 2) {
    return {
      attendeeId: attendee.id,
      query,
      profile: null,
      status: !apiKey ? 'missing_search_config' : 'needs_full_name',
    }
  }

  const cached = await getLinkedInCache(query)
  if (cached) {
    let profile = cached.profile

    if (profile?.url && !profile.imageUrl?.trim()) {
      profile = await ensureProfileImage(profile, attendee, query, apiKey)
      await setLinkedInCache(query, {
        profile,
        status: cached.status,
      })
    }

    return {
      attendeeId: attendee.id,
      query,
      profile,
      status: cached.status,
      fromCache: true,
    }
  }

  try {
    const result = await fetchLinkedInFromSerp(query, apiKey, attendee)

    await setLinkedInCache(query, {
      profile: result.profile,
      status: result.status,
    })

    return {
      attendeeId: attendee.id,
      query,
      profile: result.profile,
      status: result.status,
    }
  } catch {
    return {
      attendeeId: attendee.id,
      query,
      profile: null,
      status: 'search_fetch_error',
    }
  }
}

export async function enrichLinkedInCandidates(attendees: Attendee[], eventContext?: string) {
  const apiKey = getSerpApiKey()

  if (!apiKey) {
    const probe = await probeSearchAccess()
    return {
      search: probe,
      linkedIn: attendees.map((attendee) => ({
        attendeeId: attendee.id,
        query: buildLinkedInQuery(attendee, eventContext),
        profile: null,
        status: probe.status,
      })),
      cache: { hits: 0, misses: 0 },
      stats: {
        guests: attendees.length,
        profilesFound: 0,
        profilesMissing: attendees.length,
        cacheHits: 0,
        cacheMisses: 0,
      },
    }
  }

  let hits = 0
  let misses = 0

  const linkedIn = await Promise.all(
    attendees.map(async (attendee) => {
      const result = await searchLinkedInCandidate(attendee, eventContext)
      if (result.fromCache) hits += 1
      else misses += 1
      return result
    }),
  )

  if (hits > 0) {
    console.log(`[SerpAPI] cache: ${hits} hit(s), ${misses} new search(es)`)
  }

  return {
    search: { ok: true as const },
    linkedIn,
    cache: { hits, misses },
    stats: {
      guests: attendees.length,
      profilesFound: linkedIn.filter((entry) => entry.profile?.url).length,
      profilesMissing: linkedIn.filter((entry) => !entry.profile?.url).length,
      cacheHits: hits,
      cacheMisses: misses,
    },
  }
}

export async function logSearchStatusOnStartup() {
  const apiKey = getSerpApiKey()

  if (!apiKey) {
    console.warn('[SerpAPI] Not configured. Set SERPAPI_KEY in .env.')
    return
  }

  const probe = await probeSearchAccess()

  if (probe.ok) {
    const left = probe.searchesLeft
    console.log(
      `[SerpAPI] Ready${typeof left === 'number' ? ` (${left} searches left)` : ''}. LinkedIn cache: .cache/linkedin-search.json`,
    )
    return
  }

  console.error('[SerpAPI] Setup issue:', probe.message)
  console.error('[SerpAPI] Fix:', probe.hint)
}
