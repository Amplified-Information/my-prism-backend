import { useStatsContext } from '../src/contexts/StatsContext'
import { DollarSign, Building2, Users, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const Stats = () => {
  const { nMarkets, tvlUsd, totalVolumeUsd, activeTraders } = useStatsContext()
  const { t } = useTranslation()
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`
    }
    if (num >= 1000) {
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return `$${num.toFixed(2)}`
  }

  const stats = [
    { 
      label: t('stats.tv_locked', 'Total Value Locked'),
      value: formatNumber(tvlUsd || 0),
      icon: DollarSign
    },
    { 
      label: t('stats.activeMarkets', 'Active Event Prediction Markets'),
      value: nMarkets || 0,
      icon: Building2
    },
    { 
      label: t('stats.activeTraders', 'Active Traders'),
      sublabelBelow: t('stats.activeTradersNote', '(As measured by activity over the last month.)'),
      value: activeTraders.toLocaleString(),
      icon: Users,
      valueColor: activeTraders > 0 ? undefined : 'text-orange-500'
    },
    { 
      label: t('stats.volume24h', '24h Volume'),
      value: formatNumber(totalVolumeUsd?.['24h'] || 0),
      icon: TrendingUp
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <div
            key={i}
            className="relative px-4 py-4 border border-border/50 rounded-lg bg-background/50 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-background/80"
          >
            {/* Icon - top right */}
            <div className="absolute top-3 right-3 text-primary/80">
              <Icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            
            {/* Label */}
            <div className="text-xs text-muted-foreground mb-1 pr-6 leading-tight">
              {stat.label}
            </div>
            
            {/* Value */}
            <div className={`text-xl lg:text-2xl font-semibold ${stat.valueColor || 'text-foreground'}`}>
              {stat.value}
            </div>

            {/* Sublabel below value if it exists */}
            {stat.sublabelBelow && (
              <div className="text-[10px] text-muted-foreground/60 mt-1 pr-6 leading-tight">
                {stat.sublabelBelow}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default Stats
