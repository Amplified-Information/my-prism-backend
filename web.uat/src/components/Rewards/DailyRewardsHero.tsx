import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const DailyRewardsHero = () => {
  const { wallet, connect } = useWallet();
  const { t } = useTranslation();

  const handleEnableRewards = async () => {
    if (!wallet.isConnected) {
      try {
        await connect();
        toast.success(t('rewards.walletConnected'));
      } catch (error) {
        toast.error(t('rewards.failedToConnect'));
      }
    } else {
      toast.success(t('rewards.rewardsEnabled'));
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  }).toUpperCase();

  return (
    <div className="relative overflow-hidden border-b border-border/40">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/80" />
      
      <div className="relative container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Badge */}
          <Badge variant="outline" className="border-primary/30 bg-primary/10">
            <Trophy className="mr-1 h-3 w-3" />
            {currentDate} {t('rewards.earnings')}
          </Badge>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold">
            <span className="text-transparent bg-gradient-to-r from-primary to-primary-glow bg-clip-text">
              {t('rewards.dailyRewards')}
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('rewards.description')}
          </p>

          {/* CTA Button */}
          <div className="pt-4">
            <Button 
              variant="trading"
              size="lg"
              onClick={handleEnableRewards}
              className="!text-black"
            >
              <Trophy className="mr-2 h-4 w-4" />
              {wallet.isConnected ? t('rewards.rewardsActive') : t('rewards.enableRewards')}
            </Button>
          </div>

          {/* Stats */}
          {wallet.isConnected && (
            <div className="pt-8 flex justify-center gap-8 text-sm">
              <div>
                <div className="text-2xl font-bold text-primary">($)0.00</div>
                <div className="text-muted-foreground">{t('rewards.todaysEarnings')}</div>
              </div>
              <div className="border-l border-border/40" />
              <div>
                <div className="text-2xl font-bold text-primary">($)0.00</div>
                <div className="text-muted-foreground">{t('rewards.totalEarnings')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyRewardsHero;
