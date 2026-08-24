package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"math"
	"os"
	"strconv"
	"time"
)

var distance2durationRatio = 2.0     // weight distance points twice as much as duration points when calculating the total LOM score
var dollarValue2lomScoreRatio = 1.25 // larger dollar values in the orderbook give more PRISM than a lower dollar value LOM score
var executionMultiplier = 2.0        // if a txId was fully executed during the epoch, the LOM score is multiplied by this factor to reward execution. Partial execution -> pro-rata

var priceDistanceTiers = []lib.PriceDistanceTier{
	{Threshold: 0.20, Weight: 5.0},
	{Threshold: 0.10, Weight: 10.0},
	{Threshold: 0.05, Weight: 30.0},
	{Threshold: 0.02, Weight: 60.0},
	{Threshold: 0.01, Weight: 90.0},
}
var orderDuration_ignoreFurtherThan = 0.20 // only consider orders within 20% of the market price for duration points
var orderDurationTiers = []lib.OrderDurationTier{
	{Duration: 24 * time.Hour, Weight: 15.0},
	{Duration: 1 * time.Hour, Weight: 10.0},
	{Duration: 30 * time.Minute, Weight: 2.0},
	{Duration: 10 * time.Minute, Weight: 1.0},
}

type CronLOMService struct {
	priceRepository             *repositories.PriceRepository
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository
	prismLomRepository          *repositories.PrismLomRepository
	prismRewardsRepository      *repositories.PrismRewardsRepository

	hederaService            *HederaService
	predictionIntentsService *PredictionIntentsService
}

