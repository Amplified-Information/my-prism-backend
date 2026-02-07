import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, PieChart } from "lucide-react";
import { PortfolioSummary } from "@/hooks/usePortfolio";
import { useTranslation } from "react-i18next";

interface PortfolioSummaryProps {
  summary: PortfolioSummary;
}

export const PortfolioSummaryCard = ({ summary }: PortfolioSummaryProps) => {
  const { t } = useTranslation();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('portfolio.summary.totalValue')}</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
          <p className="text-xs text-muted-foreground">
            {t('portfolio.summary.totalValueDesc')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('portfolio.summary.totalPnL')}</CardTitle>
          {summary.totalPnL >= 0 ? (
            <TrendingUp className="h-4 w-4 text-primary" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${summary.totalPnL >= 0 ? 'text-primary' : 'text-red-600'}`}>
            {formatCurrency(summary.totalPnL)}
          </div>
          <p className={`text-xs ${summary.totalPnL >= 0 ? 'text-primary' : 'text-red-600'}`}>
            {formatPercent(summary.totalPnLPercent)} {t('portfolio.summary.overall')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('portfolio.summary.dayChange')}</CardTitle>
          {summary.dayChange >= 0 ? (
            <TrendingUp className="h-4 w-4 text-primary" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${summary.dayChange >= 0 ? 'text-primary' : 'text-red-600'}`}>
            {formatCurrency(summary.dayChange)}
          </div>
          <p className={`text-xs ${summary.dayChange >= 0 ? 'text-primary' : 'text-red-600'}`}>
            {formatPercent(summary.dayChangePercent)} {t('portfolio.summary.today')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('portfolio.summary.totalCost')}</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
          <p className="text-xs text-muted-foreground">
            {t('portfolio.summary.totalCostDesc')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};