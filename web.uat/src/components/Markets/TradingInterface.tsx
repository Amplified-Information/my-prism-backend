import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "@/hooks/use-toast";
import WalletConnectionModal from "@/components/Wallet/WalletConnectionModal";

interface Candidate {
  id: string;
  name: string;
  party: string;
  percentage: number;
  yesPrice: number;
  noPrice: number;
  avatar: string;
}

interface TradingInterfaceProps {
  topCandidate: Candidate;
  marketId: string;
}

const TradingInterface = ({ topCandidate }: TradingInterfaceProps) => {
  const { wallet } = useWallet();
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={topCandidate.avatar} />
            <AvatarFallback>{topCandidate.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{topCandidate.name}</h3>
            <Badge variant="outline" className="text-xs">
              {topCandidate.party}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>
          
          <TabsContent value="buy" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="yes" className="w-full" onClick={() => handleBuyClick('yes')}>
                Yes {topCandidate.yesPrice}¢
              </Button>
              <Button variant="no" className="w-full" onClick={() => handleBuyClick('no')}>
                No {topCandidate.noPrice}¢
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
              <p>You don't own any shares in this event prediction market</p>
            </div>
          </TabsContent>
        </Tabs>

      </CardContent>
      
      <WalletConnectionModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </Card>
  );
};

export default TradingInterface;