func (cs *CronLOMService) Init(mr *repositories.MarketsRepository, pir *repositories.PredictionIntentsRepository, hs *HederaService, pis *PredictionIntentsService, pr *repositories.PriceRepository, plr *repositories.PrismLomRepository, prr *repositories.PrismRewardsRepository) error {
	// inject deps
	cs.priceRepository = pr
	cs.marketsRepository = mr
	cs.predictionIntentsRepository = pir
	cs.prismLomRepository = plr
	cs.prismRewardsRepository = prr

	cs.hederaService = hs
	cs.predictionIntentsService = pis

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
	cronRanAt := time.Now() // need to store this on the prism_lom table to identify the epoch of orders we are calculating the LOM for
	lib.Log(lib.LOG_INFO, "%s: CalcLOM...", cronRanAt.UTC().Format(time.RFC3339))

	/////
	// pause for a random duration between 0-55 minutes to mitigate gaming the system by timing orders right before the cron job runs
	// NO - gamification mitigation is built-in
	/////
	// randomMinutes := rand.Intn(56) // random integer between 0 and 55 minutes
	// lib.Log(lib.LOG_INFO, "Pausing for a random duration [0-55] minutes to mitigate gaming: %d minute pause...", randomMinutes)
	// lib.Log(lib.LOG_INFO, "CronLOMService: Sleeping...")
	// time.Sleep(time.Duration(randomMinutes) * time.Minute)
	// lib.Log(lib.LOG_INFO, "CronLOMService: Awake")
	// lib.Log(lib.LOG_INFO, "CronLOMService: Resuming CalcLOM after a %d minute pause...", randomMinutes)

	if lib.LaunchDate.After(time.Now().AddDate(0, 0, int(lib.LOMrewardsVestingPeriodDays))) {
		return lib.ErrorLog("LOM initiative has finished. Date is too far in the future.")
	}
	if lib.LaunchDate.After(time.Now()) {
		return lib.ErrorLog("LOM initiative has not started yet. Date is too far in the past.")
	}

	var PRISMperDay = ((lib.LOMrewardsPercentOfTokensForLOMrewards / 100) * float64(lib.TotalNprismTokens)) / lib.LOMrewardsVestingPeriodDays

	// calc number of cron jobs per day based off of the CRON_STR_LOM string
	var cronJobsPerDay = math.MaxFloat64
	var cronStr = os.Getenv("CRON_STR_LOM")
	cronJobsPerDay, err := lib.CronJobsPerDay(cronStr)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to convert CRON_STR_LOM to # cron jobs per day %v", err)
		return err
	}

	var prismToBeAllocatedThisRun = PRISMperDay / cronJobsPerDay // since this cron runs every hour, we allocate 1/24th of the daily PRISM allocation each run

	// Map: marketID -> accountID -> { size points, lom score }
	type UserLOMSummary struct {
		SizePoints float64
		LOMScore   float64
	}
	lom_scores := make(map[string]map[string]UserLOMSummary)
	netByMarketID := make(map[string]string)

	markets, err := cs.marketsRepository.GetAllUnresolvedMarkets() // N.B. unresolved markets
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to fetch unresolved markets: %v", err)
		return err
	}
	lib.Log(lib.LOG_INFO, "Fetched %d unresolved markets", len(markets))

	/////
	// loop through all active markets:
	// See: https://docs.prism.market/protocol/liquidity-mining-limit-order-mining
	/////
	for _, market := range markets {
		if market.IsLomEnabled == false {
			lib.Log(lib.LOG_INFO, "Skipping market ID %s: LOM is disabled for this market", market.MarketID.String())
			continue
		}

		lib.Log(lib.LOG_INFO, "Calculating LOM for market ID %s", market.MarketID.String())
		netByMarketID[market.MarketID.String()] = market.Net

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

		// Calculate LOM for each accountId
		for _, accountIdStr := range accountIds {
			// userValueUsd := 0.0
			predictionIntentsForUserInMarket, err := cs.predictionIntentsRepository.GetAllOpenPredictionIntentsByMarketIdAndAccountId(market.MarketID, accountIdStr)
			if err != nil {
				lib.Log(lib.LOG_ERROR, "Failed to fetch prediction intents for account ID %s: %v", accountIdStr, err)
				continue
			}

			// 1. Distance
			totalDistancePointsForUser := 0.0
			// 2. Size
			totalSizePointsForUser := 0.0
			// 3. Duration
			totalDurationPointsForUser := 0.0

			for _, pi := range predictionIntentsForUserInMarket {
				// exclude secondary orders:
				if pi.PrimarySecondary == "s" {
					continue
				}

				/////
				// 1. *distance* from market price
				/////
				distance := math.Abs((pi.PriceUsd - currentMarketPrice) / currentMarketPrice)
				distancePoints := 0.0
				for _, tier := range priceDistanceTiers {
					if distance <= tier.Threshold && tier.Weight > distancePoints {
						distancePoints = tier.Weight // override the previous value in the loop
					}
				}
				totalDistancePointsForUser += distancePoints

				/////
				// 2. *size* of the order in USD
				/////
				orderSizeUsd := math.Abs(pi.PriceUsd * pi.QtyRem)
				orderSizePoints := calculateOrderSizePoints(orderSizeUsd, pi.QtyOrig, pi.QtyRem)
				totalSizePointsForUser += orderSizePoints
				lib.Log(lib.LOG_INFO, "totalSizePointsForUser = %f", totalSizePointsForUser)

				/////
				// 3. *duration* the order has been sitting in the order book
				/////
				// accounted for in GetAllOpenPredictionIntentsByMarketIdAndAccountId:
				// - exclude orders that have been matched (fully_matched_at)
				// - exclude orders that have been cancelled (cancelled_at)
				// - exclude orders that have been evicted (evicted_at)
				//
				// - exclude order that are far away from the market price (orderDuration_ignoreFurtherThan)
				// - duration calculation is based on: created_at

				if distance > orderDuration_ignoreFurtherThan {
					continue // skip duration points calculation for orders that are too far from the market price
				} else {
					orderAge := time.Since(pi.CreatedAt)
					durationPoints := 0.0
					for _, tier := range orderDurationTiers {
						if orderAge >= tier.Duration && tier.Weight > durationPoints {
							durationPoints = tier.Weight // override the previous value in the loop
						}
					}
					totalDurationPointsForUser += durationPoints
				}
			}

			// add the UserLomSummary object for this market_id and account_id
			lomScoreForUserInMarket := (distance2durationRatio * totalDistancePointsForUser) + totalDurationPointsForUser
			lomScoreForUserInMarket += dollarValue2lomScoreRatio * totalSizePointsForUser

			var lomSummaryForUserInMarket = UserLOMSummary{
				SizePoints: totalSizePointsForUser,
				LOMScore:   lomScoreForUserInMarket,
			}
			var market_id = market.MarketID.String()
			if _, ok := lom_scores[accountIdStr]; !ok { // if the account_id key doesn't exist in lom_scores, initialize it with an empty map
				lom_scores[accountIdStr] = make(map[string]UserLOMSummary)
			}
			lom_scores[accountIdStr][market_id] = lomSummaryForUserInMarket

			lib.Log(lib.LOG_INFO, "LOM for account ID %s in market ID %s: %f (orders: $%f, distance points: %f, duration points: %f). size: %f", accountIdStr, market.MarketID.String(), lomSummaryForUserInMarket.LOMScore, totalSizePointsForUser, totalDistancePointsForUser, totalDurationPointsForUser, totalAmountInMarketUsd)

			// Now log the LOM score for this account/marketId in the database (prism_lom table):
			err = cs.prismLomRepository.CreateLOMentryForUserOnMarket(
				market.MarketID,
				accountIdStr,
				totalDistancePointsForUser,
				totalDurationPointsForUser,
				totalSizePointsForUser,
				lomScoreForUserInMarket,
			)
			if err != nil {
				lib.LogAndError(lib.LOG_ERROR, "Failed to create LOM entry in database for account ID %s in market ID %s: %v", accountIdStr, market.MarketID.String(), err)
			}
		}
	}

	//
	// second pass - calculate the total LOM score and DollarValue for each user across all markets
	// “Across all markets, how much did each account contribute, and what percentage of this run’s PRISM budget should they receive?”
	//
	totalDollarValueByAccount := make(map[string]float64)
	totalLOMScoreByAccount := make(map[string]float64)
	compoundedLOMByAccount := make(map[string]float64)

	totalSize := 0.0
	totalLOMScore := 0.0
	for accountID, marketMap := range lom_scores {
		for _, summary := range marketMap {
			totalSize += summary.SizePoints
			totalLOMScore += summary.LOMScore
			totalDollarValueByAccount[accountID] += summary.SizePoints
			totalLOMScoreByAccount[accountID] += summary.LOMScore
		}
		compounded := dollarValue2lomScoreRatio*totalDollarValueByAccount[accountID] + totalLOMScoreByAccount[accountID]
		compoundedLOMByAccount[accountID] = compounded

	}
	// Now sum all compoundedLOMByAccount values for denominator
	totalLOMScoreCompounded := 0.0
	for _, v := range compoundedLOMByAccount {
		totalLOMScoreCompounded += v
	}

	//
	// Final pass: print totals and send (schedule for send) PRISM
	//
	lib.Log(lib.LOG_INFO, "Total size across all accountIds and markets: %.2f", totalSize)
	lib.Log(lib.LOG_INFO, "Total LOMScore across all accountIds and markets: %.2f", totalLOMScore)
	lib.Log(lib.LOG_INFO, "-> PRISM tokens to be allocated to %d accountIds in this epoch", len(lom_scores))
	for accountID := range lom_scores {
		net := ""
		for marketID := range lom_scores[accountID] {
			marketNet := netByMarketID[marketID]
			if net == "" {
				net = marketNet
			} else if net != marketNet {
				lib.Log(lib.LOG_ERROR, "Skipping PRISM reward for account ID %s: LOM spans multiple networks (%s, %s)", accountID, net, marketNet)
				net = ""
				break
			}
		}
		if net == "" {
			continue
		}

		dollarTotalByAccount := totalDollarValueByAccount[accountID]
		lomTotalByAccount := totalLOMScoreByAccount[accountID]
		lib.Log(lib.LOG_INFO, "Account %s: %% of SizeTotal=%.2f, %% of LOMScoreTotal=%.2f", accountID, dollarTotalByAccount/totalSize*100, lomTotalByAccount/totalLOMScore*100)

		compoundedLOMForUser := compoundedLOMByAccount[accountID]
		prismToSendUser := 0.0
		if totalLOMScoreCompounded > 0 {
			prismToSendUser = prismToBeAllocatedThisRun * (compoundedLOMForUser / totalLOMScoreCompounded)
		}

		// sanity check the numbers (bounds) before sending, to avoid any bugs that could lead to huge unintended transfers
		if !sanityCheckPrismAllocation(accountID, prismToSendUser, prismToBeAllocatedThisRun) {
			continue
		}

		lib.Log(lib.LOG_INFO, "*** PRISM available to be allocated today: %f", PRISMperDay)
		lib.Log(lib.LOG_INFO, "*** PRISM available to be allocated this run: %f", prismToBeAllocatedThisRun)
		lib.Log(lib.LOG_INFO, "*** Transfer %f PRISM (%%%f.2 of the allocation) to accountId: %s (epoch: %s)", prismToSendUser, prismToSendUser/prismToBeAllocatedThisRun*100, accountID, cronRanAt.UTC().Format(time.RFC3339))

		/////
		// Record the PRISM allocation in the database (prism_rewards table) for this accountId, but do not send it yet. The user will have to redeem it via the web UI.
		/////
		tokenDecimalsStr := os.Getenv("TOKEN_DECIMALS")
		TOKEN_DECIMALS, err := strconv.Atoi(tokenDecimalsStr)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to parse TOKEN_DECIMALS from env: %v.", err)
			return err
		}

		CreatePrismRewardErr := cs.prismRewardsRepository.CreatePrismReward(
			net,
			accountID,
			int64(prismToSendUser*math.Pow10(TOKEN_DECIMALS)),
			compoundedLOMForUser/totalLOMScoreCompounded,
			cronRanAt,
		)
		if CreatePrismRewardErr != nil {
			lib.Log(lib.LOG_ERROR, "Failed to create PRISM reward in the db for account ID %s: %v", accountID, CreatePrismRewardErr)
			continue
		}
		lib.Log(lib.LOG_INFO, "Successfully marked PRISM reward in the db for account ID %s", accountID)

	}

	return nil

}

func calculateOrderSizePoints(orderSizeUsd, qtyOrig, qtyRem float64) float64 {
	baseSizePoints := orderSizeUsd
	if qtyOrig <= 0 {
		return baseSizePoints
	}

	ratioMatched := 1 - (qtyRem / qtyOrig)
	if ratioMatched < 0 {
		ratioMatched = 0
	}
	if ratioMatched > 1 {
		ratioMatched = 1
	}

	executionBonus := orderSizeUsd * (executionMultiplier - 1) * ratioMatched
	return baseSizePoints + executionBonus
}

func sanityCheckPrismAllocation(accountID string, prismToSendUser, prismToBeAllocatedThisRun float64) bool {
	if prismToSendUser < 0 || prismToSendUser > prismToBeAllocatedThisRun {
		lib.Log(lib.LOG_ERROR, "ERROR: Sanity check failed for account ID %s: prismToSendUser=%f, prismToBeAllocatedThisRun=%f", accountID, prismToSendUser, prismToBeAllocatedThisRun)
		return false
	}
	return true
}
