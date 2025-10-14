export interface ParsedLyricLine {
  time: number
  text: string
}

export interface LyricLine extends ParsedLyricLine {
  translation?: string
}

const TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g

const toSeconds = (minutes: number, seconds: number, milliseconds: number) => {
  return minutes * 60 + seconds + milliseconds / 1000
}

export const parseLrc = (lrc?: string | null): ParsedLyricLine[] => {
  if (!lrc) {
    return []
  }

  const lines = lrc
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)

  const result: ParsedLyricLine[] = []

  for (const line of lines) {
    TIMESTAMP_REGEX.lastIndex = 0
    const matches = Array.from(line.matchAll(TIMESTAMP_REGEX))

    if (!matches.length) {
      continue
    }

    const text = line.replace(TIMESTAMP_REGEX, '').trim()
    if (!text) {
      continue
    }

    for (const match of matches) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const milliseconds = match[3] ? Number(match[3].padEnd(3, '0')) : 0
      const time = toSeconds(minutes, seconds, milliseconds)
      result.push({ time, text })
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

export const mergeLyrics = (
  original?: string | null,
  translated?: string | null,
): LyricLine[] => {
  const base = parseLrc(original)
  const translatedLines = parseLrc(translated)

  if (!translatedLines.length) {
    return base
  }

  const translationMap = new Map<number, string>()
  for (const line of translatedLines) {
    const key = Math.round(line.time * 100)
    if (!translationMap.has(key)) {
      translationMap.set(key, line.text)
    }
  }

  return base.map((line) => {
    const key = Math.round(line.time * 100)
    return {
      ...line,
      translation: translationMap.get(key),
    }
  })
}
