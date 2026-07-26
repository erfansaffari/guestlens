import { serpApiProvider } from './serpapi'
import type { SearchProvider } from './types'

export function searchProvider(): SearchProvider {
  const provider = process.env.SEARCH_PROVIDER || 'serpapi'
  if (provider !== 'serpapi') throw new Error(`Unsupported SEARCH_PROVIDER: ${provider}`)
  return serpApiProvider
}
