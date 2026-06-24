export type SerpOrganicResult = {
  title?: string
  link?: string
  snippet?: string
  thumbnail?: string
  source?: string
  displayed_link?: string
  rich_snippet?: {
    top?: {
      extensions?: string[]
    }
  }
  about_this_result?: {
    source?: {
      description?: string
      icon?: string
    }
  }
  read_more_link?: string
}

export type ParsedLinkedInProfile = {
  title: string
  url: string
  headline: string
  location: string
  company: string
  school: string
  role: string
  followers: string
  bio: string
  summary: string
  snippet: string
  description: string
  experienceSignal: string
  imageUrl: string
  previewLimited: boolean
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function looksLikeLocation(value: string) {
  const text = value.toLowerCase()
  if (/\bprofile on linkedin\b/.test(text)) return false
  if (/\bconnections on linkedin\b/.test(text)) return false
  return (
    /,\s*(canada|united states|uk|australia)\b/.test(text) ||
    /\b(area|region|metropolitan)\b/.test(text) ||
    /\b(on|bc|ab|qc|ns|nb|mb|sk|nl|pe|nt|nu|yt)\b/.test(text) ||
    /\b(greater|toronto|vancouver|montreal|waterloo|ottawa)\b/.test(text)
  )
}

function looksLikeFollowers(value: string) {
  return /\bfollowers?\b|\bconnections?\b/i.test(value)
}

function looksLikeSchool(value: string) {
  return /\b(university|college|school|institute|polytechnic|uwaterloo)\b/i.test(value)
}

function looksLikeBoilerplate(value: string) {
  const text = value.toLowerCase()
  return (
    text.includes('profile on linkedin') ||
    text.includes('professional community of') ||
    text.includes('see your mutual') ||
    /^\.{2,}$/.test(text.trim()) ||
    /^\.{2,}\s/.test(text)
  )
}

function looksLikeQuotedExcerpt(value: string) {
  const text = value.trim()
  return text.startsWith('"') || (text.startsWith('“') && text.length < 120)
}

function isLowQualityGoogleSnippet(value: string) {
  const text = value.toLowerCase()
  return (
    text.includes('profile on linkedin, a professional community') ||
    (text.includes('profile on linkedin') && isTruncated(value)) ||
    /^\.{2,}\s/.test(value.trim())
  )
}

function sanitizeSerpText(value: string) {
  return normalizeWhitespace(value.replace(/^\.{2,}\s*/, ''))
}

function isTruncated(value: string) {
  const trimmed = value.trim()
  return /(\.{3}|…)$/.test(trimmed) || /'\s*\.{3}$/.test(trimmed)
}

function stripLinkedInNoise(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\s*-\s*LinkedIn\s*$/i, '')
      .replace(/\s*\|\s*LinkedIn\s*$/i, '')
      .replace(/^LinkedIn\s*·\s*/i, '')
      .replace(/\bis an influencer\.?\b/gi, ' ')
      .replace(/^\.{3}\s*/, ''),
  )
}

function stripLinkedInBoilerplate(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\bView\s+[^.]+\s+profile on LinkedIn[^.]*\.?/gi, ' ')
      .replace(/\bSee your mutual connections?\b[^.]*\.?/gi, ' ')
      .replace(/\b\d+(?:\.\d+)?[Kk]?\+\s*connections?\s+on LinkedIn\b/gi, ' ')
      .replace(/\b\d+(?:\.\d+)?[Kk]?\+\s*connections?\b/gi, ' ')
      .replace(/\b\d+(?:\.\d+)?[Kk]?\+\s*followers?\b/gi, ' ')
      .replace(/\b500\+\s*connections?\b/gi, ' ')
      .replace(/\b\d+(?:\.\d+)?[Kk]\s+followers?\b/gi, ' ')
      .replace(/\b\d+\s+followers?\b/gi, ' '),
  )
}

export function extractHeadlineFromTitle(title: string, fullName: string) {
  const cleaned = stripLinkedInNoise(title)
  const dashParts = cleaned.split(/\s+-\s+/)

  if (dashParts.length >= 2) {
    const leading = dashParts[0]?.trim() || ''
    const nameTokens = fullName.toLowerCase().split(/\s+/).filter(Boolean)
    const leadingTokens = leading.toLowerCase().split(/\s+/).filter(Boolean)

    if (nameTokens.every((token) => leadingTokens.includes(token))) {
      return normalizeWhitespace(dashParts.slice(1).join(' - '))
    }
  }

  return cleaned
}

function stripLeadingName(text: string, fullName: string) {
  const cleaned = sanitizeSerpText(text)
  const pattern = new RegExp(`^${escapeRegExp(fullName)}['’]?[\\s.·-]+`, 'i')
  const withoutName = cleaned.replace(pattern, '')
  const possessivePattern = new RegExp(`^${escapeRegExp(fullName)}['’]?s[\\s.·-]+`, 'i')
  return normalizeWhitespace(withoutName.replace(possessivePattern, ''))
}

