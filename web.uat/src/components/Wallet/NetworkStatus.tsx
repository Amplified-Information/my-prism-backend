import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, AlertTriangle } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { hederaConfig, isMainnet } from "@/config/hedera";

const NetworkStatus = () => {
  const { isOnline, networkQuality } = useNetworkStatus();

  if (!isOnline) {
    return (
      <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-800 dark:text-red-200">
              Network Offline
            </span>
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
              Disconnected
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getNetworkBadge = () => {
    const badgeColor = isMainnet() 
      ? 'bg-blue-100 text-blue-700 border-blue-300' 
      : 'bg-green-100 text-green-700 border-green-300';

    switch (networkQuality) {
      case 'slow':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">
            Slow Connection
          </Badge>
        );
      case 'fast':
        return (
          <Badge variant="outline" className={`${badgeColor} text-xs`}>
            {hederaConfig.displayName}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
            {hederaConfig.displayName}
          </Badge>
        );
    }
  };

  return (
    <Card className="bg-muted/30 border-muted">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Network</span>
          {getNetworkBadge()}
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkStatus;