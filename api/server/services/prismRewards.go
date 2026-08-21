package services

import (
	pb_api "api/gen"
	"api/server/lib"
	repositories "api/server/repositories"
	"fmt"
	"os"
	"strings"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type PrismRewardsService struct {
	marketsRepository      *repositories.MarketsRepository
	positionsRepository    *repositories.PositionsRepository
	prismRewardsRepository *repositories.PrismRewardsRepository
}

func (prs *PrismRewardsService) Init(mr *repositories.MarketsRepository, pr *repositories.PositionsRepository, ppr *repositories.PrismRewardsRepository) error {
	// inject deps
	prs.marketsRepository = mr
	prs.positionsRepository = pr
	prs.prismRewardsRepository = ppr

	lib.Log(lib.LOG_INFO, "Service: PrismRewards service initialized successfully")
	return nil
}

func (prs *PrismRewardsService) GetPrism(accountId string, net string) (*pb_api.PrismResponse, error) {
	if prs.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	// rewards, err := prs.prismRewardsRepository.GetPrismByUser(accountId)
	// if err != nil {
	// 	return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prism rewards for user %s: %v", accountId, err)
	// }

	// totalPoints := 0.0
	// for _, reward := range rewards {
	// 	totalPoints += float64(reward.NPrismScaled) / 1e6 // convert scaled points to actual points
	// }

	prismTokenAddress := os.Getenv(fmt.Sprintf("%s_TOKEN", strings.ToUpper(net))) // get the PRISM token address from environment variable

	// Convert string parameters to Hedera types
	ledgerID, err := hiero.LedgerIDFromString(strings.ToLower(net))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid network: %s: %v", net, err)
	}
	tokenID, err := hiero.TokenIDFromString(prismTokenAddress)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid token address: %s: %v", prismTokenAddress, err)
	}
	accountIDParsed, err := hiero.AccountIDFromString(accountId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid account ID: %s: %v", accountId, err)
	}

	prismBalanceScaled, err := lib.GetTokenBalance(*ledgerID, tokenID, accountIDParsed)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get token balance for user %s: %v", accountId, err)
	}

	totalUnredeemedPrismScaled, err := prs.prismRewardsRepository.GetTotalUnredeemedPrismRewardsByUser(net, accountId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get total unredeemed prism rewards for user %s: %v", accountId, err)
	}

	totalRedeemablePrismScaled, err := prs.prismRewardsRepository.GetTotalRedeemablePrismRewardsByUser(net, accountId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get total redeemable prism rewards for user %s: %v", accountId, err)
	}

	response := &pb_api.PrismResponse{
		PrismBalance:    prismBalanceScaled,
		PrismUnredeemed: totalUnredeemedPrismScaled,
		PrismRedeemable: totalRedeemablePrismScaled,
	}

	return response, nil
}

func (prs *PrismRewardsService) ClaimPrism(accountId string, net string, sig string, publicKey string, keyType uint32) (*pb_api.StdResponse, error) {
	if prs.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	// no auth - TODO: implement auth and signature verification

	// 1. get the user's pending PRISM

	// 2. if pending > 0, proceed

	// 3. send the PRISM to the user's wallet address on the specified network

	// 4. update the database to mark the PRISM as claimed

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   "Unimplemented: ClaimPrism functionality is not yet implemented",
	}, nil
}

func (prs *PrismRewardsService) SendEntitledPrism(req *pb_api.AccountIdRequest) (*pb_api.StdResponse, error) {
	if prs.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	// no auth - TODO: implement auth and signature verification

	// 1. validate the accountId and net

	// 2. check if the user is entitled to receive PRISM (e.g., based on some criteria)

	// 3. if entitled, send the specified amount of PRISM to the user's wallet address on the specified network

	// 4. update the database to record the transaction

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   "Unimplemented: SendEntitledPrism functionality is not yet implemented",
	}, nil
}
