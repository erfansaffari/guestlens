import { describe, expect, it } from 'vitest'
import { buildLinkedInQuery, linkedInProfileSlug } from './linkedInSearch'

describe('buildLinkedInQuery', () => {
  it('defaults to Canada when attendee location and event context are empty', () => {
    expect(buildLinkedInQuery({ id: '1', fullName: 'Jane Doe' })).toBe(
      '"Jane Doe" site:linkedin.com/in "Canada"',
    )
  })

  it('uses attendee location when provided', () => {
    expect(
      buildLinkedInQuery({ id: '1', fullName: 'Jane Doe', location: 'Toronto, ON' }),
    ).toBe('"Jane Doe" site:linkedin.com/in "Toronto, ON"')
  })

  it('uses event context when attendee location is missing', () => {
    expect(
      buildLinkedInQuery({ id: '1', fullName: 'Jane Doe' }, 'Founder meetup New York, NY'),
    ).toBe('"Jane Doe" site:linkedin.com/in "United States"')
  })
})

describe('linkedInProfileSlug', () => {
  it('extracts slug from linkedin profile urls', () => {
    expect(linkedInProfileSlug('https://www.linkedin.com/in/satyanadella/')).toBe('satyanadella')
  })
})
