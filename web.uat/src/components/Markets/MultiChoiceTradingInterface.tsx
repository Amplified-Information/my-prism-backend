import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "@/hooks/use-toast";
import WalletConnectionModal from "@/components/Wallet/WalletConnectionModal";
import type { MultiChoiceCandidate } from "@/types/market";

interface MultiChoiceTradingInterfaceProps {
  candidates: MultiChoiceCandidate[];
  marketId: string;
}

const MultiChoiceTradingInterface = ({ candidates }: MultiChoiceTradingInterfaceProps) => {
  const { wallet } = useWallet();
  const [selectedCandidate, setSelectedCandidate] = useState<MultiChoiceCandidate | null>(
    candidates[0] || null
  );
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("buy");
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const handleBuyClick = (option: 'yes' | 'no') => {
    if (!wallet.accountId) {
      setWalletModalOpen(true);
    } else {
      toast({
        title: "Coming Soon",
        description: "Market order trading will be available soon!",
      });
    }
  };

  if (!selectedCandidate) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">No candidates available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Trade Candidates</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Candidate Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Candidate</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedCandidate.id === candidate.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50'
                }`}
                onClick={() => setSelectedCandidate(candidate)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={candidate.avatar} />
                    <AvatarFallback className="text-xs">
                      {candidate.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{candidate.name}</div>
                    {candidate.party && (
                      <Badge variant="outline" className="text-xs">
                        {candidate.party}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-sm font-bold">
                      {Math.round(candidate.yesPrice * 100)}¢
                    </div>
                    <div className="flex items-center text-xs">
                      {candidate.change24h >= 0 ? (
                        <TrendingUp className="mr-1 h-2 w-2 text-up" />
                      ) : (
                        <TrendingDown className="mr-1 h-2 w-2 text-down" />
                      )}
                      <span className={candidate.change24h >= 0 ? 'text-up' : 'text-down'}>
                        {candidate.change24h >= 0 ? '+' : ''}{candidate.change24h.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Interface for Selected Candidate */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={selectedCandidate.avatar} />
              <AvatarFallback>
                {selectedCandidate.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{selectedCandidate.name}</h3>
              {selectedCandidate.party && (
                <Badge variant="outline" className="text-xs">
                  {selectedCandidate.party}
                </Badge>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
            </TabsList>
            
            <TabsContent value="buy" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="yes" className="w-full" onClick={() => handleBuyClick('yes')}>
                  Yes {Math.round(selectedCandidate.yesPrice * 100)}¢
                </Button>
                <Button variant="no" className="w-full" onClick={() => handleBuyClick('no')}>
                  No {Math.round(selectedCandidate.noPrice * 100)}¢
                </Button>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-right"
                />
                <p className="text-xs text-muted-foreground">
                  Earn 4% Interest
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="sell" className="space-y-4 mt-4">
              <div className="text-center text-muted-foreground">
                <p>You don't own any shares in this candidate</p>
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </CardContent>
      
      <WalletConnectionModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </Card>
  );
};

export default MultiChoiceTradingInterface;