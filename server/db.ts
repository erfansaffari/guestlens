import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let client: ReturnType<typeof postgres> | null = null
export function db() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL is required for production enrichment.')
  client ??= postgres(url, { max: 10 })
  return drizzle(client, { schema })
}

export type Database = ReturnType<typeof db>
