import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown } from "lucide-react";

interface BinaryOption {
  id: string;
  option_name: string;
  option_type: 'yes' | 'no';
  current_price: number;
  total_shares?: number;
}

interface BinaryMarketInterfaceProps {
  yesOption: BinaryOption;
  noOption: BinaryOption;
}

const BinaryMarketInterface = ({ yesOption, noOption }: BinaryMarketInterfaceProps) => {
  const yesPercentage = Math.round(yesOption.current_price * 100);
  const noPercentage = Math.round(noOption.current_price * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Outcomes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Yes Option */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-primary">
              <AvatarFallback className="text-primary-foreground">Y</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">Yes</div>
              <div className="text-sm text-muted-foreground">Yes</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold">{yesPercentage}%</div>
              <div className="text-sm text-muted-foreground flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +0
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="yes" size="sm">
                Yes {yesPercentage}¢
              </Button>
              <Button variant="no" size="sm">
                No {100 - yesPercentage}¢
              </Button>
            </div>
          </div>
        </div>

        {/* No Option */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-destructive">
              <AvatarFallback className="text-destructive-foreground">N</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">No</div>
              <div className="text-sm text-muted-foreground">No</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold">{noPercentage}%</div>
              <div className="text-sm text-muted-foreground flex items-center">
                <TrendingDown className="h-3 w-3 mr-1" />
                +0
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="yes" size="sm">
                Yes {noPercentage}¢
              </Button>
              <Button variant="no" size="sm">
                No {100 - noPercentage}¢
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BinaryMarketInterface;