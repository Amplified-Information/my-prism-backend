import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { useMemo } from "react";
import { ChevronDown } from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  party: string;
  percentage: number;
}

interface PriceHistoryPoint {
  id: string;
  market_id: string;
  option_id: string;
  price: number;
  volume: number;
  timestamp: string;
}

interface MarketChartProps {
  priceHistory: PriceHistoryPoint[];
  candidates: Candidate[];
  marketOptions: any[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Generate distinct colors for candidates
const generateColor = (index: number, total: number) => {
  const hue = (index * 360) / total;
  const saturation = 70;
  const lightness = index % 2 === 0 ? 50 : 40; // Alternate lightness for better distinction
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const MarketChart = ({ priceHistory, candidates, marketOptions, isOpen = true, onOpenChange }: MarketChartProps) => {
  // Debug: Log the input data
  console.log('MarketChart Debug:', {
    priceHistoryCount: priceHistory?.length,
    candidatesCount: candidates?.length,
    marketOptionsCount: marketOptions?.length,
    candidates: candidates?.map(c => c.name),
    marketOptions: marketOptions?.map(o => ({ name: o.option_name, candidateName: o.candidate_name, type: o.option_type }))
  });

  // Transform price history data into chart format
  const chartData = useMemo(() => {
    if (!priceHistory || !marketOptions) {
      console.log('MarketChart: Missing data', { priceHistory: !!priceHistory, marketOptions: !!marketOptions });
      return [];
    }

    // Group price history by timestamp
    const timeGroups: { [key: string]: { [key: string]: string | number } } = {};
    
    priceHistory.forEach(point => {
      try {
        const date = format(new Date(point.timestamp), 'yyyy-MM-dd');
        
        if (!timeGroups[date]) {
          timeGroups[date] = { timestamp: date };
        }
        
        // Find the option for this price point to get candidate info
        const option = marketOptions.find(opt => opt.id === point.option_id);
        console.log('MarketChart: Matching option for point', { 
          pointOptionId: point.option_id, 
          foundOption: option ? {
            id: option.id,
            optionName: option.option_name,
            candidateName: option.candidate_name,
            optionType: option.option_type
          } : 'NOT FOUND'
        });
        
        if (option && option.option_type === 'yes') { // Only show YES prices for candidates
          const candidateName = option.candidate_name || option.option_name;
          timeGroups[date][candidateName] = point.price * 100; // Convert to percentage
          console.log('MarketChart: Adding data point', { date, candidateName, price: point.price * 100 });
        }
      } catch (error) {
        console.warn('Error processing price history point:', point, error);
      }
    });

    const result = Object.values(timeGroups).sort((a, b) => 
      new Date(a.timestamp as string).getTime() - new Date(b.timestamp as string).getTime()
    );
    
    console.log('MarketChart: Final chartData', result);
    return result;
  }, [priceHistory, marketOptions]);

  // Generate colors and config for candidates
  const candidateColors = useMemo(() => {
    const colors: { [key: string]: string } = {};
    candidates.forEach((candidate, index) => {
      colors[candidate.name] = generateColor(index, candidates.length);
    });
    return colors;
  }, [candidates]);

  const chartConfig = useMemo(() => {
    const config: { [key: string]: { label: string; color: string } } = {};
    candidates.forEach(candidate => {
      config[candidate.name] = {
        label: candidate.name,
        color: candidateColors[candidate.name],
      };
    });
    return config;
  }, [candidates, candidateColors]);

  if (!chartData.length) {
    return (
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <Card className="w-full">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Price History</CardTitle>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                No price history data available
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className="w-full">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Price History</CardTitle>
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardHeader className="pt-0">
            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: candidateColors[candidate.name] }}
                  />
                  <span className="font-medium">{candidate.name}</span>
                  <span className="text-muted-foreground">
                    {candidate.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </CardHeader>
          
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => {
                      try {
                        return format(new Date(value), 'MMM dd');
                      } catch {
                        return value;
                      }
                    }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    labelFormatter={(value) => {
                      try {
                        return format(new Date(value), 'MMM dd, yyyy');
                      } catch {
                        return value;
                      }
                    }}
                    formatter={(value: any, name: string) => [`${Number(value).toFixed(1)}%`, name]}
                  />
                  {candidates.map((candidate) => (
                    <Line
                      key={candidate.id}
                      type="monotone"
                      dataKey={candidate.name}
                      stroke={candidateColors[candidate.name]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default MarketChart;