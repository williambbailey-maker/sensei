import type { Format, Vibe } from './types'

export const VIBES: { key: Vibe; label: string; emoji: string }[] = [
  { key: 'relax', label: 'Relax', emoji: '🛋️' },
  { key: 'sleep', label: 'Sleep', emoji: '🌙' },
  { key: 'social', label: 'Social', emoji: '🥂' },
  { key: 'creative', label: 'Creative', emoji: '🎨' },
  { key: 'focus', label: 'Focus', emoji: '🎯' },
  { key: 'energize', label: 'Energize', emoji: '⚡' },
  { key: 'body-high', label: 'Body high', emoji: '🌊' },
  { key: 'balance', label: 'Balance', emoji: '☯️' },
]

export const FORMATS: { key: Format; label: string; emoji: string }[] = [
  { key: 'flower', label: 'Flower', emoji: '🌸' },
  { key: 'pre-rolls', label: 'Pre-rolls', emoji: '🚬' },
  { key: 'vaporizers', label: 'Vapes', emoji: '💨' },
  { key: 'edibles', label: 'Edibles', emoji: '🍬' },
]

export const BUDGETS: { label: string; ceiling: number | null; band: '$' | '$$' | '$$$' | null }[] = [
  { label: 'Under $25', ceiling: 25, band: null },
  { label: 'Under $50', ceiling: 50, band: null },
  { label: 'Under $100', ceiling: 100, band: null },
  { label: 'No limit', ceiling: null, band: null },
]

export const vibeLabel = (v: string) => VIBES.find((x) => x.key === v)?.label ?? v
export const formatLabel = (f: string) => FORMATS.find((x) => x.key === f)?.label ?? f
