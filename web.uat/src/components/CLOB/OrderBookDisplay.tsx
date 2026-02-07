import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCLOBOrderBook } from "@/hooks/useCLOB";
import { OrderBookLevel } from "@/types/clob";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface OrderBookDisplayProps {
  marketId: string;
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const OrderBookDisplay = ({ marketId, className, isOpen = true, onOpenChange }: OrderBookDisplayProps) => {
  const { data: orderBook, isLoading, error } = useCLOBOrderBook(marketId);

  if (isLoading) {
    return (
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <Card className={cn("w-full", className)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle>Order Book</CardTitle>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  if (error || !orderBook) {
    return (
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <Card className={cn("w-full", className)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle>Order Book</CardTitle>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <p className="text-muted-foreground">Failed to load order book</p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  const maxQuantity = Math.max(
    ...[...orderBook.bids, ...orderBook.asks].map(level => level.quantity)
  );

  const renderOrderLevel = (level: OrderBookLevel, side: 'bid' | 'ask', index: number) => {
    const percentage = (level.quantity / maxQuantity) * 100;
    const isAsk = side === 'ask';
    const priceInDollars = level.price / 100;
    
    // Validate price is within acceptable range
    if (priceInDollars < 0.01 || priceInDollars > 0.99) {
      return null;
    }
    
    return (
      <div 
        key={`${side}-${level.price}-${index}`}
        className={cn(
          "relative flex justify-between items-center px-2 py-1 text-sm font-mono",
          "hover:bg-muted/50 transition-colors"
        )}
      >
        {/* Background bar showing quantity depth */}
        <div 
          className={cn(
            "absolute inset-y-0 opacity-20",
            isAsk ? "right-0 bg-no" : "left-0 bg-yes"
          )}
          style={{ 
            width: `${percentage}%`,
            ...(isAsk ? { right: 0 } : { left: 0 })
          }}
        />
        
        {/* Price and quantity display */}
        <span className={cn(
          "font-semibold z-10 relative",
          isAsk ? "text-no" : "text-yes"
        )}>
          ${(level.price / 100).toFixed(2)}
        </span>
        <span className="text-muted-foreground z-10 relative">
          {level.quantity.toLocaleString()}
        </span>
      </div>
    );
  };

  // Filter to valid price range and limit display
  const displayAsks = orderBook.asks
    .filter(level => {
      const price = level.price / 100;
      return price >= 0.01 && price <= 0.99;
    })
    .slice(0, 10)
    .reverse();
    
  const displayBids = orderBook.bids
    .filter(level => {
      const price = level.price / 100;
      return price >= 0.01 && price <= 0.99;
    })
    .slice(0, 10);

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className={cn("w-full", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-primary/5 transition-colors">
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Order Book</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-normal">
                  Last updated: {new Date(orderBook.lastUpdate).toLocaleTimeString()}
                </span>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
        {/* Column headers */}
        <div className="flex justify-between px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
          <span>Price</span>
          <span>Size</span>
        </div>
        
        {/* Asks (sells) - shown on top, reversed order */}
        <div className="border-b">
          {displayAsks.length > 0 ? (
            displayAsks.map((level, index) => 
              renderOrderLevel(level, 'ask', index)
            )
          ) : (
            <div className="px-2 py-4 text-center text-muted-foreground text-sm">
              No asks
            </div>
          )}
        </div>

        {/* Spread indicator */}
        {orderBook.asks.length > 0 && orderBook.bids.length > 0 && (
          <div className="px-2 py-2 text-center text-xs text-muted-foreground bg-muted/30">
            Spread: ${((orderBook.asks[0].price - orderBook.bids[0].price) / 100).toFixed(2)}
          </div>
        )}
        
        {/* Bids (buys) - shown on bottom */}
        <div>
          {displayBids.length > 0 ? (
            displayBids.map((level, index) => 
              renderOrderLevel(level, 'bid', index)
            )
          ) : (
            <div className="px-2 py-4 text-center text-muted-foreground text-sm">
              No bids
            </div>
          )}
          </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default OrderBookDisplay;