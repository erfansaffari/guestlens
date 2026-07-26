import IORedis from 'ioredis'

let connection: IORedis | null = null
export function redis() {
  const url = process.env.REDIS_URL?.trim()
  if (!url) throw new Error('REDIS_URL is required for background enrichment.')
  connection ??= new IORedis(url, {
    maxRetriesPerRequest: null,
    connectTimeout: 5_000,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  })
  return connection
}
