import cors from 'cors'
import dotenv from 'dotenv'
import express, { type Request, type Response } from 'express'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { clerkMiddleware, getAuth } from '@clerk/express'
import OpenAI from 'openai'
import { and, asc, count, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from './db'
import { enqueueImage, enqueueRefresh, enqueueResolution } from './queue'
import { redis } from './redis'
import { eventAttendees, events, nameResolutions, people, profileCache, searchCandidates } from './schema'
import { canonicalLinkedInUrl } from './matching'
import { hasMeaningfulFullName, normaliseName } from '../src/name'

dotenv.config({ override: true })
const app = express(); const port = Number(process.env.PORT || 8787)
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((value) => value.trim())
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '256kb' }))
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
}))
app.use('/api', rateLimit({ windowMs: 60_000, limit: Number(process.env.API_REQUESTS_PER_MINUTE || 120), standardHeaders: 'draft-8', legacyHeaders: false }))

const importSchema = z.object({ eventName: z.string().trim().min(1).max(200), eventLink: z.string().url().max(2_000).optional().or(z.literal('')), eventContext: z.string().trim().max(300).optional(), attendees: z.array(z.object({ id: z.string().optional(), fullName: z.string().trim().min(1).max(160) })).min(1).max(Number(process.env.MAX_ATTENDEES_PER_IMPORT || 500)) })
const confirmSchema = z.object({ candidateId: z.string().uuid().optional(), linkedinUrl: z.string().url().optional() }).refine((value) => value.candidateId || value.linkedinUrl, 'Select a candidate or provide a LinkedIn URL.')
const askSchema = z.object({ question: z.string().trim().min(3).max(500) })
const askResultSchema = z.object({ answer: z.string().trim().min(1).max(1_200), matches: z.array(z.object({ personId: z.string().uuid(), reason: z.string().trim().min(1).max(240) })).max(20) })
const importLimiter = rateLimit({ windowMs: 3_600_000, limit: Number(process.env.MAX_IMPORTS_PER_HOUR || 12), standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => userId(req) || ipKeyGenerator(req.ip || '::') })
const askLimiter = rateLimit({ windowMs: 3_600_000, limit: Number(process.env.MAX_AI_ASKS_PER_HOUR || 30), standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => userId(req) || ipKeyGenerator(req.ip || '::') })
const networkStatus = new Set(['pending', 'processing', 'resolved', 'ambiguous', 'not_found', 'failed', 'budget_paused'])

function userId(req: Request) {
  if (!process.env.CLERK_SECRET_KEY) return null
  return getAuth(req).userId
}
function requireUser(req: Request, res: Response) {
  const id = userId(req)
  if (!id) { res.status(process.env.CLERK_SECRET_KEY ? 401 : 503).json({ error: process.env.CLERK_SECRET_KEY ? 'Authentication required.' : 'Clerk is not configured.' }); return null }
  return id
}
async function ownedEvent(id: string, ownerId: string) { return db().query.events.findFirst({ where: and(eq(events.id, id), eq(events.ownerId, ownerId)) }) }
function profileResponse(person: typeof people.$inferSelect, candidates: Array<typeof searchCandidates.$inferSelect>) {
  return { id: person.id, displayName: person.displayName, status: person.status, confidence: person.confidence, matchScore: person.matchScore, linkedinUrl: person.linkedinUrl, profile: person.profile, userConfirmed: person.userConfirmed, candidates: candidates.map((candidate) => ({ id: candidate.id, url: candidate.url, title: candidate.title, snippet: candidate.snippet, thumbnailUrl: candidate.thumbnailUrl, score: candidate.score, rank: candidate.rank, evidence: candidate.evidence, fields: candidate.fields })) }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, services: { database: Boolean(process.env.DATABASE_URL), redis: Boolean(process.env.REDIS_URL), clerk: Boolean(process.env.CLERK_SECRET_KEY), search: Boolean(process.env.SERPAPI_KEY), askAi: Boolean(process.env.OPENAI_API_KEY) } }))

