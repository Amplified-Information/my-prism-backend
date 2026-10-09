import { useId } from 'react'
import type { MarketResponse } from '../gen/api'
import { getOutcomeStyles, getOutcomeHslValues } from '../lib/marketLabels'

interface MiniOutcomeWidgetProps {
  probability: number // 0-1 value
  market?: MarketResponse
}

const MiniOutcomeWidget = ({ probability, market }: MiniOutcomeWidgetProps) => {
  const yesPercent = Math.round(probability * 100)
  const noPercent = 100 - yesPercent

  const labels = getOutcomeStyles(market)
  const { yes: yesHsl, no: noHsl } = getOutcomeHslValues(market)

  // Default fallback colors (red→yellow→green) when no custom palette.
  const hasCustom = Boolean(yesHsl || noHsl)
  const noStopColor = noHsl ? `hsl(${noHsl})` : 'hsl(0, 84%, 60%)'
  const yesStopColor = yesHsl ? `hsl(${yesHsl})` : 'hsl(142, 76%, 36%)'
  const midStopColor = hasCustom ? undefined : 'hsl(45, 93%, 47%)'

  const noTextColor = noHsl ? `hsl(${noHsl})` : undefined
  const yesTextColor = yesHsl ? `hsl(${yesHsl})` : undefined

  // Unique gradient id per instance so custom colors don't bleed between cards.
  const reactId = useId().replace(/[:]/g, '')
  const gradientId = `miniGaugeGradient-${reactId}`

  const needleRotation = (probability - 0.5) * 180

  return (
    <div className="flex items-center justify-center gap-3">
      <span
        className={`text-xs font-semibold tabular-nums ${noTextColor ? '' : 'text-down'}`}
        style={noTextColor ? { color: noTextColor } : undefined}
      >
        {labels.no.label} {noPercent}%
      </span>

      <div className="relative w-10 h-5">
        <svg
          viewBox="0 0 200 110"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={noStopColor} />
              {midStopColor && <stop offset="50%" stopColor={midStopColor} />}
              <stop offset="100%" stopColor={yesStopColor} />
            </linearGradient>
          </defs>

          <path
            d="M 15 100 A 85 85 0 0 1 185 100"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.3"
          />

          <path
            d="M 15 100 A 85 85 0 0 1 185 100"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="16"
            strokeLinecap="round"
          />

          <g
            transform={`rotate(${needleRotation}, 100, 100)`}
            style={{ transition: 'transform 0.5s ease-out' }}
          >
            <polygon
              points="100,35 94,100 106,100"
              fill="white"
              filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
            />
            <circle cx="100" cy="100" r="10" fill="white" />
          </g>
        </svg>
      </div>

      <span
        className={`text-xs font-semibold tabular-nums ${yesTextColor ? '' : 'text-up'}`}
        style={yesTextColor ? { color: yesTextColor } : undefined}
      >
        {labels.yes.label} {yesPercent}%
      </span>
    </div>
  )
}

export default MiniOutcomeWidget
