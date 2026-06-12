package repositories

import (
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"

	sqlc "api/gen/sqlc"

	"github.com/google/uuid"
)

type CategoriesRepository struct {
	db *sql.DB
}

func (categoriesRepository *CategoriesRepository) CloseDb() error {
	var err = categoriesRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (categoriesRepository *CategoriesRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	categoriesRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "CategoriesRepository")
	return nil
}

func (categoriesRepository *CategoriesRepository) CreateCategory(name string, isActive bool, description string) (*sqlc.Category, error) {
	if categoriesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	params := sqlc.CreateCategoryParams{
		Name:        name,
		IsActive:    sql.NullBool{Bool: isActive, Valid: true},
		Description: sql.NullString{String: description, Valid: true},
	}

	q := sqlc.New(categoriesRepository.db)
	row, err := q.CreateCategory(context.Background(), params)
	if err != nil {
		return nil, lib.ErrorLog("CreateCategory failed", "error", err, "name", name)
	}

	lib.Info("category created", "name", name)

	return &row, nil
}

func (categoriesRepository *CategoriesRepository) UpdateCategory(id int32, name string, isActive bool, description string) (*sqlc.Category, error) {
	if categoriesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	params := sqlc.UpdateCategoryParams{
		ID:          id,
		Name:        name,
		IsActive:    sql.NullBool{Bool: isActive, Valid: true},
		Description: sql.NullString{String: description, Valid: true},
	}

	q := sqlc.New(categoriesRepository.db)
	row, err := q.UpdateCategory(context.Background(), params)
	if err != nil {
		return nil, lib.ErrorLog("UpdateCategory failed", "error", err, "id", id)
	}

	lib.Info("category updated", "id", id)

	return &row, nil
}

func (categoriesRepository *CategoriesRepository) DeleteCategory(id int32) error {
	if categoriesRepository.db == nil {
		return lib.ErrorLog("database not initialized")
	}

	q := sqlc.New(categoriesRepository.db)
	_, err := q.DeleteCategory(context.Background(), id)
	if err != nil {
		return lib.ErrorLog("DeleteCategory failed", "error", err, "id", id)
	}

	lib.Info("category deleted", "id", id)

	return nil
}

func (categoriesRepository *CategoriesRepository) SetCategoriesForMarket(marketId string, categoryIds []int32) ([]int32, error) {
	if categoriesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	tx, err := categoriesRepository.db.Begin()
	if err != nil {
		return nil, lib.ErrorLog("failed to begin transaction", "error", err)
	}

	q := sqlc.New(tx)

	// Delete all existing category links for this market
	err = q.DeleteCategoriesForMarket(context.Background(), marketUUID)
	if err != nil {
		tx.Rollback()
		return nil, lib.ErrorLog("DeleteCategoriesForMarket failed", "error", err, "marketId", marketId)
	}

	// Insert new category links
	if len(categoryIds) > 0 {
		err = q.AssociateMarketCategoriesBatch(context.Background(), sqlc.AssociateMarketCategoriesBatchParams{
			MarketID: marketUUID,
			Column2:  categoryIds,
		})
		if err != nil {
			tx.Rollback()
			return nil, lib.ErrorLog("AssociateMarketCategoriesBatch failed", "error", err, "marketId", marketId, "categoryIds", categoryIds)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, lib.ErrorLog("failed to commit transaction", "error", err)
	}

	lib.Info("categories set for market", "marketId", marketId, "categoryIds", categoryIds)

	return categoryIds, nil
}

func (categoriesRepository *CategoriesRepository) GetCategoryIdsByMarketId(marketId string) ([]int32, error) {
	if categoriesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(categoriesRepository.db)
	categories, err := q.GetCategoriesForMarket(context.Background(), marketUUID)
	if err != nil {
		return nil, lib.ErrorLog("GetCategoryIdsByMarketId failed", "error", err, "marketId", marketId)
	}

	var categoryIds []int32
	for _, category := range categories {
		categoryIds = append(categoryIds, category.ID)
	}

	return categoryIds, nil
}