app.get('/api/dashboard', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const [summary] = await db().execute<{ events: number; people: number; resolved: number; repeats: number }>(sql`
    WITH scoped AS (SELECT p.linkedin_url, p.normalised_name, p.status, ea.event_id FROM people p JOIN event_attendees ea ON ea.person_id = p.id JOIN events e ON e.id = ea.event_id WHERE e.owner_id = ${ownerId} AND e.deleted_at IS NULL), identities AS (SELECT CASE WHEN linkedin_url IS NOT NULL THEN 'linkedin:' || linkedin_url ELSE 'name:' || normalised_name END AS identity_key, count(DISTINCT event_id) AS event_count, bool_or(status = 'resolved') AS is_resolved FROM scoped GROUP BY 1)
    SELECT (SELECT count(*)::int FROM events WHERE owner_id = ${ownerId} AND deleted_at IS NULL) AS events, count(*)::int AS people, count(*) FILTER (WHERE is_resolved)::int AS resolved, count(*) FILTER (WHERE event_count > 1)::int AS repeats FROM identities
  `)
  res.json(summary || { events: 0, people: 0, resolved: 0, repeats: 0 })
})

app.get('/api/events', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const page = Math.max(1, Number(req.query.page || 1)); const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20))); const offset = (page - 1) * limit
  const rows = await db().execute<{ id: string; name: string; context: string | null; eventLink: string | null; createdAt: string; updatedAt: string; people: number; resolved: number }>(sql`
    SELECT e.id, e.name, e.context, e.event_link AS "eventLink", e.created_at AS "createdAt", e.updated_at AS "updatedAt", count(ea.id)::int AS people, count(ea.id) FILTER (WHERE p.status = 'resolved')::int AS resolved FROM events e LEFT JOIN event_attendees ea ON ea.event_id = e.id LEFT JOIN people p ON p.id = ea.person_id WHERE e.owner_id = ${ownerId} AND e.deleted_at IS NULL GROUP BY e.id ORDER BY e.updated_at DESC LIMIT ${limit} OFFSET ${offset}
  `)
  res.json({ page, limit, events: rows })
})

app.get('/api/network/people', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const page = Math.max(1, Number(req.query.page || 1)); const limit = Math.min(50, Math.max(1, Number(req.query.limit || 25))); const offset = (page - 1) * limit
  const query = String(req.query.query || '').trim(); const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : null
  const status = typeof req.query.status === 'string' && networkStatus.has(req.query.status) ? req.query.status : null; const repeatsOnly = req.query.repeatsOnly === 'true'; const like = `%${query}%`
  const rows = await db().execute(sql`
    WITH scoped AS (SELECT p.*, ea.event_id, e.name AS event_name FROM people p JOIN event_attendees ea ON ea.person_id = p.id JOIN events e ON e.id = ea.event_id WHERE e.owner_id = ${ownerId} AND e.deleted_at IS NULL ${eventId ? sql`AND e.id = ${eventId}` : sql``} ${status ? sql`AND p.status = ${status}` : sql``} ${query ? sql`AND (p.display_name ILIKE ${like} OR p.profile::text ILIKE ${like})` : sql``}), identities AS (SELECT CASE WHEN linkedin_url IS NOT NULL THEN 'linkedin:' || linkedin_url ELSE 'name:' || normalised_name END AS identity_key, max(display_name) AS "displayName", max(linkedin_url) AS "linkedinUrl", (jsonb_agg(profile)->0) AS profile, bool_or(status = 'resolved') AS resolved, count(DISTINCT event_id)::int AS "eventCount", jsonb_agg(DISTINCT jsonb_build_object('id', event_id, 'name', event_name)) AS events FROM scoped GROUP BY 1)
    SELECT * FROM identities ${repeatsOnly ? sql`WHERE "eventCount" > 1` : sql``} ORDER BY "eventCount" DESC, "displayName" ASC LIMIT ${limit} OFFSET ${offset}
  `)
  res.json({ page, limit, people: rows.map((row: any) => ({ ...row, identityConfidence: row.linkedinUrl ? 'high' : 'low' })) })
})

