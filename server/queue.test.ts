import { describe, expect, it } from 'vitest'
import { queueJobId } from './queue'

describe('queue job IDs', () => {
  it('does not use colons, which BullMQ rejects in custom IDs', () => {
    expect(queueJobId('linkedin-search', 'ali shaverdi:canada')).toBe('linkedin-search-ali shaverdi-canada')
    expect(queueJobId('profile-refresh', 'a14054e3-3351-460d-8822-596f675d5620')).not.toContain(':')
  })
})
