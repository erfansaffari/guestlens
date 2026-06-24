export type Attendee = {
  id: string
  fullName: string
  company?: string
  title?: string
  location?: string
  raw: string
}

const headerAliases: Record<string, keyof Attendee> = {
  name: 'fullName',
  'full name': 'fullName',
  fullname: 'fullName',
  attendee: 'fullName',
  guest: 'fullName',
  company: 'company',
  organization: 'company',
  org: 'company',
  title: 'title',
  role: 'title',
  job: 'title',
  location: 'location',
  city: 'location',
  place: 'location',
}

function splitCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

function normalizeName(value: string) {
  return value
    .replace(/^profile picture for\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^@/, '')
    .replace(/\s+\(.+?\)$/, '')
    .trim()
}

function isNoiseLine(line: string) {
  return /^(going|went|interested|waitlist|host|hosts|speaker|speakers|sponsor|sponsors)$/i.test(line)
}

function looksLikePersonName(value: string) {
  const normalized = normalizeName(value)
  if (!normalized || normalized.length < 2) return false
  if (isNoiseLine(normalized)) return false
  if (/https?:\/\//i.test(normalized)) return false
  if (/@/.test(normalized)) return false
  if (/\d/.test(normalized)) return false
  if (normalized.split(/\s+/).length > 5) return false

  return /^[\p{L}.' -]+$/u.test(normalized)
}

function looksLikeHeader(cells: string[]) {
  return cells.some((cell) => headerAliases[cell.trim().toLowerCase()])
}

function fromCsv(lines: string[]) {
  const rows = lines.map(splitCsvLine)
  const headers = rows[0].map((header) => headerAliases[header.trim().toLowerCase()])
  const dataRows = looksLikeHeader(rows[0]) ? rows.slice(1) : rows

  return dataRows
    .map((row, index) => {
      const attendee: Attendee = {
        id: `guest-${index + 1}`,
        fullName: '',
        raw: row.join(', '),
      }

      row.forEach((cell, cellIndex) => {
        const key = headers[cellIndex]
        if (key && key !== 'id' && key !== 'raw') {
          attendee[key] = cell.trim()
        }
      })

      if (!attendee.fullName) {
        attendee.fullName = normalizeName(row[0] || '')
        attendee.company = row[1]?.trim() || undefined
        attendee.title = row[2]?.trim() || undefined
        attendee.location = row[3]?.trim() || undefined
      }

      attendee.fullName = normalizeName(attendee.fullName)
      return attendee
    })
    .filter((attendee) => attendee.fullName.length > 1)
}

export function parseGuestList(input: string): Attendee[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isNoiseLine(line))

  if (!lines.length) return []

  const commaLikeRows = lines.filter((line) => line.includes(',')).length

  if (commaLikeRows >= Math.max(1, lines.length / 2)) {
    return dedupeAttendees(fromCsv(lines))
  }

  return dedupeAttendees(
    lines.map((line, index) => {
      const parts = line
        .split(/\t|\s{2,}| \| | - /)
        .map((part) => part.trim())
        .filter(Boolean)

      const fullName = normalizeName(parts[0] || line)

      return {
        id: `guest-${index + 1}`,
        fullName,
        company: parts[1],
        title: parts[2],
        location: parts[3],
        raw: line,
      }
    }).filter((attendee) => looksLikePersonName(attendee.fullName)),
  )
}

function dedupeAttendees(attendees: Attendee[]) {
  const seen = new Set<string>()

  return attendees.filter((attendee) => {
    const key = attendee.fullName.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const sampleGuestList = `Name,Company,Title,Location
Sarah Chen,Northstar Labs,Product Lead,Toronto
Michael Rivera,Arc Studio,Founder,New York
Priya Shah,Beacon AI,Investor,Toronto
Alex Kim,Independent,Designer,Montreal
Daniel Martins,Layer Fund,Partner,San Francisco
Emma Wilson,Field Notes,Community Manager,Toronto`

export const sampleLumaGuestList = `Profile picture for Erfan Saffari
Erfan Saffari
Profile picture for Aahaan Maini
Aahaan Maini
Profile picture for Aarya
Aarya
Profile picture for Aarya Desai
Aarya Desai
Profile picture for Aaryaman Saini
Aaryaman Saini
Profile picture for Achita Anantachina
Achita Anantachina`
