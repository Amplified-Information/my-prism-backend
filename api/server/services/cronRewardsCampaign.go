package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
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
	lib.Log(lib.LOG_INFO, "CronRewardsCampaignService: Calculating rewards for the current season... [TODO]")
	// - convert the cron string to a time interval INTERVAL (e.g. seconds since the last run)
	// - calculate the number of PRISM tokens that will be awarded during this epoch (PRISM_FOR_THIS_EPOCH)
	// - get all markets that were resolved in the last INTERVAL seconds
	// - foreach market, get all predictionIntents for each user
	// - sum all YES and NO positions for each user and calculate their total position tokens (YES and NO)
	// - allocate the propportion of PRISM_FOR_THIS_EPOCH to each user based on their total position tokens relative to the total position tokens for all users in that market
	//

	// CreatePrismRewardErr := crcs.prismRewardsRepository.CreatePrismReward( // schedule PRISM send/redeem
	// 	net,
	// 	accountID,
	// 	int64(prismToSendUser*math.Pow10(TOKEN_DECIMALS)),
	// 	compoundedLOMForUser/totalLOMScoreCompounded,
	// 	cronRanAt,
	// 	2, // campaign_id = 2 for Rewards Campaign
	// )
	// if CreatePrismRewardErr != nil {
	// 	lib.Log(lib.LOG_ERROR, "Failed to create PRISM reward in the db for account ID %s: %v", accountID, CreatePrismRewardErr)
	// 	continue
	// }
	// lib.Log(lib.LOG_INFO, "Successfully marked PRISM reward in the db for account ID %s", accountID)

	return nil
}
