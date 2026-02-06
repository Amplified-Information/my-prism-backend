import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PortfolioHolding } from "@/hooks/usePortfolio";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface PortfolioHoldingsProps {
  holdings: PortfolioHolding[];
}
export const PortfolioHoldings = ({
  holdings
}: PortfolioHoldingsProps) => {
  const navigate = useNavigate();
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
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  return <Card>
      <CardHeader>
        <CardTitle>{t('portfolio.holdings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('portfolio.holdings.market')}</TableHead>
                <TableHead>{t('portfolio.holdings.position')}</TableHead>
                <TableHead className="text-right">{t('portfolio.holdings.shares')}</TableHead>
                <TableHead className="text-right">{t('portfolio.holdings.avgPrice')}</TableHead>
                <TableHead className="text-right">{t('portfolio.holdings.currentPrice')}</TableHead>
                <TableHead className="text-right">{t('portfolio.holdings.marketValue')}</TableHead>
                <TableHead className="text-right">{t('portfolio.holdings.pnl')}</TableHead>
                <TableHead className="text-right">{t('portfolio.holdings.endDate')}</TableHead>
                <TableHead className="text-right">{t('portfolio.holdings.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map(holding => <TableRow 
                  key={holding.id}
                  onClick={() => navigate(`/market/${holding.id}`)}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="max-w-xs">
                    <div className="truncate font-medium">
                      {holding.marketName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={holding.position === 'YES' ? 'default' : 'secondary'} className={holding.position === 'YES' ? 'bg-primary/20 text-primary' : 'bg-red-100 text-red-800'}>
                      {holding.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {holding.shares.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${holding.avgPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <div className="flex items-center justify-end gap-1">
                      ${holding.currentPrice.toFixed(2)}
                      {holding.change24h !== 0 && <div className={`flex items-center ${holding.change24h >= 0 ? 'text-primary' : 'text-red-600'}`}>
                          {holding.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          <span className="text-xs ml-1">
                            {Math.abs(holding.change24h).toFixed(1)}%
                          </span>
                        </div>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(holding.marketValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`font-mono ${holding.unrealizedPnL >= 0 ? 'text-primary' : 'text-red-600'}`}>
                      {formatCurrency(holding.unrealizedPnL)}
                      <div className="text-xs">
                        {formatPercent(holding.unrealizedPnLPercent)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDate(holding.endDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/market/${holding.id}`);
                      }}
                    >
                      {t('portfolio.holdings.trade')}
                    </Button>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>;
};