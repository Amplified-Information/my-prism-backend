package services

import (
	pb_api "api/gen"
	"api/server/lib"
	repositories "api/server/repositories"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type PrismRewardsService struct {
	marketsRepository      *repositories.MarketsRepository
	positionsRepository    *repositories.PositionsRepository
	prismRewardsRepository *repositories.PrismRewardsRepository

	prismLOMservice *PrismLOMservice
}

func (prs *PrismRewardsService) Init(mr *repositories.MarketsRepository, pr *repositories.PositionsRepository, ppr *repositories.PrismRewardsRepository, plom *PrismLOMservice) error {
	// inject deps
	prs.marketsRepository = mr
	prs.positionsRepository = pr
	prs.prismRewardsRepository = ppr
	prs.prismLOMservice = plom

	lib.Log(lib.LOG_INFO, "Service: PrismRewards service initialized successfully")
	return nil
}

func (prs *PrismRewardsService) GetPrismPointsRewardsByAccountId(accountId *hiero.AccountID) ([]*pb_api.Pointsreward, error) {
	pointsRewards := []*pb_api.Pointsreward{}

	// TODO: Implement logic to fetch PRISM points rewards by account ID

	return pointsRewards, nil
}

func (prs *PrismRewardsService) GetPrismPointsRewardsByMarketId(marketId string) ([]*pb_api.Pointsreward, error) {
	pointsRewards := []*pb_api.Pointsreward{}

	// TODO: Implement logic to fetch PRISM points rewards by market ID

	return pointsRewards, nil
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

func (prs *PrismRewardsService) ClaimPrism(destAccountIdStr string, net string, sig string, publicKey string, keyType uint32) (*pb_api.StdResponse, error) {
	if prs.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	// TODO: implement auth and signature verification

	// 1. get the destAccountIdStr's pending PRISM
	totalUnredeemedPrismScaled, err := prs.prismRewardsRepository.GetTotalUnredeemedPrismRewardsByUser(net, destAccountIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get total unredeemed prism rewards for user %s: %v", destAccountIdStr, err)
	}

	// 2. if pending > 0, proceed
	if totalUnredeemedPrismScaled <= 0 {
		return &pb_api.StdResponse{
			ErrorCode: 1,
			Message:   "No unredeemed PRISM rewards available",
		}, nil
	}
	if totalUnredeemedPrismScaled > uint64(^uint64(0)>>1) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "unredeemed PRISM rewards exceed the transferable amount limit for user %s", destAccountIdStr)
	}

	// 3. send the PRISM to the user's wallet address on the specified network
	prismTokenIdStr := os.Getenv(fmt.Sprintf("%s_TOKEN", strings.ToUpper(net)))
	if prismTokenIdStr == "" {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get PRISM token ID for network %s", net)
	}
	prismTokenId, err := hiero.TokenIDFromString(prismTokenIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to parse PRISM token ID for network %s: %v", net, err)
	}

	srcAccountIdStr := os.Getenv(fmt.Sprintf("%s_PRISM_TOKEN_HOT_PAYER", strings.ToUpper(net)))
	if srcAccountIdStr == "" {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get source account ID %s_PRISM_TOKEN_HOT_PAYER", strings.ToUpper(net))
	}
	srcAccountId, err := hiero.AccountIDFromString(srcAccountIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to parse source account ID for network %s: %v", net, err)
	}

	destAccountId, err := hiero.AccountIDFromString(destAccountIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to parse destination account ID for network %s: %v", net, err)
	}

	hotPayerPrivateKeyStr := os.Getenv(fmt.Sprintf("%s_PRISM_TOKEN_HOT_PAYER_KEY", strings.ToUpper(net)))
	if hotPayerPrivateKeyStr == "" {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get hot payer private key for network %s", net)
	}
	hotPayerPrivateKey, err := hiero.PrivateKeyFromString(hotPayerPrivateKeyStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to parse hot payer private key for network %s: %v", net, err)
	}

	client, err := hiero.ClientForName(strings.ToLower(net))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to create Hedera client for network %s: %v", net, err)
	}
	client.SetOperator(srcAccountId, hotPayerPrivateKey)

	result, err := hiero.NewTransferTransaction().
		AddTokenTransfer(prismTokenId, srcAccountId, -int64(totalUnredeemedPrismScaled)).
		AddTokenTransfer(prismTokenId, destAccountId, int64(totalUnredeemedPrismScaled)).
		Execute(client)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to transfer PRISM tokens: %v", err)
	}

	// Get the receipt to ensure the transaction was successful
	receipt, err := result.GetReceipt(client)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get receipt for PRISM token transfer: %v", err)
	}

	// 4. And update the database to mark the PRISM as claimed
	err = prs.prismRewardsRepository.MarkAllPrismClaimed(net, &destAccountId, client.GetOperatorAccountID(), receipt.TransactionID.String())
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to mark PRISM as claimed for account %s: %v", destAccountId.String(), err)
	}

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   "Successfully claimed all PRISM tokens",
	}, nil
}

// func (prs *PrismRewardsService) SendEntitledPrism(req *pb_api.AccountIdRequest) (*pb_api.StdResponse, error) {
// 	if prs.prismRewardsRepository == nil {
// 		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
// 	}

// 	// no auth - TODO: implement auth and signature verification

// 	// 1. validate the accountId and net

// 	// 2. check if the user is entitled to receive PRISM (e.g., based on some criteria)

// 	// 3. if entitled, send the specified amount of PRISM to the user's wallet address on the specified network

// 	// 4. update the database to record the transaction

// 	return &pb_api.StdResponse{
// 		ErrorCode: 0,
// 		Message:   "Unimplemented: SendEntitledPrism functionality is not yet implemented",
// 	}, nil
// }

func (prs *PrismRewardsService) GetRewardsByAccountId(accountIdStr string) (*pb_api.RewardsResponse, error) {
	if prs.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	accountId, err := hiero.AccountIDFromString(accountIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid account ID %s: %v", accountIdStr, err)
	}

	lomRewards, err := prs.prismLOMservice.GetLOMrewardsByAccountId(&accountId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get rewards by account ID %s: %v", accountId, err)
	}

	pointsRewards, err := prs.GetPrismPointsRewardsByAccountId(&accountId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get points rewards by account ID %s: %v", accountId, err)
	}

	return &pb_api.RewardsResponse{
		LomRewards:    lomRewards,
		PointsRewards: pointsRewards, // TODO - Replace with actual PRISM rewards when available
	}, nil
}

func (prs *PrismRewardsService) GetRewardsByMarketId(marketIdStr string) (*pb_api.RewardsResponse, error) {
	if prs.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	// ensure marketIdStr is a valid UUID
	_, err := uuid.Parse(marketIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid UUID format for market ID %s: %v", marketIdStr, err)
	}

	lomRewards, err := prs.prismLOMservice.GetLOMrewardsByMarketId(marketIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get rewards by market ID %s: %v", marketIdStr, err)
	}

	pointsRewards, err := prs.GetPrismPointsRewardsByMarketId(marketIdStr)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get points rewards by market ID %s: %v", marketIdStr, err)
	}

	return &pb_api.RewardsResponse{
		LomRewards:    lomRewards,
		PointsRewards: pointsRewards,
	}, nil
}
