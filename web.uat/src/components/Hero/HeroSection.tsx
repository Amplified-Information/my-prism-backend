import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users, Store } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMarketStats } from "@/hooks/useMarketStats";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const HeroSection = () => {
  const navigate = useNavigate();
  const { wallet, connect } = useWallet();
  const { toast } = useToast();
  const { stats: marketStats, loading } = useMarketStats();
  const { t } = useTranslation();

  const stats = [
    {
      label: t('stats.tvl'),
      value: loading ? "..." : marketStats.totalVolume,
      icon: DollarSign
    },
    {
      label: t('stats.activeMarkets'),
      value: loading ? "..." : marketStats.activeMarkets.toString(),
      icon: Store
    },
    {
      label: t('stats.activeTraders'),
      subtitle: t('stats.tradersSubtitle'),
      value: loading ? "..." : marketStats.totalTraders,
      icon: Users
    },
    {
      label: t('stats.volume24h'),
      value: loading ? "..." : marketStats.volume24h,
      icon: TrendingUp
    }
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="relative container py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
                {t('hero.title')}
                <span className="block text-primary">
                  {t('hero.titleHighlight')}
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-lg">
                {t('hero.description')}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="trading" 
                size="xl" 
                onClick={async () => {
                  if (wallet.isConnected) {
                    navigate('/markets');
                  } else {
                    try {
                      await connect();
                      navigate('/markets');
                    } catch (error) {
                      toast({
                        title: t('wallet.connectionFailed'),
                        description: t('wallet.connectionFailedDesc'),
                        variant: "destructive"
                      });
                    }
                  }
                }} 
                className="!text-black"
              >
                {t('hero.startTrading')}
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/markets">
                  {t('hero.exploreMarkets')}
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-card to-card/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.label}
                      </p>
                      {stat.subtitle && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {stat.subtitle}
                        </p>
                      )}
                      <p className="text-2xl font-bold mt-1">
                        {stat.value}
                      </p>
                    </div>
                    <stat.icon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
