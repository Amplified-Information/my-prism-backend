import type { MarketResponse } from '../gen/api'

/**
 * Per-market outcome labeling + theming. Internal `'yes' | 'no'` codes
 * stay everywhere (yes = side A, no = side B). This module is the single
 * source of truth for what to *display* and which color tokens to use.
 *
 * Backend exposes (proto fields 15-18 on MarketResponse):
 *   - aliasYes / aliasNo (string)        — display labels, empty = use default
 *   - hexColorYes / hexColorNo (string)  — '#RRGGBB' or 'RRGGBB', empty = default
 */

export interface OutcomeStyle {
  /** Display label, e.g. "Yes" or "Team A" */
  label: string
  /** Uppercase compact label for badges, e.g. "YES" / "TEAM A" */
  shortLabel: string
  /** CSS custom property name (without var()) for the color HSL triplet */
  colorVar: '--outcome-a' | '--outcome-b'
  /** Tailwind text color class */
  textClass: string
  /** Tailwind bg color class (use with /opacity modifier if needed) */
  bgClass: string
  /** Tailwind border color class */
  borderClass: string
}

export interface OutcomeStyles {
  /** Side A (internal code `'yes'`) */
  yes: OutcomeStyle
  /** Side B (internal code `'no'`) */
  no: OutcomeStyle
}

const DEFAULTS: OutcomeStyles = {
  yes: {
    label: 'Yes',
    shortLabel: 'YES',
    colorVar: '--outcome-a',
    textClass: 'text-outcome-a',
    bgClass: 'bg-outcome-a',
    borderClass: 'border-outcome-a',
  },
  no: {
    label: 'No',
    shortLabel: 'NO',
    colorVar: '--outcome-b',
    textClass: 'text-outcome-b',
    bgClass: 'bg-outcome-b',
    borderClass: 'border-outcome-b',
  },
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function getOutcomeStyles(market?: MarketResponse): OutcomeStyles {
  const aLabel = cleanString(market?.aliasYes)
  const bLabel = cleanString(market?.aliasNo)

  return {
    yes: aLabel
      ? { ...DEFAULTS.yes, label: aLabel, shortLabel: aLabel.toUpperCase() }
      : DEFAULTS.yes,
    no: bLabel
      ? { ...DEFAULTS.no, label: bLabel, shortLabel: bLabel.toUpperCase() }
      : DEFAULTS.no,
  }
}

/** Convert '#RRGGBB' (or 'RRGGBB' / '#RGB') to a Tailwind/CSS HSL triplet
 *  string like "142 76% 36%". Returns undefined on bad input. */
function hexToHslTriplet(hex: string): string | undefined {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let hue = 0, sat = 0
  if (max !== min) {
    const d = max - min
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)); break
      case g: hue = (b - r) / d + 2; break
      case b: hue = (r - g) / d + 4; break
    }
    hue *= 60
  }
  return `${Math.round(hue)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`
}

/** Accept either an HSL triplet ("142 76% 36%") or a hex string ('#RRGGBB'). */
function normalizeColor(raw?: string): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(raw) || /^[0-9a-fA-F]{3}$/.test(raw)) {
    return hexToHslTriplet(raw)
  }
  // assume already an HSL triplet
  return raw
}

/** Darken an HSL triplet by reducing lightness. Amount = percentage points. */
function darkenHsl(hsl: string, amount: number = 12): string {
  const match = hsl.match(/^(\d+(?:\.\d+)?)\s+(\d+)%\s+(\d+)%$/)
  if (!match) return hsl
  const h = match[1]
  const s = match[2]
  const l = Math.max(0, parseInt(match[3]) - amount)
  return `${h} ${s}% ${l}%`
}

/** Return raw HSL triplets for a market's outcomes (undefined = use defaults). */
export function getOutcomeHslValues(market?: MarketResponse): { yes?: string; no?: string } {
  return {
    yes: normalizeColor(cleanString(market?.hexColorYes)),
    no: normalizeColor(cleanString(market?.hexColorNo)),
  }
}

/**
 * Inline style object to scope per-market color overrides. Apply on the
 * Market page root so every descendant resolves `var(--outcome-a/b)` to
 * the market-specific HSL. Falls through to the global defaults when the
 * market doesn't specify colors.
 */
export function getOutcomeColorVars(market?: MarketResponse): React.CSSProperties {
  const a = normalizeColor(cleanString(market?.hexColorYes))
  const b = normalizeColor(cleanString(market?.hexColorNo))
  const style: Record<string, string> = {}
  // Override both the raw HSL triplet (consumed by hand-rolled `hsl(var(--outcome-a))`
  // call sites, e.g. GraphPrice canvas) AND the Tailwind v4 `--color-outcome-*` token
  // (consumed by utilities like `text-outcome-a`). The latter is required because
  // @theme inlines `--color-outcome-a: hsl(var(--outcome-a))` at :root, where
  // var() is substituted once against :root's --outcome-a — descendant overrides
  // of --outcome-a alone do NOT re-resolve it.
  if (a) {
    style['--outcome-a'] = a
    style['--color-outcome-a'] = `hsl(${a})`
  }
  if (b) {
    style['--outcome-b'] = b
    style['--color-outcome-b'] = `hsl(${b})`
  }
  return style as React.CSSProperties
}

/** WCAG relative luminance from an HSL triplet ("H S% L%"). 0 = black, 1 = white. */
function hslLuminance(hsl: string): number {
  const m = hsl.match(/^(\d+(?:\.\d+)?)\s+(\d+)%\s+(\d+)%$/)
  if (!m) return 0
  const h = parseFloat(m[1]) / 360
  const s = parseInt(m[2]) / 100
  const l = parseInt(m[3]) / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Pick a readable foreground (near-black or white) for a given outcome HSL triplet. */
export function getOutcomeContrastColor(hsl?: string): string | undefined {
  if (!hsl) return undefined
  return hslLuminance(hsl) > 0.5 ? 'hsl(0 0% 8%)' : 'hsl(0 0% 100%)'
}

/** Build inline styles for a selected outcome button using the raw HSL triplet.
 *  Includes a contrast-aware `color` so children inheriting currentColor stay legible. */
export function getOutcomeButtonStyle(hsl?: string): React.CSSProperties | undefined {
  if (!hsl) return undefined
  const dark = darkenHsl(hsl, 12)
  return {
    background: `linear-gradient(to bottom, hsl(${hsl}), hsl(${dark}))`,
    borderColor: `hsl(${hsl})`,
    boxShadow: `0 10px 15px -3px hsl(${hsl} / 0.3)`,
    color: getOutcomeContrastColor(hsl),
  } as React.CSSProperties
}
