package services

import (
	pb_api "api/gen"
	repositories "api/server/repositories"
	"context"
	"time"
)

type MatchesService struct {
	log               *LogService
	matchesRepository *repositories.MatchesRepository
}

func (ms *MatchesService) Init(log *LogService, matchesRepository *repositories.MatchesRepository) error {
	ms.log = log
	ms.matchesRepository = matchesRepository

	ms.log.Log(INFO, "Service: Matches service initialized successfully")
	return nil
}

func (ms *MatchesService) GetAllMatches(limit int32, offset int32) ([]*pb_api.Match, error) {
	matchesResp, err := ms.matchesRepository.GetAllMatches(context.Background(), int(limit), int(offset))
	if err != nil {
		return nil, ms.log.Log(ERROR, "failed to get all matches: %v", err)
	}

	var apiMatches []*pb_api.Match
	for _, m := range matchesResp {
		apiMatch := &pb_api.Match{
			TxId1:     m.TxId1.String(),
			TxId2:     m.TxId2.String(),
			CreatedAt: m.CreatedAt.Format(time.RFC3339),
			MarketId:  m.MarketID.String(),
			TxHash:    m.TxHash,
			Qty1:      m.Qty1,
			Qty2:      m.Qty2,
		}
		apiMatches = append(apiMatches, apiMatch)
	}

	return apiMatches, nil
}
