package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
	"math"
	"os"
	"strconv"
	"time"
)

/////
// campaign_id = 2
/////

const RewardsCampaignAllocationAbsolute = 1_000_000 // 1 million PRISM tokens allocated for Rewards Campaign over a 1 year vesting period

var RewardsCampaignVestingSchedule = []struct {
	Year int
	N    int
}{
	{Year: 1, N: 1_000_000},
	// sum: 1_000_000
}

// TODO

// NFT multipliers

// var nftBonusTiers =
// emerald 1.05
// ruby 1.40
// diamond 2.10

// prism points configuration:
// var Seasons = [][2]int64{
// 	{1764374400, 1772419199}, // season 0: 1st Apr 2026 00:00:00 to 30th Jun 2026 23:59:59
// 	{1772419200, 1780377599}, // season 1: 1st Jul 2026 00:00:00 to 30th Sep 2026 23:59:59
// 	{1780377600, 1788326399}, // season 2: 1st Oct 2026 00:00:00 to 31st Dec 2026 23:59:59
// 	{1788326400, 1796207999}, // season 3: 1st Jan 2027 00:00:00 to 31st Mar 2027 23:59:59
// 	{1796208000, 1804089599}, // season 4: 1st Apr 2027 00:00:00 to 30th Jun 2027 23:59:59
// }

type CronRewardsCampaignService struct {
	hederaService            *HederaService
	predictionIntentsService *PredictionIntentsService
	prismRewardsRepository   *repositories.PrismRewardsRepository
}

func (crcs *CronRewardsCampaignService) Init(hs *HederaService, pis *PredictionIntentsService, prp *repositories.PrismRewardsRepository) error {
	// inject deps
	crcs.hederaService = hs
	crcs.predictionIntentsService = pis

	crcs.prismRewardsRepository = prp

	lib.Log(lib.LOG_INFO, "Service: CronRewardsCampaign service initialized successfully")
	return nil
}

func (crcs *CronRewardsCampaignService) CronJob() {
	lib.Log(lib.LOG_INFO, "CronRewardsCampaignService: Running CronJob...")

	crcs.Calc()

	lib.Log(lib.LOG_INFO, "CronRewardsCampaignService: CronJob completed.")
}

