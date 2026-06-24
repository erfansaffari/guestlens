const canadianProvincePattern =
  /\b([A-Z][a-zA-Z.' -]{2,}),\s*(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/

const usStatePattern =
  /\b([A-Z][a-zA-Z.' -]{2,}),\s*(A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\b/

export function extractSearchContext(eventContext?: string) {
  if (!eventContext) return undefined

  const normalized = eventContext.replace(/\s+/g, ' ').trim()
  const provinceMatch = normalized.match(canadianProvincePattern)
  const stateMatch = normalized.match(usStatePattern)
  const country = provinceMatch ? 'Canada' : stateMatch ? 'United States' : undefined

  if (country) return country

  const withoutDateNoise = normalized
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, ' ')
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*(AM|PM)\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return withoutDateNoise || undefined
}
