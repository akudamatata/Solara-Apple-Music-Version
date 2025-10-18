// ✅ Performance optimized automatically by Codex
const CANVAS_SIZE = 1440
const SAMPLE_SIZE = 40

type RGB = [number, number, number]

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value))

const mix = (a: RGB, b: RGB, amount: number): RGB => [
  a[0] + (b[0] - a[0]) * amount,
  a[1] + (b[1] - a[1]) * amount,
  a[2] + (b[2] - a[2]) * amount,
]

const lighten = (color: RGB, amount: number): RGB => mix(color, [255, 255, 255], amount)

const darken = (color: RGB, amount: number): RGB => mix(color, [0, 0, 0], amount)

const toColorString = (color: RGB, alpha = 1) =>
  `rgba(${Math.round(clamp(color[0]))}, ${Math.round(clamp(color[1]))}, ${Math.round(
    clamp(color[2]),
  )}, ${alpha.toFixed(3)})`

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

const extractDominantColors = (image: HTMLImageElement): { base: RGB; highlight: RGB; shadow: RGB } => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    return {
      base: [118, 96, 255],
      highlight: [180, 150, 255],
      shadow: [20, 18, 42],
    }
  }

  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE

  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

  let totalWeight = 0
  let base: RGB = [0, 0, 0]
  let highlight: RGB = [0, 0, 0]
  let highlightWeight = 0
  let shadow: RGB = [0, 0, 0]
  let shadowWeight = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255
    if (alpha < 0.1) {
      continue
    }

    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]

    const weight = alpha
    totalWeight += weight
    base = [base[0] + r * weight, base[1] + g * weight, base[2] + b * weight]

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max

    if (luminance > 170 || (luminance > 140 && saturation > 0.35)) {
      highlight = [highlight[0] + r * weight, highlight[1] + g * weight, highlight[2] + b * weight]
      highlightWeight += weight
    } else if (luminance < 70 || (luminance < 110 && saturation < 0.25)) {
      shadow = [shadow[0] + r * weight, shadow[1] + g * weight, shadow[2] + b * weight]
      shadowWeight += weight
    }
  }

  if (!totalWeight) {
    return {
      base: [118, 96, 255],
      highlight: [180, 150, 255],
      shadow: [20, 18, 42],
    }
  }

  const averageBase: RGB = [base[0] / totalWeight, base[1] / totalWeight, base[2] / totalWeight]

  const averageHighlight: RGB = highlightWeight
    ? [highlight[0] / highlightWeight, highlight[1] / highlightWeight, highlight[2] / highlightWeight]
    : lighten(averageBase, 0.32)

  const averageShadow: RGB = shadowWeight
    ? [shadow[0] / shadowWeight, shadow[1] / shadowWeight, shadow[2] / shadowWeight]
    : darken(averageBase, 0.45)

  return {
    base: averageBase,
    highlight: averageHighlight,
    shadow: averageShadow,
  }
}

export const generateAppleMusicStyleBackground = async (url: string): Promise<string> => {
  const image = await loadImage(url)
  await image.decode?.()

  const { base, highlight, shadow } = extractDominantColors(image)

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to create canvas context for background generation')
  }

  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE

  const softenedBase = darken(base, 0.25)
  const accent = mix(highlight, base, 0.4)
  const deepShadow = darken(shadow, 0.2)

  const radial = context.createRadialGradient(
    CANVAS_SIZE * 0.3,
    CANVAS_SIZE * 0.3,
    CANVAS_SIZE * 0.18,
    CANVAS_SIZE * 0.7,
    CANVAS_SIZE * 0.75,
    CANVAS_SIZE * 0.95,
  )
  radial.addColorStop(0, toColorString(lighten(highlight, 0.15), 0.95))
  radial.addColorStop(0.22, toColorString(highlight, 0.9))
  radial.addColorStop(0.48, toColorString(accent, 0.86))
  radial.addColorStop(0.74, toColorString(softenedBase, 0.92))
  radial.addColorStop(1, toColorString(deepShadow, 0.98))

  context.save()
  context.setTransform(1.04, 0, 0, 1.04, -CANVAS_SIZE * 0.02, -CANVAS_SIZE * 0.02)
  context.filter = 'blur(12px)'
  context.fillStyle = radial
  context.fillRect(0, 0, CANVAS_SIZE * 1.04, CANVAS_SIZE * 1.04)
  context.restore()

  const linear = context.createLinearGradient(0, CANVAS_SIZE * 0.2, CANVAS_SIZE, CANVAS_SIZE * 0.9)
  linear.addColorStop(0, toColorString(lighten(highlight, 0.22), 0.6))
  linear.addColorStop(0.45, toColorString(base, 0.45))
  linear.addColorStop(0.78, toColorString(mix(base, shadow, 0.5), 0.68))
  linear.addColorStop(1, toColorString(deepShadow, 0.88))

  context.globalAlpha = 0.9
  context.fillStyle = linear
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  context.globalAlpha = 1

  const noiseSize = 256
  const noiseCanvas = document.createElement('canvas')
  noiseCanvas.width = noiseSize
  noiseCanvas.height = noiseSize
  const noiseContext = noiseCanvas.getContext('2d')

  if (noiseContext) {
    const noiseData = noiseContext.createImageData(noiseSize, noiseSize)
    const { data } = noiseData
    for (let index = 0; index < data.length; index += 4) {
      const value = Math.floor(Math.random() * 256)
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
      data[index + 3] = 255
    }
    noiseContext.putImageData(noiseData, 0, 0)

    const pattern = context.createPattern(noiseCanvas, 'repeat')
    if (pattern) {
      context.save()
      context.globalAlpha = 0.02
      context.fillStyle = pattern
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      context.restore()
    }
  }

  return canvas.toDataURL('image/jpeg', 0.9)
}

export default generateAppleMusicStyleBackground
