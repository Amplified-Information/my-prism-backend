package repositories

import (
	sqlc "api/gen/sqlc"
	"context"
	"database/sql"
	"fmt"
	"log"
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
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (positionsRepository *PositionsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	positionsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: PositionsRepository connected successfully")
	return nil
}

func (positionsRepository *PositionsRepository) GetUserPositions(evmAddress string) ([]sqlc.GetUserPositionsRow, error) {
	if positionsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)
	result, err := q.GetUserPositions(context.Background(), evmAddress)
	return result, err
}

func (positionsRepository *PositionsRepository) GetUserPositionsByMarketId(evmAddress string, marketId string) ([]sqlc.GetUserPositionsRow, error) {
	if positionsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	marketIdUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
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

func (positionsRepository *PositionsRepository) UpsertUserPositions(evmAddress string, marketId string, nYesTokens int64, nNoTokens int64) (*sqlc.Position, error) {
	if positionsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)

	result, err := q.UpsertPositions(context.Background(), sqlc.UpsertPositionsParams{
		MarketID:   uuid.MustParse(marketId),
		EvmAddress: evmAddress,
		NYes:       nYesTokens,
		NNo:        nNoTokens,
	})
	if err != nil {
		return nil, fmt.Errorf("UpsertUserPositions failed: %v", err)
	}

	log.Printf("Updated user position tokens: %+v", result)
	return &result, nil
}

func (positionsRepository *PositionsRepository) GetAllPositions(ctx context.Context, limit int, offset int) ([]sqlc.Position, error) {
	if positionsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	q := sqlc.New(positionsRepository.db)

	result, err := q.GetAllPositions(ctx, sqlc.GetAllPositionsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("GetAllPositions failed: %v", err)
	}

	return result, nil
}