app.post('/api/events/import', importLimiter, async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const parsed = importSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    const seen = new Set<string>(); const attendees = parsed.data.attendees.filter((attendee) => { const key = normaliseName(attendee.fullName); if (!key || seen.has(key)) return false; seen.add(key); return true })
    const database = db(); const [event] = await database.insert(events).values({ ownerId, name: parsed.data.eventName, eventLink: parsed.data.eventLink || null, context: parsed.data.eventContext, updatedAt: new Date() }).returning()
    const names = attendees.map((attendee) => normaliseName(attendee.fullName)); const now = new Date()
    const resolutions = names.length ? await database.select().from(nameResolutions).where(and(inArray(nameResolutions.normalisedName, names), or(isNull(nameResolutions.expiresAt), gt(nameResolutions.expiresAt, now)))) : []
    const resolutionByName = new Map(resolutions.map((resolution) => [resolution.normalisedName, resolution])); const urls = resolutions.flatMap((resolution) => resolution.linkedinUrl ? [resolution.linkedinUrl] : [])
    const cachedProfiles = urls.length ? await database.select().from(profileCache).where(and(inArray(profileCache.linkedinUrl, urls), gt(profileCache.expiresAt, now))) : []
    const profileByUrl = new Map(cachedProfiles.map((profile) => [profile.linkedinUrl, profile.profile]))
    const personRows = await database.insert(people).values(attendees.map((attendee) => { const normalisedName = normaliseName(attendee.fullName); const resolution = resolutionByName.get(normalisedName); const url = resolution?.linkedinUrl || null; return { displayName: attendee.fullName.trim(), normalisedName, status: !hasMeaningfulFullName(attendee.fullName) ? 'ambiguous' : url ? 'resolved' : 'pending', confidence: resolution?.confidence || null, linkedinUrl: url, linkedinSlug: url?.split('/').at(-1) || null, profile: url ? profileByUrl.get(url) || {} : {}, userConfirmed: resolution?.userConfirmed || false, updatedAt: new Date() } })).returning()
    await database.insert(eventAttendees).values(personRows.map((person, index) => ({ eventId: event.id, personId: person.id, originalName: attendees[index]!.fullName.trim(), ordinal: index, updatedAt: new Date() })))
    let queued = 0
    for (const person of personRows) if (person.status === 'pending') { await enqueueResolution(person.id, event.id, `${person.normalisedName}:canada`); queued += 1 }
    res.status(201).json({ eventId: event.id, total: personRows.length, cached: personRows.length - queued - personRows.filter((person) => person.status === 'ambiguous').length, queued })
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined
    console.error(JSON.stringify({ level: 'error', action: 'event.import', error: error instanceof Error ? error.message : 'unknown', cause }))
    const queueUnavailable = cause?.includes('Stream isn\'t writeable') || cause?.includes('ECONNREFUSED')
    res.status(500).json({
      error: queueUnavailable ? 'The enrichment queue is unavailable. Configure a reachable REDIS_URL and retry.' : 'Unable to import this event.',
      detail: process.env.NODE_ENV === 'production' ? undefined : cause || (error instanceof Error ? error.message : undefined),
    })
  }
})

app.get('/api/events/:eventId/attendees', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const event = await ownedEvent(req.params.eventId, ownerId); if (!event) { res.status(404).json({ error: 'Event not found.' }); return }
  const page = Math.max(1, Number(req.query.page || 1)); const limit = Math.min(50, Math.max(1, Number(req.query.limit || 50))); const offset = (page - 1) * limit
  const rows = await db().select({ attendee: eventAttendees, person: people }).from(eventAttendees).innerJoin(people, eq(eventAttendees.personId, people.id)).where(eq(eventAttendees.eventId, event.id)).orderBy(asc(eventAttendees.ordinal)).limit(limit).offset(offset)
  const ids = rows.map((row) => row.person.id); const candidates = ids.length ? await db().select().from(searchCandidates).where(inArray(searchCandidates.personId, ids)).orderBy(asc(searchCandidates.rank)) : []
  const totalResult = await db().select({ total: count() }).from(eventAttendees).where(eq(eventAttendees.eventId, event.id))
  res.json({ event: { id: event.id, name: event.name, context: event.context, eventLink: event.eventLink }, page, limit, total: totalResult[0]?.total || 0, attendees: rows.map(({ attendee, person }) => ({ attendeeId: attendee.id, originalName: attendee.originalName, person: profileResponse(person, candidates.filter((candidate) => candidate.personId === person.id)) })) })
})

app.get('/api/events/:eventId/progress', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const event = await ownedEvent(req.params.eventId, ownerId); if (!event) { res.status(404).json({ error: 'Event not found.' }); return }
  const rows = await db().select({ status: people.status, total: count() }).from(eventAttendees).innerJoin(people, eq(eventAttendees.personId, people.id)).where(eq(eventAttendees.eventId, event.id)).groupBy(people.status)
  const status = Object.fromEntries(rows.map((row) => [row.status, row.total])); res.json({ total: Object.values(status).reduce((sum, value) => sum + Number(value), 0), resolved: status.resolved || 0, ambiguous: status.ambiguous || 0, notFound: status.not_found || 0, pending: (status.pending || 0) + (status.processing || 0), failed: status.failed || 0, budgetPaused: status.budget_paused || 0 })
})

