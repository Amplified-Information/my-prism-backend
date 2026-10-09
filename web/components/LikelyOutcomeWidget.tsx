import { Card, CardContent } from '../src/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../src/components/ui/tooltip'
import { Badge } from '../src/components/ui/badge'
import { AlertCircle, TrendingUp } from 'lucide-react'
export type ProbabilitySource = 'trade' | 'orderbook' | 'none'

interface LikelyOutcomeWidgetProps {
  probability: number // 0-1 value from price chart
  source?: ProbabilitySource // 'trade' | 'orderbook' | 'none'
}

const LikelyOutcomeWidget = ({ probability, source = 'none' }: LikelyOutcomeWidgetProps) => {
  const percentProbability = Math.round(probability * 100)
  const hasNoTrades = source === 'none' || source === 'orderbook'
  
  // Calculate needle rotation: -90deg (left/No) to 90deg (right/Yes)
  // probability 0 = -90deg, probability 0.5 = 0deg, probability 1 = 90deg
  const needleRotation = (probability - 0.5) * 180
  
  // Calculate color based on probability position on the gradient
  // Red (0) -> Yellow (0.5) -> Green (1)
  const getGradientColor = (p: number) => {
    if (p <= 0.5) {
      // Red to Yellow: interpolate hue from 0 to 45
      const hue = p * 2 * 45 // 0 at p=0, 45 at p=0.5
      const saturation = p <= 0.25 ? 84 : 84 + (p - 0.25) * 36 // 84 to 93
      const lightness = 60 - p * 26 // 60 at p=0, 47 at p=0.5
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`
    } else {
      // Yellow to Green: interpolate hue from 45 to 142
      const t = (p - 0.5) * 2 // 0 at p=0.5, 1 at p=1
      const hue = 45 + t * 97 // 45 at p=0.5, 142 at p=1
      const saturation = 93 - t * 17 // 93 to 76
      const lightness = 47 - t * 11 // 47 to 36
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`
    }
  }
  
  const probabilityColor = getGradientColor(probability)
  return (
    <Card className="h-full flex flex-col justify-center bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Likely Outcome
          </p>
          {hasNoTrades && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>No trades yet. Based on order book.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* Semi-radial gauge */}
        <div className="relative w-full max-w-[180px] aspect-[2/1]">
          <svg 
            viewBox="0 0 200 110" 
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(0, 84%, 60%)" /> {/* Red - No */}
                <stop offset="50%" stopColor="hsl(45, 93%, 47%)" /> {/* Yellow */}
                <stop offset="100%" stopColor="hsl(142, 76%, 36%)" /> {/* Green - Yes */}
              </linearGradient>
              <linearGradient id="gaugeGradientDark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(0, 84%, 25%)" />
                <stop offset="50%" stopColor="hsl(45, 93%, 20%)" />
                <stop offset="100%" stopColor="hsl(142, 76%, 18%)" />
              </linearGradient>
            </defs>
            
            {/* Background arc (darker) */}
            <path
              d="M 15 100 A 85 85 0 0 1 185 100"
              fill="none"
              stroke="url(#gaugeGradientDark)"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0.3"
            />
            
            {/* Foreground arc (colored) */}
            <path
              d="M 15 100 A 85 85 0 0 1 185 100"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            
            {/* Tick marks */}
            {[0, 25, 50, 75, 100].map((tick) => {
              const angle = (tick / 100) * 180 - 180 // -180 to 0
              const rad = (angle * Math.PI) / 180
              const innerR = 70
              const outerR = 78
              const x1 = 100 + innerR * Math.cos(rad)
              const y1 = 100 + innerR * Math.sin(rad)
              const x2 = 100 + outerR * Math.cos(rad)
              const y2 = 100 + outerR * Math.sin(rad)
              return (
                <line
                  key={tick}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )
            })}
            
            {/* Needle */}
            <g 
              transform={`rotate(${needleRotation}, 100, 100)`}
              style={{ transition: 'transform 0.5s ease-out' }}
            >
              {/* Needle body */}
              <polygon
                points="100,30 96,100 104,100"
                fill="white"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
              />
              {/* Needle center circle */}
              <circle
                cx="100"
                cy="100"
                r="8"
                fill="white"
                stroke="hsl(var(--muted))"
                strokeWidth="2"
              />
            </g>
            
          </svg>
        </div>
        
        {/* Probability display */}
        <div className="space-y-0.5">
          <p className="text-2xl font-bold" style={{ color: hasNoTrades ? 'hsl(var(--muted-foreground))' : probabilityColor }}>
            {percentProbability}%
          </p>
          <div className="flex items-center justify-center gap-1">
            {!hasNoTrades && <TrendingUp className="h-3 w-3 text-muted-foreground" />}
            <p className="text-xs text-muted-foreground">
              {hasNoTrades ? 'no trades yet' : 'last trade'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default LikelyOutcomeWidget
