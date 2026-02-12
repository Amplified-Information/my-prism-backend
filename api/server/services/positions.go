package services

import (
	pb_api "api/gen"
	sqlc "api/gen/sqlc"
	repositories "api/server/repositories"
	"context"
	"time"
)

type PositionsService struct {
	log                         *LogService
	positionsRepository         *repositories.PositionsRepository
	marketsRepository           *repositories.MarketsRepository
	predictionIntentsRepository *repositories.PredictionIntentsRepository
	priceService                *PriceService
}

func (ps *PositionsService) Init(log *LogService, positionsRepository *repositories.PositionsRepository, marketsRepository *repositories.MarketsRepository, predictionIntentsRepository *repositories.PredictionIntentsRepository, priceService *PriceService) error {
	// and inject the deps:
	ps.log = log
	ps.positionsRepository = positionsRepository
	ps.marketsRepository = marketsRepository
	ps.predictionIntentsRepository = predictionIntentsRepository
	ps.priceService = priceService

	ps.log.Log(INFO, "Service: Positions service initialized successfully")
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
		return nil, ps.log.Log(ERROR, "failed to get user portfolio: %v", err)
	}

	response := &pb_api.UserPortfolioResponse{
		Positions:             make(map[string]*pb_api.PositionInfo),
		OpenPredictionIntents: make(map[string]*pb_api.PredictionIntents),
	}

	for _, userPosition := range userPositions {
		priceUsd, err := ps.priceService.GetLatestPriceByMarket(userPosition.MarketID.String())
		if err != nil {
			ps.log.Log(WARN, "skipping market %s: failed to get latest price: %v", userPosition.MarketID.String(), err)
			continue // skip to next userPosition
		}

		market, err := ps.marketsRepository.GetMarketById(userPosition.MarketID.String())
		if err != nil {
			ps.log.Log(WARN, "skipping market %s: failed to get market: %v", userPosition.MarketID.String(), err)
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
		return nil, ps.log.Log(ERROR, "failed to get open prediction intents for account with evm address %s: %v", req.EvmAddress, err)
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

	return response, nil

	// On-chain query equivalent:
	// contractID, err := hiero.ContractIDFromString(
	// be careful - is _SMART_CONTRACT_ID the correct one here?
	// 	os.Getenv(fmt.Sprintf("%s_SMART_CONTRACT_ID", strings.ToUpper(req.Net))),
	// )
	// if err != nil {
	// 	return nil, fmt.Errorf("invalid contract ID: %v", err)
	// }
	// params := hiero.NewContractFunctionParameters()
	// params.AddUint128BigInt(marketIdBig)
	// params.AddAddress(req.EvmAddress)

	// query := hiero.NewContractCallQuery().
	// 	SetContractID(contractID).
	// 	SetGas(100_000).
	// 	SetFunction("getUserTokens", params)
	// 	// TODO - remove this print!
	// fmt.Println(query.GetContractID().String())
}

func (ps *PositionsService) GetAllPositions(limit int32, offset int32) ([]*pb_api.Position, error) {
	positionsResp, err := ps.positionsRepository.GetAllPositions(context.Background(), int(limit), int(offset))
	if err != nil {
		return nil, ps.log.Log(ERROR, "failed to get all positions: %v", err)
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
