import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Clock, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MarketOption } from "@/types/market";
interface MarketCardProps {
  id: string;
  question: string;
  category: string;
  yesPrice?: number;
  noPrice?: number;
  volume: number;
  endDate: string;
  liquidity: number;
  change24h: number;
  marketStructure?: string;
  options?: MarketOption[];
  imageUrl?: string;
}
const MarketCard = ({
  id,
  question,
  category,
  yesPrice,
  noPrice,
  volume,
  endDate,
  liquidity,
  change24h,
  marketStructure,
  options = [],
  imageUrl
}: MarketCardProps) => {
  const navigate = useNavigate();

  // Detect if this is a multi-candidate market
  const isMultiChoice = marketStructure === 'multi-choice' || options.length > 2;

  // Process candidates for multi-choice markets
  const candidates = isMultiChoice ? options.filter(option => option.option_type === 'yes').sort((a, b) => b.current_price - a.current_price).slice(0, 3).map(option => ({
    id: option.id,
    name: option.candidate_name || option.option_name,
    avatar: option.candidate_avatar || '/api/placeholder/32/32',
    party: option.candidate_party || '',
    price: Math.round(option.current_price * 100),
    change24h: 0 // Would need to be calculated from price history
  })) : [];
  const yesPercentage = yesPrice && noPrice ? yesPrice / (yesPrice + noPrice) * 100 : 0;
  const handleCardClick = () => {
    navigate(`/market/${id}`);
  };
  return <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer" style={{background: 'var(--gradient-card)'}} onClick={handleCardClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start space-x-3">
          {imageUrl && (
            <div className="flex-shrink-0">
              <img 
                src={imageUrl} 
                alt={`${question} image`}
                className="w-12 h-12 object-cover rounded-md"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {question}
            </h3>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Display candidates for multi-choice markets */}
        {isMultiChoice ? <div className="space-y-3">
            {/* Top candidates */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-2">Top Candidates</div>
              {candidates.slice(0, 3).map((candidate, index) => <div key={candidate.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground w-4">#{index + 1}</span>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={candidate.avatar} alt={candidate.name} />
                      <AvatarFallback className="text-xs">
                        {candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium line-clamp-1">{candidate.name}</span>
                      {candidate.party && <span className="text-xs text-muted-foreground">{candidate.party}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{candidate.price}¢</div>
                  </div>
                </div>)}
            </div>
          </div> : (
          /* Binary market display - compact layout */
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center text-sm">
                {change24h >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-up" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-down" />
                )}
                <span className={`font-medium ${change24h >= 0 ? 'text-up' : 'text-down'}`}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Trading buttons - on one row, YES left */}
            <div className="flex items-center gap-2 ml-3">
              <Button
                variant="yes"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle buy yes action
                }}
                className="text-xs px-2 py-1 h-7"
              >
                YES {yesPrice}¢
              </Button>
              <Button
                variant="no"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle buy no action
                }}
                className="text-xs px-2 py-1 h-7"
              >
                NO {noPrice}¢
              </Button>
            </div>
          </div>
        )}

          {/* Bottom info row: volume (left), category (center), clock (right) */}
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="flex items-center">
              <DollarSign className="mr-1 h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Vol:</span>
              <span className="ml-1 font-medium">${volume.toLocaleString()}</span>
            </div>
            <Badge variant="outline">{category}</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Resolves: {endDate}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Multi-choice trading button */}
          {isMultiChoice && (
            <Button
              variant="trading"
              size="sm"
              className="w-full mt-3"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/market/${id}`);
              }}
            >
              View Market
            </Button>
          )}
        </CardContent>
    </Card>;
};
export default MarketCard;