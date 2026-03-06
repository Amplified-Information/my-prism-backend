package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

type MarketsRepository struct {
	db *sql.DB
}

type MarketAug struct {
	sqlc.Market
	// augmented fields:
	CategoryIds []int32 `json:"categoryIds"`
}

func (marketsRepository *MarketsRepository) CloseDb() error {
	var err = marketsRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (marketsRepository *MarketsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	marketsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "MarketsRepository")
	return nil
}

func (marketsRepository *MarketsRepository) GetMarketById(marketId string, isAdmin bool) (*MarketAug, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(marketsRepository.db)
	market, err := q.GetMarketById(context.Background(), sqlc.GetMarketByIdParams{
		MarketID: marketUUID,
		Column2:  isAdmin,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetMarketById failed", "error", err, "marketId", marketId)
	}

	categoryIds, err := q.GetCategoriesForMarket(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetCategoriesForMarket failed", "error", err, "marketId", marketId)
	}
	categoryIds32 := make([]int32, len(categoryIds))
	for i, category := range categoryIds {
		categoryIds32[i] = int32(category.ID)
	}

	return &MarketAug{
		Market:      market,
		CategoryIds: categoryIds32,
	}, nil
}

func (marketsRepository *MarketsRepository) GetMarkets(limit int32, offset int32, isAdmin bool) ([]MarketAug, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	markets, err := q.GetMarkets(context.Background(), sqlc.GetMarketsParams{
		Limit:   limit,
		Offset:  offset,
		Column3: isAdmin,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetMarkets failed", "error", err, "limit", limit, "offset", offset)
	}

	marketAugs := make([]MarketAug, len(markets))
	for i, market := range markets {

		categoryIds, err := q.GetCategoriesForMarket(context.Background(), market.MarketID)
		if err != nil {
			return nil, lib.ErrorLog("GetCategoriesForMarket failed", "error", err, "marketId", market.MarketID)
		}
		categoryIds32 := make([]int32, len(categoryIds))
		for i, category := range categoryIds {
			categoryIds32[i] = int32(category.ID)
		}

		marketAugs[i] = MarketAug{
			Market:      market,
			CategoryIds: categoryIds32,
		}
	}
	return marketAugs, nil
}

func (marketsRepository *MarketsRepository) GetCategories() ([]sqlc.Category, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	categories, err := q.GetCategories(context.Background())
	if err != nil {
		return nil, lib.ErrorLog("GetCategories failed", "error", err)
	}

	return categories, nil
}

func (marketsRepository *MarketsRepository) CreateMarket(marketId string, _net string, _imageUrl string, _statement string, closesAt time.Time, _description string, smartContractId string, categoryIds []int32) (*MarketAug, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	net := strings.ToLower(_net)
	isValid := lib.IsValidNetwork(net)
	if !isValid {
		return nil, lib.ErrorLog("invalid network", "network", net)
	}

	imageUrl := strings.TrimSpace(_imageUrl)

	statement := strings.TrimSpace(_statement)

	isValidSmartContractId := lib.IsValidAccountId(smartContractId)
	if !isValidSmartContractId {
		return nil, lib.ErrorLog("invalid smart contract ID", "smartContractId", smartContractId)
	}

	description := strings.TrimSpace(_description)

	// OK
	// Start a transaction
	tx, err := marketsRepository.db.Begin()
	if err != nil {
		return nil, lib.ErrorLog("failed to begin transaction", "error", err)
	}

	// Use the transaction with the query builder
	q := sqlc.New(tx)
	market, err := q.CreateMarket(context.Background(), sqlc.CreateMarketParams{
		MarketID:        marketUUID,
		Net:             net,
		Statement:       statement,
		ImageUrl:        sql.NullString{String: imageUrl, Valid: imageUrl != ""},
		SmartContractID: smartContractId,
		ClosesAt:        closesAt,
		Description:     description,
	})
	if err != nil {
		tx.Rollback() // Rollback the transaction on error
		return nil, lib.ErrorLog("CreateMarket failed", "error", err, "marketId", marketId)
	}

	// And update the market_categories table:
	// now associate the market with its categories in the market_categories table
	if len(categoryIds) > 0 {
		err = q.AssociateMarketCategoriesBatch(context.Background(), sqlc.AssociateMarketCategoriesBatchParams{
			MarketID: marketUUID,
			Column2:  categoryIds,
		})
		if err != nil {
			tx.Rollback() // Rollback the transaction on error
			return nil, lib.ErrorLog("AssociateMarketCategoriesBatch failed", "error", err, "marketId", marketId, "categoryIds", categoryIds)
		}
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, lib.ErrorLog("failed to commit transaction", "error", err)
	}

	lib.Info("market created", "marketId", market.MarketID.String())
	return &MarketAug{
		Market:      market,
		CategoryIds: categoryIds,
	}, nil
}

func (marketsRepository *MarketsRepository) CountUnresolvedMarkets() (int64, error) {
	if marketsRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	count, err := q.CountUnresolvedMarkets(context.Background())
	if err != nil {
		return 0, lib.ErrorLog("CountUnresolvedMarkets failed", "error", err)
	}

	return count, nil
}

func (marketsRepository *MarketsRepository) GetAllUnresolvedMarkets() ([]MarketAug, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(marketsRepository.db)
	markets, err := q.GetAllUnresolvedMarkets(context.Background())
	if err != nil {
		return nil, lib.ErrorLog("GetAllUnresolvedMarkets failed", "error", err)
	}

	var marketAugs []MarketAug
	for _, market := range markets {
		categoryIds, err := q.GetCategoriesForMarket(context.Background(), market.MarketID)
		if err != nil {
			return nil, lib.ErrorLog("GetCategoriesForMarket failed", "error", err, "marketId", market.MarketID)
		}
		categoryIds32 := make([]int32, len(categoryIds))
		for i, category := range categoryIds {
			categoryIds32[i] = int32(category.ID)
		}

		marketAugs = append(marketAugs, MarketAug{
			Market:      market,
			CategoryIds: categoryIds32,
		})
	}

	return marketAugs, nil
}

func (marketsRepository *MarketsRepository) ToggleMarketPause(marketId string) (*MarketAug, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(marketsRepository.db)
	market, err := q.ToggleMarketPause(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("ToggleMarketPause failed", "error", err, "marketId", marketId)
	}

	categoryIds, err := q.GetCategoriesForMarket(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetCategoriesForMarket failed", "error", err, "marketId", marketId)
	}
	categoryIds32 := make([]int32, len(categoryIds))
	for i, category := range categoryIds {
		categoryIds32[i] = int32(category.ID)
	}

	return &MarketAug{
		Market:      market,
		CategoryIds: categoryIds32,
	}, nil
}

func (marketsRepository *MarketsRepository) ToggleMarketSuspend(marketId string) (*MarketAug, error) {
	if marketsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(marketsRepository.db)
	market, err := q.ToggleMarketSuspend(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("ToggleMarketSuspend failed", "error", err, "marketId", marketId)
	}

	categoryIds, err := q.GetCategoriesForMarket(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetCategoriesForMarket failed", "error", err, "marketId", marketId)
	}
	categoryIds32 := make([]int32, len(categoryIds))
	for i, category := range categoryIds {
		categoryIds32[i] = int32(category.ID)
	}

	return &MarketAug{
		Market:      market,
		CategoryIds: categoryIds32,
	}, nil
}

func (marketsRepository *MarketsRepository) ResolveMarket(marketId string, outcome bool) (bool, error) {
	if marketsRepository.db == nil {
		return false, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return false, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(marketsRepository.db)
	err = q.ResolveMarket(context.Background(), sqlc.ResolveMarketParams{
		MarketID: marketUUID,
		Outcome:  sql.NullBool{Bool: outcome, Valid: true},
	})
	if err != nil {
		return false, lib.ErrorLog("ResolveMarket failed", "error", err, "marketId", marketId)
	}

	return true, nil
}
