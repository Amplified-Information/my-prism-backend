import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";

export function useFavoriteMarkets() {
  const { wallet } = useWallet();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch favorites when wallet connects
  useEffect(() => {
    if (wallet?.accountId) {
      fetchFavorites();
    } else {
      setFavorites(new Set());
    }
  }, [wallet?.accountId]);

  const fetchFavorites = async () => {
    if (!wallet?.accountId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("user_favorite_markets")
        .select("market_id")
        .eq("wallet_id", wallet.accountId);

      if (error) throw error;

      const favoriteIds = new Set(data.map((fav) => fav.market_id));
      setFavorites(favoriteIds);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isFavorite = (marketId: string) => {
    return favorites.has(marketId);
  };

  const toggleFavorite = async (marketId: string) => {
    if (!wallet?.accountId) {
      toast.error("Please connect your wallet to save favorites");
      return;
    }

    const isCurrentlyFavorite = favorites.has(marketId);

    try {
      if (isCurrentlyFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from("user_favorite_markets")
          .delete()
          .eq("wallet_id", wallet.accountId)
          .eq("market_id", marketId);

        if (error) throw error;

        setFavorites((prev) => {
          const newSet = new Set(prev);
          newSet.delete(marketId);
          return newSet;
        });
        toast.success("Removed from favorites");
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("user_favorite_markets")
          .insert({
            wallet_id: wallet.accountId,
            market_id: marketId,
          });

        if (error) throw error;

        setFavorites((prev) => new Set(prev).add(marketId));
        toast.success("Added to favorites");
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorites");
    }
  };

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
    isWalletConnected: !!wallet?.accountId,
  };
}
