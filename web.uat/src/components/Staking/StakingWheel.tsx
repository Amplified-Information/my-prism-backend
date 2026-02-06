import { ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export const StakingWheel = () => {
  const { t } = useTranslation();

  return (
    <div className="relative w-64 h-64 mx-auto">
      {/* SVG Circular Visualization */}
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Outer ring (xPRSM) - gradient fill showing growth */}
        <defs>
          <linearGradient id="xprsmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="prsmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
          opacity="0.2"
        />
        
        {/* Outer ring - xPRSM */}
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke="url(#xprsmGradient)"
          strokeWidth="16"
          strokeDasharray="534"
          strokeDashoffset="133.5"
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
          className="animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        />
        
        {/* Inner circle - PRSM */}
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="url(#prsmGradient)"
          opacity="0.4"
          className="animate-scale-in"
        />
        
        {/* Inner circle border */}
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          opacity="0.6"
        />
      </svg>
      
      {/* Center text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-center space-y-1">
          <div className="text-sm text-muted-foreground font-medium">{t('stake.exchangeRate')}</div>
          <div className="text-2xl font-bold text-foreground">1 {t('stake.prsm')}</div>
          <div className="flex items-center justify-center gap-1">
            <ArrowUp className="h-4 w-4 text-primary" />
            <div className="text-xl font-semibold text-primary">1.0 {t('stake.xprsm')}</div>
          </div>
        </div>
      </div>
      
      {/* Labels */}
      <div className="absolute -bottom-8 left-0 right-0 flex justify-between px-4 text-xs text-muted-foreground">
        <span>{t('stake.prsm')}</span>
        <span>{t('stake.xprsm')}</span>
      </div>
    </div>
  );
};