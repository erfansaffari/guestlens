import { Queue } from 'bullmq'
import { redis } from './redis'

export type EnrichmentJob = { personId: string; eventId: string; type: 'resolve-linkedin-profile' | 'resolve-profile-image' | 'refresh-profile' | 'build-detailed-profile' }
const queueName = 'guestlens-enrichment'
let queue: Queue<EnrichmentJob> | null = null

export function queueJobId(prefix: string, value: string) {
  return `${prefix}-${value.replaceAll(':', '-')}`
}

export function enrichmentQueue() {
  queue ??= new Queue<EnrichmentJob>(queueName, { connection: redis() })
  return queue
}

export async function enqueueResolution(personId: string, eventId: string, lookupKey: string) {
  return enrichmentQueue().add('resolve-linkedin-profile', { personId, eventId, type: 'resolve-linkedin-profile' }, {
    jobId: queueJobId('linkedin-search', lookupKey), attempts: 3, backoff: { type: 'exponential', delay: 1_000 }, removeOnComplete: 500, removeOnFail: 500,
  })
}

export async function enqueueImage(personId: string, eventId: string) {
  return enrichmentQueue().add('resolve-profile-image', { personId, eventId, type: 'resolve-profile-image' }, {
    jobId: queueJobId('linkedin-image', personId), attempts: 2, backoff: { type: 'exponential', delay: 1_000 }, removeOnComplete: 500, removeOnFail: 500,
  })
}

export async function enqueueRefresh(personId: string, eventId: string) {
  return enrichmentQueue().add('refresh-profile', { personId, eventId, type: 'refresh-profile' }, {
    jobId: queueJobId('profile-refresh', personId), attempts: 3, backoff: { type: 'exponential', delay: 1_000 }, removeOnComplete: 500, removeOnFail: 500,
  })
}

export async function publishEvent(eventId: string, data: unknown) {
  await redis().publish(`guestlens:event:${eventId}`, JSON.stringify(data))
}
