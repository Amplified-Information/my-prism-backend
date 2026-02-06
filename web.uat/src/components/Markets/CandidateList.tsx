import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
interface Candidate {
  id: string;
  name: string;
  party: string;
  percentage: number;
  yesPrice: number;
  noPrice: number;
  change24h: number;
  avatar: string;
}
interface CandidateListProps {
  candidates: Candidate[];
}
const CandidateList = ({
  candidates
}: CandidateListProps) => {
  return <Card>
      <CardHeader>
        <CardTitle>Candidate Outcomes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {candidates.map(candidate => <div key={candidate.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={candidate.avatar} />
                <AvatarFallback>{candidate.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-semibold">{candidate.name}</h4>
                <Badge variant="outline" className="text-xs">
                  {candidate.party}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{candidate.percentage}%</div>
                <div className="flex items-center text-sm">
                  {candidate.change24h >= 0 ? <TrendingUp className="mr-1 h-3 w-3 text-up" /> : <TrendingDown className="mr-1 h-3 w-3 text-down" />}
                  <span className={candidate.change24h >= 0 ? 'text-up' : 'text-down'}>
                    {candidate.change24h >= 0 ? '+' : ''}{candidate.change24h}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="yes" size="sm" className="min-w-[80px]">
                  Yes {candidate.yesPrice}¢
                </Button>
                <Button variant="no" size="sm" className="min-w-[80px]">
                  No {candidate.noPrice}¢
                </Button>
              </div>
            </div>
          </div>)}
      </CardContent>
    </Card>;
};
export default CandidateList;