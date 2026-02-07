import MarketCard from "./MarketCard";
import MultiChoiceMarketCard from "./MultiChoiceMarketCard";
import { isMultiChoiceMarket, processMultiChoiceCandidates, type MarketData } from "@/utils/marketCardSelector";

interface SmartMarketCardProps extends MarketData {}

const SmartMarketCard = (props: SmartMarketCardProps) => {
  const isMultiChoice = isMultiChoiceMarket(props);

  if (isMultiChoice && props.options) {
    // Process candidates for multi-choice market
    const candidates = processMultiChoiceCandidates(props.options);
    
    return (
      <MultiChoiceMarketCard
        id={props.id}
        question={props.question}
        category={props.category}
        candidates={candidates}
        volume={props.volume}
        endDate={props.endDate}
        liquidity={props.liquidity}
        imageUrl={props.imageUrl}
      />
    );
  }

  // Fallback to binary market card
  return (
      <MarketCard
        id={props.id}
        question={props.question}
        category={props.category}
        yesPrice={props.yesPrice}
        noPrice={props.noPrice}
        volume={props.volume}
        endDate={props.endDate}
        liquidity={props.liquidity}
        change24h={props.change24h}
        marketStructure={props.marketStructure}
        options={props.options}
      />
  );
};

export default SmartMarketCard;