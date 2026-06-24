import { describe, expect, it } from 'vitest'
import { extractSearchContext } from './eventContext'

describe('extractSearchContext', () => {
  it('extracts country from Canadian Luma event details', () => {
    expect(
      extractSearchContext('the Technical Jun 12 Friday, June 12 9:30 PM - 1:00 AM WCRI Waterloo, ON'),
    ).toBe('Canada')
  })

  it('extracts country from US city and state details', () => {
    expect(extractSearchContext('Founder meetup Friday 7 PM New York, NY')).toBe('United States')
  })
})
