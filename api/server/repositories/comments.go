package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"log"
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
		return fmt.Errorf("failed to close database: %v", err)
	}
	return nil
}

func (commentsRepository *CommentsRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %v", err)
	}
	commentsRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	log.Println("DB: CommentsRepository connected successfully")
	return nil
}

func (commentsRepository *CommentsRepository) GetCommentsByMarketId(marketId string, limit int32, offset int32) (*pb_api.GetCommentsResponse, error) {
	if commentsRepository.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	q := sqlc.New(commentsRepository.db)
	rows, err := q.GetCommentsByMarketId(context.Background(), sqlc.GetCommentsByMarketIdParams{
		MarketID: marketUUID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, fmt.Errorf("GetCommentsByMarketId failed: %v", err)
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
		return nil, fmt.Errorf("database not initialized")
	}

	marketUUID, err := uuid.Parse(marketId)
	if err != nil {
		return nil, fmt.Errorf("invalid marketId uuid: %v", err)
	}

	if !lib.IsValidAccountId(accountId) {
		return nil, fmt.Errorf("invalid accountId: %s", accountId)
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
		return nil, fmt.Errorf("AddComment failed: %v", err)
	}

	log.Printf("Added comment to database for market %s by account %s", marketId, accountId)
	return &row, nil
}