function isUsableSegment(value: string) {
  const segment = normalizeWhitespace(value)
  if (!segment || segment.length < 4) return false
  if (/^\.{1,3}$/.test(segment)) return false
  if (looksLikeBoilerplate(segment)) return false
  if (looksLikeQuotedExcerpt(segment)) return false
  return true
}

function parseSnippetSegments(snippet: string, fullName: string) {
  const body = stripLeadingName(snippet, fullName)
  if (!body) return []

  return body
    .split(/\.\s+/)
    .map((part) => sanitizeSerpText(part))
    .filter(isUsableSegment)
}

function splitCompanySchool(value: string) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { company: '', school: '' }

  const match = normalized.match(
    /^(.+?)\s+((?:University|College|Institute|School|Polytechnic)\b.+)$/i,
  )

  if (match) {
    return {
      company: match[1]?.trim() || '',
      school: match[2]?.trim() || '',
    }
  }

  if (looksLikeSchool(normalized)) {
    return { company: '', school: normalized }
  }

  return { company: normalized, school: '' }
}

function extractFollowers(...sources: string[]) {
  for (const source of sources) {
    const normalized = normalizeWhitespace(source)
    if (!normalized) continue

    if (looksLikeFollowers(normalized) && !looksLikeLocation(normalized)) {
      return normalized
    }

    const match = normalized.match(
      /\b(\d+(?:\.\d+)?[Kk]?\+?\s*(?:followers?|connections?)(?:\s+on\s+LinkedIn)?)\b/i,
    )
    if (match?.[1]) return normalizeWhitespace(match[1])
  }

  return ''
}

function parseRichSnippetExtensions(extensions: string[]) {
  let location = ''
  let company = ''
  let role = ''

  for (const extension of extensions.map((value) => normalizeWhitespace(value)).filter(Boolean)) {
    if (looksLikeFollowers(extension)) continue

    if (!location && looksLikeLocation(extension)) {
      location = extension
      continue
    }

    if (!role && !looksLikeSchool(extension) && !looksLikeLocation(extension)) {
      role = extension
      continue
    }

    if (!company && !looksLikeLocation(extension)) {
      company = extension
    }
  }

  return { location, company, role }
}

function pickStructuredFields(
  segments: string[],
  rich: { location: string; company: string; role: string },
) {
  let headline = ''
  let company = rich.company
  let school = ''
  let location = rich.location
  const role = rich.role

  for (const segment of segments) {
    if (looksLikeBoilerplate(segment)) continue

    if (looksLikeFollowers(segment)) continue

    if (!location && looksLikeLocation(segment)) {
      location = segment
      continue
    }

    if (!headline) {
      headline = segment
      continue
    }

    const split = splitCompanySchool(segment)
    if (split.school) {
      if (!company && split.company) company = split.company
      school = school ? `${school} · ${split.school}` : split.school
      continue
    }

    if (looksLikeSchool(segment)) {
      school = school ? `${school} · ${segment}` : segment
      continue
    }

    if (!company) {
      company = segment
    }
  }

  if (company && (looksLikeQuotedExcerpt(company) || looksLikeBoilerplate(company))) {
    company = rich.company || ''
  }

  return { headline, company, school, location, role }
}

function resolveHeadline(title: string, snippet: string, fullName: string, parsedHeadline: string) {
  const fromTitle = extractHeadlineFromTitle(title, fullName)
  const lowQualitySnippet = isLowQualityGoogleSnippet(snippet)

  if (lowQualitySnippet && fromTitle) {
    return fromTitle
  }

  const segments = parseSnippetSegments(snippet, fullName)
  const fromSnippet = segments.find(
    (segment) => !looksLikeLocation(segment) && !looksLikeFollowers(segment),
  )

  if (fromSnippet && !isTruncated(fromTitle) && fromSnippet.length <= fromTitle.length) {
    return fromTitle || fromSnippet
  }

  if (fromSnippet && (isTruncated(fromTitle) || fromSnippet.length > fromTitle.length)) {
    return fromSnippet
  }

  if (parsedHeadline && isUsableSegment(parsedHeadline) && (isTruncated(fromTitle) || parsedHeadline.length > fromTitle.length)) {
    return parsedHeadline
  }

  return fromTitle || parsedHeadline || fromSnippet || ''
}

