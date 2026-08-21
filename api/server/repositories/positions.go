package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type PositionsRepository struct {
	db *sql.DB
}

func (positionsRepository *PositionsRepository) CloseDb() error {
	var err = positionsRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (positionsRepository *PositionsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	positionsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "PositionsRepository")
	return nil
}

func (positionsRepository *PositionsRepository) GetUserPositions(evmAddress string) ([]sqlc.GetUserPositionsRow, error) {
	if positionsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)
	result, err := q.GetUserPositions(context.Background(), evmAddress)
	return result, err
}

func (positionsRepository *PositionsRepository) GetUserPositionsByMarketId(evmAddress string, marketId string) ([]sqlc.GetUserPositionsRow, error) {
	if positionsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketIdUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(positionsRepository.db)
	result, err := q.GetUserPositionsByMarketId(context.Background(), sqlc.GetUserPositionsByMarketIdParams{
		EvmAddress: evmAddress,
		MarketID:   marketIdUUID,
	})
	// Convert []sqlc.GetUserPositionsByMarketIdRow to []sqlc.GetUserPositionsRow
	converted := make([]sqlc.GetUserPositionsRow, len(result))
	for i, v := range result {
		converted[i] = sqlc.GetUserPositionsRow(v)
	}
	return converted, err
}

func (positionsRepository *PositionsRepository) UpsertUserPositions(evmAddress string, marketId string, nYesTokens int64, nNoTokens int64, priceUsd float64) (*sqlc.Position, error) {
	if positionsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)

	result, err := q.UpsertPositions(context.Background(), sqlc.UpsertPositionsParams{
		MarketID:   uuid.MustParse(marketId),
		EvmAddress: evmAddress,
		NYes:       nYesTokens,
		NNo:        nNoTokens,
		PriceUsd:   priceUsd,
	})
	if err != nil {
		return nil, lib.ErrorLog("UpsertUserPositions failed", "error", err, "evmAddress", evmAddress, "marketId", marketId)
	}

	lib.Info("user positions updated", "evmAddress", evmAddress, "marketId", marketId)
	return &result, nil
}

func (positionsRepository *PositionsRepository) GetAllPositions(ctx context.Context, limit int, offset int) ([]sqlc.Position, error) {
	if positionsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)

	result, err := q.GetAllPositions(ctx, sqlc.GetAllPositionsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, lib.ErrorLog("GetAllPositions failed", "error", err, "limit", limit, "offset", offset)
	}

	return result, nil
}

func (positionsRepository *PositionsRepository) CountAllPositions(ctx context.Context) (int64, error) {
	if positionsRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)

	total, err := q.CountAllPositions(ctx)
	if err != nil {
		return 0, lib.ErrorLog("CountAllPositions failed", "error", err)
	}

	return total, nil
}

func (positionsRepository *PositionsRepository) GetPositionsByMarketIdNoPointsAwardedMarketNotResolved(marketId string) (error, []sqlc.Position) {
	if positionsRepository.db == nil {
		return lib.ErrorLog("database not initialized"), nil
	}

	q := sqlc.New(positionsRepository.db)

	marketIdUUID, err := uuid.Parse(marketId)
	if err != nil {
		return lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId), nil
	}

	result, err := q.GetPositionsByMarketIdNoPointsAwardedMarketNotResolved(context.Background(), marketIdUUID)
	if err != nil {
		return lib.ErrorLog("GetPositionsByMarketIdNoPointsAwardedMarketNotResolved failed", "error", err, "marketId", marketId), nil
	}

	return nil, result
}

func (positionsRepository *PositionsRepository) GetCostBasisForUser(marketId uuid.UUID, evmAddress string) (float64, float64, error) {
	if positionsRepository.db == nil {
		return 0.0, 0.0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)

	result, err := q.GetCostBasisForUserOnMarket(context.Background(), sqlc.GetCostBasisForUserOnMarketParams{
		MarketID:   marketId,
		EvmAddress: evmAddress,
	})

	if err != nil {
		return 0.0, 0.0, lib.ErrorLog("GetCostBasisForUser failed", "error", err, "marketId", marketId.String(), "evmAddress", evmAddress)
	}
	return result.CostBasisPriceYesUsd, result.CostBasisPriceNoUsd, nil
}
