import dotenv from 'dotenv'
import { Worker } from 'bullmq'
import { and, eq, gt } from 'drizzle-orm'
import { db } from './db'
import { rankCandidates, resolutionFor, linkedInQueries, canonicalLinkedInUrl } from './matching'
import { searchProvider } from './providers'
import { type EnrichmentJob, publishEvent } from './queue'
import { redis } from './redis'
import { nameResolutions, people, profileCache, searchAttempts, searchCandidates, searchQueryCache } from './schema'

dotenv.config({ override: true })
const ttl = (days: number) => new Date(Date.now() + days * 86_400_000)

async function withinBudget() {
  const day = Number(process.env.SEARCH_DAILY_BUDGET || 0)
  const month = Number(process.env.SEARCH_MONTHLY_BUDGET || 0)
  const now = new Date()
  const [daily, monthly] = await Promise.all([
    redis().get(`guestlens:budget:${now.toISOString().slice(0, 10)}`),
    redis().get(`guestlens:budget:${now.toISOString().slice(0, 7)}`),
  ])
  return (!day || Number(daily || 0) < day) && (!month || Number(monthly || 0) < month)
}
async function recordSpend() {
  const now = new Date(); const dailyKey = `guestlens:budget:${now.toISOString().slice(0, 10)}`; const monthlyKey = `guestlens:budget:${now.toISOString().slice(0, 7)}`
  await Promise.all([redis().incr(dailyKey), redis().expire(dailyKey, 172_800), redis().incr(monthlyKey), redis().expire(monthlyKey, 5_443_200)])
}

async function rememberAttempt(input: { personId: string; eventId: string; query: string; provider: string; requestType: string; status: string; count?: number; duration: number; cacheHit?: boolean }) {
  await db().insert(searchAttempts).values({ personId: input.personId, eventId: input.eventId, query: input.query, provider: input.provider, requestType: input.requestType, status: input.status, resultCount: input.count || 0, durationMs: input.duration, cacheHit: Boolean(input.cacheHit) })
}

