import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), '.cache')
const SEARCH_CACHE_FILE = path.join(CACHE_DIR, 'linkedin-search.json')
const IMAGE_CACHE_FILE = path.join(CACHE_DIR, 'linkedin-images.json')
const ASK_CACHE_FILE = path.join(CACHE_DIR, 'ask.json')
const AGGREGATE_CACHE_FILE = path.join(CACHE_DIR, 'aggregate.json')

export const LINKEDIN_CACHE_VERSION = 'v5'

export function linkedInCacheKey(query: string) {
  return `${LINKEDIN_CACHE_VERSION}:${query}`
}

export type CachedLinkedInProfile = {
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

export type CachedLinkedInEntry = {
  profile: CachedLinkedInProfile
  status: string
  cachedAt: string
}

export type CachedAskEntry = {
  answer: string
  matches: Array<{ id: string; reason: string }>
  cachedAt: string
}

export type CachedAggregateEntry = {
  men: number
  women: number
  unknown: number
  method: string
  cachedAt: string
}

type SearchCacheStore = Record<string, CachedLinkedInEntry>
type ImageCacheStore = Record<string, { imageUrl: string; cachedAt: string }>
type AskCacheStore = Record<string, CachedAskEntry>
type AggregateCacheStore = Record<string, CachedAggregateEntry>

let searchCachePromise: Promise<SearchCacheStore> | null = null
let imageCachePromise: Promise<ImageCacheStore> | null = null
let askCachePromise: Promise<AskCacheStore> | null = null
let aggregateCachePromise: Promise<AggregateCacheStore> | null = null

function hashKey(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

async function readStore<T extends Record<string, unknown>>(file: string): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return {} as T
  }
}

async function writeStore(file: string, store: Record<string, unknown>) {
  await ensureCacheDir()
  await fs.writeFile(file, JSON.stringify(store, null, 2))
}

async function getSearchStore() {
  searchCachePromise ??= readStore<SearchCacheStore>(SEARCH_CACHE_FILE)
  return searchCachePromise
}

async function getImageStore() {
  imageCachePromise ??= readStore<ImageCacheStore>(IMAGE_CACHE_FILE)
  return imageCachePromise
}

async function getAskStore() {
  askCachePromise ??= readStore<AskCacheStore>(ASK_CACHE_FILE)
  return askCachePromise
}

async function getAggregateStore() {
  aggregateCachePromise ??= readStore<AggregateCacheStore>(AGGREGATE_CACHE_FILE)
  return aggregateCachePromise
}

export async function getLinkedInCache(query: string) {
  const store = await getSearchStore()
  return store[linkedInCacheKey(query)] || null
}

export async function setLinkedInCache(query: string, entry: Omit<CachedLinkedInEntry, 'cachedAt'>) {
  const store = await getSearchStore()
  store[linkedInCacheKey(query)] = { ...entry, cachedAt: new Date().toISOString() }
  await writeStore(SEARCH_CACHE_FILE, store)
}

export async function getLinkedInImageCache(linkedInUrl: string) {
  const store = await getImageStore()
  return store[linkedInUrl]?.imageUrl || ''
}

export async function setLinkedInImageCache(linkedInUrl: string, imageUrl: string) {
  const store = await getImageStore()
  store[linkedInUrl] = { imageUrl, cachedAt: new Date().toISOString() }
  await writeStore(IMAGE_CACHE_FILE, store)
}

export function buildAskCacheKey(
  question: string,
  people: Array<{
    id: string
    fullName: string
    sourceContext?: string
    profile: CachedLinkedInProfile
  }>,
) {
  const payload = {
    question: question.trim().toLowerCase(),
    people: [...people]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((person) => ({
        id: person.id,
        fullName: person.fullName,
        sourceContext: person.sourceContext || '',
        profile: person.profile,
      })),
  }

  return hashKey(JSON.stringify(payload))
}

export async function getAskCache(key: string) {
  const store = await getAskStore()
  return store[key] || null
}

export async function setAskCache(key: string, entry: Omit<CachedAskEntry, 'cachedAt'>) {
  const store = await getAskStore()
  store[key] = { ...entry, cachedAt: new Date().toISOString() }
  await writeStore(ASK_CACHE_FILE, store)
}

export function buildAggregateCacheKey(names: string[]) {
  return hashKey(names.map((name) => name.trim().toLowerCase()).sort().join('\n'))
}

export async function getAggregateCache(key: string) {
  const store = await getAggregateStore()
  return store[key] || null
}

export async function setAggregateCache(
  key: string,
  entry: Omit<CachedAggregateEntry, 'cachedAt'>,
) {
  const store = await getAggregateStore()
  store[key] = { ...entry, cachedAt: new Date().toISOString() }
  await writeStore(AGGREGATE_CACHE_FILE, store)
}
