import { Link } from "react-router-dom";
import { ArrowLeft, Server, Shield, Database, Radio, Globe, Layers, GitBranch } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const DevNotes = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Development Notes</h1>
          <p className="text-lg text-muted-foreground">
            Internal Infrastructure Documentation for Prism Market
          </p>
        </div>

        {/* Infrastructure Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Infrastructure Overview
            </CardTitle>
            <CardDescription>
              AWS-based two-environment architecture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Prism Market runs on a two-environment AWS architecture with identical <Badge variant="outline">dev</Badge> and <Badge variant="outline">prod</Badge> environments. 
              Each environment is deployed within its own VPC with the following layers:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Bastion</strong> - Secure SSH access and logging</li>
              <li><strong className="text-foreground">Proxy</strong> - Envoy-based ingress routing</li>
              <li><strong className="text-foreground">Monolith</strong> - Core application services (Web, API, CLOB)</li>
              <li><strong className="text-foreground">Data</strong> - NATS messaging and PostgreSQL database</li>
            </ul>
          </CardContent>
        </Card>

        {/* Component Details */}
        <h2 className="text-2xl font-semibold mb-4">Component Details</h2>
        
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Bastion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-4 w-4 text-yellow-500" />
                Bastion Host
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Secure entry point for SSH access to internal infrastructure.</p>
              <div className="mt-2">
                <Badge variant="secondary">Port 22</Badge>
              </div>
              <p className="mt-2">Provides centralized logging and audit trail for all administrative access.</p>
            </CardContent>
          </Card>

          {/* Envoy Proxy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-4 w-4 text-blue-500" />
                Proxy Layer (Envoy)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Handles all incoming traffic and routes requests to appropriate backend services.</p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <Badge variant="secondary">Load Balancing</Badge>
                <Badge variant="secondary">TLS Termination</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Web Service */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-4 w-4 text-green-500" />
                Web Service
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Serves the frontend application and static assets.</p>
              <div className="mt-2">
                <Badge variant="secondary">Port 3000</Badge>
              </div>
            </CardContent>
          </Card>

          {/* API Gateway */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-4 w-4 text-purple-500" />
                API Gateway
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Central API endpoint for all client requests. The frontend connects to services through this gateway.</p>
              <div className="mt-2">
                <Badge variant="secondary">Port 8888</Badge>
              </div>
            </CardContent>
          </Card>

          {/* CLOB Service */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GitBranch className="h-4 w-4 text-orange-500" />
                CLOB Service
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Central Limit Order Book service for order matching and trade execution.</p>
              <div className="mt-2">
                <Badge variant="secondary">Port 50051</Badge>
                <Badge variant="outline" className="ml-2">gRPC</Badge>
              </div>
              <p className="mt-2">Handles real-time order matching for prediction markets.</p>
            </CardContent>
          </Card>

          {/* NATS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radio className="h-4 w-4 text-red-500" />
                NATS Messaging
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>High-performance messaging system for inter-service communication.</p>
              <div className="mt-2">
                <Badge variant="secondary">Port 4222</Badge>
              </div>
            </CardContent>
          </Card>

          {/* PostgreSQL */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-4 w-4 text-cyan-500" />
                PostgreSQL Database
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Primary database for order data, trade history, and CLOB state.</p>
              <div className="mt-2">
                <Badge variant="secondary">Port 5432</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Architecture Notes */}
        <h2 className="text-2xl font-semibold mb-4">Architecture Notes</h2>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Data Architecture Split</CardTitle>
            <CardDescription>How data is distributed between systems</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Supabase</Badge>
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>User accounts and wallet connections</li>
                  <li>Market metadata and categories</li>
                  <li>Governance proposals and votes</li>
                  <li>Comments and social features</li>
                  <li>Staking positions</li>
                  <li>Market creation workflow</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">AWS Infrastructure</Badge>
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Order matching engine (CLOB)</li>
                  <li>Trade execution and settlement</li>
                  <li>Order book state</li>
                  <li>Trade history</li>
                  <li>Real-time market data feeds</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Frontend Connectivity</CardTitle>
            <CardDescription>How the Lovable frontend connects to services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The frontend (this Lovable application) connects to backend services through two paths:
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong className="text-foreground">Supabase Direct</strong> - For user data, governance, and market metadata using the Supabase JS client.
              </li>
              <li>
                <strong className="text-foreground">API Gateway (Port 8888)</strong> - For CLOB operations, order placement, and real-time trading data.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Integration Status */}
        <h2 className="text-2xl font-semibold mb-4">Integration Status</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Current State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                  In Progress
                </Badge>
                <div>
                  <p className="font-medium">CLOB Integration</p>
                  <p className="text-sm text-muted-foreground">
                    Currently using mock data for order book display and trading interface. 
                    The <code className="bg-muted px-1 rounded">useCLOB</code> hook is prepared for API integration.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                  Complete
                </Badge>
                <div>
                  <p className="font-medium">Supabase Integration</p>
                  <p className="text-sm text-muted-foreground">
                    Full integration with Supabase for markets, governance, comments, and user data.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                  Planned
                </Badge>
                <div>
                  <p className="font-medium">API Gateway Connection</p>
                  <p className="text-sm text-muted-foreground">
                    Environment configuration for dev/prod API endpoints. Will connect via port 8888 for trading operations.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
          <p>Last updated: December 2024</p>
        </div>
      </main>
    </div>
  );
};

export default DevNotes;