async function resolve(job: EnrichmentJob) {
  const database = db()
  const person = await database.query.people.findFirst({ where: eq(people.id, job.personId) })
  if (!person || (person.userConfirmed && job.type !== 'refresh-profile')) return
  if (!person.normalisedName.split(' ').filter(Boolean).slice(1).length) {
    await database.update(people).set({ status: 'ambiguous', updatedAt: new Date() }).where(eq(people.id, person.id))
    return
  }
  if (!await withinBudget()) {
    await database.update(people).set({ status: 'budget_paused', updatedAt: new Date() }).where(eq(people.id, person.id))
    await publishEvent(job.eventId, { type: 'person.updated', personId: person.id, status: 'budget_paused' })
    return
  }
  const provider = searchProvider()
  let candidates = [] as ReturnType<typeof rankCandidates>
  for (const query of linkedInQueries(person.displayName)) {
    const started = Date.now()
    const cached = await database.query.searchQueryCache.findFirst({ where: and(eq(searchQueryCache.query, query), gt(searchQueryCache.expiresAt, new Date())) })
    try {
      const results = cached ? cached.result as Parameters<typeof rankCandidates>[0] : await provider.searchWeb({ query, limit: Number(process.env.SEARCH_MAX_RESULTS || 5) })
      if (!cached) await recordSpend()
      await rememberAttempt({ personId: person.id, eventId: job.eventId, query, provider: provider.name, requestType: 'web', status: 'success', count: results.length, duration: Date.now() - started, cacheHit: Boolean(cached) })
      if (!cached) await database.insert(searchQueryCache).values({ query, provider: provider.name, result: results, status: 'success', expiresAt: ttl(90), updatedAt: new Date() }).onConflictDoUpdate({ target: searchQueryCache.query, set: { result: results, status: 'success', expiresAt: ttl(90), updatedAt: new Date() } })
      candidates = rankCandidates(results, person.displayName)
      if (resolutionFor(candidates).selected || candidates.some((candidate) => candidate.score >= 60)) break
    } catch (error) {
      await rememberAttempt({ personId: person.id, eventId: job.eventId, query, provider: provider.name, requestType: 'web', status: 'failed', duration: Date.now() - started })
      await database.insert(searchQueryCache).values({ query, provider: provider.name, result: [], status: 'failed', expiresAt: new Date(Date.now() + 300_000), updatedAt: new Date() }).onConflictDoUpdate({ target: searchQueryCache.query, set: { result: [], status: 'failed', expiresAt: new Date(Date.now() + 300_000), updatedAt: new Date() } })
      if (query === linkedInQueries(person.displayName).at(-1)) throw error
    }
  }
  await database.delete(searchCandidates).where(eq(searchCandidates.personId, person.id))
  if (candidates.length) await database.insert(searchCandidates).values(candidates.map((candidate) => ({ personId: person.id, url: candidate.url, title: candidate.title, snippet: candidate.snippet, thumbnailUrl: candidate.thumbnailUrl, score: candidate.score, rank: candidate.rank, evidence: candidate.evidence, fields: candidate.fields, updatedAt: new Date() })))
  const resolution = resolutionFor(candidates)
  const selected = resolution.selected
  const profile = selected ? selected.fields : {}
  await database.update(people).set({ status: resolution.status, confidence: resolution.confidence, matchScore: selected?.score ?? candidates[0]?.score ?? null, linkedinUrl: selected?.url ?? null, linkedinSlug: selected ? selected.url.split('/').at(-1) : null, profile, searchProvider: provider.name, lastSearchedAt: new Date(), updatedAt: new Date() }).where(eq(people.id, person.id))
  if (selected) {
    await database.insert(profileCache).values({ linkedinUrl: selected.url, profile, expiresAt: ttl(180), updatedAt: new Date() }).onConflictDoUpdate({ target: profileCache.linkedinUrl, set: { profile, expiresAt: ttl(180), updatedAt: new Date() } })
    await database.insert(nameResolutions).values({ lookupKey: `${person.normalisedName}:canada`, normalisedName: person.normalisedName, linkedinUrl: selected.url, confidence: 'high', expiresAt: ttl(180), updatedAt: new Date() }).onConflictDoUpdate({ target: nameResolutions.lookupKey, set: { linkedinUrl: selected.url, confidence: 'high', expiresAt: ttl(180), updatedAt: new Date() } })
  }
  await publishEvent(job.eventId, { type: 'person.updated', personId: person.id })
}

async function image(job: EnrichmentJob) {
  const database = db(); const person = await database.query.people.findFirst({ where: eq(people.id, job.personId) })
  if (!person?.linkedinUrl) return
  const profile = person.profile as Record<string, unknown>
  if (profile.image) return
  const provider = searchProvider(); if (!provider.searchImages) return
  const started = Date.now(); const images = await provider.searchImages({ query: `site:linkedin.com/in/${person.linkedinSlug} ${person.displayName}`, limit: 5 })
  const exact = images.find((item) => canonicalLinkedInUrl(item.pageUrl) === person.linkedinUrl)
  await rememberAttempt({ personId: person.id, eventId: job.eventId, query: person.linkedinUrl, provider: provider.name, requestType: 'image', status: 'success', count: images.length, duration: Date.now() - started })
  if (exact?.thumbnailUrl || exact?.imageUrl) await database.update(people).set({ profile: { ...profile, image: { value: exact.thumbnailUrl || exact.imageUrl, source: 'image_search', confidence: 'medium' } }, updatedAt: new Date() }).where(eq(people.id, person.id))
  await publishEvent(job.eventId, { type: 'person.updated', personId: person.id })
}

new Worker<EnrichmentJob>('guestlens-enrichment', async (job) => job.data.type === 'resolve-profile-image' ? image(job.data) : resolve(job.data), { connection: redis(), concurrency: Number(process.env.SEARCH_CONCURRENCY || 5), lockDuration: 30_000 })
console.log(JSON.stringify({ level: 'info', message: 'GuestLens enrichment worker started' }))