function extractReadMorePreview(readMoreLink?: string) {
  if (!readMoreLink) return ''

  const match = readMoreLink.match(/#:~:text=([^&]+)/)
  if (!match?.[1]) return ''

  const decoded = decodeURIComponent(match[1])
  const parts = decoded.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  if (!parts.length) return ''

  return normalizeWhitespace(parts.join(' '))
}

function buildFullBio(result: SerpOrganicResult, fullName: string, headline: string) {
  const rawSnippet = sanitizeSerpText(result.snippet || '')
  const rawDescription = sanitizeSerpText(result.about_this_result?.source?.description || '')
  const readMorePreview = extractReadMorePreview(result.read_more_link)
  const lowQualitySnippet = isLowQualityGoogleSnippet(rawSnippet) || isLowQualityGoogleSnippet(rawDescription)

  if (lowQualitySnippet) {
    const parts = [headline, readMorePreview].filter(Boolean)
    return parts.join(' · ')
  }

  const snippetBio = stripLinkedInBoilerplate(stripLeadingName(stripLinkedInNoise(rawSnippet), fullName))
  const aboutBio = stripLinkedInBoilerplate(stripLeadingName(stripLinkedInNoise(rawDescription), fullName))

  if (aboutBio && aboutBio.length > snippetBio.length + 20 && !snippetBio.includes(aboutBio)) {
    return aboutBio
  }

  if (snippetBio && !isLowQualityGoogleSnippet(snippetBio)) return snippetBio

  const fallback = [headline, readMorePreview].filter(Boolean).join(' · ')
  return fallback || stripLinkedInBoilerplate(stripLeadingName(stripLinkedInNoise(result.title || ''), fullName))
}

function buildExperienceSignal(parts: {
  headline: string
  company: string
  school: string
  location: string
  role: string
}) {
  return [parts.role, parts.headline, parts.company, parts.school, parts.location]
    .filter(Boolean)
    .join(' · ')
}

function nameMatchScore(text: string, fullName: string) {
  const haystack = normalizeWhitespace(text).toLowerCase()
  const tokens = normalizeWhitespace(fullName).toLowerCase().split(/\s+/).filter((token) => token.length > 1)
  if (!tokens.length) return 0

  let matched = 0
  for (const token of tokens) {
    if (haystack.includes(token)) matched += 1
  }

  return matched / tokens.length
}

export function scoreLinkedInResult(result: SerpOrganicResult, fullName: string) {
  const haystack = normalizeWhitespace(
    [result.title, result.snippet, result.source, result.link].filter(Boolean).join(' '),
  ).toLowerCase()
  const normalizedName = normalizeWhitespace(fullName).toLowerCase()
  const nameTokens = normalizedName.split(/\s+/).filter((token) => token.length > 1)

  let score = 0
  if (haystack.includes(normalizedName)) score += 12

  for (const token of nameTokens) {
    if (haystack.includes(token)) score += 3
  }

  const titleLead = (result.title || '').split(/\s+-\s+/)[0]?.trim() || ''
  const titleMatch = nameMatchScore(titleLead, fullName)
  score += Math.round(titleMatch * 10)

  if (titleLead && titleMatch < 0.5) {
    score -= 20
  }

  if (result.link?.includes('linkedin.com/in')) score += 2

  return score
}

export function pickBestLinkedInResult(results: SerpOrganicResult[], fullName: string) {
  const linkedInResults = results.filter((result) => result.link?.includes('linkedin.com/in'))
  if (!linkedInResults.length) return null

  return linkedInResults.reduce((best, current) => {
    const bestScore = scoreLinkedInResult(best, fullName)
    const currentScore = scoreLinkedInResult(current, fullName)
    return currentScore > bestScore ? current : best
  })
}

export function parseLinkedInProfile(result: SerpOrganicResult, fullName: string): ParsedLinkedInProfile {
  const rawSnippet = sanitizeSerpText(result.snippet || '')
  const rawDescription = sanitizeSerpText(result.about_this_result?.source?.description || '')
  const snippet = rawDescription || rawSnippet || result.title || ''
  const previewLimited = isLowQualityGoogleSnippet(rawSnippet) || isLowQualityGoogleSnippet(rawDescription)
  const segments = parseSnippetSegments(snippet, fullName)
  const rich = parseRichSnippetExtensions(result.rich_snippet?.top?.extensions || [])
  const parsed = pickStructuredFields(segments, rich)

  const headline = resolveHeadline(result.title || '', snippet, fullName, parsed.headline)
  const location = parsed.location && !looksLikeBoilerplate(parsed.location) ? parsed.location : ''
  const company = parsed.company && !looksLikeBoilerplate(parsed.company) && !looksLikeQuotedExcerpt(parsed.company)
    ? parsed.company
    : rich.company || ''
  const school = parsed.school
  const role = parsed.role
  const followers =
    extractFollowers(result.displayed_link || '', snippet) ||
    (looksLikeFollowers(result.displayed_link || '') ? normalizeWhitespace(result.displayed_link || '') : '')
  const bio = buildFullBio(result, fullName, headline)
  const experienceSignal = buildExperienceSignal({
    headline,
    company,
    school,
    location,
    role,
  })

  const displayHeadline = headline || stripLinkedInNoise(result.title || '') || 'LinkedIn profile'

  return {
    title: displayHeadline,
    url: result.link || '',
    headline: displayHeadline,
    location,
    company,
    school,
    role,
    followers,
    bio,
    summary: bio,
    snippet: rawSnippet || bio,
    description: rawDescription || bio,
    experienceSignal,
    imageUrl: result.thumbnail || '',
    previewLimited,
  }
}
