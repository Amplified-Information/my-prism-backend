import { useEffect, useState } from "react";
import Header from "@/components/Layout/Header";
import MarketChart from "@/components/Markets/MarketChart";
import MarketHeader from "@/components/Markets/MarketHeader";
import MarketRules from "@/components/Markets/MarketRules";
import MarketResolution from "@/components/Markets/MarketResolution";
import DiscussionBoard from "@/components/Markets/DiscussionBoard";
import MultiChoiceTradingInterface from "@/components/Markets/MultiChoiceTradingInterface";
import CLOBTradingInterface from "@/components/CLOB/CLOBTradingInterface";
import OrderBookDisplay from "@/components/CLOB/OrderBookDisplay";
import OrderHistoryTable from "@/components/CLOB/OrderHistoryTable";
import { useMultiChoiceMarket } from "@/hooks/useMultiChoiceMarket";
import { useWallet } from "@/contexts/WalletContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketDetail } from "@/hooks/useMarketDetail";

interface MultiChoiceMarketDetailPageProps {
  market: MarketDetail;
}

const MultiChoiceMarketDetailPage = ({ market }: MultiChoiceMarketDetailPageProps) => {
  const { wallet } = useWallet();
  const [orderBookOpen, setOrderBookOpen] = useState(true);
  const [chartOpen, setChartOpen] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(true);
  const { 
    candidateGroups, 
    binaryCandidates,
    loading: multiChoiceLoading 
  } = useMultiChoiceMarket(market.id);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (multiChoiceLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <MarketHeader 
              marketId={market.id}
              question={market.name}
              category={market.category}
              subcategory={market.subcategory}
              volume={market.volume}
              endDate={market.end_date}
              description={market.description}
              imageUrl={market.image_url}
            />
            
            {/* Price History Chart */}
            <MarketChart 
              priceHistory={market.chartData || []}
              candidates={binaryCandidates}
              marketOptions={market.options}
              isOpen={chartOpen}
              onOpenChange={setChartOpen}
            />

            {/* Order Book */}
            <OrderBookDisplay 
              marketId={market.id}
              isOpen={orderBookOpen}
              onOpenChange={setOrderBookOpen}
            />
            
            {/* Candidates */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Candidates</h3>
              <div className="grid gap-4">
                {candidateGroups.map((group) => (
                  <div key={group.candidate.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3">
                      <img 
                        src={group.candidate.avatar || '/placeholder.svg'} 
                        alt={group.candidate.name}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <h4 className="font-semibold">{group.candidate.name}</h4>
                        {group.candidate.party && (
                          <span className="text-sm text-muted-foreground">{group.candidate.party}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {Math.round(group.candidate.yesPrice * 100)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {group.candidate.change24h >= 0 ? '+' : ''}{group.candidate.change24h.toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                          Yes {Math.round(group.candidate.yesPrice * 100)}¢
                        </button>
                        <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90">
                          No {Math.round(group.candidate.noPrice * 100)}¢
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Rules */}
            <MarketRules
              marketId={market.id}
              minimumBet={1}
              maximumBet={undefined}
              category={market.category}
              subcategory={market.subcategory}
              resolutionCriteria={market.resolution_criteria}
              importantNotes={market.important_notes}
              isOpen={rulesOpen}
              onOpenChange={setRulesOpen}
            />

            {/* Market Resolution */}
            <MarketResolution
              status="open"
              endDate={market.end_date}
              resolutionDate={undefined}
              resolutionNotes={undefined}
              resolutionValue={undefined}
              oracleType="Manual"
              isOpen={resolutionOpen}
              onOpenChange={setResolutionOpen}
            />

            {/* Discussion Board */}
            <DiscussionBoard 
              marketId={market.id}
              isOpen={discussionOpen}
              onOpenChange={setDiscussionOpen}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Trading Interface */}
              <Tabs defaultValue="market" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market">Market Order</TabsTrigger>
                  <TabsTrigger value="limit">Limit Order</TabsTrigger>
                </TabsList>
                
                <TabsContent value="market" className="space-y-4">
                  <MultiChoiceTradingInterface 
                    candidates={candidateGroups.map(g => g.candidate)}
                    marketId={market.id} 
                  />
                </TabsContent>
                
                <TabsContent value="limit">
                  <CLOBTradingInterface marketId={market.id} />
                </TabsContent>
              </Tabs>
              
              {/* Order History */}
              {wallet.accountId && (
                <OrderHistoryTable 
                  marketId={market.id}
                  accountId={wallet.accountId}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MultiChoiceMarketDetailPage;