app.post('/api/events/:eventId/ask', askLimiter, async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const input = askSchema.safeParse(req.body); if (!input.success) { res.status(400).json({ error: input.error.flatten() }); return }
  const event = await ownedEvent(req.params.eventId, ownerId); if (!event) { res.status(404).json({ error: 'Event not found.' }); return }
  if (!process.env.OPENAI_API_KEY) { res.status(503).json({ error: 'Ask AI is unavailable until OPENAI_API_KEY is configured.' }); return }
  const rows = await db().select({ person: people, attendee: eventAttendees }).from(eventAttendees).innerJoin(people, eq(eventAttendees.personId, people.id)).where(eq(eventAttendees.eventId, event.id)).orderBy(asc(eventAttendees.ordinal))
  const directory = rows.map(({ person, attendee }) => ({ personId: person.id, name: person.displayName, status: person.status, publicProfile: person.profile, guestList: { name: attendee.originalName } }))
  const started = Date.now()
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const outputSchema = {
      name: 'guestlens_answer',
      strict: true,
      schema: {
        type: 'object', additionalProperties: false, required: ['answer', 'matches'],
        properties: {
          answer: { type: 'string' },
          matches: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['personId', 'reason'],
              properties: { personId: { type: 'string' }, reason: { type: 'string' } },
            },
          },
        },
      },
    } as const
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: outputSchema },
      messages: [
        { role: 'system', content: 'You help an event attendee find relevant people using only the supplied public search metadata. Never infer or invent facts. Return a concise answer and only include a match when the supplied fields directly support the reason. If no profile supports the question, return an empty matches array and say so.' },
        { role: 'user', content: JSON.stringify({ question: input.data.question, people: directory }) },
      ],
    })
    const parsed = askResultSchema.parse(JSON.parse(completion.choices[0]?.message.content || '{}'))
    const allowed = new Set(directory.map((person) => person.personId))
    const matches = parsed.matches.filter((match) => allowed.has(match.personId))
    await db().insert(searchAttempts).values({ eventId: event.id, query: input.data.question, provider: 'openai', requestType: 'ai_ask', status: 'success', resultCount: matches.length, durationMs: Date.now() - started })
    res.json({ answer: parsed.answer, matches })
  } catch (error) {
    await db().insert(searchAttempts).values({ eventId: event.id, query: input.data.question, provider: 'openai', requestType: 'ai_ask', status: 'failed', durationMs: Date.now() - started })
    console.error(JSON.stringify({ level: 'error', action: 'event.ask', error: error instanceof Error ? error.message : 'unknown' }))
    res.status(502).json({ error: 'Ask AI could not complete this question. Please try again.' })
  }
})

app.get('/api/events/:eventId/stream', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const event = await ownedEvent(req.params.eventId, ownerId); if (!event) { res.status(404).end(); return }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' }); res.write('event: ready\ndata: {}\n\n')
  const subscriber = redis().duplicate({ enableOfflineQueue: true }); await subscriber.subscribe(`guestlens:event:${event.id}`)
  subscriber.on('error', (error) => console.error(JSON.stringify({ level: 'error', action: 'event.stream', error: error.message })))
  subscriber.on('message', (_channel, message) => res.write(`event: person.updated\ndata: ${message}\n\n`))
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20_000)
  req.on('close', () => { clearInterval(heartbeat); subscriber.disconnect() })
})

app.get('/api/people/:personId', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const person = await db().query.people.findFirst({ where: eq(people.id, req.params.personId) }); if (!person) { res.status(404).json({ error: 'Person not found.' }); return }
  const owns = await db().select().from(eventAttendees).innerJoin(events, eq(eventAttendees.eventId, events.id)).where(and(eq(eventAttendees.personId, person.id), eq(events.ownerId, ownerId))).limit(1); if (!owns.length) { res.status(404).json({ error: 'Person not found.' }); return }
  res.json(profileResponse(person, await db().select().from(searchCandidates).where(eq(searchCandidates.personId, person.id)).orderBy(asc(searchCandidates.rank))))
})

