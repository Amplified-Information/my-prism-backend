import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, DollarSign, Scale, ChevronDown } from "lucide-react";

interface MarketRulesProps {
  marketId: string;
  minimumBet?: number;
  maximumBet?: number;
  category?: string;
  subcategory?: string;
  resolutionCriteria?: string;
  importantNotes?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MarketRules = ({ 
  marketId, 
  minimumBet = 1, 
  maximumBet, 
  category = "Politics",
  subcategory = "Elections",
  resolutionCriteria = "This market will resolve based on official results and credible news sources. Resolution typically occurs within 24-48 hours of the outcome being determined.",
  importantNotes = "All trades are final. Market may be resolved early if outcome becomes certain before the close date. Fees apply to winning positions.",
  isOpen = true,
  onOpenChange
}: MarketRulesProps) => {
  const rules = [
    {
      icon: DollarSign,
      title: "Betting Limits",
      description: `Minimum bet: $${minimumBet}${maximumBet ? ` • Maximum bet: $${maximumBet.toLocaleString()}` : ''}`,
      type: "info"
    },
    {
      icon: Scale,
      title: "Resolution Criteria",
      description: resolutionCriteria,
      type: "warning"
    },
    {
      icon: AlertCircle,
      title: "Important Notes",
      description: importantNotes,
      type: "destructive"
    }
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className="w-full">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Market Rules</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{category}</Badge>
                <Badge variant="outline">{subcategory}</Badge>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
        {rules.map((rule, index) => {
          const Icon = rule.icon;
          return (
            <div key={index} className="flex gap-3 p-3 rounded-lg border bg-card">
              <div className={`flex-shrink-0 p-2 rounded-full ${
                rule.type === 'info' ? 'bg-primary/10 text-primary' :
                rule.type === 'warning' ? 'bg-amber-500/10 text-amber-600' :
                'bg-destructive/10 text-destructive'
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-medium text-sm">{rule.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {rule.description}
                </p>
              </div>
            </div>
          );
        })}
        
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Market ID: {marketId} • Always read the full terms and conditions before participating.
            </p>
          </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default MarketRules;