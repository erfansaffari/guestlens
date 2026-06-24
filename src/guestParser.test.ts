import { describe, expect, it } from 'vitest'
import { parseGuestList } from './guestParser'

describe('parseGuestList', () => {
  it('parses CSV headers into attendee fields', () => {
    const guests = parseGuestList(`Name,Company,Title
Sarah Chen,Northstar,Lead
Michael Rivera,Arc,Founder`)

    expect(guests).toHaveLength(2)
    expect(guests[0]).toMatchObject({
      fullName: 'Sarah Chen',
      company: 'Northstar',
      title: 'Lead',
    })
  })

  it('deduplicates pasted names', () => {
    const guests = parseGuestList(`Alex Kim
Alex Kim
Priya Shah`)

    expect(guests.map((guest) => guest.fullName)).toEqual(['Alex Kim', 'Priya Shah'])
  })

  it('cleans Luma profile-picture rows', () => {
    const guests = parseGuestList(`Profile picture for Erfan Saffari
Erfan Saffari
Profile picture for Aarya
Aarya
Profile picture for Aarya Desai
Aarya Desai`)

    expect(guests.map((guest) => guest.fullName)).toEqual([
      'Erfan Saffari',
      'Aarya',
      'Aarya Desai',
    ])
  })
})
