import { describe, expect, it } from 'vitest'
import {
  extractHeadlineFromTitle,
  parseLinkedInProfile,
  pickBestLinkedInResult,
  scoreLinkedInResult,
} from './profileParser'

const auroraResult = {
  title: "Aurora Shen - Management Specialist, Economics Minor ' ...",
  link: 'https://ca.linkedin.com/in/aurora-shen-723466326',
  displayed_link: '50+ followers',
  snippet:
    "Aurora Shen. Management Specialist, Economics Minor '28 at University of Toronto. Shoppers Drug Mart University of Toronto. Toronto, Ontario, Canada.",
  rich_snippet: {
    top: {
      extensions: ['Toronto, Ontario, Canada', 'Cashier/Merchandiser', 'Shoppers Drug Mart'],
    },
  },
  source: 'LinkedIn · Aurora Shen',
}

const wrongResult = {
  title: 'Mark Hanlan - Student at University of Toronto',
  link: 'https://ca.linkedin.com/in/mark-hanlan',
  snippet:
    'Mark Hanlan. Student at University of Toronto. City of Toronto Rotman Commerce, University of Toronto. Toronto, Ontario, Canada',
  source: 'LinkedIn · Mark Hanlan',
}

describe('profileParser', () => {
  it('prefers the result that matches the guest name', () => {
    expect(scoreLinkedInResult(auroraResult, 'Aurora Shen')).toBeGreaterThan(
      scoreLinkedInResult(wrongResult, 'Aurora Shen'),
    )
    expect(pickBestLinkedInResult([wrongResult, auroraResult], 'Aurora Shen')).toBe(auroraResult)
  })

  it('extracts structured fields from rich_snippet and snippet', () => {
    const profile = parseLinkedInProfile(auroraResult, 'Aurora Shen')

    expect(profile.headline).toContain("Economics Minor '28")
    expect(profile.location).toBe('Toronto, Ontario, Canada')
    expect(profile.company).toBe('Shoppers Drug Mart')
    expect(profile.followers).toBe('50+ followers')
    expect(profile.bio).toContain("Economics Minor '28 at University of Toronto")
    expect(profile.bio).not.toContain('LinkedIn ·')
    expect(profile.experienceSignal).toContain('Shoppers Drug Mart')
  })

  it('strips repeated names from titles', () => {
    expect(extractHeadlineFromTitle('Jane Doe - Product Manager at Acme', 'Jane Doe')).toBe(
      'Product Manager at Acme',
    )
  })

  it('falls back to title when Google returns boilerplate snippets', () => {
    const profile = parseLinkedInProfile(
      {
        title: 'Jia Ming Huang - Founder | Entrepreneur in Residence at ...',
        link: 'https://ca.linkedin.com/in/j-huang',
        displayed_link: '5.2K+ followers',
        snippet:
          "... Jia Ming Huang's profile on LinkedIn, a professional community of 1 billion members ... \"The CEMC has become Canada's largest and most recognized outreach ...",
        read_more_link:
          "https://ca.linkedin.com/in/j-huang#:~:text=%22The%20CEMC%20has%20become%20Canada's,in%20mathematics%20and%20computer%20science.",
      },
      'Jia Ming Huang',
    )

    expect(profile.headline).toContain('Founder')
    expect(profile.headline).not.toBe('..')
    expect(profile.company).toBe('')
    expect(profile.previewLimited).toBe(true)
    expect(profile.bio).toContain('Founder')
    expect(profile.bio).not.toContain('professional community of 1 billion members')
  })
})
