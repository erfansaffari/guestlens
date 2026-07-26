import { describe, expect, it } from 'vitest'
import { hasMeaningfulFullName, normaliseName } from './name'

describe('normaliseName', () => {
  it('normalises accents and punctuation without rejecting Unicode names', () => {
    expect(normaliseName('  Élodie  D’Ávila! ')).toBe('elodie d avila')
    expect(normaliseName('علی رضایی')).toBe('علی رضایی')
    expect(normaliseName('李 小龍')).toBe('李 小龍')
  })

  it('preserves hyphenated name tokens and detects full names', () => {
    expect(normaliseName('Jean-Luc Picard')).toBe('jean-luc picard')
    expect(hasMeaningfulFullName('Aarya Desai')).toBe(true)
    expect(hasMeaningfulFullName('Aarya')).toBe(false)
  })
})
