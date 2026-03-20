package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"math"
	"strconv"
)

type CronLOMService struct {
	priceRepository             *repositories.PriceRepository
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository
	hederaService               *HederaService
	predictionIntentsService    *PredictionIntentsService
}

func (cs *CronLOMService) Init(mr *repositories.MarketsRepository, pir *repositories.PredictionIntentsRepository, hs *HederaService, pis *PredictionIntentsService, pr *repositories.PriceRepository) error {
	// inject deps
	cs.marketsRepository = mr
	cs.predictionIntentsRepository = pir
	cs.hederaService = hs
	cs.predictionIntentsService = pis
	cs.priceRepository = pr

	lib.Log(lib.LOG_INFO, "Service: CronLOM service initialized successfully")
	return nil
}

func (cs *CronLOMService) CronJob() {
	lib.Log(lib.LOG_INFO, "CronLOMService: Running CronJob...")

	cs.CalcLOM()

	lib.Log(lib.LOG_INFO, "CronLOMService: CronJob completed.")
}

// See: https://docs.prism.market/protocol/liquidity-mining-limit-order-mining
func (cs *CronLOMService) CalcLOM() error {
	lib.Log(lib.LOG_INFO, "CalcLOM...")

	// price/distance tiers:
	type PriceDistanceTier struct {
		Threshold float64 // percent distance from market price (e.g., 0.20 for 20%)
		Weight    int
	}
	var priceDistanceTiers = []PriceDistanceTier{
		{Threshold: 0.20, Weight: 5},
		{Threshold: 0.10, Weight: 10},
		{Threshold: 0.05, Weight: 30},
		{Threshold: 0.02, Weight: 60},
		{Threshold: 0.01, Weight: 90},
	}

	markets, err := cs.marketsRepository.GetAllUnresolvedMarkets()
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to fetch unresolved markets: %v", err)
		return err
	}

	for _, market := range markets {
		lib.Log(lib.LOG_INFO, "Calculating LOM for market ID %s", market.MarketID.String())

		// get the current market price:
		currentMarketPriceStr, err := cs.priceRepository.GetLatestPriceByMarket(market.MarketID.String())
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to fetch current price for market ID %s: %v", market.MarketID.String(), err)
			continue
		}
		currentMarketPrice, err := strconv.ParseFloat(currentMarketPriceStr, 64)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to parse current price for market ID %s: %v", market.MarketID.String(), err)
			continue
		}
		lib.Log(lib.LOG_INFO, "Current market price for market ID %s: %f", market.MarketID.String(), currentMarketPrice)

		// total dollar amount for this market:

		totalAmountInMarketUsd, err := cs.predictionIntentsRepository.GetTotalValueUsdForMarketId(market.MarketID.String())
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to fetch total amount in market USD for market ID %s: %v", market.MarketID.String(), err)
			continue
		}

		// Get all account IDs for this market
		accountIds, err := cs.predictionIntentsRepository.GetAllAccountIdsForMarketId(market.MarketID)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to fetch account IDs for market ID %s: %v", market.MarketID.String(), err)
			continue
		}

		// Calculate LOM for each user
		for _, accountIdStr := range accountIds {
			userValueUsd := 0.0
			predictionIntents, err := cs.predictionIntentsRepository.GetAllOpenPredictionIntentsByMarketIdAndAccountId(market.MarketID, accountIdStr)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch prediction intents for account ID %s: %v", accountIdStr, err)
				continue
			}

			buyOrders := 0.0
			sellOrders := 0.0
			points := 0

			for _, pi := range predictionIntents {
				userValueUsd += math.Abs(pi.PriceUsd * pi.Qty) // keep track of the totalUsd for this user

				if pi.Qty > 0 {
					buyOrders += pi.PriceUsd * pi.Qty
				} else {
					sellOrders += math.Abs(pi.PriceUsd * pi.Qty)
				}
				// Calculate distance from market price
				distance := math.Abs(pi.PriceUsd-currentMarketPrice) / currentMarketPrice
				maxPoints := 0
				for _, tier := range priceDistanceTiers {
					if distance <= tier.Threshold && tier.Weight > maxPoints {
						maxPoints = tier.Weight
					}
				}
				points += maxPoints
			}

			lom := 0.0
			if buyOrders+sellOrders > 0 {
				lom = math.Abs(buyOrders-sellOrders) / (buyOrders + sellOrders)
			}

			lib.Log(lib.LOG_INFO, "LOM for account ID %s in market ID %s: %f (buy: %f, sell: %f, points: %d). Total amount USD in this market: %f", accountIdStr, market.MarketID.String(), lom, buyOrders, sellOrders, points, totalAmountInMarketUsd)
		}
	}

	return nil

	// Final step:
	// allocate the PRISM tokens (claimable)

	/*
		OLD
		| behaviour | points |
		| --- | --- |
		| user connected their wallet in the last 24 hours | 10 |
		| user entered a limit order in any market within 10% of market price | 10 |
		| user entered a limit order in any market within 5% of market price | 30 |
		| user entered a limit order in any market within 2% of market price | 60 |
		| user entered a limit order in any market within 1% of market price | 90 |
		| user entered a market order in any market | 30 |
		| a user order matched | 50 |
		| | 0 points |
	*/
}
