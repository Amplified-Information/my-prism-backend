package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"math"
	"math/rand"
	"strconv"
	"time"
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

	/////
	// pause for a random duration between 0-55 minutes to mitigate gaming the system by timing orders right before the cron job runs
	/////
	randomMinutes := rand.Intn(1) // random integer between 0 and 55 minutes
	lib.Log(lib.LOG_INFO, "Pausing for a random duration [0-55] minutes to mitigate gaming: %d minute pause...", randomMinutes)
	lib.Log(lib.LOG_INFO, "CronLOMService: Sleeping...")
	time.Sleep(time.Duration(randomMinutes) * time.Minute)
	lib.Log(lib.LOG_INFO, "CronLOMService: Awake")
	lib.Log(lib.LOG_INFO, "CronLOMService: Resuming CalcLOM after a %d minute pause...", randomMinutes)
	cronRanAt := time.Now() // need to store this on the prism_lom table to identify the epoch of orders we are calculating the LOM for

	var vestingPeriodYears = 6.0
	if lib.LaunchDate.After(time.Now().AddDate(int(vestingPeriodYears), 0, 0)) {
		return lib.ErrorLog("LOM initiative has finished. Date is too far in the future.")
	}

	var PRISMperDay = (0.1 * float64(lib.TotalNprismTokens)) / (vestingPeriodYears * 365) // 10% of 1 billion PRISM distributed per year, divided by 365 to get daily distribution
	var prismToBeAllocatedThisRun = PRISMperDay / 24                                      // since this cron runs every hour, we allocate 1/24th of the daily PRISM allocation each run

	var distance2durationRatio = 2.0     // weight distance points twice as much as duration points when calculating the total LOM score
	var dollarValue2lomScoreRatio = 1.25 // larger dollar values in the orderbook give more PRISM than a lower dollar value LOM score

	// var executionBonusPercentge = 10

	////
	// set up the weightings
	/////
	var priceDistanceTiers = []lib.PriceDistanceTier{
		{Threshold: 0.20, Weight: 5},
		{Threshold: 0.10, Weight: 10},
		{Threshold: 0.05, Weight: 30},
		{Threshold: 0.02, Weight: 60},
		{Threshold: 0.01, Weight: 90},
	}
	orderDurationMaxPercentageFromMarketPrice := 0.20 // only consider orders within 20% of the market price for duration points
	var orderDurationTiers = []lib.OrderDurationTier{
		{Duration: 24 * time.Hour, Weight: 15},
		{Duration: 1 * time.Hour, Weight: 10},
		{Duration: 30 * time.Minute, Weight: 2},
		{Duration: 10 * time.Minute, Weight: 1},
	}

	// Map: marketID -> accountID -> { dollarValue, lom score }
	type UserLOMSummary struct {
		DollarValue float64
		LOMScore    float64
	}
	lom_scores := make(map[string]map[string]UserLOMSummary)

	markets, err := cs.marketsRepository.GetAllUnresolvedMarkets()
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to fetch unresolved markets: %v", err)
		return err
	}
	lib.Log(lib.LOG_INFO, "Fetched %d unresolved markets", len(markets))

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
			// userValueUsd := 0.0
			predictionIntentsForUserInMarket, err := cs.predictionIntentsRepository.GetAllOpenPredictionIntentsByMarketIdAndAccountId(market.MarketID, accountIdStr)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch prediction intents for account ID %s: %v", accountIdStr, err)
				continue
			}

			dollarValueBuyOrdersForUser := 0.0
			dollarValueSellOrdersForUser := 0.0
			totalDistancePointsForUser := 0
			totalDurationPointsForUser := 0

			for _, pi := range predictionIntentsForUserInMarket {
				dollarValueBuyOrdersForUser += math.Abs(pi.PriceUsd * pi.Qty)

				/////
				// Calculate *distance* from market price
				/////
				distance := math.Abs((pi.PriceUsd - currentMarketPrice) / currentMarketPrice)
				distancePoints := 0
				for _, tier := range priceDistanceTiers {
					if distance <= tier.Threshold && tier.Weight > distancePoints {
						distancePoints = tier.Weight // override the previous value in the loop
					}
				}
				totalDistancePointsForUser += distancePoints

				/////
				// Calculate *duration* the order has been sitting in the order book
				/////
				// accounted for in GetAllOpenPredictionIntentsByMarketIdAndAccountId:
				// - exclude orders that have been matched (fully_matched_at)
				// - exclude orders that have been cancelled (cancelled_at)
				// - exclude orders that have been evicted (evicted_at)
				//
				// - exclude order that are far away from the market price (orderDurationMaxPercentageFromMarketPrice)
				// - duration calculation is based on: created_at

				if distance > orderDurationMaxPercentageFromMarketPrice {
					continue // skip duration points calculation for orders that are too far from the market price
				}

				orderAge := time.Since(pi.CreatedAt)
				durationPoints := 0
				for _, tier := range orderDurationTiers {
					if orderAge >= tier.Duration && tier.Weight > durationPoints {
						durationPoints = tier.Weight // override the previous value in the loop
					}
				}
				totalDurationPointsForUser += durationPoints
			}

			// add the UserLomSummary object for this market_id and account_id
			var lomSummaryForUserInMarket = UserLOMSummary{
				DollarValue: dollarValueBuyOrdersForUser + dollarValueSellOrdersForUser,
				LOMScore:    float64(distance2durationRatio) * (float64(totalDistancePointsForUser) + float64(totalDurationPointsForUser)),
			}
			var market_id = market.MarketID.String()
			var account_id = accountIdStr
			if _, ok := lom_scores[account_id]; !ok { // if the account_id key doesn't exist in lom_scores, initialize it with an empty map
				lom_scores[account_id] = make(map[string]UserLOMSummary)
			}
			lom_scores[account_id][market_id] = lomSummaryForUserInMarket

			lib.Log(lib.LOG_INFO, "LOM for account ID %s in market ID %s: %f (buyOrders: $%f, sellOrders: $%f, distance points: %d, duration points: %d). Total amount USD in this market: %f", accountIdStr, market.MarketID.String(), lomSummaryForUserInMarket.LOMScore, dollarValueBuyOrdersForUser, dollarValueSellOrdersForUser, totalDistancePointsForUser, totalDurationPointsForUser, totalAmountInMarketUsd)
		}
	}

	// second pass - calculate the total LOM score and DollarValue for each user across all markets
	totalDollarValue := 0.0
	totalLOMScore := 0.0
	totalDollarValueByAccount := make(map[string]float64)
	totalLOMScoreByAccount := make(map[string]float64)
	compoundedLOMByAccount := make(map[string]float64)
	for accountID, marketMap := range lom_scores {
		for _, summary := range marketMap {
			totalDollarValue += summary.DollarValue
			totalLOMScore += summary.LOMScore
			totalDollarValueByAccount[accountID] += summary.DollarValue
			totalLOMScoreByAccount[accountID] += summary.LOMScore
		}
		compoundedLOMByAccount[accountID] = dollarValue2lomScoreRatio*totalDollarValueByAccount[accountID] + totalLOMScoreByAccount[accountID]
	}
	// Now sum all compoundedLOMByAccount values for denominator
	totalLOMScoreCompounded := 0.0
	for _, v := range compoundedLOMByAccount {
		totalLOMScoreCompounded += v
	}

	// Final pass: print totals and send PRISM
	lib.Log(lib.LOG_INFO, "Total DollarValue across all users and markets: %.2f", totalDollarValue)
	lib.Log(lib.LOG_INFO, "Total LOMScore across all users and markets: %.2f", totalLOMScore)
	lib.Log(lib.LOG_INFO, "-> PRISM tokens to be allocated to %d accountIds in this epoch", len(lom_scores))
	for accountID := range lom_scores {
		dollarTotalByAccount := totalDollarValueByAccount[accountID]
		lomTotalByAccount := totalLOMScoreByAccount[accountID]
		lib.Log(lib.LOG_INFO, "Account %s: %% of DollarValueTotal=%.2f, %% of LOMScoreTotal=%.2f", accountID, dollarTotalByAccount/totalDollarValue*100, lomTotalByAccount/totalLOMScore*100)

		compoundedLOMForUser := compoundedLOMByAccount[accountID]
		prismToSendUser := 0.0
		if totalLOMScoreCompounded > 0 {
			prismToSendUser = prismToBeAllocatedThisRun * (compoundedLOMForUser / totalLOMScoreCompounded)
		}
		lib.Log(lib.LOG_INFO, "*** PRISM available to be allocated today: %f", PRISMperDay)
		lib.Log(lib.LOG_INFO, "*** PRISM available to be allocated this run: %f", prismToBeAllocatedThisRun)
		lib.Log(lib.LOG_INFO, "*** Transfer %f PRISM (%%%f.2 of the allocation) to user: %s (epoch: %s)", prismToSendUser, prismToSendUser/prismToBeAllocatedThisRun*100, accountID, cronRanAt.UTC().Format(time.RFC3339))

		// TODO - actually send the PRISM tokens:
		// sanity check the numbers (bounds) before sending, to avoid any bugs that could lead to huge unintended transfers

		// finally, log this PRISM token transfer action to database (prism_lom table):
		// TODO

	}

	return nil

}
