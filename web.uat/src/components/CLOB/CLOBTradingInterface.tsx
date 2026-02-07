import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/contexts/WalletContext";
import { useCLOBPositions } from "@/hooks/useCLOB";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CLOBTradingInterfaceProps {
  marketId: string;
  className?: string;
}

const CLOBTradingInterface = ({ marketId, className }: CLOBTradingInterfaceProps) => {
  const { wallet, connect } = useWallet();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const { data: positions } = useCLOBPositions(wallet.accountId, marketId);

  const isConnected = wallet.isConnected && wallet.accountId;

  const handleSubmitOrder = () => {
    toast.info('CLOB Trading Coming Soon', {
      description: 'Order submission will be available when the trading API is integrated.',
    });
  };

  const yesPosition = positions?.find(p => p.marketId === marketId && p.positionType === 'YES');
  const noPosition = positions?.find(p => p.marketId === marketId && p.positionType === 'NO');

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>CLOB Trading</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Connect your wallet to start trading
            </p>
            <Button onClick={connect} className="w-full">
              Connect Wallet
            </Button>
          </div>
        ) : (
          <>
            {/* Position Summary */}
            {(yesPosition || noPosition) && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <h4 className="font-semibold text-sm mb-2">Current Positions</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {yesPosition && (
                    <div className="flex justify-between">
                      <span>YES:</span>
                      <span className="font-mono">{yesPosition.quantity}</span>
                    </div>
                  )}
                  {noPosition && (
                    <div className="flex justify-between">
                      <span>NO:</span>
                      <span className="font-mono">{noPosition.quantity}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Form */}
            <Tabs value={side} onValueChange={(value) => setSide(value as 'BUY' | 'SELL')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="BUY" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Buy
                </TabsTrigger>
                <TabsTrigger value="SELL" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Sell
                </TabsTrigger>
              </TabsList>

              <TabsContent value={side} className="space-y-4">
                {/* Price Input */}
                <div className="space-y-2">
                  <Label>Price ($)</Label>
                  <Input
                    type="number"
                    placeholder="0.50"
                    value={price}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (e.target.value === '' || (val >= 0.01 && val <= 0.99)) {
                        setPrice(e.target.value);
                      }
                    }}
                    min="0.01"
                    max="0.99"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">Min $0.01, Max $0.99</p>
                </div>

                {/* Quantity Input */}
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    step="1"
                  />
                </div>

                {/* Time in Force Note */}
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Time in Force:</span> Good Till Cancelled
                </div>

                {/* Order Summary */}
                {price && quantity && (
                  <div className="border rounded-lg p-3 bg-muted/30 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Number of Shares:</span>
                      <span className="font-mono">{parseInt(quantity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Share Price:</span>
                      <span className="font-mono">${parseFloat(price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t">
                      <span>Total Cost (USDC):</span>
                      <span className="font-mono">
                        ${(parseFloat(price) * parseInt(quantity)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Trade Fee (1%):</span>
                      <span className="font-mono">
                        ${((parseFloat(price) * parseInt(quantity)) * 0.01).toFixed(4)} USDC
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Gas Fees:</span>
                      <span>FREE (Operator pays)</span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button 
                  onClick={handleSubmitOrder}
                  disabled={!price || !quantity}
                  className={cn(
                    "w-full",
                    side === 'BUY' ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"
                  )}
                >
                  {`${side} ${quantity || '0'} shares at $${parseFloat(price || '0').toFixed(2)}`}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  CLOB Trading Coming Soon
                </p>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CLOBTradingInterface;
