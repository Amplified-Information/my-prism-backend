import { Clock, DollarSign, Star } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useFavoriteMarkets } from "@/hooks/useFavoriteMarkets";
import { cn } from "@/lib/utils";

interface MarketHeaderProps {
  marketId: string;
  question: string;
  category: string;
  subcategory?: string;
  volume: number;
  endDate: string;
  description: string;
  imageUrl?: string;
}

const MarketHeader = ({ marketId, question, category, subcategory, volume, endDate, description, imageUrl }: MarketHeaderProps) => {
  const { isFavorite, toggleFavorite, isWalletConnected } = useFavoriteMarkets();
  const favorited = isFavorite(marketId);

  return (
    <div className="space-y-4">
      {imageUrl && (
        <div className="w-full">
          <img 
            src={imageUrl} 
            alt={question}
            className="w-full h-48 md:h-64 object-cover rounded-lg shadow-sm"
          />
        </div>
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Breadcrumb className="mb-3">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/markets">Markets</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/markets?category=${encodeURIComponent(category)}`}>{category}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {subcategory && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`/markets?category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(subcategory)}`}>{subcategory}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center text-sm text-muted-foreground mb-2">
            <Clock className="mr-1 h-4 w-4" />
            Ends {new Date(endDate).toLocaleDateString()}
          </div>
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-bold mb-2 flex-1">{question}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(marketId)}
              className="shrink-0"
              title={favorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  favorited ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                )}
              />
            </Button>
          </div>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center">
          <DollarSign className="mr-1 h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Volume:</span>
          <span className="ml-1 font-medium">${volume.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default MarketHeader;