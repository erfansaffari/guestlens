import { describe, expect, it } from 'vitest'
import { parseFirstJsonObject } from './parseModelJson'

describe('parseFirstJsonObject', () => {
  it('parses plain JSON', () => {
    expect(parseFirstJsonObject('{"men": 1, "women": 2, "unknown": 0, "method": "test"}')).toEqual({
      men: 1,
      women: 2,
      unknown: 0,
      method: 'test',
    })
  })

  it('parses fenced JSON with trailing commentary', () => {
    const text = `\`\`\`json
{"men": 1, "women": 2, "unknown": 0, "method": "test"}
\`\`\`
Here is the breakdown by name.`

    expect(parseFirstJsonObject(text)).toEqual({
      men: 1,
      women: 2,
      unknown: 0,
      method: 'test',
    })
  })

  it('parses the first object when extra text follows', () => {
    const text = `{"men": 1, "women": 2, "unknown": 0, "method": "test"}
Some extra explanation that should be ignored.`

    expect(parseFirstJsonObject(text)).toEqual({
      men: 1,
      women: 2,
      unknown: 0,
      method: 'test',
    })
  })
})
