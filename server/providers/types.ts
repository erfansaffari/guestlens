export type WebSearchResult = {
  title: string
  url: string
  snippet: string
  thumbnailUrl?: string
  richSnippet?: string[]
  displayedLink?: string
}

export type ImageSearchResult = { pageUrl: string; thumbnailUrl?: string; imageUrl?: string }

export interface SearchProvider {
  name: string
  searchWeb(input: { query: string; limit: number }): Promise<WebSearchResult[]>
  searchImages?(input: { query: string; limit: number }): Promise<ImageSearchResult[]>
}
