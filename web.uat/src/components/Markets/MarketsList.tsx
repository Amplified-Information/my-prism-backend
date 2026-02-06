import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, SortAsc } from "lucide-react";
import { useTranslation } from "react-i18next";
import MarketCard from "./MarketCard";

// Mock data
const mockMarkets = [
  {
    id: "1",
    question: "Will Bitcoin reach $100,000 by end of 2024?",
    category: "Crypto",
    yesPrice: 65,
    noPrice: 35,
    volume: 125000,
    endDate: "Dec 31, 2024",
    liquidity: 50000,
    change24h: 2.3,
    imageUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png"
  },
  {
    id: "2", 
    question: "Will the next US Federal Reserve rate decision be a cut?",
    category: "Economics",
    yesPrice: 78,
    noPrice: 22,
    volume: 89000,
    endDate: "Nov 15, 2024",
    liquidity: 35000,
    change24h: -1.2,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Seal_of_the_United_States_Federal_Reserve_System.svg/512px-Seal_of_the_United_States_Federal_Reserve_System.svg.png"
  },
  {
    id: "3",
    question: "Will Hedera Hashgraph partnership with a Fortune 500 company be announced in Q4 2024?",
    category: "Technology",
    yesPrice: 42,
    noPrice: 58,
    volume: 45000,
    endDate: "Dec 31, 2024",
    liquidity: 28000,
    change24h: 5.7,
    imageUrl: "https://cryptologos.cc/logos/hedera-hbar-logo.png"
  },
  {
    id: "4",
    question: "Will global temperature rise exceed 1.5°C by 2025?",
    category: "Climate",
    yesPrice: 85,
    noPrice: 15,
    volume: 67000,
    endDate: "Dec 31, 2025",
    liquidity: 40000,
    change24h: 0.8,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Temperature_icon.svg/512px-Temperature_icon.svg.png"
  }
];

const MarketsList = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("volume");

  const categories = ["all", "Crypto", "Economics", "Technology", "Climate", "Sports", "Politics"];

  const filteredMarkets = mockMarkets
    .filter(market => 
      market.question.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedCategory === "all" || market.category === selectedCategory)
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "volume":
          return b.volume - a.volume;
        case "liquidity":
          return b.liquidity - a.liquidity;
        case "change":
          return b.change24h - a.change24h;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={t('markets.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-muted/50"
          />
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder={t('markets.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category === "all" ? t('markets.allCategories') : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px]">
            <SortAsc className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="volume">{t('markets.volume')}</SelectItem>
            <SelectItem value="liquidity">{t('markets.liquidity')}</SelectItem>
            <SelectItem value="change">{t('markets.change24h')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Market Tabs */}
      <Tabs defaultValue="trending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trending">{t('markets.trending')}</TabsTrigger>
          <TabsTrigger value="ending-soon">{t('markets.endingSoon')}</TabsTrigger>
          <TabsTrigger value="new">{t('markets.new')}</TabsTrigger>
          <TabsTrigger value="high-volume">{t('markets.highVolume')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trending" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMarkets.map((market) => (
              <MarketCard key={market.id} {...market} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="ending-soon" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMarkets.slice(0, 3).map((market) => (
              <MarketCard key={market.id} {...market} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="new" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMarkets.slice(1, 4).map((market) => (
              <MarketCard key={market.id} {...market} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="high-volume" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMarkets.slice(0, 2).map((market) => (
              <MarketCard key={market.id} {...market} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {filteredMarkets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('markets.noMarketsFound')}</p>
        </div>
      )}
    </div>
  );
};

export default MarketsList;
