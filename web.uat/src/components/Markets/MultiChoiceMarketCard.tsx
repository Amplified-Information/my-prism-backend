import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Volume2, Droplet, Eye, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import CandidateCarousel, { type CandidateOption } from "./CandidateCarousel";
import type { MultiChoiceCandidate } from "@/types/market";

interface MultiChoiceMarketCardProps {
  id: string;
  question: string;
  category: string;
  candidates: MultiChoiceCandidate[];
  volume: number;
  endDate: string;
  liquidity: number;
  imageUrl?: string;
}

const MultiChoiceMarketCard = ({
  id,
  question,
  category,
  candidates,
  volume,
  endDate,
  liquidity,
  imageUrl
}: MultiChoiceMarketCardProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const maxVisible = 3;

  const handleCardClick = () => {
    navigate(`/market/${id}`);
  };

  const handleCandidateClick = (candidate: CandidateOption) => {
    // Navigate to market with candidate pre-selected
    navigate(`/market/${id}?candidate=${candidate.id}`);
  };
  
  const canScrollLeft = currentIndex > 0;
  const canScrollRight = currentIndex + maxVisible < candidates.length;
  
  const scrollLeft = () => {
    if (canScrollLeft) {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  };
  
  const scrollRight = () => {
    if (canScrollRight) {
      setCurrentIndex(Math.min(candidates.length - maxVisible, currentIndex + 1));
    }
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200 group" style={{background: 'var(--gradient-card)'}}>
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
            <h3 
              className="text-base font-semibold leading-tight line-clamp-2 hover:text-primary transition-colors cursor-pointer"
              onClick={handleCardClick}
            >
              {question}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Candidates Carousel */}
        <CandidateCarousel
          candidates={candidates}
          maxVisible={maxVisible}
          currentIndex={currentIndex}
          showPrices={true}
          showControls={false}
          onCandidateClick={handleCandidateClick}
        />

        {/* Bottom info row: volume (left), category (center), clock (right) */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center">
            <DollarSign className="mr-1 h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Vol:</span>
            <span className="ml-1 font-medium">${volume.toLocaleString()}</span>
          </div>
          <Badge variant="outline">{category}</Badge>
          <div className="flex items-center gap-2">

            {/* Carousel Navigation */}
            {candidates.length > maxVisible && (
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollLeft();
                  }}
                  disabled={!canScrollLeft}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollRight();
                  }}
                  disabled={!canScrollRight}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
            
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
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiChoiceMarketCard;