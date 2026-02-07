import Header from "@/components/Layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { TrendingUp, Wallet } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { StakingWheel } from "@/components/Staking/StakingWheel";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const StakePRSM = () => {
  const { wallet, connect } = useWallet();
  const [stakeAmount, setStakeAmount] = useState("");
  const { t } = useTranslation();

  // Placeholder data
  const userPRSMBalance = 10000;

  const calculateXPRSM = () => {
    if (!stakeAmount) return 0;
    const amount = parseInt(stakeAmount, 10);
    // 1:1 conversion for flexible staking
    return isNaN(amount) ? 0 : amount;
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16">
        <div className="container mx-auto px-4 py-4 space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-bold">
              {t('stake.title')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('stake.subtitle')}
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
            {/* Left Column: Metrics & Wheel Card */}
            <Card className="border-2">
              <CardContent className="p-8 space-y-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
                    <CardHeader className="text-center">
                      <TrendingUp className="h-10 w-10 text-primary mx-auto mb-2" />
                      <CardDescription className="text-xs">{t('stake.approximateApr')}</CardDescription>
                      <CardTitle className="text-3xl font-bold text-primary">5%</CardTitle>
                    </CardHeader>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
                    <CardHeader className="text-center">
                      <Wallet className="h-10 w-10 text-primary mx-auto mb-2" />
                      <CardDescription className="text-xs">{t('stake.totalValueLocked')}</CardDescription>
                      <CardTitle className="text-3xl font-bold text-primary">$250,000</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Staking Wheel Visualization */}
                <div className="py-4">
                  <StakingWheel />
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Staking Form */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle>{t('stake.stakeTokens')}</CardTitle>
                <CardDescription>
                  {t('stake.stakeTokensDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="amount">{t('stake.amountToStake')}</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0"
                    min="0"
                    step="1"
                    value={stakeAmount}
                    onKeyDown={(e) => {
                      if (e.key === '-') {
                        e.preventDefault();
                        toast({
                          title: t('stake.invalidInput'),
                          description: t('stake.positiveAmountsOnly'),
                          variant: "destructive",
                        });
                      } else if (e.key === '.' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault();
                        toast({
                          title: t('stake.invalidInput'),
                          description: t('stake.wholeNumbersOnly'),
                          variant: "destructive",
                        });
                      }
                    }}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="text-lg h-12 focus-visible:ring-primary"
                  />
                  <div className="text-sm text-muted-foreground">
                    {t('stake.available')} {userPRSMBalance.toLocaleString()} {t('stake.prsm')}
                  </div>
                </div>

                {stakeAmount && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="text-sm text-muted-foreground mb-1">{t('stake.youWillReceive')}</div>
                    <div className="text-2xl font-bold text-primary">
                      {calculateXPRSM()} {t('stake.xprsm')}
                    </div>
                  </div>
                )}

                {!wallet.isConnected ? (
                  <Button variant="trading" className="w-full h-12 !text-black" size="lg" onClick={connect}>
                    {t('stake.connectWalletToStake')}
                  </Button>
                ) : (
                  <Button variant="trading" className="w-full h-12 !text-black" size="lg" disabled>
                    {t('stake.stakePrsmComingSoon')}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* How it Works */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">{t('stake.howItWorks')}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <CardTitle className="text-lg">{t('stake.step1Title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('stake.step1Desc')}
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <CardTitle className="text-lg">{t('stake.step2Title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('stake.step2Desc')}
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <CardTitle className="text-lg">{t('stake.step3Title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t('stake.step3Desc')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default StakePRSM;