import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { Wallet, Loader2, Copy, ExternalLink, LogOut, ChevronDown, User, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useHederaBalance } from "@/hooks/useHederaBalance";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";

import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import usdcLogo from "@/assets/usdc-logo.png";
import { hederaConfig, isMainnet, getAccountHashscanUrl } from "@/config/hedera";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SettingsDialog from "@/components/Settings/SettingsDialog";

interface WalletPersona {
  persona_name: string | null;
  persona_color: string | null;
}

const WalletButton = () => {
  const { wallet, connect, disconnect, isLoading } = useWallet();
  const { balance, refetch: refetchHbar, isLoading: isHbarLoading } = useHederaBalance();
  const { formattedBalance: usdcFormattedBalance, refetch: refetchUsdc, isLoading: isUsdcLoading } = useUsdcBalance();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [persona, setPersona] = useState<WalletPersona | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchPersona = async () => {
      if (!wallet.accountId) {
        setPersona(null);
        return;
      }
      
      const { data } = await supabase
        .from("hedera_wallets")
        .select("persona_name, persona_color")
        .eq("account_id", wallet.accountId)
        .maybeSingle();
      
      if (data) {
        setPersona(data);
      }
    };

    fetchPersona();
  }, [wallet.accountId, settingsOpen]);

  const formatAccountId = (accountId: string) => {
    return `${accountId.slice(0, 6)}...${accountId.slice(-4)}`;
  };

  const formatBalance = (balance: any) => {
    if (!balance?.balance?.balance) return null;
    const numBalance = balance.balance.balance / 100000000;
    if (numBalance === 0) return '0 HBAR';
    if (numBalance < 1) return `${numBalance.toFixed(4)} HBAR`;
    return `${numBalance.toFixed(2)} HBAR`;
  };

  const copyAccountId = async () => {
    if (!wallet.accountId) return;
    try {
      await navigator.clipboard.writeText(wallet.accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: t('wallet.copied'),
        description: t('wallet.copiedDesc')
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('wallet.connectionFailedDesc'),
        variant: "destructive"
      });
    }
  };

  const openAccountOnHashscan = () => {
    if (!wallet.accountId) return;
    window.open(getAccountHashscanUrl(wallet.accountId), '_blank');
  };


  const refreshBalances = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchHbar(), refetchUsdc()]);
      toast({
        title: t('wallet.balancesRefreshed'),
        description: t('wallet.balancesRefreshedDesc')
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('wallet.refreshFailed'),
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (wallet.isConnected) {
    return (
      <>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button 
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-primary/10 border-primary text-primary cursor-pointer hover:bg-primary/20 gap-1"
            >
              <Wallet className="w-3 h-3" />
              <span className="hidden sm:inline">
                {wallet.accountId ? formatAccountId(wallet.accountId) : 'Connected'}
              </span>
              <span className="sm:hidden">
                {wallet.accountId ? `${wallet.accountId.slice(0, 4)}...` : '...'}
              </span>
              {balance && (
                <span className="hidden md:inline text-xs ml-1 opacity-80">
                  ({formatBalance(balance)})
                </span>
              )}
              <ChevronDown className="w-3 h-3 ml-1" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56 bg-background border border-border z-[100]">
            {/* Network Indicator */}
            <div className="px-3 py-2 border-b border-border">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                isMainnet() 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  isMainnet() ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                {hederaConfig.displayName}
              </div>
            </div>
            <div className="px-3 py-2 flex items-center gap-3">
              {persona?.persona_name ? (
                <>
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-black font-bold shrink-0"
                    style={{ backgroundColor: persona.persona_color || '#FEFF9D' }}
                  >
                    {persona.persona_name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{persona.persona_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{wallet.accountId}</p>
                  </div>
                </>
              ) : (
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t('wallet.accountId') || 'Account ID'}</p>
                  <p className="text-sm font-medium truncate">{wallet.accountId}</p>
                </div>
              )}
            </div>
            <div className="px-3 py-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">{t('wallet.balances')}</span>
                <button
                  onClick={refreshBalances}
                  disabled={isRefreshing}
                  className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
                  title={t('wallet.refreshBalances')}
                >
                  <RefreshCw className={`w-3 h-3 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {balance && (
                <div className="flex items-center gap-2">
                  <img src="https://bfenuvdwsgzglhhjbrql.supabase.co/storage/v1/object/public/images/uploads/1758864965179_1p4b5jtrdp7.JPG" alt="Hedera" className="w-4 h-4 object-contain" />
                  <p className="text-sm font-medium">{formatBalance(balance)}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <img src={usdcLogo} alt="USDC" className="w-4 h-4" />
                <p className="text-sm font-medium">{usdcFormattedBalance}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={copyAccountId} className="cursor-pointer">
              <Copy className="w-4 h-4 mr-2" />
              {t('wallet.copyAddress') || 'Copy Address'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openAccountOnHashscan} className="cursor-pointer">
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('wallet.viewOnHashscan') || 'View on Hashscan'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              {t('wallet.persona') || 'Wallet Persona'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={disconnect} disabled={isLoading} className="cursor-pointer text-destructive focus:text-destructive">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
              {t('wallet.disconnect')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <SettingsDialog 
          open={settingsOpen} 
          onOpenChange={setSettingsOpen} 
          walletId={wallet.accountId} 
        />
      </>
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error: any) {
      console.error("Connection failed:", error);
      toast({
        title: t('wallet.connectionFailed'),
        description: error.message || t('wallet.connectionFailedDesc'),
        variant: "destructive"
      });
    }
  };

  return (
    <Button variant="trading" onClick={handleConnect} disabled={isLoading} className="!text-black">
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      <Wallet className="w-4 h-4 mr-2" />
      {t('wallet.connect')}
    </Button>
  );
};

export default WalletButton;
