import Header from "@/components/Layout/Header";
import GovernanceDashboard from "@/components/Governance/GovernanceDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGovernanceTokenBalance } from "@/hooks/useGovernanceTokenBalance";
import { useWallet } from "@/contexts/WalletContext";
import { Loader2, AlertCircle, Vote, Users, TrendingUp, ShieldCheck, Coins, Lock, Building2, Scale, GitBranch, Settings2, FileText, Wallet, Timer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Governance = () => {
  const { t } = useTranslation();
  const { wallet } = useWallet();
  const { tokenBalance, votingPower, isLoading, error } = useGovernanceTokenBalance();

  const daoStructure = [
    {
      icon: Wallet,
      title: t('governance.dao.tokenGovernance.title'),
      description: t('governance.dao.tokenGovernance.description'),
      color: "text-primary"
    },
    {
      icon: Scale,
      title: t('governance.dao.governanceScope.title'),
      description: t('governance.dao.governanceScope.description'),
      color: "text-primary"
    },
    {
      icon: GitBranch,
      title: t('governance.dao.proposalLifecycle.title'),
      description: t('governance.dao.proposalLifecycle.description'),
      color: "text-primary"
    }
  ];

  const governanceParameters = [
    {
      icon: FileText,
      label: t('governance.parameters.minXprsm.label'),
      value: t('governance.parameters.minXprsm.value'),
      description: t('governance.parameters.minXprsm.description')
    },
    {
      icon: Vote,
      label: t('governance.parameters.proposalQuorum.label'),
      value: t('governance.parameters.proposalQuorum.value'),
      description: t('governance.parameters.proposalQuorum.description')
    },
    {
      icon: ShieldCheck,
      label: t('governance.parameters.electionQuorum.label'),
      value: t('governance.parameters.electionQuorum.value'),
      description: t('governance.parameters.electionQuorum.description')
    },
    {
      icon: Timer,
      label: t('governance.parameters.votingDuration.label'),
      value: t('governance.parameters.votingDuration.value'),
      description: t('governance.parameters.votingDuration.description')
    }
  ];

  const governanceFeatures = [
    {
      icon: Vote,
      title: t('governance.features.voteOnProposals.title'),
      description: t('governance.features.voteOnProposals.description'),
      color: "text-primary"
    },
    {
      icon: Users,
      title: t('governance.features.communityDriven.title'),
      description: t('governance.features.communityDriven.description'),
      color: "text-primary"
    },
    {
      icon: ShieldCheck,
      title: t('governance.features.transparentProcess.title'),
      description: t('governance.features.transparentProcess.description'),
      color: "text-primary"
    },
    {
      icon: TrendingUp,
      title: t('governance.features.shapeFuture.title'),
      description: t('governance.features.shapeFuture.description'),
      color: "text-primary"
    }
  ];

  const howItWorks = [
    {
      step: "1",
      title: t('governance.howItWorks.step1.title'),
      description: t('governance.howItWorks.step1.description')
    },
    {
      step: "2",
      title: t('governance.howItWorks.step2.title'),
      description: t('governance.howItWorks.step2.description')
    },
    {
      step: "3",
      title: t('governance.howItWorks.step3.title'),
      description: t('governance.howItWorks.step3.description')
    },
    {
      step: "4",
      title: t('governance.howItWorks.step4.title'),
      description: t('governance.howItWorks.step4.description')
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">
            {t('governance.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('governance.subtitle')}
          </p>
        </div>

        {/* Token Balance Card */}
        <Card className="mb-8 bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  {t('governance.votingPower.title')}
                </CardTitle>
                <CardDescription>
                  {wallet.isConnected 
                    ? t('governance.votingPower.connectedDesc')
                    : t('governance.votingPower.disconnectedDesc')
                  }
                </CardDescription>
              </div>
              <Link to="/stake">
                <Button variant="outline" size="sm">
                  <Lock className="h-4 w-4 mr-2" />
                  {t('governance.votingPower.stakePrsm')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!wallet.isConnected ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('governance.votingPower.connectWallet')}
                </AlertDescription>
              </Alert>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('governance.votingPower.loadFailed')}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-3xl font-bold">{tokenBalance || 0}</p>
                  <p className="text-sm text-muted-foreground">{t('governance.votingPower.xprsmBalance')}</p>
                </div>
                {(tokenBalance || 0) > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {t('governance.votingPower.activeVoter')}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prism Market DAO Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              {t('governance.dao.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {t('governance.dao.subtitle')}
            </p>
          </div>

          {/* DAO Structure Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {daoStructure.map((item, index) => (
              <Card key={index} className="bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <item.icon className={`h-10 w-10 mb-4 ${item.color}`} />
                  <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Governance Parameters */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                {t('governance.parameters.title')}
              </CardTitle>
              <CardDescription>
                {t('governance.parameters.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {governanceParameters.map((param, index) => (
                  <div key={index} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <param.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">{param.label}</span>
                    </div>
                    <p className="text-2xl font-bold mb-1">{param.value}</p>
                    <p className="text-xs text-muted-foreground">{param.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Governance Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">{t('governance.features.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {governanceFeatures.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <feature.icon className={`h-10 w-10 mb-4 ${feature.color}`} />
                  <h3 className="font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">{t('governance.howItWorks.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item, index) => (
              <Card key={index} className="relative bg-gradient-to-br from-card to-card/50">
                <CardContent className="p-6">
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                    {item.step}
                  </div>
                  <div className="mt-4">
                    <h3 className="font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Governance Dashboard */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">{t('governance.activeProposals')}</h2>
          <GovernanceDashboard />
        </div>
      </main>
    </div>
  );
};

export default Governance;
