import { describe, expect, it } from 'vitest'
import { canonicalLinkedInUrl, linkedInQueries, rankCandidates, resolutionFor } from './matching'

describe('production candidate matching', () => {
  it('canonicalises only LinkedIn /in URLs', () => {
    expect(canonicalLinkedInUrl('https://ca.linkedin.com/in/Jane-Doe/?trk=public')).toBe('https://www.linkedin.com/in/jane-doe')
    expect(canonicalLinkedInUrl('https://www.linkedin.com/company/acme')).toBeNull()
    expect(canonicalLinkedInUrl('https://example.com/in/jane-doe')).toBeNull()
  })

  it('uses Canada first and only exposes fallbacks for failed matches', () => {
    expect(linkedInQueries('Jane Doe')).toEqual([
      'site:linkedin.com/in "Jane Doe" "Canada"',
      'site:linkedin.com/in "Jane Doe" Waterloo OR Toronto',
      'site:linkedin.com/in "Jane Doe"',
    ])
  })

  it('requires a high score and a clear score gap for automatic resolution', () => {
    const candidates = rankCandidates([
      { title: 'Jane Doe - Software Engineer', url: 'https://ca.linkedin.com/in/jane-doe', snippet: 'Canada' },
      { title: 'Jane Doe - Product Designer', url: 'https://www.linkedin.com/in/jane-doe-2', snippet: 'Canada' },
    ], 'Jane Doe')
    expect(candidates[0]?.score).toBeGreaterThanOrEqual(80)
    expect(resolutionFor(candidates).status).toBe('ambiguous')
    expect(resolutionFor([candidates[0]!]).status).toBe('resolved')
  })

  it('persists public profile fields and an organic-result thumbnail with provenance', () => {
    const [candidate] = rankCandidates([{
      title: 'Jane Doe - Product Manager at Acme',
      url: 'https://www.linkedin.com/in/jane-doe',
      snippet: 'Jane Doe. Product manager at Acme. Toronto, Ontario, Canada.',
      thumbnailUrl: 'https://media.licdn.com/example.jpg',
      richSnippet: ['Toronto, Ontario, Canada', 'Product Manager', 'Acme'],
    }], 'Jane Doe')
    expect(candidate?.fields.headline?.value).toBe('Product Manager at Acme')
    expect(candidate?.fields.location?.value).toBe('Toronto, Ontario, Canada')
    expect(candidate?.fields.image).toEqual({ value: 'https://media.licdn.com/example.jpg', source: 'search_thumbnail', confidence: 'low' })
  })
})
