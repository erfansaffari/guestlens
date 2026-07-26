/** A comparison key only; callers must preserve the supplied display name. */
export function normaliseName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hasMeaningfulFullName(value: string) {
  return normaliseName(value).split(/\s+/).filter((token) => token.length > 0).length >= 2
}
