import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const Wiki = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.substring(1);
      const element = document.getElementById(id);

      if (element) {
        setTimeout(() => {
          const yOffset = -120; // Increased offset to account for fixed header
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }, 100);
      }
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Prism Market Wiki</h1>
          <p className="text-muted-foreground">
            Learn about trading, liquidity, governance, and staking on Prism Market
          </p>
        </div>

        <div className="space-y-8">
          <Card id="bet-on-events">
            <CardHeader>
              <CardTitle>Bet on Events</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Prism Market allows you to trade on real-world events using prediction markets. Each market represents an
                event with YES or NO outcomes, where the prices reflect the collective probability of each outcome
                occurring.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">How Prediction Markets Work</h3>
              <p className="text-muted-foreground">
                Prediction markets use the wisdom of the crowd to forecast event outcomes. You can buy YES or NO shares
                based on your belief about an event's likelihood. Share prices move between 0 and 1, representing the
                market's probability estimate.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Order Books & Trading</h3>
              <p className="text-muted-foreground">
                View real-time order books showing all available bids and asks. Place limit orders at your preferred
                odds or execute market orders instantly. Trade at competitive prices with transparent order matching
                through our Central Limit Order Book (CLOB) system.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Market Types</h3>
              <p className="text-muted-foreground">
                Explore binary markets (YES/NO), multi-choice markets with multiple outcomes, and smart markets with
                advanced features. Each market type offers unique trading opportunities and strategies.
              </p>
            </CardContent>
          </Card>

          <Card id="provide-liquidity">
            <CardHeader>
              <CardTitle>Provide Liquidity</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Become a market maker by providing liquidity to Prism Market. Place limit orders within the bid-ask
                spread to earn rewards and trading fee income while helping maintain efficient markets.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Understanding Liquidity Provision</h3>
              <p className="text-muted-foreground">
                Liquidity providers create pending limit orders that other traders can execute against. By narrowing the
                spread between buy and sell prices, you make trading more efficient for everyone while positioning
                yourself to profit from the spread.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Rewards Program</h3>
              <p className="text-muted-foreground">
                Active liquidity providers are eligible for additional rewards based on their contribution to market
                depth and trading volume. Check the Daily Rewards page to track your earnings and competitive standing.
              </p>
            </CardContent>
          </Card>

          <Card id="governance">
            <CardHeader>
              <CardTitle>Governance</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Prism Market is community-governed through xPRSM token holders. Participate in platform decisions by
                voting on proposals, suggesting new markets, and shaping the future direction of the protocol.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Voting on Proposals</h3>
              <p className="text-muted-foreground">
                Active proposals are open for community voting. Your voting power is proportional to your xPRSM balance.
                Review proposal details, discussion, and rationale before casting your vote.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Creating Proposals</h3>
              <p className="text-muted-foreground">
                Holders of xPRSM tokens can submit proposals for new markets, platform improvements, or governance
                changes. Provide detailed information including implementation details, expected impact, and community
                benefits.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Governance Process</h3>
              <p className="text-muted-foreground">
                Proposals go through discussion, voting, and implementation phases. Successful proposals that meet
                quorum requirements are executed by the community. View past proposals to understand governance history
                and decision patterns.
              </p>
            </CardContent>
          </Card>

          <Card id="stake-prsm">
            <CardHeader>
              <CardTitle>Stake PRSM</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Stake your PRSM tokens to receive xPRSM, the governance token that grants you voting power and
                additional benefits. Staking helps secure the protocol while earning you rewards and influence over
                platform decisions.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">PRSM to xPRSM Conversion</h3>
              <p className="text-muted-foreground">
                When you stake PRSM tokens, you receive xPRSM tokens representing your staked position. xPRSM tokens
                grant governance rights while your original PRSM tokens continue to earn rewards from protocol fees and
                trading activity.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Enhanced Voting Power</h3>
              <p className="text-muted-foreground">
                xPRSM tokens provide voting power proportional to your staked amount. The longer you stake, the more
                influence you have in governance decisions. Active participation in voting can earn additional rewards.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Staking Rewards</h3>
              <p className="text-muted-foreground">
                Stakers earn rewards from protocol revenue, including trading fees and market settlement fees. Track
                your staking performance and accumulated rewards in your portfolio dashboard.
              </p>
            </CardContent>
          </Card>

          <Card id="active-proposals">
            <CardHeader>
              <CardTitle>Active Proposals</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Active proposals are community-submitted suggestions that are currently open for voting. These proposals
                can cover various aspects of the platform including new market creation, platform improvements, and
                governance changes.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">How to Vote</h3>
              <p className="text-muted-foreground">
                Connect your wallet and use your xPRSM tokens to cast votes on active proposals. Your voting power is
                proportional to your xPRSM balance.
              </p>
            </CardContent>
          </Card>

          <Card id="create-proposal">
            <CardHeader>
              <CardTitle>Create Proposal</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Community members can submit their own proposals for consideration. Proposals typically include
                suggestions for new prediction markets, platform features, or governance changes.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Proposal Requirements</h3>
              <p className="text-muted-foreground">
                To create a proposal, you'll need to hold xPRSM tokens and provide detailed information about your
                suggestion including rationale, implementation details, and expected impact.
              </p>
            </CardContent>
          </Card>

          <Card id="voting-power">
            <CardHeader>
              <CardTitle>Your Voting Power</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Voting power in Prism Market is determined by your xPRSM token balance. xPRSM is obtained by staking PRSM
                tokens, which gives you governance rights while continuing to earn rewards.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">How to Increase Voting Power</h3>
              <p className="text-muted-foreground">
                Stake more PRSM tokens to receive xPRSM and increase your influence in governance decisions. Your voting
                history and participation are tracked and displayed in your profile.
              </p>
            </CardContent>
          </Card>

          <Card id="past-proposals">
            <CardHeader>
              <CardTitle>Past Proposals</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground">
                Browse the complete history of community proposals, including passed and rejected suggestions. This
                archive provides transparency and insight into how the platform has evolved through community
                governance.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4">Learning from History</h3>
              <p className="text-muted-foreground">
                Review past proposals to understand what types of suggestions the community supports and to learn from
                previous discussions and voting outcomes.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Wiki;
