function stripCodeFences(text: string) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

export function parseFirstJsonObject(text: string): unknown {
  const cleaned = stripCodeFences(text.trim())

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    if (start === -1) {
      throw new Error('No JSON object found in model response.')
    }

    let depth = 0
    let inString = false
    let escaped = false

    for (let index = start; index < cleaned.length; index += 1) {
      const char = cleaned[index]

      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }

        if (char === '\\') {
          escaped = true
          continue
        }

        if (char === '"') {
          inString = false
        }

        continue
      }

      if (char === '"') {
        inString = true
        continue
      }

      if (char === '{') depth += 1
      if (char === '}') {
        depth -= 1
        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, index + 1))
        }
      }
    }

    throw new Error('Unbalanced JSON object in model response.')
  }
}
