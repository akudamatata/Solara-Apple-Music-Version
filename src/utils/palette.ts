export interface BackgroundPalette {
  primary: string
  secondary: string
  tertiary: string
  accent: string
  accentSoft: string
  accentStrong: string
  panel: string
  panelBorder: string
  muted: string
}

export const DEFAULT_PALETTE: BackgroundPalette = {
  primary: 'rgba(118, 96, 255, 0.72)',
  secondary: 'rgba(12, 9, 32, 0.88)',
  tertiary: 'rgba(255, 132, 168, 0.5)',
  accent: '#ff6d9b',
  accentSoft: 'rgba(255, 109, 155, 0.45)',
  accentStrong: '#ff8bb3',
  panel: 'rgba(14, 12, 34, 0.72)',
  panelBorder: 'rgba(255, 255, 255, 0.08)',
  muted: 'rgba(255, 255, 255, 0.7)',
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const normalizeHue = (value: number) => {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

type RGB = [number, number, number]

type HSL = { h: number; s: number; l: number }

const toCss = ([r, g, b]: RGB, alpha = 1) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(3)})`

const mix = (color: RGB, target: RGB, amount: number): RGB => [
  color[0] + (target[0] - color[0]) * amount,
  color[1] + (target[1] - color[1]) * amount,
  color[2] + (target[2] - color[2]) * amount,
]

const rgbToHsl = (r: number, g: number, b: number): HSL => {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      default:
        h = (rNorm - gNorm) / d + 4
        break
    }
    h /= 6
  }

  return { h: h * 360, s, l }
}

const hueToRgb = (p: number, q: number, t: number) => {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

const hslToRgb = ({ h, s, l }: HSL): RGB => {
  const hue = normalizeHue(h) / 360
  if (s === 0) {
    const value = l * 255
    return [value, value, value]
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return [
    hueToRgb(p, q, hue + 1 / 3) * 255,
    hueToRgb(p, q, hue) * 255,
    hueToRgb(p, q, hue - 1 / 3) * 255,
  ]
}

const buildPalette = (base: RGB): BackgroundPalette => {
  const [r, g, b] = base
  const baseHsl = rgbToHsl(r, g, b)

  const glowHsl: HSL = {
    h: normalizeHue(baseHsl.h + 8),
    s: clamp01(baseHsl.s * 0.85 + 0.12),
    l: clamp01(baseHsl.l + 0.08),
  }

  const highlightHsl: HSL = {
    h: normalizeHue(baseHsl.h + 24),
    s: clamp01(baseHsl.s * 0.8 + 0.08),
    l: clamp01(baseHsl.l * 0.55 + 0.25),
  }

  const depthHsl: HSL = {
    h: normalizeHue(baseHsl.h - 12),
    s: clamp01(baseHsl.s * 0.6 + 0.05),
    l: clamp01(baseHsl.l * 0.22 + 0.12),
  }

  const sheenHsl: HSL = {
    h: normalizeHue(baseHsl.h + 4),
    s: clamp01(baseHsl.s * 0.75 + 0.1),
    l: clamp01(baseHsl.l * 0.45 + 0.38),
  }

  const accentRgb = hslToRgb(glowHsl)
  const accentStrongRgb = hslToRgb({ ...glowHsl, l: clamp01(glowHsl.l + 0.08) })
  const primaryRgb = hslToRgb({ ...highlightHsl, l: clamp01(highlightHsl.l + 0.12) })
  const tertiaryRgb = hslToRgb({ ...sheenHsl, h: normalizeHue(sheenHsl.h + 8) })
  const panelRgb = hslToRgb({ ...depthHsl, l: clamp01(depthHsl.l + 0.05) })
  const borderRgb = mix(panelRgb, [255, 255, 255], 0.12)
  const mutedRgb = mix(primaryRgb, [255, 255, 255], 0.55)

  return {
    primary: toCss(primaryRgb, 0.82),
    secondary: toCss(hslToRgb(depthHsl), 0.92),
    tertiary: toCss(tertiaryRgb, 0.68),
    accent: toCss(accentRgb),
    accentSoft: toCss(mix(accentRgb, [255, 255, 255], 0.35), 0.45),
    accentStrong: toCss(accentStrongRgb),
    panel: toCss(panelRgb, 0.7),
    panelBorder: toCss(borderRgb, 0.3),
    muted: toCss(mutedRgb, 0.78),
  }
}

const SAMPLE_SIZE = 64

const getImageDataAverage = (image: HTMLImageElement): RGB | null => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    return null
  }

  const width = SAMPLE_SIZE
  const height = SAMPLE_SIZE

  canvas.width = width
  canvas.height = height

  context.drawImage(image, 0, 0, width, height)

  try {
    const { data } = context.getImageData(0, 0, width, height)

    let r = 0
    let g = 0
    let b = 0
    let count = 0

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3] / 255
      if (alpha < 0.1) {
        continue
      }
      r += data[index] * alpha
      g += data[index + 1] * alpha
      b += data[index + 2] * alpha
      count += alpha
    }

    if (!count) {
      return null
    }

    return [r / count, g / count, b / count]
  } catch (error) {
    console.warn('Failed to sample artwork colors', error)
    return null
  }
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

export const extractPaletteFromImage = async (url: string): Promise<BackgroundPalette> => {
  try {
    const image = await loadImage(url)
    const average = getImageDataAverage(image)
    if (!average) {
      return DEFAULT_PALETTE
    }
    return buildPalette(average)
  } catch (error) {
    console.warn('Unable to generate palette from artwork', error)
    return DEFAULT_PALETTE
  }
}
