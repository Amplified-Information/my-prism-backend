package services

import (
	pb_api "api/gen"
	sqlc "api/gen/sqlc"
	"api/server/lib"
	repositories "api/server/repositories"
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	hiero "github.com/hiero-ledger/hiero-sdk-go/v2/sdk"
)

type PositionsService struct {
	positionsRepository         *repositories.PositionsRepository
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository
	prismPointsRepository       *repositories.PrismPointsRepository

	hederaService *HederaService
	priceService  *PriceService
}

func (ps *PositionsService) Init(positionsRepository *repositories.PositionsRepository, marketsRepository *repositories.MarketsRepository, predictionIntentsRepository *repositories.PredictionIntentsRepository, prismPointsRepository *repositories.PrismPointsRepository, hederaService *HederaService, priceService *PriceService) error {
	// and inject the deps:
	ps.positionsRepository = positionsRepository
	ps.marketsRepository = marketsRepository
	ps.predictionIntentsRepository = predictionIntentsRepository
	ps.prismPointsRepository = prismPointsRepository

	ps.hederaService = hederaService
	ps.priceService = priceService

	lib.Log(lib.LOG_INFO, "Service: Positions service initialized successfully")
	return nil
}

func (ps *PositionsService) GetUserPortfolio(req *pb_api.UserPortfolioRequest) (*pb_api.UserPortfolioResponse, error) {
	// guards

	// OK
	var userPositions []sqlc.GetUserPositionsRow
	var err error

	if req.MarketId == nil { // optional parameter
		userPositions, err = ps.positionsRepository.GetUserPositions(req.EvmAddress)
	} else {
		userPositions, err = ps.positionsRepository.GetUserPositionsByMarketId(req.EvmAddress, *req.MarketId)
	}
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get user portfolio: %v", err)
	}

	response := &pb_api.UserPortfolioResponse{
		Positions:             make(map[string]*pb_api.PositionInfo),
		OpenPredictionIntents: make(map[string]*pb_api.PredictionIntents),
		PrismPoints:           []*pb_api.PrismPoints{},
		PrismTokenBalance:     uint64(0),
	}

	for _, userPosition := range userPositions {
		priceUsd, err := ps.priceService.GetLatestPriceByMarket(userPosition.MarketID.String())
		if err != nil {
			lib.Log(lib.LOG_WARN, "skipping market %s: failed to get latest price: %v", userPosition.MarketID.String(), err)
			continue // skip to next userPosition
		}

		market, err := ps.marketsRepository.GetMarketById(userPosition.MarketID.String(), false /* don't include suspended or paused markets*/)
		if err != nil {
			lib.Log(lib.LOG_WARN, "skipping market %s: failed to get market: %v", userPosition.MarketID.String(), err)
			continue // skip to next userPosition
		}

		position := &pb_api.Position{
			MarketId:   userPosition.MarketID.String(),
			EvmAddress: userPosition.EvmAddress,
			Yes:        uint64(userPosition.NYes),
			No:         uint64(userPosition.NNo),
			UpdatedAt:  userPosition.UpdatedAt.Format(time.RFC3339),
			CreatedAt:  userPosition.CreatedAt.Format(time.RFC3339),
		}

		elem := &pb_api.PositionInfo{
			Position:   position,
			PriceUsd:   priceUsd,
			IsPaused:   market.IsPaused,
			ResolvedAt: market.ResolvedAt.Time.String(),
		}

		response.Positions[userPosition.MarketID.String()] = elem
	}

	// now construct the open orderbookPositions by retrieving all open orders from prediction_intents:
	// response.OrderbookPositions = make(map[string]*pb_api.Position) // REMOVE this line, already initialized above as map[string][]*pb_api.Position
	predictionIntents, err := ps.predictionIntentsRepository.GetAllOpenPredictionIntentsByEvmAddress(req.EvmAddress)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get open prediction intents for account with evm address %s: %v", req.EvmAddress, err)
	}
	// loop through each predictionIntents and add to OrderbookPositions
	for _, pi := range predictionIntents {
		orderbookPosition := &pb_api.PredictionIntent{
			TxId:        pi.TxID.String(),
			Net:         pi.Net,
			MarketId:    pi.MarketID.String(),
			GeneratedAt: pi.GeneratedAt.String(),
			AccountId:   pi.AccountID,
			MarketLimit: pi.MarketLimit,
			PriceUsd:    pi.PriceUsd,
			Qty:         pi.Qty,
		}
		if _, ok := response.OpenPredictionIntents[pi.MarketID.String()]; !ok {
			response.OpenPredictionIntents[pi.MarketID.String()] = &pb_api.PredictionIntents{}
		}
		response.OpenPredictionIntents[pi.MarketID.String()].PredictionIntents = append(response.OpenPredictionIntents[pi.MarketID.String()].PredictionIntents, orderbookPosition)
	}

	// retrieve this user's prism balance:
	// Perhaps this should be done from the front-end?
	// validate that the network sent is valid
	netSelectedByUser := strings.ToLower(req.Net)
	if !lib.IsValidNetwork(netSelectedByUser) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "invalid network: %s", req.Net)
	}
	_networkSelected, err := hiero.LedgerIDFromString(netSelectedByUser)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get network selected: %v", err)
	}

	prismTokenIdStr := os.Getenv(fmt.Sprintf("%s_TOKEN", strings.ToUpper(req.Net)))
	if prismTokenIdStr == "" {
		lib.Log(lib.LOG_ERROR, "%s_TOKEN environment variable is not set", strings.ToUpper(req.Net))
	} else {
		lib.Log(lib.LOG_INFO, "%s_TOKEN: %s", strings.ToUpper(req.Net), prismTokenIdStr)
	}
	prismTokenId, err := hiero.TokenIDFromString(prismTokenIdStr)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "invalid %s_TOKEN: %v", strings.ToUpper(req.Net), err)
	}

	userAccountId, err := lib.EvmAddressToHederaAccountId(*_networkSelected, req.EvmAddress)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "failed to convert evm address to hedera account ID: %v", err)
	} else {
		lib.Log(lib.LOG_INFO, "userAccountId: %s", userAccountId.String())
	}
	userBalanceInt64, err := lib.GetTokenBalance(*_networkSelected, prismTokenId, *userAccountId)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "failed to get user's prism token balance: %v", err)
	} else {
		response.PrismTokenBalance = uint64(userBalanceInt64)
	}

	// and retrieve the number of Prism Points this user has for a given season:
	// look up database
	prismPointsRows, err := ps.prismPointsRepository.GetPrismPointsByUser(req.EvmAddress)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "failed to get prism points for user: %v", err)
	}
	// process prismPointsRows: aggregate points by season
	// lib.seasons is [][2]int64 (start, end) unix timestamps
	// prismPointsRows is []sqlc.PrismPoint (CreatedAt, PointsAwarded)

	// Prepare a slice to hold the sum of points for each season
	seasonPoints := make([]float64, len(lib.Seasons)) // placeholder, will fix to lib.seasons

	for _, row := range prismPointsRows {
		createdAtUnix := row.CreatedAt.Unix()
		for i, rng := range lib.Seasons {
			if createdAtUnix >= rng[0] && createdAtUnix <= rng[1] {
				seasonPoints[i] += row.PointsAwarded
				break // a point can only belong to one season
			}
		}
	}

	// Populate response.PrismPoints
	for i, pts := range seasonPoints {
		response.PrismPoints = append(response.PrismPoints, &pb_api.PrismPoints{
			SeasonId: uint32(i), // season_id is 0-based
			Points:   float32(pts),
		})
	}

	return response, nil
}

func (ps *PositionsService) GetAllPositions(limit int32, offset int32) ([]*pb_api.Position, error) {
	positionsResp, err := ps.positionsRepository.GetAllPositions(context.Background(), int(limit), int(offset))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get all positions: %v", err)
	}

	var apiPositions []*pb_api.Position
	for _, p := range positionsResp {
		apiPosition := &pb_api.Position{
			MarketId:   p.MarketID.String(),
			EvmAddress: p.EvmAddress,
			Yes:        uint64(p.NYes),
			No:         uint64(p.NNo),
			UpdatedAt:  p.UpdatedAt.Format(time.RFC3339),
			CreatedAt:  p.CreatedAt.Format(time.RFC3339),
		}
		apiPositions = append(apiPositions, apiPosition)
	}

	return apiPositions, nil
}
