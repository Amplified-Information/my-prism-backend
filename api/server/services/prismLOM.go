package services

import (
	pb_api "api/gen"
	"api/server/lib"
	repositories "api/server/repositories"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type PrismLOMservice struct {
	prismLOMrepository     *repositories.PrismLomRepository
	prismRewardsRepository *repositories.PrismRewardsRepository
}

func (pls *PrismLOMservice) Init(prismLOMrepository *repositories.PrismLomRepository, prismRewardsRepository *repositories.PrismRewardsRepository) error {
	// inject deps
	pls.prismLOMrepository = prismLOMrepository
	pls.prismRewardsRepository = prismRewardsRepository

	lib.Log(lib.LOG_INFO, "Service: PrismLOM service initialized successfully")
	return nil
}

func (pls *PrismLOMservice) GetLOMrewardsByMarketId(marketId string) ([]*pb_api.LOMreward, error) {
	if pls.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	result, err := pls.prismLOMrepository.GetLOMrewardsByMarketId(marketId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get LOM rewards by market ID %s: %v", marketId, err)
	}

	// map the result to the protobuf response:
	response := []*pb_api.LOMreward{}
	for _, lom := range result {
		response = append(response, &pb_api.LOMreward{
			MarketId:  lom.MarketID.String(),
			AccountId: lom.AccountID,
			Distance:  float32(lom.Distance),
			Size:      float32(lom.DollarValue),
			Duration:  float32(lom.Duration),
			LomScore:  float32(lom.LomScore),
			CreatedAt: lom.CreatedAt.Format("2006-01-02 15:04:05"), // format the timestamp as a string
		})
	}

	return response, nil
}

func (pls *PrismLOMservice) GetLOMrewardsByAccountId(accountId *hiero.AccountID) ([]*pb_api.LOMreward, error) {
	if pls.prismRewardsRepository == nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "prismRewardsRepository is not initialized")
	}

	result, err := pls.prismLOMrepository.GetLOMrewardsByAccountId(accountId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get LOM rewards by account ID %s: %v", accountId, err)
	}

	// map the result to the protobuf response:
	response := []*pb_api.LOMreward{}
	for _, lom := range result {
		response = append(response, &pb_api.LOMreward{
			MarketId:  lom.MarketID.String(),
			AccountId: lom.AccountID,
			Distance:  float32(lom.Distance),
			Size:      float32(lom.DollarValue),
			Duration:  float32(lom.Duration),
			LomScore:  float32(lom.LomScore),
			CreatedAt: lom.CreatedAt.Format("2006-01-02 15:04:05"), // format the timestamp as a string
		})
	}

	return response, nil
}
