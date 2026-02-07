import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { ErrorBoundary, WalletErrorBoundary } from "@/components/ErrorBoundary";
import DustParticles from "@/components/Effects/DustParticles";
// Import pages directly for now to fix dynamic import issues
import Index from "./pages/Index";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import Portfolio from "./pages/Portfolio";
import CreateMarket from "./pages/CreateMarket";
import DailyRewards from "./pages/DailyRewards";
import Governance from "./pages/Governance";
import StakePRSM from "./pages/StakePRSM";
import Wiki from "./pages/Wiki";
import DevNotes from "./pages/DevNotes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors or network issues
        if (error?.message?.includes('404') || 
            error?.message?.includes('401') || 
            error?.message?.includes('403')) {
          return false;
        }
        return failureCount < 2; // Max 2 retries
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: false,
    },
  },
});

const App = () => {
  console.log('🎯 App component rendering...');
  
  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <WalletErrorBoundary>
        <WalletProvider>
          <TooltipProvider>
            <DustParticles />
            <Toaster />
            <Sonner />
            <ErrorBoundary>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/markets" element={<Markets />} />
                  <Route path="/create-market" element={<CreateMarket />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/stake" element={<StakePRSM />} />
                  <Route path="/governance" element={<Governance />} />
                  <Route path="/wiki" element={<Wiki />} />
                  <Route path="/rewards" element={<DailyRewards />} />
                  <Route path="/market/:id" element={<MarketDetail />} />
                  <Route path="/dev-notes" element={<DevNotes />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </ErrorBoundary>
          </TooltipProvider>
        </WalletProvider>
      </WalletErrorBoundary>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