app.post('/api/people/:personId/confirm', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const input = confirmSchema.safeParse(req.body); if (!input.success) { res.status(400).json({ error: input.error.flatten() }); return }
  const database = db()
  const person = await database.query.people.findFirst({ where: eq(people.id, req.params.personId) }); if (!person) { res.status(404).json({ error: 'Person not found.' }); return }
  const owns = await database.select({ eventId: eventAttendees.eventId }).from(eventAttendees).innerJoin(events, eq(eventAttendees.eventId, events.id)).where(and(eq(eventAttendees.personId, person.id), eq(events.ownerId, ownerId))).limit(1); if (!owns[0]) { res.status(404).json({ error: 'Person not found.' }); return }
  let url = input.data.linkedinUrl ? canonicalLinkedInUrl(input.data.linkedinUrl) : null
  const candidate = input.data.candidateId ? await database.query.searchCandidates.findFirst({ where: and(eq(searchCandidates.id, input.data.candidateId), eq(searchCandidates.personId, person.id)) }) : null
  if (candidate) url = candidate.url
  if (!url) { res.status(400).json({ error: 'A canonical LinkedIn profile URL is required.' }); return }
  const now = new Date(); const expiresAt = new Date(now.getTime() + 180 * 86_400_000)
  const profile = candidate?.fields || person.profile
  await database.update(people).set({ linkedinUrl: url, linkedinSlug: url.split('/').at(-1), profile, status: 'resolved', confidence: 'high', userConfirmed: true, lastVerifiedAt: now, updatedAt: now }).where(eq(people.id, person.id))
  await database.insert(nameResolutions).values({ lookupKey: `${person.normalisedName}:canada`, normalisedName: person.normalisedName, linkedinUrl: url, confidence: 'high', userConfirmed: true, expiresAt, updatedAt: now }).onConflictDoUpdate({ target: nameResolutions.lookupKey, set: { linkedinUrl: url, confidence: 'high', userConfirmed: true, expiresAt, updatedAt: now } })
  if (Object.keys(profile).length) await database.insert(profileCache).values({ linkedinUrl: url, profile, expiresAt, updatedAt: now }).onConflictDoUpdate({ target: profileCache.linkedinUrl, set: { profile, expiresAt, updatedAt: now } })
  res.json({ ok: true, linkedinUrl: url })
})

app.post('/api/people/:personId/unresolve', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const person = await db().query.people.findFirst({ where: eq(people.id, req.params.personId) }); if (!person) { res.status(404).json({ error: 'Person not found.' }); return }
  const owns = await db().select().from(eventAttendees).innerJoin(events, eq(eventAttendees.eventId, events.id)).where(and(eq(eventAttendees.personId, person.id), eq(events.ownerId, ownerId))).limit(1); if (!owns.length) { res.status(404).json({ error: 'Person not found.' }); return }
  await db().update(people).set({ status: 'not_found', linkedinUrl: null, linkedinSlug: null, userConfirmed: true, updatedAt: new Date() }).where(eq(people.id, person.id)); res.json({ ok: true })
})
app.post('/api/people/:personId/enrich-image', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const person = await db().query.people.findFirst({ where: eq(people.id, req.params.personId) }); if (!person?.linkedinUrl) { res.status(400).json({ error: 'A resolved profile is required.' }); return }
  const ownerAttendee = await db().select({ eventId: eventAttendees.eventId }).from(eventAttendees).innerJoin(events, eq(eventAttendees.eventId, events.id)).where(and(eq(eventAttendees.personId, person.id), eq(events.ownerId, ownerId))).limit(1); if (!ownerAttendee[0]) { res.status(404).json({ error: 'Person not found.' }); return }
  await enqueueImage(person.id, ownerAttendee[0].eventId); res.status(202).json({ ok: true })
})
app.post('/api/people/:personId/enrich-details', async (req, res) => { const ownerId = requireUser(req, res); if (!ownerId) return; res.status(202).json({ status: 'not_implemented', message: 'Detailed enrichment is scheduled for Phase 4.' }) })
app.post('/api/people/:personId/refresh', async (req, res) => {
  const ownerId = requireUser(req, res); if (!ownerId) return
  const person = await db().query.people.findFirst({ where: eq(people.id, req.params.personId) }); if (!person) { res.status(404).json({ error: 'Person not found.' }); return }
  const ownerAttendee = await db().select({ eventId: eventAttendees.eventId }).from(eventAttendees).innerJoin(events, eq(eventAttendees.eventId, events.id)).where(and(eq(eventAttendees.personId, person.id), eq(events.ownerId, ownerId))).limit(1)
  if (!ownerAttendee[0]) { res.status(404).json({ error: 'Person not found.' }); return }
  await enqueueRefresh(person.id, ownerAttendee[0].eventId)
  res.status(202).json({ ok: true })
})

app.listen(port, () => console.log(JSON.stringify({ level: 'info', message: `GuestLens API listening on ${port}` })))
