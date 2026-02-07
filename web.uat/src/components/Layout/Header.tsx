import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu } from "lucide-react";
import prismLogo from "@/assets/logo-prism-market.png";
import { Link } from "react-router-dom";
import WalletButton from "@/components/Wallet/WalletButton";
import { useWallet } from "@/contexts/WalletContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import LanguageSelector from "./LanguageSelector";

const Header = () => {
  const { wallet } = useWallet();
  const { t } = useTranslation();

  const handlePortfolioClick = (e: React.MouseEvent) => {
    if (!wallet.isConnected) {
      e.preventDefault();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <Link to="/" className="flex items-center">
            <img src={prismLogo} alt="Prism Market" className="h-8 w-auto object-contain" />
            <a href="https://hedera.com/" target="_blank" rel="noopener noreferrer" className="hidden lg:block">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 ml-2 lg:ml-3 flex items-center gap-1 lg:gap-2 hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <span className="hidden lg:inline">{t('common.poweredBy')}</span>
                <img
                  src="https://bfenuvdwsgzglhhjbrql.supabase.co/storage/v1/object/public/images/uploads/1758864965179_1p4b5jtrdp7.JPG"
                  alt="Hedera Hashgraph"
                  className="h-4"
                />
                <span className="text-primary font-medium hidden md:inline">Hedera</span>
              </Badge>
            </a>
          </Link>
        </div>

        {/* Navigation - Show on medium screens and up */}
        <nav className="hidden md:flex items-center space-x-3 lg:space-x-6 ml-4 lg:ml-8">
          <Link to="/markets" className="text-sm font-medium hover:text-primary transition-colors">
            {t('header.markets')}
          </Link>
          <Link to="/rewards" className="text-sm font-medium hover:text-primary transition-colors">
            {t('header.rewards')}
          </Link>
          <Link to="/create-market" className="text-sm font-medium hover:text-primary transition-colors">
            {t('header.marketFactory')}
          </Link>
          <Link to="/stake" className="text-sm font-medium hover:text-primary transition-colors">
            {t('header.stake')}
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center space-x-2 lg:space-x-4">

          {/* Hamburger menu button - visible on all screen sizes for accessing all menu items */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-background">
              <DropdownMenuItem asChild>
                <Link to="/markets" className="w-full cursor-pointer">
                  {t('header.markets')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/rewards" className="w-full cursor-pointer">
                  {t('header.rewards')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/create-market" className="w-full cursor-pointer">
                  {t('header.marketFactory')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/stake" className="w-full cursor-pointer">
                  {t('header.stake')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/portfolio"
                  onClick={handlePortfolioClick}
                  className={`w-full cursor-pointer ${
                    !wallet.isConnected ? "text-muted-foreground opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {t('header.portfolio')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/governance" className="w-full cursor-pointer">
                  {t('header.governance')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/wiki" className="w-full cursor-pointer">
                  {t('header.docs')}
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Language Selector */}
              <div className="px-2 py-2">
                <span className="text-xs text-muted-foreground mb-2 block">{t('header.language')}</span>
                <LanguageSelector className="w-full" />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <WalletButton />
        </div>
      </div>
    </header>
  );
};

export default Header;
