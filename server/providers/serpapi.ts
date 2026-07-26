import type { ImageSearchResult, SearchProvider, WebSearchResult } from './types'

function key() {
  const value = process.env.SERPAPI_KEY?.trim()
  if (!value) throw new Error('SERPAPI_KEY is not configured.')
  return value
}

async function request(params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, api_key: key(), hl: 'en' })
  const response = await fetch(`https://serpapi.com/search.json?${query}`, { signal: AbortSignal.timeout(15_000) })
  const body = await response.json() as { error?: string }
  if (!response.ok || body.error) throw new Error(body.error || `SerpAPI returned ${response.status}`)
  return body
}

export const serpApiProvider: SearchProvider = {
  name: 'serpapi',
  async searchWeb({ query, limit }) {
    const body = await request({ engine: 'google', q: query, num: String(limit) }) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string; thumbnail?: string; displayed_link?: string; rich_snippet?: { top?: { extensions?: string[] } } }>
    }
    return (body.organic_results || []).flatMap((result): WebSearchResult[] => result.link ? [{
      title: result.title || '', url: result.link, snippet: result.snippet || '', thumbnailUrl: result.thumbnail, displayedLink: result.displayed_link,
      richSnippet: result.rich_snippet?.top?.extensions,
    }] : [])
  },
  async searchImages({ query, limit }) {
    const body = await request({ engine: 'google_images', q: query, num: String(limit) }) as {
      images_results?: Array<{ link?: string; thumbnail?: string; original?: string }>
    }
    return (body.images_results || []).flatMap((result): ImageSearchResult[] => result.link ? [{ pageUrl: result.link, thumbnailUrl: result.thumbnail, imageUrl: result.original }] : [])
  },
}
