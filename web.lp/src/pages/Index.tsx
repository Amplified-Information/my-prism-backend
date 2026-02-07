import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Shield, Eye, Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { apiClient } from "../../grpcClient"

const emailSchema = z.string().trim().email("Please enter a valid email").max(255, "Email is too long");

const Index = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = emailSchema.safeParse(email);

    if (!result.success) {
      toast({
        title: "Invalid email",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true)

      const response = await apiClient.newsLetter({ email })
      const stdResponse = response.response
      console.log(stdResponse)

      if (stdResponse.errorCode > 0) {
        throw new Error(stdResponse.message)
      }

      toast({
        title: "You're on the list!",
        description: "We'll notify you when prism.market launches.",
      })
    setEmail("");
    } catch (e) {
      console.error(e)
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false)
    }
  };

  return (
    <div className="min-h-screen bg-gradient-cosmic relative overflow-hidden">
      {/* Sweeping spotlight beams */}
      <div 
        className="absolute bottom-0 left-1/4 w-[200px] h-[120%] opacity-[0.85] animate-spotlight-left"
        style={{
          background: 'linear-gradient(to top, hsl(195 100% 50% / 0.6), transparent 60%)',
          transformOrigin: 'bottom center',
        }}
      />
      <div 
        className="absolute bottom-0 right-1/4 w-[200px] h-[120%] opacity-[0.85] animate-spotlight-right"
        style={{
          background: 'linear-gradient(to top, hsl(280 100% 70% / 0.6), transparent 60%)',
          transformOrigin: 'bottom center',
        }}
      />
      
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(100,200,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(100,200,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      
      {/* Dust particles */}
      {Array.from({ length: 30 }).map((_, i) => {
        const endX = -200 + Math.random() * 400;
        const endY = Math.random() > 0.7 
          ? 30 + Math.random() * 40
          : -50 - Math.random() * 70;
        const duration = 12 + Math.random() * 10;
        const delay = Math.random() * 15;
        
        return (
          <div
            key={i}
            className="absolute w-1 h-1 bg-prism-cyan/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationName: `dust-${i}`,
              animationDuration: `${duration}s`,
              animationTimingFunction: 'ease-in-out',
              animationDelay: `${delay}s`,
              animationIterationCount: 'infinite',
            }}
          >
            <style>{`
              @keyframes dust-${i} {
                0% {
                  transform: translate(0, 0);
                  opacity: 0;
                }
                10% {
                  opacity: 1;
                }
                90% {
                  opacity: 1;
                }
                100% {
                  transform: translate(${endX}px, ${endY}vh);
                  opacity: 0;
                }
              }
            `}</style>
          </div>
        );
      })}
      
      {/* Floating prism effect elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-prism-gold/5 rounded-full blur-3xl animate-float" />
      <div className="absolute top-40 right-20 w-40 h-40 bg-prism-purple/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-20 left-1/4 w-36 h-36 bg-prism-pink/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 md:px-12 py-6">
        <img 
          src={logo} 
          alt="Prism Market" 
          className="h-10 md:h-12 w-auto object-contain"
        />
        <div className="px-4 py-1.5 bg-prism-gold text-cosmic-dark text-xs md:text-sm font-semibold rounded-full">
          Powered by Hedera
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Coming Soon Badge */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="inline-block px-8 py-3 bg-secondary/50 backdrop-blur-sm border border-prism-gold/30 rounded-full">
              <p className="text-prism-gold font-mono text-lg md:text-xl">
                LAUNCHING SOON
              </p>
            </div>
          </div>

          {/* Hero Content */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-foreground leading-tight">
              Predict the Future,
            </h1>
            <p className="text-4xl md:text-5xl lg:text-6xl font-medium italic text-prism-gold">
              Trade with Confidence
            </p>
          </div>

          {/* Description */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Trade Real-World Events on Hedera. A decentralized prediction protocol built for speed, fairness, and the next generation of Web3.
            </p>
          </div>

          {/* Email Signup */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-secondary/50 backdrop-blur-sm border-prism-gold/30 focus:border-prism-gold text-foreground placeholder:text-muted-foreground"
              />
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="bg-prism-gold text-cosmic-dark font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? "Joining..." : "Join Waitlist"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              Be the first to know when we launch
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
            <div className="p-6 bg-card/50 backdrop-blur-sm border border-border rounded-lg hover:border-prism-gold/50 transition-colors">
              <div className="w-12 h-12 bg-prism-gold rounded-lg mb-4 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6 text-cosmic-dark" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Decentralized
              </h3>
              <p className="text-sm text-muted-foreground">
                Built on Hedera's fast, secure, and sustainable network
              </p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm border border-border rounded-lg hover:border-prism-gold/50 transition-colors">
              <div className="w-12 h-12 bg-prism-gold rounded-lg mb-4 mx-auto flex items-center justify-center">
                <Eye className="w-6 h-6 text-cosmic-dark" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Transparent
              </h3>
              <p className="text-sm text-muted-foreground">
                All predictions and outcomes verified on-chain
              </p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm border border-border rounded-lg hover:border-prism-gold/50 transition-colors">
              <div className="w-12 h-12 bg-prism-gold rounded-lg mb-4 mx-auto flex items-center justify-center">
                <Users className="w-6 h-6 text-cosmic-dark" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Community-Driven
              </h3>
              <p className="text-sm text-muted-foreground">
                Powered by collective intelligence and market consensus
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-8 text-center">
        <p className="text-sm text-muted-foreground">
          © 2025 Prism.Market
        </p>
      </footer>
    </div>
  );
};

export default Index;
