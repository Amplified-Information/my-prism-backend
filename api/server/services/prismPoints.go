package services

import (
	"api/server/lib"
	repositories "api/server/repositories"
)

type PrismPointsService struct {
	marketsRepository      *repositories.MarketsRepository
	positionsRepository    *repositories.PositionsRepository
	prismPointsRespository *repositories.PrismPointsRepository
}

func (pps *PrismPointsService) Init(mr *repositories.MarketsRepository, pr *repositories.PositionsRepository, ppr *repositories.PrismPointsRepository) error {
	// inject deps
	pps.marketsRepository = mr
	pps.positionsRepository = pr
	pps.prismPointsRespository = ppr

	lib.Log(lib.LOG_INFO, "Service: PrismPoints service initialized successfully")
	return nil
}

func (pps *PrismPointsService) AwardPrismPoints(marketId string) (bool, error) {
	err, positions := pps.positionsRepository.GetPositionsByMarketIdNoPointsAwardedMarketNotResolved(marketId)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to award Prism points for market ID %s: %v", marketId, err)
	}

	resolvedMarket, err := pps.marketsRepository.GetMarketById(marketId, true /* include suspended or paused markets*/)
	if err != nil {
		return false, lib.LogAndError(lib.LOG_ERROR, "failed to get market by ID %s: %v", marketId, err)
	}
	if !resolvedMarket.Outcome.Valid {
		return false, lib.LogAndError(lib.LOG_ERROR, "market ID %s is not resolved yet", marketId)
	}

	if resolvedMarket.Outcome.Int32 != 0 && resolvedMarket.Outcome.Int32 != 1 {
		return false, lib.LogAndError(lib.LOG_ERROR, "market ID %s has unsupported outcome=%d for points calculation", marketId, resolvedMarket.Outcome.Int32)
	}

	noYesOutcome := resolvedMarket.Outcome.Int32 == 1

	// loop through each item in the 'evm_address' column
	for _, position := range positions {
		// mark the database with the points awarded to the user for this market resolution:
		_, err := pps.markInDbPointsForUser(noYesOutcome, marketId, position.EvmAddress, position.NYes, position.NNo, position.CostBasisPriceYesUsd, position.CostBasisPriceNoUsd)
		if err != nil {
			lib.Log(lib.LOG_ERROR, "failed to award points to user %s for market ID %s: %v", position.EvmAddress, marketId, err)
			continue // continue awarding points to other users even if one fails
		}
	}

	lib.Log(lib.LOG_INFO, "successfully awarded Prism points for market ID %s", marketId)
	return true, nil
}

func (pps *PrismPointsService) markInDbPointsForUser(noYes_outcome bool, marketId string, evmAddress string, nYes int64, nNo int64, CostBasisPriceYesUsd float64, CostBasisPriceNoUsd float64) (float64, error) {
	// calculate points based on the user's position
	// See: https://docs.prism.market/protocol/prism-points-campaign
	points := 0.0
	if noYes_outcome { // true => YES wins
		points = (float64(nYes) * CostBasisPriceYesUsd) - (float64(nNo) * CostBasisPriceNoUsd)
	} else { // false => NO wins
		points = (float64(nNo) * CostBasisPriceNoUsd) - (float64(nYes) * CostBasisPriceYesUsd)
	}

	// update the user's points in the database
	err := pps.prismPointsRespository.UpsertPrismPointsAddPoints(marketId, evmAddress, points)
	if err != nil {
		return 0, lib.LogAndError(lib.LOG_ERROR, "failed to UpsertPrismPointsAddPoints for user %s: %v", evmAddress, err)
	}

	lib.Log(lib.LOG_INFO, "awarded %f points to user %s", points, evmAddress)
	return points, nil
}
