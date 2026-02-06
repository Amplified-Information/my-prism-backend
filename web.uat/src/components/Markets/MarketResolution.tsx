import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, CheckCircle2, Clock, AlertTriangle, ExternalLink, ChevronDown } from "lucide-react";

interface MarketResolutionProps {
  status: 'open' | 'closed' | 'resolved' | 'cancelled';
  endDate: string;
  resolutionDate?: string;
  resolutionNotes?: string;
  resolutionValue?: boolean;
  oracleType?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MarketResolution = ({ 
  status, 
  endDate, 
  resolutionDate, 
  resolutionNotes,
  resolutionValue,
  oracleType = "Manual",
  isOpen = true,
  onOpenChange
}: MarketResolutionProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'open':
        return {
          icon: Clock,
          label: 'Active',
          variant: 'default' as const,
          color: 'text-primary'
        };
      case 'closed':
        return {
          icon: AlertTriangle,
          label: 'Closed',
          variant: 'secondary' as const,
          color: 'text-amber-600'
        };
      case 'resolved':
        return {
          icon: CheckCircle2,
          label: 'Resolved',
          variant: 'default' as const,
          color: 'text-emerald-600'
        };
      case 'cancelled':
        return {
          icon: AlertTriangle,
          label: 'Cancelled',
          variant: 'destructive' as const,
          color: 'text-destructive'
        };
      default:
        return {
          icon: Clock,
          label: 'Unknown',
          variant: 'outline' as const,
          color: 'text-muted-foreground'
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className="w-full">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Resolution & Timeline</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
        {/* Timeline */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="flex-shrink-0 p-2 rounded-full bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">Market Closes</h4>
              <p className="text-sm text-muted-foreground">
                {new Date(endDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </p>
            </div>
          </div>

          {status === 'resolved' && resolutionDate && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="flex-shrink-0 p-2 rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">Market Resolved</h4>
                <p className="text-sm text-muted-foreground">
                  {new Date(resolutionDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                {resolutionValue !== undefined && (
                  <div className="mt-2">
                    <Badge variant={resolutionValue ? "default" : "destructive"}>
                      Resolved: {resolutionValue ? "YES" : "NO"}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Oracle Information */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Resolution Method</h4>
            <Badge variant="outline">{oracleType}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            This market uses {oracleType.toLowerCase()} resolution based on official sources and credible news outlets.
            Resolution typically occurs within 24-48 hours of outcome determination.
          </p>
        </div>

        {/* Resolution Notes */}
        {resolutionNotes && status === 'resolved' && (
          <div className="p-3 rounded-lg border bg-card">
            <h4 className="font-medium text-sm mb-2">Resolution Notes</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {resolutionNotes}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {status === 'open' && (
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ExternalLink className="h-3 w-3" />
              View Sources
            </Button>
            <Button variant="outline" size="sm">
              Subscribe to Updates
            </Button>
          </div>
          )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default MarketResolution;