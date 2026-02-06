import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGovernance } from "@/hooks/useGovernance";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslation } from "react-i18next";
import { 
  Vote, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  Coins,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import type { MarketProposal, VoteChoice } from "@/types/governance";

const GovernanceDashboard = () => {
  const { wallet } = useWallet();
  const { t } = useTranslation();
  const {
    userBalance,
    activeProposals,
    userProposals,
    userVotes,
    vote,
    isVoting,
    submitProposal,
    isSubmittingProposal,
    getProposalQuorum,
    getElectionQuorum,
  } = useGovernance();

  const formatVotingPower = (power: number) => {
    if (power >= 1000000) {
      return `${(power / 1000000).toFixed(1)}M`;
    }
    if (power >= 1000) {
      return `${(power / 1000).toFixed(1)}K`;
    }
    return power.toString();
  };

  const getProposalStatus = (proposal: MarketProposal) => {
    const now = new Date();
    
    if (proposal.governance_status === 'proposal' || proposal.governance_status === 'voting') {
      const endDate = new Date(proposal.voting_end_date || '');
      if (now > endDate) {
        return t('marketFactory.dashboard.proposalPhaseEnded');
      }
      return t('marketFactory.dashboard.proposalVoting');
    }
    
    if (proposal.governance_status === 'election') {
      const endDate = new Date(proposal.election_end_date || '');
      if (now > endDate) {
        return t('marketFactory.dashboard.electionEnded');
      }
      return t('marketFactory.dashboard.electionVoting');
    }
    
    return proposal.governance_status;
  };

  const getQuorumProgress = (proposal: MarketProposal) => {
    const isElection = proposal.governance_status === 'election';
    const totalVotingPower = isElection 
      ? proposal.election_voting_power_for + proposal.election_voting_power_against + proposal.election_voting_power_abstain
      : proposal.proposal_voting_power_for + proposal.proposal_voting_power_against + proposal.proposal_voting_power_abstain;
    
    const requiredQuorum = isElection ? getElectionQuorum() : getProposalQuorum();
    
    return (totalVotingPower / Number(requiredQuorum)) * 100;
  };

  const hasUserVoted = (proposalId: string, isElection: boolean = false) => {
    return userVotes?.some(vote => 
      vote.proposal_id === proposalId && 
      vote.is_proposal_phase !== isElection &&
      ((vote as any).wallet_id === wallet.accountId || vote.voter_id === wallet.accountId)
    );
  };

  const handleVote = (proposalId: string, choice: VoteChoice, isElection: boolean = false) => {
    vote({ 
      proposalId, 
      voteChoice: choice, 
      isProposalPhase: !isElection 
    });
  };

  if (!wallet.isConnected) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('marketFactory.dashboard.connectWalletDashboard')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User voting power card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            {t('marketFactory.dashboard.yourVotingPower')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('marketFactory.dashboard.tokenBalance')}</p>
              <p className="text-2xl font-bold">
                {formatVotingPower(userBalance?.token_balance || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('marketFactory.dashboard.stakedBalance')}</p>
              <p className="text-2xl font-bold">
                {formatVotingPower(userBalance?.staked_balance || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('marketFactory.dashboard.totalVotingPower')}</p>
              <p className="text-2xl font-bold text-primary">
                {formatVotingPower(userBalance?.total_voting_power || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">{t('marketFactory.dashboard.activeProposals')}</TabsTrigger>
          <TabsTrigger value="my-proposals">{t('marketFactory.dashboard.myProposals')}</TabsTrigger>
          <TabsTrigger value="voting-history">{t('marketFactory.dashboard.votingHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeProposals?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Vote className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{t('marketFactory.dashboard.noActiveProposals')}</p>
              </CardContent>
            </Card>
          ) : (
            activeProposals?.map((proposal) => {
              const isElection = proposal.governance_status === 'election';
              const userVoted = hasUserVoted(proposal.id, isElection);
              const quorumProgress = getQuorumProgress(proposal);
              
              return (
                <Card key={proposal.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{proposal.market_title}</CardTitle>
                        <CardDescription>{proposal.title}</CardDescription>
                      </div>
                      <Badge variant={isElection ? "default" : "secondary"}>
                        {getProposalStatus(proposal)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {proposal.image_url && (
                      <div className="w-full h-32 overflow-hidden rounded-lg">
                        <img 
                          src={proposal.image_url} 
                          alt={proposal.market_title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {proposal.market_description}
                    </p>
                    
                    {/* Voting progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t('marketFactory.dashboard.quorumProgress')}</span>
                        <span>{quorumProgress.toFixed(1)}%</span>
                      </div>
                      <Progress value={Math.min(quorumProgress, 100)} />
                    </div>

                    {/* Vote counts */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('marketFactory.dashboard.for')}</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatVotingPower(
                            isElection 
                              ? proposal.election_voting_power_for 
                              : proposal.proposal_voting_power_for
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('marketFactory.dashboard.against')}</p>
                        <p className="text-lg font-semibold text-red-600">
                          {formatVotingPower(
                            isElection 
                              ? proposal.election_voting_power_against 
                              : proposal.proposal_voting_power_against
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('marketFactory.dashboard.abstain')}</p>
                        <p className="text-lg font-semibold text-gray-600">
                          {formatVotingPower(
                            isElection 
                              ? proposal.election_voting_power_abstain 
                              : proposal.proposal_voting_power_abstain
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Voting buttons */}
                    {!userVoted && getProposalStatus(proposal) !== t('marketFactory.dashboard.proposalPhaseEnded') && getProposalStatus(proposal) !== t('marketFactory.dashboard.electionEnded') && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleVote(proposal.id, 'yes', isElection)}
                          disabled={isVoting}
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t('marketFactory.dashboard.voteFor')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleVote(proposal.id, 'no', isElection)}
                          disabled={isVoting}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t('marketFactory.dashboard.voteAgainst')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVote(proposal.id, 'abstain', isElection)}
                          disabled={isVoting}
                          className="flex-1"
                        >
                          {t('marketFactory.dashboard.abstain')}
                        </Button>
                      </div>
                    )}
                    
                    {userVoted && (
                      <div className="text-center">
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('marketFactory.dashboard.youHaveVoted')}
                        </Badge>
                      </div>
                    )}

                    {/* Time remaining */}
                    <div className="flex items-center justify-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {t('marketFactory.dashboard.ends')} {new Date(
                        isElection 
                          ? proposal.election_end_date || ''
                          : proposal.voting_end_date || ''
                      ).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="my-proposals" className="space-y-4">
          {userProposals?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{t('marketFactory.dashboard.noProposalsYet')}</p>
              </CardContent>
            </Card>
          ) : (
            userProposals?.map((proposal) => (
              <Card key={proposal.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{proposal.market_title}</CardTitle>
                      <CardDescription>{proposal.title}</CardDescription>
                    </div>
                    <Badge>{proposal.governance_status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {proposal.image_url && (
                    <div className="w-full h-32 overflow-hidden rounded-lg mb-4">
                      <img 
                        src={proposal.image_url} 
                        alt={proposal.market_title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('marketFactory.dashboard.created')} {new Date(proposal.created_at).toLocaleString()}
                  </p>
                  
                  {proposal.governance_status === 'draft' && (
                    <Button 
                      size="sm"
                      onClick={() => submitProposal(proposal.id)}
                      disabled={isSubmittingProposal}
                    >
                      {isSubmittingProposal ? t('marketFactory.dashboard.submitting') : t('marketFactory.dashboard.submitForVoting')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="voting-history" className="space-y-4">
          {userVotes?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">{t('marketFactory.dashboard.noVotingHistory')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {userVotes?.map((vote) => (
                <Card key={vote.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{t('marketFactory.dashboard.proposal')} {vote.proposal_id.slice(0, 8)}...</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(vote.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          vote.vote_choice === 'yes' ? 'default' : 
                          vote.vote_choice === 'no' ? 'destructive' : 'secondary'
                        }>
                          {vote.vote_choice.toUpperCase()}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatVotingPower(vote.voting_power)} {t('marketFactory.dashboard.votingPower')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GovernanceDashboard;
