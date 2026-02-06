import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown, DollarSign, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import CompetitionIndicator from "./CompetitionIndicator";

interface RewardsTableProps {
  markets: any[];
  loading: boolean;
  favorites: Set<string>;
  onToggleFavorite: (marketId: string) => Promise<void>;
  isWalletConnected: boolean;
}

type SortField = 'maxSpread' | 'minShares' | 'reward' | 'earnings';
type SortDirection = 'asc' | 'desc';

const RewardsTable = ({ markets, loading, favorites, onToggleFavorite, isWalletConnected }: RewardsTableProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedMarkets = [...markets].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: number, bValue: number;

    switch (sortField) {
      case 'maxSpread':
        aValue = parseFloat(a.maxSpread.replace(/[^0-9.]/g, ''));
        bValue = parseFloat(b.maxSpread.replace(/[^0-9.]/g, ''));
        break;
      case 'minShares':
        aValue = a.minShares;
        bValue = b.minShares;
        break;
      case 'reward':
        aValue = a.reward;
        bValue = b.reward;
        break;
      case 'earnings':
        aValue = a.earnings;
        bValue = b.earnings;
        break;
      default:
        return 0;
    }

    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('rewards.noMarketsFound')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/40">
            <TableHead className="w-[300px]">{t('rewards.tableHeaders.market')}</TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('maxSpread')}
            >
              <div className="flex items-center gap-1">
                {t('rewards.tableHeaders.maxSpread')}
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('minShares')}
            >
              <div className="flex items-center gap-1">
                {t('rewards.tableHeaders.minShares')}
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('reward')}
            >
              <div className="flex items-center gap-1">
                {t('rewards.tableHeaders.reward')}
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead>{t('rewards.tableHeaders.competition')}</TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('earnings')}
            >
              <div className="flex items-center gap-1">
                {t('rewards.tableHeaders.earnings')}
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead>{t('rewards.tableHeaders.percent')}</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMarkets.map((market) => (
            <TableRow 
              key={market.id}
              className="cursor-pointer hover:bg-card/50 transition-colors border-b border-border/20"
              onClick={() => navigate(`/market/${market.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10" style={{ backgroundColor: `${market.categoryColor}20` }}>
                    <AvatarImage src={market.image_url} />
                    <AvatarFallback style={{ color: market.categoryColor }}>
                      {market.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium line-clamp-1">{market.name}</div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {market.category}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">{market.maxSpread}</TableCell>
              <TableCell className="font-mono text-sm">{market.minShares}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 font-semibold text-primary">
                  <span className="text-xs">($)</span>
                  {market.reward}
                </div>
              </TableCell>
              <TableCell>
                <CompetitionIndicator level={market.competition} />
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                ($){market.earnings.toFixed(2)}
              </TableCell>
              <TableCell>
                <div className="flex gap-2 text-xs">
                  <span className="text-yes font-medium">
                    {market.yesPercent.toFixed(0)}%
                  </span>
                  <span className="text-destructive font-medium">
                    {market.noPercent.toFixed(0)}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(market.id);
                  }}
                  disabled={!isWalletConnected}
                  className="group relative"
                  title={!isWalletConnected ? t('rewards.connectWalletToFavorite') : t('rewards.toggleFavorite')}
                >
                  <Star 
                    className={`h-4 w-4 transition-all ${
                      favorites.has(market.id) 
                        ? "fill-yellow-500 text-yellow-500" 
                        : "text-muted-foreground group-hover:text-yellow-500"
                    } ${!isWalletConnected ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default RewardsTable;