// See: https://docs.prism.market/protocol/prism-points-campaign
func (crcs *CronRewardsCampaignService) Calc() error {
	cronRanAt := time.Now() // need to store this on the prism_lom table to identify the epoch of orders we are calculating the LOM for
	lib.Log(lib.LOG_INFO, "%s: CronRewardsCampaignService: Calculating rewards...", cronRanAt.UTC().Format(time.RFC3339))

	// - convert the cron string to a time interval INTERVAL (e.g. seconds since the last run)
	// - calculate the number of PRISM tokens that will be awarded during this epoch (PRISM_FOR_THIS_EPOCH)
	// - get all markets that were resolved in the last INTERVAL seconds
	// - foreach market, get all predictionIntents for each user
	// - sum all YES and NO positions for each user and calculate their total position tokens (YES and NO)
	// - the the user's NFT status at the current time
	// - allocate the proportion (with due regard to number of NFTs a user has) of PRISM_FOR_THIS_EPOCH to each user based on their total position tokens relative to the total position tokens for all users in that market

	// make sure we're within the campaign's vesting period:
	now := time.Now()
	if now.After(lib.LaunchDate.AddDate(len(RewardsCampaignVestingSchedule), 0, 0)) {
		return lib.ErrorLog("Rewards campaign has finished. Date is too far in the future.")
	}
	if lib.LaunchDate.After(now) {
		return lib.ErrorLog("Rewards campaign has not started yet. Date is too far in the past.")
	}

	// calc number of PRISM tokens to be awarded during this epoch:
	var cronJobsPerDay = math.MaxFloat64 // every 24 hours => cronJobsPerDay = 24
	var cronStr = os.Getenv("CRON_STR_REWARDS_CAMPAIGN")
	cronJobsPerDay, err := lib.CronJobsPerDay(cronStr)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to convert CRON_STR_REWARDS_CAMPAIGN to # cron jobs per day %v", err)
		return err
	}

	allocationPerDay := rewardsCampaignPerDayAtTime(now)
	nPRISMthisEpoch := allocationPerDay / cronJobsPerDay

	// now divide up the nPRISMthisEpoch amount all users on markets that resolved during the last epoch
	// only include position tokens (i.e. matched), not open orders
	// get all markets that resolved in the last epoch:
	//   foreach market, get all position tokens for each user
	//     sum up all position tokens for each user
	//   sum up all position tokens for all users
	//
	// foreach user, calculate their proportion of the total position tokens for all users

	// TODO

	// Now log an entry on prism_rewards table - so that the PRISM reward can be claimed.
	// Calc() does not send PRISM, it only calculates the PRISM reward and logs it in the db.
	tokenDecimalsStr := os.Getenv("TOKEN_DECIMALS")
	TOKEN_DECIMALS, err := strconv.Atoi(tokenDecimalsStr)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to parse TOKEN_DECIMALS from env: %v.", err)
		return err
	}

	// now, for each user, create a prism_rewards entry in the db:
	// get all markets that resolved in the last epoch
	// , and for each market, get all users that had position tokens in that market
	// , and for each user, calculate their proportion of the total position tokens for all users in that market
	// , and then create a prism_rewards entry in the db for each user with their calculated PRISM reward.
	resolvedMarketsInEpoch, err := crcs.hederaService.marketsRepository.GetResolvedMarketsAfter(cronRanAt.Add(-time.Duration(24/cronJobsPerDay)*time.Hour)) // get all markets that resolved in the last epoch
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to get resolved markets after %v: %v", cronRanAt.Add(-time.Duration(24/cronJobsPerDay)*time.Hour), err)
		return err
	}
	
	for _, market := range resolvedMarketsInEpoch {
		// get all users that had position tokens in that market
		allUserPositions, err := crcs.hederaService.positionsRepository.GetPositionsByMarketId(market.MarketID.String())
		if err != nil {
			lib.Log(lib.LOG_ERROR, "Failed to get all user positions for market ID %s: %v", market.MarketID.String(), err)
			continue
		}

		var nYesTotalInMarket uint64 = 0
		var nNoTotalInMarket uint64 = 0
		// per-user map (nYes and nNo) to calculate their proportion of the total position tokens for all users in that market
		var userPositionsMap = make(map[string]struct {
			nYes uint64
			nNo  uint64
		})
		for _, position := range allUserPositions {
			// global nYes/nNo:
			nYesTotalInMarket += uint64(position.NYes)
			nNoTotalInMarket += uint64(position.NNo)

			// per-user nYes/nNo:
			userPositionsMap[position.EvmAddress] = struct {
				nYes uint64
				nNo  uint64
			}{
				nYes: uint64(position.NYes),
				nNo:  uint64(position.NNo),
			}
		}

		// now, mark PRISM rewards for each user in the db (will be scheduled)
		for accountID, userPositions := range userPositionsMap {
			userTotalPositionTokens := userPositions.nYes + userPositions.nNo
			if userTotalPositionTokens == 0 {
				lib.Log(lib.LOG_WARN, "User %s has no position tokens in market %s, skipping PRISM reward calculation.", accountID, market.MarketID.String())
				continue
			}

			// calculate the proportion of the total position tokens for all users in that market
			userProportion := float64(userTotalPositionTokens) / float64(nYesTotalInMarket+nNoTotalInMarket)
			prismToSendUser := nPRISMthisEpoch * userProportion

			// create a prism_rewards entry in the db for this user
			CreatePrismRewardErr := crcs.prismRewardsRepository.CreatePrismReward( // schedule PRISM send/redeem
				market.Net,
				accountID,
				int64(prismToSendUser*math.Pow10(TOKEN_DECIMALS)),
				prismToSendUser/nPRISMthisEpoch,
				cronRanAt,
				2, // campaign_id = 2 for Rewards Campaign
			)
			if CreatePrismRewardErr != nil {
				lib.Log(lib.LOG_ERROR, "Failed to create PRISM reward in the db for account ID %s: %v", accountID, CreatePrismRewardErr)
				continue
			}
			lib.Log(lib.LOG_INFO, "Successfully marked PRISM reward in the db for account ID %s", accountID)
		}
	}

	return nil
}

func rewardsCampaignVestingScheduleTotal() int {
	total := 0
	for _, entry := range RewardsCampaignVestingSchedule {
		total += entry.N
	}
	return total
}

func rewardsCampaignForYearAtTime(at time.Time) float64 {
	if at.Before(lib.LaunchDate) {
		return 0
	}

	yearIndex := at.Year() - lib.LaunchDate.Year()
	if at.Before(lib.LaunchDate.AddDate(yearIndex, 0, 0)) {
		yearIndex--
	}
	if yearIndex < 0 {
		return 0
	}
	if yearIndex >= len(RewardsCampaignVestingSchedule) {
		return 0
	}
	return float64(RewardsCampaignVestingSchedule[yearIndex].N)
}

func rewardsCampaignPerDayAtTime(at time.Time) float64 {
	allocationForCurrentYear := rewardsCampaignForYearAtTime(at)
	if allocationForCurrentYear <= 0 {
		return 0
	}
	return allocationForCurrentYear / float64(len(RewardsCampaignVestingSchedule)*365)
}
