import { normaliseName } from '../src/name'
import type { WebSearchResult } from './providers/types'
import { parseLinkedInProfile } from './profileParser'

export type ProfileField = { value: string; source: 'search_title' | 'search_snippet' | 'rich_snippet' | 'search_thumbnail' | 'image_search' | 'user_confirmed'; confidence: 'high' | 'medium' | 'low' }
export type Candidate = { url: string; title: string; snippet: string; thumbnailUrl?: string; score: number; rank: number; evidence: Record<string, boolean | string[]>; fields: Record<string, ProfileField> }

export function canonicalLinkedInUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const match = parsed.pathname.match(/^\/in\/([^/?#]+)\/?$/i)
    if (!/(^|\.)linkedin\.com$/.test(host) || !match?.[1]) return null
    return `https://www.linkedin.com/in/${encodeURIComponent(decodeURIComponent(match[1]!)).toLowerCase()}`
  } catch { return null }
}

function titleTokens(value: string) { return normaliseName(value).split(/\s+/).filter(Boolean) }
function signal(text: string, pattern: RegExp) { return pattern.test(text) }

export function scoreCandidate(result: WebSearchResult, fullName: string): { score: number; evidence: Record<string, boolean | string[]> } {
  const url = canonicalLinkedInUrl(result.url)
  if (!url) return { score: -999, evidence: { validUrl: false } }
  const title = normaliseName(result.title)
  const all = normaliseName(`${result.title} ${result.snippet} ${(result.richSnippet || []).join(' ')}`)
  const tokens = titleTokens(fullName).filter((token) => token.length > 1)
  const matched = tokens.filter((token) => title.includes(token))
  const exact = title.includes(normaliseName(fullName))
  const first = Boolean(tokens[0] && title.includes(tokens[0]))
  const lastToken = tokens.at(-1)
  const last = Boolean(lastToken && title.includes(lastToken))
  const allTokens = tokens.length > 1 && matched.length === tokens.length
  let score = 10
  if (exact) score += 60
  else if (allTokens) score += 45
  if (last) score += 20
  if (first) score += 10
  if (signal(all, /\bcanada\b/)) score += 8
  if (signal(all, /\bwaterloo\b/)) score += 6
  if (signal(all, /\btoronto\b/)) score += 4
  if (signal(all, /university of waterloo|uwaterloo/)) score += 10
  if (signal(all, /wilfrid laurier/)) score += 8
  if (signal(all, /\b(university|college)\b/) && signal(all, /\b(canada|ontario|british columbia|quebec)\b/)) score += 5
  if (!last) score -= 35
  if (first && !last) score -= 30
  if (!first && !last) score -= 40
  return { score, evidence: { validUrl: true, exactFullName: exact, allNameTokens: allTokens, firstNameMatched: first, lastNameMatched: last, canadaSignalMatched: signal(all, /\bcanada\b/), waterlooSignalMatched: signal(all, /\bwaterloo\b/), torontoSignalMatched: signal(all, /\btoronto\b/) } }
}

export function rankCandidates(results: WebSearchResult[], fullName: string): Candidate[] {
  return results.map((result) => ({ result, ...scoreCandidate(result, fullName) }))
    .filter((entry) => entry.score > -999)
    .sort((a, b) => b.score - a.score).slice(0, 3)
    .map((entry, index) => {
      const parsed = parseLinkedInProfile({
        title: entry.result.title,
        link: canonicalLinkedInUrl(entry.result.url)!,
        snippet: entry.result.snippet,
        thumbnail: entry.result.thumbnailUrl,
        displayed_link: entry.result.displayedLink,
        rich_snippet: { top: { extensions: entry.result.richSnippet } },
      }, fullName)
      const confidence = entry.score >= 80 ? 'high' as const : 'medium' as const
      const fields: Record<string, ProfileField> = {}
      const add = (key: string, value: string, source: ProfileField['source'], fieldConfidence = confidence) => {
        if (value.trim()) fields[key] = { value: value.trim(), source, confidence: fieldConfidence }
      }
      add('headline', parsed.headline, 'search_title')
      add('snippet', parsed.snippet, 'search_snippet', 'medium')
      add('company', parsed.company, 'rich_snippet')
      add('school', parsed.school, 'search_snippet')
      add('location', parsed.location, 'rich_snippet')
      add('role', parsed.role, 'rich_snippet')
      add('followers', parsed.followers, 'rich_snippet')
      add('bio', parsed.bio, 'search_snippet', 'medium')
      add('previewLimited', parsed.previewLimited ? 'true' : '', 'search_snippet', 'low')
      add('image', parsed.imageUrl, 'search_thumbnail', 'low')
      return { url: canonicalLinkedInUrl(entry.result.url)!, title: entry.result.title, snippet: entry.result.snippet, thumbnailUrl: entry.result.thumbnailUrl, score: entry.score, rank: index + 1, evidence: entry.evidence, fields }
    })
}

export function resolutionFor(candidates: Candidate[]) {
  const best = candidates[0]
  const runnerUp = candidates[1]
  if (!best) return { status: 'not_found', confidence: 'low' as const, selected: null }
  const strongTitle = Boolean(best.evidence.exactFullName || best.evidence.allNameTokens)
  const gap = best.score - (runnerUp?.score ?? 0)
  if (best.score >= 80 && strongTitle && gap >= 15) return { status: 'resolved', confidence: 'high' as const, selected: best }
  if (best.score >= 60) return { status: 'ambiguous', confidence: 'medium' as const, selected: null }
  return { status: 'not_found', confidence: 'low' as const, selected: null }
}

export function linkedInQueries(fullName: string) {
  return [
    `site:linkedin.com/in "${fullName}" "Canada"`,
    `site:linkedin.com/in "${fullName}" Waterloo OR Toronto`,
    `site:linkedin.com/in "${fullName}"`,
  ]
}
