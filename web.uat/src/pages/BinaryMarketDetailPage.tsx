import { useMemo, useEffect, useState } from "react";
import Header from "@/components/Layout/Header";
import BinaryMarketChart from "@/components/Markets/BinaryMarketChart";
import MarketHeader from "@/components/Markets/MarketHeader";
import MarketRules from "@/components/Markets/MarketRules";
import MarketResolution from "@/components/Markets/MarketResolution";
import DiscussionBoard from "@/components/Markets/DiscussionBoard";
import BinaryMarketInterface from "@/components/Markets/BinaryMarketInterface";
import BinaryTradingInterface from "@/components/Markets/BinaryTradingInterface";
import CLOBTradingInterface from "@/components/CLOB/CLOBTradingInterface";
import OrderBookDisplay from "@/components/CLOB/OrderBookDisplay";
import OrderHistoryTable from "@/components/CLOB/OrderHistoryTable";
import WalletConnectionModal from "@/components/Wallet/WalletConnectionModal";
import { useWallet } from "@/contexts/WalletContext";
import { useCLOBOrderBook } from "@/hooks/useCLOB";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import type { MarketDetail } from "@/hooks/useMarketDetail";

interface BinaryMarketDetailPageProps {
  market: MarketDetail;
}

const BinaryMarketDetailPage = ({ market }: BinaryMarketDetailPageProps) => {
  const { wallet } = useWallet();
  const { data: orderBook } = useCLOBOrderBook(market.id);
  const [orderBookOpen, setOrderBookOpen] = useState(true);
  const [chartOpen, setChartOpen] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(true);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Get best prices from order book (best ask for YES, best bid for NO equivalent)
  const bestYesPrice = orderBook?.asks[0]?.price || 50; // Default to 50 ticks ($0.50)
  const bestNoPrice = 100 - bestYesPrice; // NO is inverse of YES

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get binary options
  const binaryOptions = useMemo(() => {
    if (!market?.options) return { yesOption: null, noOption: null };
    
    const yesOption = market.options.find(opt => opt.option_type?.toLowerCase() === 'yes');
    const noOption = market.options.find(opt => opt.option_type?.toLowerCase() === 'no');
    
    return { 
      yesOption: yesOption ? {
        ...yesOption,
        option_type: 'yes' as const
      } : null, 
      noOption: noOption ? {
        ...noOption,
        option_type: 'no' as const
      } : null
    };
  }, [market]);

  if (!binaryOptions.yesOption || !binaryOptions.noOption) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="text-destructive text-xl font-semibold">
              Market Configuration Error
            </div>
            <div className="text-muted-foreground space-y-2">
              <p>This binary market is missing its trading options.</p>
              <p>Expected: YES and NO options</p>
              <p>Found: {binaryOptions.yesOption ? '✓ YES' : '✗ YES'} • {binaryOptions.noOption ? '✓ NO' : '✗ NO'}</p>
            </div>
            <div className="text-sm text-muted-foreground mt-4 p-4 bg-muted rounded-lg">
              <p><strong>Market ID:</strong> {market.id}</p>
              <p><strong>Market Name:</strong> {market.name}</p>
              <p>This market needs to be configured with proper YES/NO options before trading can begin.</p>
            </div>
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
            <BinaryMarketChart
              data={market.chartData || []}
              yesPrice={binaryOptions.yesOption.current_price}
              noPrice={binaryOptions.noOption.current_price}
              volume={market.volume}
              isOpen={chartOpen}
              onOpenChange={setChartOpen}
            />

            {/* Order Book */}
            <OrderBookDisplay 
              marketId={market.id}
              isOpen={orderBookOpen}
              onOpenChange={setOrderBookOpen}
            />

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
                  <div className="bg-card rounded-lg border p-4">
                    <h3 className="text-sm font-semibold mb-4">Quick Trade</h3>
                    <div className="flex items-center justify-center gap-4">
                      <button 
                        onClick={() => {
                          if (!wallet.accountId) {
                            setWalletModalOpen(true);
                          } else {
                            toast({
                              title: "Coming Soon",
                              description: "Market order trading will be available soon!",
                            });
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-yes text-white rounded-lg hover:bg-yes/90 transition-colors font-medium"
                      >
                        Buy YES ${(bestYesPrice / 100).toFixed(2)}
                      </button>
                      <button 
                        onClick={() => {
                          if (!wallet.accountId) {
                            setWalletModalOpen(true);
                          } else {
                            toast({
                              title: "Coming Soon",
                              description: "Market order trading will be available soon!",
                            });
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors font-medium"
                      >
                        Buy NO ${(bestNoPrice / 100).toFixed(2)}
                      </button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-3">
                      Execute at best available price from order book
                    </p>
                  </div>
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
      
      <WalletConnectionModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
};

export default BinaryMarketDetailPage;