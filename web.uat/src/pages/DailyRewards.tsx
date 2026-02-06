import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import Header from "@/components/Layout/Header";
import DailyRewardsHero from "@/components/Rewards/DailyRewardsHero";
import CategoryTabs from "@/components/Rewards/CategoryTabs";
import RewardsTable from "@/components/Rewards/RewardsTable";
import { supabase } from "@/integrations/supabase/client";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { useTranslation } from "react-i18next";

// Icon mapping from Markets.tsx
import { Globe, Landmark, Activity, Heart, TrendingUp, TreePine, DollarSign, Building2, Briefcase, Microscope, Stethoscope, MapPin, Star } from "lucide-react";
import { useFavoriteMarkets } from "@/hooks/useFavoriteMarkets";

const getIconForCategory = (name: string) => {
  const iconMap: { [key: string]: any } = {
    'Politics': Landmark,
    'Sports': Activity,
    'Culture': Heart,
    'Crypto': TrendingUp,
    'Climate': TreePine,
    'Economics': DollarSign,
    'Mentions': Activity,
    'Companies': Building2,
    'Financials': Briefcase,
    'Tech & Science': Microscope,
    'Health': Stethoscope,
    'World': MapPin
  };
  return iconMap[name] || Globe;
};

const getColorForCategory = (name: string) => {
  const colorMap: { [key: string]: string } = {
    'Politics': 'hsl(0 84% 60%)',
    'Sports': 'hsl(200 80% 70%)',
    'Culture': 'hsl(330 76% 45%)',
    'Crypto': 'hsl(45 84% 60%)',
    'Climate': 'hsl(120 60% 45%)',
    'Economics': 'hsl(210 76% 45%)',
    'Mentions': 'hsl(280 76% 45%)',
    'Companies': 'hsl(190 76% 45%)',
    'Financials': 'hsl(260 76% 45%)',
    'Tech & Science': 'hsl(160 76% 45%)',
    'Health': 'hsl(300 76% 45%)',
    'World': 'hsl(20 84% 60%)'
  };
  return colorMap[name] || 'hsl(200 80% 70%)';
};

// Calculate reward metrics from market data
const enrichMarketWithRewards = (market: any, index: number) => {
  const maxSpread = Math.abs(market.yes_price - 50);
  const minShares = market.minimum_bet || 20;
  const reward = Math.floor(market.volume * 0.01) || 50;
  
  // Generate varied competition levels using multiple factors for diversity
  const hashValue = market.id ? market.id.charCodeAt(0) + market.id.charCodeAt(market.id.length - 1) : index;
  const volumeFactor = Math.floor((market.volume || 0) / 5000) % 3;
  const priceFactor = Math.floor(market.yes_price / 25);
  const competition = Math.min(5, Math.max(1, ((hashValue + volumeFactor + priceFactor + index) % 5) + 1));
  
  return {
    ...market,
    maxSpread: `±${maxSpread.toFixed(0)}¢`,
    minShares,
    reward,
    competition,
    earnings: 0, // User-specific, would need tracking
    yesPercent: market.yes_price,
    noPercent: market.no_price
  };
};

const DailyRewards = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const marketsPerPage = 50;
  const { favorites, isFavorite, toggleFavorite, isWalletConnected } = useFavoriteMarkets();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('market_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (categoriesError) throw categoriesError;

        const formattedCategories = [
          { id: "all", name: "All", icon: Globe },
          { id: "favourite", name: "Favourite", icon: Star },
          ...(categoriesData?.map(cat => ({
            id: cat.id,
            name: cat.name,
            icon: getIconForCategory(cat.name),
            color: getColorForCategory(cat.name)
          })) || [])
        ];
        setCategories(formattedCategories);

        // Fetch markets with options
        const { data: marketsData, error: marketsError } = await supabase
          .from('event_markets')
          .select(`
            *,
            market_categories(name),
            market_options(*)
          `)
          .eq('is_active', true)
          .order('volume', { ascending: false });

        if (marketsError) throw marketsError;

        const enrichedMarkets = marketsData?.map((market, index) => {
          const enriched = enrichMarketWithRewards({
            id: market.id,
            name: market.name,
            category: market.market_categories?.name || 'Unknown',
            yes_price: market.yes_price,
            no_price: market.no_price,
            volume: market.volume,
            liquidity: market.liquidity,
            minimum_bet: market.minimum_bet,
            image_url: market.image_url,
            categoryColor: getColorForCategory(market.market_categories?.name || '')
          }, index);
          return enriched;
        }) || [];

        setMarkets(enrichedMarkets);
      } catch (error) {
        console.error('Error fetching rewards data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter markets based on category and search
  const filteredMarkets = markets.filter(market => {
    const selectedCategoryName = categories.find(cat => cat.id === selectedCategory)?.name;
    
    // Handle favorite category
    if (selectedCategory === "favourite") {
      const isFav = isFavorite(market.id);
      const matchesSearch = !searchQuery || 
        market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        market.category.toLowerCase().includes(searchQuery.toLowerCase());
      return isFav && matchesSearch;
    }
    
    const matchesCategory = selectedCategory === "all" || market.category === selectedCategoryName;
    const matchesSearch = !searchQuery || 
      market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredMarkets.length / marketsPerPage);
  const startIndex = (currentPage - 1) * marketsPerPage;
  const endIndex = startIndex + marketsPerPage;
  const paginatedMarkets = filteredMarkets.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <main>
        <DailyRewardsHero />
        
        <div className="container mx-auto px-4 py-8">
          {/* Category Tabs */}
          <CategoryTabs
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('rewards.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/40"
            />
          </div>

          {/* Rewards Table */}
          <RewardsTable 
            markets={paginatedMarkets}
            loading={loading}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            isWalletConnected={isWalletConnected}
          />

          {/* Pagination */}
          {!loading && filteredMarkets.length > marketsPerPage && (
            <div className="mt-8 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {getPageNumbers().map((page, idx) => (
                    <PaginationItem key={idx}>
                      {page === 'ellipsis' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(page as number)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DailyRewards;
