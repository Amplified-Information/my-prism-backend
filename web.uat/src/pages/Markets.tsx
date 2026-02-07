import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from "@/components/ui/carousel";
import { Search, TrendingUp, Calendar, DollarSign, Trophy, Zap, Globe, Briefcase, Gamepad2, Activity, Heart, TreePine, Building2, Microscope, Stethoscope, MapPin, ArrowLeft, ChevronRight, Users, Clock, Store, Droplets, Plus, Star, Landmark } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import Header from "@/components/Layout/Header";
import SmartMarketCard from "@/components/Markets/SmartMarketCard";
import { supabase } from "@/integrations/supabase/client";
import { useFavoriteMarkets } from "@/hooks/useFavoriteMarkets";
const Markets = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { favorites } = useFavoriteMarkets();

  // Search-specific state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // New state for hierarchical navigation
  const [viewMode, setViewMode] = useState<'categories' | 'subcategories' | 'markets'>('categories');
  const [selectedCategoryData, setSelectedCategoryData] = useState<any>(null);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [allMarkets, setAllMarkets] = useState<any[]>([]);

  // Carousel state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const itemsPerPage = 12;

  // Map category names to translation keys
  const getCategoryTranslationKey = (categoryName: string): string => {
    const keyMap: { [key: string]: string } = {
      'All Event Markets': 'categories.all',
      'Favourites': 'categories.favourites',
      'Politics': 'categories.politics',
      'Sports': 'categories.sports',
      'Culture': 'categories.culture',
      'Crypto': 'categories.crypto',
      'Climate': 'categories.climate',
      'Economics': 'categories.economics',
      'Mentions': 'categories.mentions',
      'Companies': 'categories.companies',
      'Financials': 'categories.financials',
      'Tech & Science': 'categories.techScience',
      'Health': 'categories.health',
      'World': 'categories.world',
      'All': 'categories.allSubcategory'
    };
    return keyMap[categoryName] || categoryName;
  };

  // Map category names to icons
  const getIconForCategory = (name: string) => {
    const iconMap: {
      [key: string]: any;
    } = {
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
      'World': MapPin,
      'Favourites': Star
    };
    return iconMap[name] || Globe;
  };
  const getColorForCategory = (name: string) => {
    const colorMap: {
      [key: string]: string;
    } = {
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
      'World': 'hsl(20 84% 60%)',
      'Favourites': 'hsl(45 100% 50%)'
    };
    return colorMap[name] || 'hsl(200 80% 70%)';
  };
  useEffect(() => {
    const fetchData = async () => {
      try {
        // First fetch all markets with their options
        const {
          data: marketsData,
          error: marketsError
        } = await supabase.from('event_markets').select(`
            *,
            market_categories(name),
            market_subcategories(name),
            market_options(*)
          `).eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', {
          ascending: false
        });
        if (marketsError) throw marketsError;
        const formattedMarkets = marketsData?.map(market => ({
          id: market.id,
          question: market.name,
          category: market.market_categories?.name || 'Unknown',
          subcategory: market.market_subcategories?.name || 'General',
          yesPrice: market.yes_price,
          noPrice: market.no_price,
          volume: market.volume,
          endDate: market.end_date,
          liquidity: market.liquidity,
          change24h: market.change_24h,
          description: market.description,
          relevance: market.relevance,
          whyItMatters: market.why_it_matters,
          createdAt: market.created_at,
          is_featured: market.is_featured,
          is_trending: market.is_trending,
          marketStructure: market.market_structure,
          options: market.market_options || [],
          imageUrl: market.image_url
        })) || [];
        setAllMarkets(formattedMarkets);

        // Now fetch categories and calculate real stats
        const {
          data: categoriesData,
          error: categoriesError
        } = await supabase.from('market_categories').select('*').eq('is_active', true).order('sort_order', {
          ascending: true
        });
        if (categoriesError) throw categoriesError;

        // Calculate real stats for each category
        const dbCategories = categoriesData?.map(category => {
          const categoryMarkets = formattedMarkets.filter(m => m.category.toLowerCase() === category.name.toLowerCase());
          const totalVolume = categoryMarkets.reduce((sum, m) => sum + (m.volume || 0), 0);
          const totalLiquidity = categoryMarkets.reduce((sum, m) => sum + (m.liquidity || 0), 0);
          const avgChange = categoryMarkets.length > 0 ? categoryMarkets.reduce((sum, m) => sum + (m.change24h || 0), 0) / categoryMarkets.length : 0;
          return {
            id: category.name.toLowerCase().replace(/\s+/g, '-').replace('&', ''),
            label: category.name,
            icon: getIconForCategory(category.name),
            count: categoryMarkets.length,
            fullData: category,
            color: getColorForCategory(category.name),
            volume: totalVolume,
            change24h: avgChange,
            trending: (Math.random() - 0.5) * 20,
            activeTraders: Math.floor(categoryMarkets.length * 150 + Math.random() * 1000),
            // Estimate based on markets
            avgResolutionTime: Math.floor(Math.random() * 60) + 15,
            // Still estimated
            successRate: Math.floor(Math.random() * 20) + 80,
            // Still estimated
            liquidity: totalLiquidity,
            newMarketsToday: categoryMarkets.filter(m => {
              const createdDate = new Date(m.createdAt);
              const today = new Date();
              return createdDate.toDateString() === today.toDateString();
            }).length,
            topMarket: categoryMarkets.length > 0 ? categoryMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0))[0].question : `No ${category.name} markets yet`
          };
        }) || [];

        // Calculate totals for "All" category
        const totalStats = {
          count: formattedMarkets.length,
          volume: formattedMarkets.reduce((sum, m) => sum + (m.volume || 0), 0),
          change24h: formattedMarkets.length > 0 ? formattedMarkets.reduce((sum, m) => sum + (m.change24h || 0), 0) / formattedMarkets.length : 0,
          liquidity: formattedMarkets.reduce((sum, m) => sum + (m.liquidity || 0), 0),
          activeTraders: formattedMarkets.length * 100,
          // Estimate
          avgResolutionTime: 32,
          // Still estimated
          successRate: 85,
          // Still estimated
          newMarketsToday: formattedMarkets.filter(m => {
            const createdDate = new Date(m.createdAt);
            const today = new Date();
            return createdDate.toDateString() === today.toDateString();
          }).length,
          topMarket: formattedMarkets.length > 0 ? formattedMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0))[0].question : 'No markets available'
        };
        // Add Favourites category
        const favoritesCategory = {
          id: "favourites",
          label: "Favourites",
          icon: Star,
          count: favorites.size,
          color: getColorForCategory('Favourites'),
          volume: 0,
          change24h: 0,
          trending: 0,
          activeTraders: 0,
          avgResolutionTime: 0,
          successRate: 0,
          liquidity: 0,
          newMarketsToday: 0,
          topMarket: "Your favorite markets"
        };

        setCategories([{
          id: "all",
          label: "All Event Markets",
          icon: Globe,
          ...totalStats
        }, favoritesCategory, ...dbCategories]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [favorites]);

  // Carousel effect
  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setSelectedIndex(api.selectedScrollSnap());
    };
    api.on("select", onSelect);
    onSelect();
    return () => {
      api?.off("select", onSelect);
    };
  }, [api]);

  // Handle URL parameters on mount and when they change
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const subcategoryParam = searchParams.get('subcategory');
    if (categoryParam && categories.length > 0) {
      const category = categories.find(cat => cat.label.toLowerCase() === categoryParam.toLowerCase());
      if (category && category.id !== 'all') {
        setSelectedCategoryData(category);
        setViewMode('subcategories');

        // Fetch subcategories for this category
        if (category.fullData?.id) {
          fetchSubcategories(category.fullData.id).then(() => {
            // If subcategory is also specified, navigate to markets view
            if (subcategoryParam) {
              setViewMode('markets');
              // Find and set the subcategory after subcategories are loaded
              setTimeout(() => {
                setSubcategories(prev => {
                  const subcategory = prev.find(sub => sub.name.toLowerCase() === subcategoryParam.toLowerCase());
                  if (subcategory) {
                    setSelectedSubcategory(subcategory.id);
                  }
                  return prev;
                });
              }, 100);
            }
          });
        }
      }
    }
  }, [searchParams, categories]);

  // Re-fetch subcategories when allMarkets data is available
  useEffect(() => {
    if (allMarkets.length > 0 && viewMode === 'subcategories' && selectedCategoryData?.fullData?.id) {
      fetchSubcategories(selectedCategoryData.fullData.id);
    }
  }, [allMarkets, viewMode, selectedCategoryData]);

  const fetchSubcategories = async (categoryId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('market_subcategories').select('*').eq('category_id', categoryId).eq('is_active', true).order('sort_order', {
        ascending: true
      });
      if (error) throw error;

      // Ensure we have markets data before calculating counts
      if (!allMarkets.length) {
        console.warn('No markets data available for count calculation');
      }

      // Calculate real counts for subcategories
      const subcategoriesWithCounts = data?.map(sub => {
        const subcategoryMarkets = allMarkets.filter(market => {
          // More robust filtering with null checks
          const marketSubcategory = market.subcategory?.toLowerCase().trim() || '';
          const subName = sub.name?.toLowerCase().trim() || '';
          return marketSubcategory === subName;
        });
        return {
          id: sub.id,
          name: sub.name,
          description: sub.description,
          count: subcategoryMarkets.length
        };
      }) || [];

      // Calculate total for "All" option - markets in this category
      const categoryMarkets = allMarkets.filter(market => {
        const marketCategory = market.category?.toLowerCase().trim() || '';
        const selectedCategory = selectedCategoryData?.label?.toLowerCase().trim() || '';
        return marketCategory === selectedCategory;
      });
      const subcategoriesWithAll = [{
        id: "all",
        name: "All",
        description: "All markets in this category",
        count: categoryMarkets.length
      }, ...subcategoriesWithCounts];
      setSubcategories(subcategoriesWithAll);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setSubcategories([{
        id: "all",
        name: "All",
        description: "All markets in this category",
        count: 0
      }]);
    }
  };
  const handleCategorySelect = async (category: any) => {
    if (category.id === "all") {
      setSelectedCategory("all");
      return;
    }
    
    // Special handling for Favourites - go directly to markets view
    if (category.id === "favourites") {
      setSelectedCategoryData(category);
      setViewMode('markets');
      setSelectedSubcategory("all");
      return;
    }
    
    setSelectedCategoryData(category);
    setViewMode('subcategories');
    setSelectedSubcategory("all");
    if (category.fullData?.id) {
      await fetchSubcategories(category.fullData.id);
    }
  };
  const handleSubcategorySelect = (subcategory: any) => {
    setSelectedSubcategory(subcategory.id);
    setViewMode('markets');
  };
  const handleBackToCategories = () => {
    setViewMode('categories');
    setSelectedCategoryData(null);
    setSubcategories([]);
    setSelectedSubcategory("all");
  };
  const handleBackToSubcategories = () => {
    setViewMode('subcategories');
    setSelectedSubcategory("all");
  };

  // Database search function
  const performDatabaseSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      // First search in main market fields
      const {
        data: marketsData,
        error
      } = await supabase.from('event_markets').select(`
          *,
          market_categories(name),
          market_subcategories(name),
          market_options(*)
        `).eq('is_active', true).or(`name.ilike.%${query}%,market_categories.name.ilike.%${query}%,market_subcategories.name.ilike.%${query}%`).order('sort_order', { ascending: true }).order('created_at', {
        ascending: false
      });

      if (error) throw error;

      // Also search for markets that have matching candidate outcomes
      const {
        data: candidateMarketsData,
        error: candidateError
      } = await supabase.from('event_markets').select(`
          *,
          market_categories(name),
          market_subcategories(name),
          market_options!inner(*)
        `).eq('is_active', true).or(`market_options.option_name.ilike.%${query}%,market_options.candidate_name.ilike.%${query}%`).order('sort_order', { ascending: true }).order('created_at', {
        ascending: false
      });

      if (candidateError) throw candidateError;

      // Combine and deduplicate results
      const allResults = [...(marketsData || []), ...(candidateMarketsData || [])];
      const uniqueResults = allResults.filter((market, index, self) => 
        index === self.findIndex(m => m.id === market.id)
      );

      const formattedResults = uniqueResults?.map(market => ({
        id: market.id,
        question: market.name,
        category: market.market_categories?.name || 'Unknown',
        subcategory: market.market_subcategories?.name || 'General',
        yesPrice: market.yes_price,
        noPrice: market.no_price,
        volume: market.volume,
        endDate: market.end_date,
        liquidity: market.liquidity,
        change24h: market.change_24h,
        description: market.description,
        relevance: market.relevance,
        whyItMatters: market.why_it_matters,
        createdAt: market.created_at,
        is_featured: market.is_featured,
        is_trending: market.is_trending,
        marketStructure: market.market_structure,
        options: market.market_options || [],
        imageUrl: market.image_url
      })) || [];
      setSearchResults(formattedResults);
      setHasSearched(true);
    } catch (error) {
      console.error('Database search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search on Enter key
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performDatabaseSearch(searchQuery);
    }
  };

  // Clear search results
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  // Get display markets - use search results if searched, otherwise filtered markets
  const getDisplayMarkets = () => {
    return hasSearched ? searchResults : getFilteredMarkets();
  };

  // Calculate real stats for overall platform
  const calculatePlatformStats = () => {
    const totalMarkets = allMarkets.length;
    const totalVolume = allMarkets.reduce((sum, m) => sum + (m.volume || 0), 0);
    const totalLiquidity = allMarkets.reduce((sum, m) => sum + (m.liquidity || 0), 0);
    const activeTraders = Math.floor(totalMarkets * 50); // Estimated based on markets

    return {
      totalMarkets,
      totalVolume: `$${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      activeTraders: activeTraders > 1000 ? `${(activeTraders / 1000).toFixed(1)}K` : activeTraders.toString(),
      totalValueLocked: "$1,243,906"
    };
  };
  const platformStats = calculatePlatformStats();

  // Filter markets based on current view and selection
  const getFilteredMarkets = (markets: any[] = allMarkets) => {
    let filtered = markets;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(market => market.question.toLowerCase().includes(searchQuery.toLowerCase()) || market.category.toLowerCase().includes(searchQuery.toLowerCase()) || market.subcategory.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Filter by category and subcategory based on current view
    if (viewMode === 'markets' && selectedCategoryData) {
      // Special handling for Favourites category
      if (selectedCategoryData.id === 'favourites') {
        filtered = filtered.filter(market => favorites.has(market.id));
      } else if (selectedCategoryData.id !== 'all') {
        filtered = filtered.filter(market => market.category.toLowerCase() === selectedCategoryData.label.toLowerCase());

        // Further filter by subcategory if not "all"
        if (selectedSubcategory !== 'all') {
          const selectedSubcategoryName = subcategories.find(sub => sub.id === selectedSubcategory)?.name;
          if (selectedSubcategoryName) {
            filtered = filtered.filter(market => market.subcategory.toLowerCase() === selectedSubcategoryName.toLowerCase());
          }
        }
      }
    }
    return filtered;
  };

  // Get markets for specific tab filters
  const getEndingSoonMarkets = () => {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return getDisplayMarkets().filter(market => {
      const endDate = new Date(market.endDate);
      return endDate <= oneWeekFromNow && endDate > now;
    });
  };
  const getHighVolumeMarkets = () => {
    const volumeThreshold = 10000; // $10k threshold
    return getDisplayMarkets().filter(market => market.volume >= volumeThreshold);
  };
  const getNewMarkets = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return getDisplayMarkets().filter(market => {
      // Assuming we have a createdAt field in the market data
      const createdDate = new Date(market.createdAt || market.created_at);
      return createdDate >= thirtyDaysAgo;
    });
  };
  const getFeaturedMarkets = () => {
    return getDisplayMarkets().filter(market => market.is_featured === true);
  };
  const getTrendingMarkets = () => {
    return getDisplayMarkets().filter(market => market.is_trending === true);
  };
  const filteredMarkets = (markets: any[]) => {
    return markets.filter(market => {
      const matchesSearch = market.question.toLowerCase().includes(searchQuery.toLowerCase()) || market.category.toLowerCase().includes(searchQuery.toLowerCase());

      // If in categories view or "all" is selected, show all markets that match search
      if (viewMode === 'categories' || selectedCategory === "all") return matchesSearch;

      // If in subcategories view, filter by selected category
      if (viewMode === 'subcategories') {
        const categoryMatch = selectedCategoryData && (market.category.toLowerCase() === selectedCategoryData.label.toLowerCase() || market.category.toLowerCase().replace(/\s+/g, '-').replace('&', '') === selectedCategoryData.id);
        return matchesSearch && categoryMatch;
      }

      // If in markets view, filter by category and potentially subcategory
      if (viewMode === 'markets') {
        const categoryMatch = selectedCategoryData && (market.category.toLowerCase() === selectedCategoryData.label.toLowerCase() || market.category.toLowerCase().replace(/\s+/g, '-').replace('&', '') === selectedCategoryData.id);
        return matchesSearch && categoryMatch;
      }
      return matchesSearch;
    });
  };

  // Pagination helper functions
  const getPaginatedMarkets = (markets: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return markets.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const renderPagination = (totalItems: number) => {
    const totalPages = getTotalPages(totalItems);
    
    if (totalPages <= 1) return null;

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return (
      <div className="mt-8 flex justify-center">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            
            {startPage > 1 && (
              <>
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(1)} className="cursor-pointer">
                    1
                  </PaginationLink>
                </PaginationItem>
                {startPage > 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
              </>
            )}
            
            {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => handlePageChange(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            
            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink onClick={() => handlePageChange(totalPages)} className="cursor-pointer">
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              </>
            )}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };
  return <div className="min-h-screen">
      <Header />
      
      {/* Categories View with Carousel */}
      {viewMode === 'categories' && <div className="container pt-4 pb-8">
          <div className="mb-8 space-y-8">
            {/* Carousel Wheel */}
            <div className="relative">
              <Carousel setApi={setApi} className="w-full max-w-6xl mx-auto" opts={{
            align: "center",
            loop: true,
            skipSnaps: false,
            dragFree: true
          }}>
                <CarouselContent className="py-8">
                {categories.filter(cat => cat.id !== 'all').map((category, index) => {
                const Icon = category.icon;
                const isCenter = index === selectedIndex;
                const totalCategories = categories.filter(cat => cat.id !== 'all').length;
                const distance = Math.abs(index - selectedIndex);
                const distanceFromEnd = Math.min(distance, totalCategories - distance);
                const isAdjacent = distanceFromEnd === 1;
                return <CarouselItem key={category.id} className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/6 flex justify-center px-1">
                        <div className={`
                            relative transition-all duration-500 ease-out cursor-pointer
                            ${isCenter ? 'scale-125 z-20' : isAdjacent ? 'scale-100 z-10' : 'scale-75 z-0 opacity-50'}
                          `} onClick={() => api?.scrollTo(index)}>
                          {/* Card Shadow/Glow Effect */}
                          {isCenter && <div className="absolute inset-0 rounded-2xl blur-xl opacity-30" style={{
                      backgroundColor: category.color
                    }} />}
                          
                          {/* Category Card */}
                           <Card className={`
                              relative w-20 h-16 md:w-24 md:h-20 cursor-pointer transition-all duration-500
                              ${isCenter ? 'shadow-2xl ring-2 ring-primary' : 'shadow-md hover:shadow-lg'}
                            `}>
                            <CardContent className="p-2 text-center h-full flex flex-col items-center justify-center">
                              <Icon className="h-4 w-4 md:h-5 md:w-5 mx-auto mb-1 text-primary transition-all duration-500" />
                              
                              {/* Category Label */}
                              <p className="font-medium text-xs leading-tight line-clamp-1">{t(getCategoryTranslationKey(category.label))}</p>
                              <p className="text-xs text-muted-foreground hidden sm:block">{category.count}</p>
                            </CardContent>
                            
                            {/* Market Count Badge */}
                            {isCenter && <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground animate-fade-in">
                                <span className="text-xs">{category.count}</span>
                              </div>}
                          </Card>
                        </div>
                      </CarouselItem>;
              })}
                </CarouselContent>
                
                {/* Custom Navigation Buttons */}
                <CarouselPrevious className="left-4 w-12 h-12 border-2 hover:scale-110 transition-transform border-primary" />
                <CarouselNext className="right-4 w-12 h-12 border-2 hover:scale-110 transition-transform border-primary" />
              </Carousel>
              
              {/* Diner Wheel Base */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-4">
                <div className="w-32 h-8 bg-gradient-to-b from-muted to-muted-foreground/20 rounded-full shadow-lg" />
                <div className="w-24 h-4 bg-muted-foreground/40 rounded-full mx-auto -mt-2" />
              </div>
            </div>

            {/* Selected Category Details */}
            {categories.filter(cat => cat.id !== 'all')[selectedIndex] && <div className="animate-fade-in">
                <Card className="max-w-2xl mx-auto p-6 md:p-8 space-y-6 border-2 border-primary">
                  <div className="text-center space-y-4">
                    {(() => {
                const selectedCategory = categories.filter(cat => cat.id !== 'all')[selectedIndex];
                const SelectedIcon = selectedCategory.icon;
                return <>
                          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full flex items-center justify-center border-4 border-primary bg-primary/5 animate-scale-in">
                            <SelectedIcon className="w-10 h-10 md:w-12 md:h-12 text-primary" />
                          </div>
                          
                          <div>
                            <h2 className="text-3xl md:text-4xl font-bold">{t(getCategoryTranslationKey(selectedCategory.label))}</h2>
                            <p className="text-base md:text-lg text-muted-foreground">{t('markets.eventPredictionMarkets')}</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="text-center p-4 md:p-6 bg-muted/20 rounded-xl">
                              <div className="text-2xl md:text-3xl font-bold">{selectedCategory.count}</div>
                              <div className="text-sm text-muted-foreground">{t('markets.activeEventMarkets')}</div>
                            </div>
                            
                            <div className="text-center p-4 md:p-6 bg-muted/20 rounded-xl">
                              <div className="text-2xl md:text-3xl font-bold">
                                ${(selectedCategory.volume / 1000000).toFixed(1)}M
                              </div>
                              <div className="text-sm text-muted-foreground">{t('markets.totalVolume')}</div>
                            </div>

                            <div className="text-center p-4 md:p-6 bg-muted/20 rounded-xl">
                              <div className={`text-xl md:text-2xl font-bold ${selectedCategory.trending > 0 ? 'text-primary' : 'text-red-500'}`}>
                                {selectedCategory.trending > 0 ? '+' : ''}{selectedCategory.trending.toFixed(1)}%
                              </div>
                              <div className="text-sm text-muted-foreground">{t('markets.trend24h')}</div>
                            </div>
                          </div>

                          <Button onClick={() => handleCategorySelect(selectedCategory)} className="w-full py-6 text-base md:text-lg font-semibold hover:scale-105 transition-transform bg-primary !text-black">
                            {t('markets.exploreCategory', { category: t(getCategoryTranslationKey(selectedCategory.label)) })}
                          </Button>
                        </>;
              })()}
                  </div>
                </Card>
              </div>}

            {/* Instructions */}
            <div className="text-center text-muted-foreground space-y-2 px-2">
            </div>
          </div>
        </div>}
      
      <main className="container py-8">
        {/* Header Section */}
        <div className="space-y-6 mb-12">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('markets.searchDatabase')} className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleSearchKeyDown} />
              {(isSearching || hasSearched) && <div className="absolute right-3 top-3 flex items-center gap-2">
                  {isSearching && <div className="w-4 h-4 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />}
                  {hasSearched && !isSearching && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-destructive/10" onClick={clearSearch}>
                      ×
                    </Button>}
                </div>}
            </div>
          </div>
          
          {/* Search Results Indicator */}
          {hasSearched && <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              {t('markets.searchResults', { query: searchQuery, count: searchResults.length })}
              <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={clearSearch}>
                {t('markets.clearSearch')}
              </Button>
            </div>}
        </div>

        {/* Navigation */}
        {viewMode !== 'categories' && <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <button onClick={handleBackToCategories} className="hover:text-primary transition-colors">
                {t('markets.allMarkets')}
              </button>
              <ChevronRight className="h-4 w-4" />
              {selectedCategoryData && <>
                  <button onClick={handleBackToSubcategories} className="text-foreground font-medium hover:text-primary transition-colors">
                    {selectedCategoryData.label}
                  </button>
                  {viewMode === 'markets' && selectedSubcategory !== 'all' && <>
                      <ChevronRight className="h-4 w-4" />
                      <span className="text-foreground font-medium">
                        {subcategories.find(sub => sub.id === selectedSubcategory)?.name}
                      </span>
                    </>}
                </>}
            </div>
          </div>}

        {/* Subcategories View */}
        {viewMode === 'subcategories' && selectedCategoryData && <div className="mb-6">
            {/* Enhanced Category Details Card */}
            <div className="mb-4">
              <Card className="border border-primary/30 bg-gradient-to-br from-primary/8 to-accent/8 overflow-hidden animate-fade-in">
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-primary/20 animate-scale-in">
                        <selectedCategoryData.icon className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedCategoryData.label}</h2>
                        <p className="text-sm text-muted-foreground">{t('markets.predictionMarkets')}</p>
                      </div>
                    </div>
                    <Star className="h-5 w-5 text-primary" />
                  </div>

                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-6 gap-4 mb-6">
                    {/* Total Volume - Takes 2 columns */}
                    <div className="col-span-2 p-4 bg-background/70 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <DollarSign className="h-3 w-3" />
                        {t('markets.totalVolume')}
                      </div>
                      <p className="text-2xl font-bold">${(selectedCategoryData.volume / 1000000).toFixed(1)}M</p>
                    </div>
                    
                    {/* 24h Change - Takes 2 columns */}
                    <div className="col-span-2 p-4 bg-background/70 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <TrendingUp className="h-3 w-3" />
                        {t('markets.change24h')}
                      </div>
                      <p className={`text-2xl font-bold ${selectedCategoryData.change24h > 0 ? 'text-up' : 'text-down'}`}>
                        {selectedCategoryData.change24h > 0 ? '+' : ''}{selectedCategoryData.change24h.toFixed(1)}%
                      </p>
                    </div>
                    
                    {/* Traders - Takes 1 column */}
                    <div className="col-span-1 p-3 bg-background/50 rounded-lg text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                        <Users className="h-3 w-3" />
                        {t('markets.traders')}
                      </div>
                      <p className="font-bold">{(selectedCategoryData.activeTraders / 1000).toFixed(1)}K</p>
                    </div>
                    
                    {/* Liquidity - Takes 1 column */}
                    <div className="col-span-1 p-3 bg-background/50 rounded-lg text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                        <Droplets className="h-3 w-3" />
                        {t('markets.liquidity')}
                      </div>
                      <p className="font-bold">${(selectedCategoryData.liquidity / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>

                  {/* Secondary Stats Row */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="text-center p-3 bg-background/30 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                        <Store className="h-3 w-3" />
                        {t('markets.accuracy')}
                      </div>
                      <p className="font-bold">{selectedCategoryData.successRate}%</p>
                    </div>
                    <div className="text-center p-3 bg-background/30 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        {t('markets.avgDays')}
                      </div>
                      <p className="font-bold">{selectedCategoryData.avgResolutionTime}</p>
                    </div>
                    <div className="text-center p-3 bg-background/30 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                        <Plus className="h-3 w-3" />
                        {t('markets.newToday')}
                      </div>
                      <p className="font-bold text-primary">{selectedCategoryData.newMarketsToday}</p>
                    </div>
                    <div className="text-center p-3 bg-background/30 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                        <Star className="h-3 w-3" />
                        {t('markets.marketsLabel')}
                      </div>
                      <p className="font-bold">{selectedCategoryData.count}</p>
                    </div>
                  </div>

                  {/* Bottom Info */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/30">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t('markets.mostPopularMarket')}</div>
                      <p className="text-sm font-medium line-clamp-1">{selectedCategoryData.topMarket}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                        {t('markets.subcategoriesCount', { count: subcategories.length - 1 })}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <h3 className="text-xl font-semibold mb-4">{t('markets.chooseSubcategory')}</h3>
            <div className="rounded-md border">
              <div className="divide-y divide-border">
                {subcategories.map(subcategory => <div key={subcategory.id} className="cursor-pointer transition-colors hover:bg-muted/50 p-4" onClick={() => handleSubcategorySelect(subcategory)}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{subcategory.name}</h4>
                          {subcategory.id === "all" && <Badge variant="default" className="text-xs">{t('markets.allInCategory')}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{subcategory.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary">{subcategory.count} markets</p>
                      </div>
                    </div>
                  </div>)}
              </div>
            </div>
          </div>}

        {/* Market Sections - Only show when in markets view or categories view with "all" selected */}
        {(viewMode === 'markets' || viewMode === 'categories' && selectedCategory === "all") && <Tabs defaultValue="all" className="w-full" value={activeTab} onValueChange={handleTabChange}>
          <div className="mb-6 overflow-x-auto">
              <TabsList className="inline-flex h-auto p-1 bg-card/50 border border-border/40">
                <TabsTrigger value="all" className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                  <Globe className="mr-2 h-4 w-4" />
                  {t('markets.tabs.all')}
                </TabsTrigger>
                <TabsTrigger value="featured" className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                  <Trophy className="mr-2 h-4 w-4" />
                  {t('markets.tabs.featured')}
                </TabsTrigger>
                <TabsTrigger value="trending" className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {t('markets.tabs.trending')}
                </TabsTrigger>
                <TabsTrigger value="new" className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                  <Zap className="mr-2 h-4 w-4" />
                  {t('markets.tabs.new')}
                </TabsTrigger>
                <TabsTrigger value="ending-soon" className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                  <Clock className="mr-2 h-4 w-4" />
                  {t('markets.tabs.endingSoon')}
                </TabsTrigger>
                <TabsTrigger value="high-volume" className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t('markets.tabs.highVolume')}
                </TabsTrigger>
              </TabsList>
          </div>

          <TabsContent value="all" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">{t('markets.tabTitles.allMarkets')}</h3>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {t('markets.badgeLabels.markets', { count: getDisplayMarkets().length })}
              </Badge>
            </div>
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
              {getPaginatedMarkets(getDisplayMarkets()).map(market => (
                <div key={market.id} className="break-inside-avoid mb-4">
                  <SmartMarketCard {...market} />
                </div>
              ))}
            </div>
            {getDisplayMarkets().length === 0 && <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-2">{t('markets.noMarketsFoundTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? t('markets.noMarketsFoundSearch') : t('markets.noMarketsFoundEmpty')}
                </p>
              </div>}
            {renderPagination(getDisplayMarkets().length)}
          </TabsContent>

          <TabsContent value="featured" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">{t('markets.tabTitles.featuredMarkets')}</h3>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {t('markets.badgeLabels.markets', { count: getFeaturedMarkets().length })}
              </Badge>
            </div>
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
              {getPaginatedMarkets(getFeaturedMarkets()).map(market => (
                <div key={market.id} className="break-inside-avoid mb-4">
                  <SmartMarketCard {...market} />
                </div>
              ))}
            </div>
            {getFeaturedMarkets().length === 0 && <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-2">{t('markets.emptyState.noFeatured')}</p>
                <p className="text-sm text-muted-foreground">{t('markets.emptyState.noFeaturedDesc')}</p>
              </div>}
            {renderPagination(getFeaturedMarkets().length)}
          </TabsContent>

          <TabsContent value="trending" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">{t('markets.tabTitles.trendingMarkets')}</h3>
              <Badge variant="secondary" className="bg-up/10 text-up">
                {t('markets.badgeLabels.markets', { count: getTrendingMarkets().length })}
              </Badge>
            </div>
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
              {getPaginatedMarkets(getTrendingMarkets()).map(market => (
                <div key={market.id} className="break-inside-avoid mb-4">
                  <SmartMarketCard {...market} />
                </div>
              ))}
            </div>
            {getTrendingMarkets().length === 0 && <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-2">{t('markets.emptyState.noTrending')}</p>
                <p className="text-sm text-muted-foreground">{t('markets.emptyState.noTrendingDesc')}</p>
              </div>}
            {renderPagination(getTrendingMarkets().length)}
          </TabsContent>

          <TabsContent value="new" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">{t('markets.tabTitles.newMarkets')}</h3>
              <Badge variant="secondary" className="bg-accent/10 text-accent-foreground">
                {t('markets.badgeLabels.markets30Days', { count: getNewMarkets().length })}
              </Badge>
            </div>
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
              {getPaginatedMarkets(getNewMarkets()).map(market => (
                <div key={market.id} className="break-inside-avoid mb-4">
                  <SmartMarketCard {...market} />
                </div>
              ))}
            </div>
            {getNewMarkets().length === 0 && <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-2">{t('markets.emptyState.noNew')}</p>
                <p className="text-sm text-muted-foreground">{t('markets.emptyState.noNewDesc')}</p>
              </div>}
            {renderPagination(getNewMarkets().length)}
          </TabsContent>

          <TabsContent value="ending-soon" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">{t('markets.tabTitles.endingSoon')}</h3>
              <Badge variant="secondary" className="bg-warning/10 text-warning">
                {t('markets.badgeLabels.markets7Days', { count: getEndingSoonMarkets().length })}
              </Badge>
            </div>
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
              {getPaginatedMarkets(getEndingSoonMarkets()).map(market => (
                <div key={market.id} className="break-inside-avoid mb-4">
                  <SmartMarketCard {...market} />
                </div>
              ))}
            </div>
            {getEndingSoonMarkets().length === 0 && <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-2">{t('markets.emptyState.noEndingSoon')}</p>
                <p className="text-sm text-muted-foreground">{t('markets.emptyState.noEndingSoonDesc')}</p>
              </div>}
            {renderPagination(getEndingSoonMarkets().length)}
          </TabsContent>

          <TabsContent value="high-volume" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">{t('markets.tabTitles.highVolumeMarkets')}</h3>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {t('markets.badgeLabels.markets10k', { count: getHighVolumeMarkets().length })}
              </Badge>
            </div>
            <div className="columns-1 md:columns-3 gap-4 space-y-4">
              {getPaginatedMarkets(getHighVolumeMarkets()).map(market => (
                <div key={market.id} className="break-inside-avoid mb-4">
                  <SmartMarketCard {...market} />
                </div>
              ))}
            </div>
            {getHighVolumeMarkets().length === 0 && <div className="text-center py-12">
                <p className="text-lg text-muted-foreground mb-2">{t('markets.emptyState.noHighVolume')}</p>
                <p className="text-sm text-muted-foreground">{t('markets.emptyState.noHighVolumeDesc')}</p>
              </div>}
            {renderPagination(getHighVolumeMarkets().length)}
          </TabsContent>
        </Tabs>}
      </main>
    </div>;
};
export default Markets;