package services

import (
	pb_api "api/gen"
	"api/server/lib"
	repositories "api/server/repositories"
	"context"
	"time"
)

type MatchesService struct {
	matchesRepository *repositories.MatchesRepository
	predictionIntents *repositories.PredictionIntentsRepository
}

func (ms *MatchesService) Init(matchesRepository *repositories.MatchesRepository, predictionIntents *repositories.PredictionIntentsRepository) error {
	ms.matchesRepository = matchesRepository
	ms.predictionIntents = predictionIntents

	lib.Log(lib.LOG_INFO, "Service: Matches service initialized successfully")
	return nil
}

func (ms *MatchesService) GetAllMatches(limit int32, offset int32) (*pb_api.MatchesResponse, error) {
	_limit := lib.ClampLimit(limit)

	matchesResp, err := ms.matchesRepository.GetAllMatches(context.Background(), int(_limit), int(offset))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get all matches: %v", err)
	}

	total, err := ms.matchesRepository.CountAllMatches(context.Background())
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to count all matches: %v", err)
	}

	var apiMatches []*pb_api.Match
	for _, m := range matchesResp {
		intent1, err := ms.predictionIntents.GetPredictionIntentByTxId(m.TxId1.String())
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prediction intent by txId1: %v", err)
		}
		intent2, err := ms.predictionIntents.GetPredictionIntentByTxId(m.TxId2.String())
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prediction intent by txId2: %v", err)
		}
		apiMatch := &pb_api.Match{
			TxId1:     m.TxId1.String(),
			TxId2:     m.TxId2.String(),
			CreatedAt: m.CreatedAt.Format(time.RFC3339),
			MarketId:  m.MarketID.String(),
			TxHash:    m.TxHash,
			Qty1:      m.Qty1,
			Qty2:      m.Qty2,
			PriceUsd1: intent1.PriceUsd,
			PriceUsd2: intent2.PriceUsd,
		}
		apiMatches = append(apiMatches, apiMatch)
	}

	return &pb_api.MatchesResponse{
		Matches:    apiMatches,
		Pagination: lib.NewPagination(_limit, offset, total, len(apiMatches)),
	}, nil
}

func (ms *MatchesService) GetPredictionIntentMatches(marketId string, limit *int32, offset *int32) (*pb_api.MatchesResponse, error) {
	// defaults - optional fields *req.Limit and *req.Offset
	var _limit int32 = lib.LIMIT
	var _offset int32 = lib.OFFSET

	if limit != nil {
		_limit = *limit
	}
	if offset != nil {
		_offset = *offset
	}
	_limit = lib.ClampLimit(_limit)

	matchesResp, err := ms.matchesRepository.GetPredictionIntentMatches(context.Background(), marketId, _limit, _offset)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prediction intent matches: %v", err)
	}

	total, err := ms.matchesRepository.CountPredictionIntentMatches(context.Background(), marketId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to count prediction intent matches: %v", err)
	}

	var apiMatches []*pb_api.Match
	for _, m := range matchesResp {
		intent1, err := ms.predictionIntents.GetPredictionIntentByTxId(m.TxId1.String())
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prediction intent by txId1: %v", err)
		}
		intent2, err := ms.predictionIntents.GetPredictionIntentByTxId(m.TxId2.String())
		if err != nil {
			return nil, lib.LogAndError(lib.LOG_ERROR, "failed to get prediction intent by txId2: %v", err)
		}
		apiMatch := &pb_api.Match{
			TxId1:     m.TxId1.String(),
			TxId2:     m.TxId2.String(),
			CreatedAt: m.CreatedAt.Format(time.RFC3339),
			MarketId:  m.MarketID.String(),
			TxHash:    m.TxHash,
			Qty1:      m.Qty1,
			Qty2:      m.Qty2,
			PriceUsd1: intent1.PriceUsd,
			PriceUsd2: intent2.PriceUsd,
		}
		apiMatches = append(apiMatches, apiMatch)
	}

	return &pb_api.MatchesResponse{
		Matches:    apiMatches,
		Pagination: lib.NewPagination(_limit, _offset, total, len(apiMatches)),
	}, nil
}
