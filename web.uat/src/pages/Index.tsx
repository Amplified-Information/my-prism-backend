import { Link } from "react-router-dom";
import Header from "@/components/Layout/Header";
import HeroSection from "@/components/Hero/HeroSection";
import FeatureCards from "@/components/Features/FeatureCards";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();
  console.log('🏠 Index page rendering...');
  
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <FeatureCards />
      </main>
      <footer className="py-8 border-t border-border/40">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center items-center gap-4">
            <span>{t('footer.copyright')}</span>
            <span className="text-border">•</span>
            <Link to="/dev-notes" className="hover:text-foreground transition-colors">
              Dev Notes
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
