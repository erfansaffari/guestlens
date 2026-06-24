import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import {
  buildAggregateCacheKey,
  buildAskCacheKey,
  getAggregateCache,
  getAskCache,
  setAggregateCache,
  setAskCache,
} from './cache'
import { enrichLinkedInCandidates, logSearchStatusOnStartup, probeSearchAccess } from './linkedInSearch'
import { parseFirstJsonObject } from './parseModelJson'

dotenv.config({ override: true })

const app = express()
const port = Number(process.env.PORT || 8787)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const attendeeSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1),
  company: z.string().optional(),
  title: z.string().optional(),
  location: z.string().optional(),
})

const enrichSchema = z.object({
  attendees: z.array(attendeeSchema).max(250),
  eventContext: z.string().max(300).optional(),
})

const askSchema = z.object({
  question: z.string().min(1).max(500),
  people: z
    .array(
      z.object({
        id: z.string(),
        fullName: z.string(),
        sourceContext: z.string().optional(),
        profile: z
          .object({
            title: z.string(),
            url: z.string(),
            headline: z.string().optional(),
            location: z.string().optional(),
            company: z.string().optional(),
            school: z.string().optional(),
            role: z.string().optional(),
            followers: z.string().optional(),
            bio: z.string().optional(),
            summary: z.string().optional(),
            snippet: z.string(),
            description: z.string(),
            experienceSignal: z.string(),
            imageUrl: z.string().optional(),
          })
          .nullable(),
      }),
    )
    .max(250),
})

type Attendee = z.infer<typeof attendeeSchema>

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const femaleFirstNames = new Set([
  'anna',
  'anita',
  'ashley',
  'emily',
  'emma',
  'fatima',
  'jessica',
  'julia',
  'laura',
  'lisa',
  'maria',
  'mary',
  'michelle',
  'natalie',
  'olivia',
  'priya',
  'rachel',
  'sarah',
  'sophia',
  'stephanie',
])

const maleFirstNames = new Set([
  'alexander',
  'andrew',
  'anthony',
  'chris',
  'daniel',
  'david',
  'james',
  'john',
  'joseph',
  'kevin',
  'mark',
  'matthew',
  'michael',
  'mohammed',
  'nicholas',
  'robert',
  'samuel',
  'thomas',
  'william',
])

function fallbackAggregate(attendees: Attendee[]) {
  return attendees.reduce(
    (acc, attendee) => {
      const firstName = attendee.fullName.trim().split(/\s+/)[0]?.toLowerCase()

      if (femaleFirstNames.has(firstName)) {
        acc.women += 1
      } else if (maleFirstNames.has(firstName)) {
        acc.men += 1
      } else {
        acc.unknown += 1
      }

      return acc
    },
    { men: 0, women: 0, unknown: 0 },
  )
}

const aggregateSchema = z.object({
  men: z.number().int().nonnegative(),
  women: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  method: z.string(),
})

async function estimateAggregate(attendees: Attendee[]) {
  const cacheKey = buildAggregateCacheKey(attendees.map((attendee) => attendee.fullName))
  const cached = await getAggregateCache(cacheKey)

  if (cached) {
    const { men, women, unknown, method } = cached
    return { men, women, unknown, method }
  }

  if (!anthropic) {
    const result = {
      ...fallbackAggregate(attendees),
      method:
        'Local fallback from a small first-name list. Add ANTHROPIC_API_KEY for a better aggregate estimate.',
    }
    await setAggregateCache(cacheKey, result)
    return result
  }

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5',
    max_tokens: 400,
    system:
      'Estimate aggregate likely gender presentation counts from first names only. Never return per-person labels. Use unknown when uncertain, culturally ambiguous, initials-only, or organization names. Return only strict JSON with men, women, unknown, method.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          names: attendees.map((attendee) => attendee.fullName),
          output: { men: 'number', women: 'number', unknown: 'number', method: 'string' },
        }),
      },
    ],
  })

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  try {
    const parsed = aggregateSchema.parse(parseFirstJsonObject(text))
    await setAggregateCache(cacheKey, parsed)
    return parsed
  } catch (error) {
    console.warn('[aggregate] AI response parse failed, using local fallback.', error)
    const result = {
      ...fallbackAggregate(attendees),
      method: 'Local fallback after AI parse failure.',
    }
    await setAggregateCache(cacheKey, result)
    return result
  }
}

app.get('/api/health', async (_req, res) => {
  const searchConfigured = Boolean(process.env.SERPAPI_KEY?.trim())
  const search = searchConfigured
    ? await probeSearchAccess()
    : {
        ok: false as const,
        status: 'missing_search_config',
        message: 'SerpAPI is not configured.',
        hint: 'Add SERPAPI_KEY to .env from serpapi.com/manage-api-key.',
      }

  res.json({
    ok: true,
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    searchConfigured,
    search,
  })
})

app.post('/api/enrich', async (req, res) => {
  const parsed = enrichSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  try {
    const { attendees, eventContext } = parsed.data
    const [aggregate, linkedInResult] = await Promise.all([
      estimateAggregate(attendees),
      enrichLinkedInCandidates(attendees, eventContext),
    ])

    res.json({ aggregate, ...linkedInResult })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Unknown enrichment error.'
    res.status(500).json({
      error: 'Unable to enrich this guest list.',
      detail: message.includes('model:') ? message : undefined,
    })
  }
})

app.post('/api/ask', async (req, res) => {
  const parsed = askSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  if (!anthropic) {
    res.status(400).json({ error: 'ANTHROPIC_API_KEY is not configured.' })
    return
  }

  try {
    const cacheKey = buildAskCacheKey(parsed.data.question, parsed.data.people)
    const cached = await getAskCache(cacheKey)

    if (cached) {
      res.json({
        answer: cached.answer,
        matches: cached.matches,
        fromCache: true,
      })
      return
    }

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5',
      max_tokens: 900,
      system:
        'You are a networking research assistant. Answer only from the provided public attendee context. Do not invent facts. Return strict JSON with answer:string and matches: array of {id:string, reason:string}. If no one matches, return an empty matches array and explain what is missing.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            question: parsed.data.question,
            people: parsed.data.people,
            output: {
              answer: 'short answer',
              matches: [{ id: 'attendee id', reason: 'why this person is relevant' }],
            },
          }),
        },
      ],
    })

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    const result = z
      .object({
        answer: z.string(),
        matches: z.array(z.object({ id: z.string(), reason: z.string() })),
      })
      .parse(parseFirstJsonObject(text))

    await setAskCache(cacheKey, result)
    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to search these profiles.' })
  }
})

app.listen(port, () => {
  console.log(`GuestLens API listening on http://localhost:${port}`)
  void logSearchStatusOnStartup()
})
