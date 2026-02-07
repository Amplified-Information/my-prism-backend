import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";

interface BinaryOption {
  id: string;
  option_name: string;
  option_type: 'yes' | 'no';
  current_price: number;
  total_shares?: number;
}

interface BinaryTradingInterfaceProps {
  yesOption: BinaryOption;
  noOption: BinaryOption;
  marketId: string;
}

const BinaryTradingInterface = ({ yesOption, noOption }: BinaryTradingInterfaceProps) => {
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("buy");
  const [selectedOption, setSelectedOption] = useState<'yes' | 'no'>('yes');

  const yesPrice = Math.round(yesOption.current_price * 100);
  const noPrice = Math.round(noOption.current_price * 100);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className={`h-12 w-12 ${selectedOption === 'yes' ? 'bg-primary' : 'bg-destructive'}`}>
            <AvatarFallback className={selectedOption === 'yes' ? 'text-primary-foreground' : 'text-destructive-foreground'}>
              {selectedOption === 'yes' ? 'Y' : 'N'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{selectedOption === 'yes' ? 'Yes' : 'No'}</h3>
            <div className="text-sm text-muted-foreground">
              {selectedOption === 'yes' ? yesPrice : noPrice}¢
            </div>
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
              <Button 
                variant={selectedOption === 'yes' ? 'yes' : 'outline'} 
                className="w-full"
                onClick={() => setSelectedOption('yes')}
              >
                Yes {yesPrice}¢
              </Button>
              <Button 
                variant={selectedOption === 'no' ? 'no' : 'outline'} 
                className="w-full"
                onClick={() => setSelectedOption('no')}
              >
                No {noPrice}¢
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

        <Button className="w-full bg-primary hover:bg-primary/90">
          Sign up to trade
        </Button>
      </CardContent>
    </Card>
  );
};

export default BinaryTradingInterface;