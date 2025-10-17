export type AudioQuality = 'standard' | 'high' | 'very_high' | 'lossless'

export const AUDIO_QUALITY_OPTIONS: Array<{ value: AudioQuality; label: string }> = [
  { value: 'standard', label: '标准音质' },
  { value: 'high', label: '高频音质' },
  { value: 'very_high', label: '极高音质' },
  { value: 'lossless', label: '无损音质' },
]

export const QUALITY_TO_BR: Record<AudioQuality, number> = {
  standard: 128,
  high: 192,
  very_high: 320,
  lossless: 999,
}
