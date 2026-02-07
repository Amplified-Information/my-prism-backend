import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCLOBOrderHistory, useCancelCLOBOrder } from "@/hooks/useCLOB";
import { CLOBOrder } from "@/types/clob";
import { X, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderHistoryTableProps {
  marketId?: string;
  accountId?: string;
  className?: string;
}

const OrderHistoryTable = ({ marketId, accountId, className }: OrderHistoryTableProps) => {
  const { data: orders, isLoading } = useCLOBOrderHistory(accountId, marketId, 20);
  const cancelOrderMutation = useCancelCLOBOrder();

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleCancelOrder = () => {
    cancelOrderMutation.mutate();
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Order History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!orders || orders.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No orders found
          </div>
        ) : (
          <div className="space-y-1">
            {orders.map((order: CLOBOrder) => {
              const canCancel = order.status === 'PENDING';
              const priceInDollars = order.priceTicks / 100;
              
              // Skip orders with invalid prices
              if (priceInDollars < 0.01 || priceInDollars > 0.99) {
                return null;
              }
              
              return (
                <div 
                  key={order.orderId} 
                  className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            order.side === 'BUY' ? 'text-green-600' : 'text-red-600',
                            'font-mono text-xs'
                          )}
                        >
                          {order.side}
                        </Badge>
                        <span className="font-mono text-sm">
                          {order.quantity.toLocaleString()} @ ${priceInDollars.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.orderId?.slice(0, 12)}...
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                    
                    {canCancel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelOrder}
                        disabled={cancelOrderMutation.isPending}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderHistoryTable;
