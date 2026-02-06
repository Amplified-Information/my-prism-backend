package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type PriceRepository struct {
	db *sql.DB
}

func (priceRepository *PriceRepository) CloseDb() error {
	var err = priceRepository.db.Close()
	if err != nil {
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (priceRepository *PriceRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	priceRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: PriceRepository connected successfully")
	return nil
}

func (priceRepository *PriceRepository) GetPriceHistory(marketId string, from time.Time, to time.Time, limit int32, offset int32) ([]sqlc.GetPriceHistoryEfficientRow, error) { // yes, it returns []string due to - price NUMERIC(18,10)
	if priceRepository == nil {
		msg := "ERROR: priceRepository is nil in GetPriceHistory"
		log.Printf("%s", msg)
		return nil, fmt.Errorf("%s", msg)
	}
	if priceRepository.db == nil {
		msg := "ERROR: database not initialized in GetPriceHistory"
		log.Printf("%s", msg)
		return nil, fmt.Errorf("%s", msg)
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	q := sqlc.New(priceRepository.db)
	rows, err := q.GetPriceHistoryEfficient(context.Background(), sqlc.GetPriceHistoryEfficientParams{
		MarketID: marketUUID,
		Ts:       from,
		Ts_2:     to,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) { // exception, if no rows returned, return empty array
			return []sqlc.GetPriceHistoryEfficientRow{}, nil
		}
		return nil, fmt.Errorf("GetAggregatedPriceHistory failed: %v", err)
	}
	if rows == nil {
		return []sqlc.GetPriceHistoryEfficientRow{}, nil
	}
	return rows, nil
}

func (priceRepository *PriceRepository) SavePriceHistory(marketId string, txId string, price float64) error {
	if priceRepository.db == nil {
		return fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return fmt.Errorf("invalid marketId uuid: %v", err)
	}

	txUUID, err := uuid.Parse(txId)
	if err != nil {
		return fmt.Errorf("invalid txId uuid: %v", err)
	}

	params := sqlc.CreatePriceParams{
		MarketID: marketUUID,
		TxID:     txUUID,
		Price:    fmt.Sprintf("%f", price), // use of NUMERIC(18,10) avoids floating point imprecision
		Ts:       time.Now().UTC(),
	}

	q := sqlc.New(priceRepository.db)
	err = q.CreatePrice(context.Background(), params)
	if err != nil {
		return fmt.Errorf("CreatePriceHistory failed: %v", err)
	}

	return nil
}

func (priceRepository *PriceRepository) GetLatestPriceByMarket(marketId string) (string, error) {
	if priceRepository.db == nil {
		return "", fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return "", fmt.Errorf("invalid marketId uuid: %v", err)
	}

	q := sqlc.New(priceRepository.db)
	priceRow, err := q.GetLatestPriceByMarket(context.Background(), marketUUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) { // if no rows found, return the mid-market price
			return fmt.Sprintf("%f", lib.MID_MARKET_PRICE), nil
		}
		return "", fmt.Errorf("GetLatestPriceByMarket failed: %v", err)
	}

	return priceRow.Price, nil
}
