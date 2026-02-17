package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/google/uuid"

	pb_api "api/gen"
)

type CommentsRepository struct {
	db *sql.DB
}

func (commentsRepository *CommentsRepository) CloseDb() error {
	var err = commentsRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (commentsRepository *CommentsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	commentsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "CommentsRepository")
	return nil
}

func (commentsRepository *CommentsRepository) GetCommentsByMarketId(marketId string, limit int32, offset int32) (*pb_api.GetCommentsResponse, error) {
	if commentsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	q := sqlc.New(commentsRepository.db)
	rows, err := q.GetCommentsByMarketId(context.Background(), sqlc.GetCommentsByMarketIdParams{
		MarketID: marketUUID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetCommentsByMarketId failed", "error", err, "marketId", marketId)
	}

	var resonseObject pb_api.GetCommentsResponse
	for _, row := range rows {
		commentResponse := &pb_api.Comment{
			AccountId: row.AccountID,
			Content:   row.Content,
			Sig:       row.Sig,
			PublicKey: row.PublicKey,
			KeyType:   uint32(row.KeyType),
			CreatedAt: row.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		resonseObject.Comments = append(resonseObject.Comments, commentResponse)
	}

	return &resonseObject, nil
}

func (commentsRepository *CommentsRepository) CreateComment(marketId string, accountId string, content string, sig string, publicKey string, keyType uint32) (*sqlc.AddCommentRow, error) {
	if commentsRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketId)
	}

	if !lib.IsValidAccountId(accountId) {
		return nil, lib.ErrorLog("invalid accountId", "accountId", accountId)
	}

	params := sqlc.AddCommentParams{
		MarketID:  marketUUID,
		AccountID: accountId,
		Content:   content,
		Sig:       sig,
		PublicKey: publicKey,
		KeyType:   int32(keyType),
	}

	q := sqlc.New(commentsRepository.db)
	row, err := q.AddComment(context.Background(), params)
	if err != nil {
		return nil, lib.ErrorLog("AddComment failed", "error", err, "marketId", marketId, "accountId", accountId)
	}

	lib.Info("comment added", "marketId", marketId, "accountId", accountId)
	return &row, nil
}
