package repositories

import (
	sqlc "api/gen/sqlc"
	"api/server/lib"
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"

	"github.com/google/uuid"
)

type MatchesRepository struct {
	db *sql.DB
}


func (matchesRepository *MatchesRepository) CloseDb() error {
	var err = matchesRepository.db.Close()
	if err != nil {
		return lib.ErrorLog("failed to close database", "error", err)
	}
	return nil
}

func (matchesRepository *MatchesRepository) InitDb() error {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_UNAME"), os.Getenv("DB_PWORD"), os.Getenv("DB_NAME"))

	var db, err = sql.Open("postgres", connStr)
	if err != nil {
		return lib.ErrorLog("failed to open database", "error", err)
	}
	matchesRepository.db = db

	// Verify connection
	if err = db.Ping(); err != nil {
		return lib.ErrorLog("failed to ping database", "error", err)
	}

	lib.Info("repository connected", "repository", "MatchesRepository")
	return nil
}

// MatchV2 is one PrismV2 fill. Bid is the YES-price buyer, Ask the YES-price seller.
type MatchV2 struct {
	MarketID          uuid.UUID
	BidTxID           uuid.UUID
	AskTxID           uuid.UUID
	MatchID           string // 0x-prefixed bytes32 hex
	FillShares        uint64
	ExecutionYesPrice uint64
	YesCollateral     uint64
	NoCollateral      uint64
	BidCollateral     uint64 // collateral attributed to the bid authorization (contract _consume)
	AskCollateral     uint64
	UnitScale         float64 // 10^collateral decimals, for the derived qty columns
}

// CreateMatchV2 records a fill before submission. Redelivery returns the existing row.
func (matchesRepository *MatchesRepository) CreateMatchV2(m MatchV2) (*sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	qty := float64(m.FillShares) / m.UnitScale
	q := sqlc.New(matchesRepository.db)
	match, err := q.CreateMatchV2(context.Background(), sqlc.CreateMatchV2Params{
		MarketID:          m.MarketID,
		TxId1:             m.BidTxID,
		TxId2:             m.AskTxID,
		Qty1:              qty,
		Qty2:              qty,
		MatchID:           sql.NullString{String: m.MatchID, Valid: true},
		FillShares:        strconv.FormatUint(m.FillShares, 10),
		ExecutionYesPrice: sql.NullInt64{Int64: int64(m.ExecutionYesPrice), Valid: true},
		YesCollateral:     strconv.FormatUint(m.YesCollateral, 10),
		NoCollateral:      strconv.FormatUint(m.NoCollateral, 10),
	})
	if err != nil {
		return nil, lib.ErrorLog("failed to record match", "error", err, "matchId", m.MatchID)
	}
	return &match, nil
}

func (matchesRepository *MatchesRepository) MarkMatchSubmitted(matchID string, hederaTxID string) error {
	q := sqlc.New(matchesRepository.db)
	return q.MarkMatchSubmitted(context.Background(), sqlc.MarkMatchSubmittedParams{
		MatchID: sql.NullString{String: matchID, Valid: true},
		TxHash:  hederaTxID,
	})
}

func (matchesRepository *MatchesRepository) MarkMatchFailed(matchID string, cause error) error {
	q := sqlc.New(matchesRepository.db)
	return q.MarkMatchFailed(context.Background(), sqlc.MarkMatchFailedParams{
		MatchID:   sql.NullString{String: matchID, Valid: true},
		LastError: sql.NullString{String: cause.Error(), Valid: true},
	})
}

// FinalizeMatchV2 marks a match finalized and applies both fills in one transaction.
// It returns false (and changes nothing) if the match was already finalized, so a
// redelivered settlement can never double-count a fill.
func (matchesRepository *MatchesRepository) FinalizeMatchV2(m MatchV2, txHash string) (bool, error) {
	if matchesRepository.db == nil {
		return false, lib.ErrorLog("database not initialized")
	}
	tx, err := matchesRepository.db.BeginTx(context.Background(), nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	q := sqlc.New(tx)
	n, err := q.FinalizeMatch(context.Background(), sqlc.FinalizeMatchParams{
		MatchID: sql.NullString{String: m.MatchID, Valid: true},
		TxHash:  txHash,
	})
	if err != nil {
		return false, err
	}
	if n == 0 {
		return false, nil
	}
	fills := []struct {
		txID       uuid.UUID
		collateral uint64
	}{{m.BidTxID, m.BidCollateral}, {m.AskTxID, m.AskCollateral}}
	for _, fill := range fills {
		if _, err := q.AddPredictionIntentFill(context.Background(), sqlc.AddPredictionIntentFillParams{
			FillShares:     strconv.FormatUint(m.FillShares, 10),
			FillCollateral: strconv.FormatUint(fill.collateral, 10),
			UnitScale:      m.UnitScale,
			TxID:           fill.txID,
		}); err != nil {
			return false, fmt.Errorf("apply fill to %s: %w", fill.txID, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	lib.Info("match finalized", "matchId", m.MatchID, "bid", m.BidTxID.String(), "ask", m.AskTxID.String())
	return true, nil
}

func (matchesRepository *MatchesRepository) SetMatchHcsTxId(matchID string, hcsTxID string) error {
	q := sqlc.New(matchesRepository.db)
	return q.SetMatchHcsTxId(context.Background(), sqlc.SetMatchHcsTxIdParams{
		MatchID: sql.NullString{String: matchID, Valid: true},
		HcsTxID: sql.NullString{String: hcsTxID, Valid: true},
	})
}

func (matchesRepository *MatchesRepository) GetMatchByMatchId(matchID string) (*sqlc.Match, error) {
	q := sqlc.New(matchesRepository.db)
	match, err := q.GetMatchByMatchId(context.Background(), sql.NullString{String: matchID, Valid: true})
	if err != nil {
		return nil, err
	}
	return &match, nil
}

func (matchesRepository *MatchesRepository) GetAllMatchesForMarketIdTxId(marketID uuid.UUID, txId uuid.UUID) ([]sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	q := sqlc.New(matchesRepository.db)
	matches, err := q.GetAllMatchesForMarketIdTxId(context.Background(), sqlc.GetAllMatchesForMarketIdTxIdParams{
		MarketID: marketID,
		TxId1:    txId,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetAllMatchesForMarketIdTxId failed", "error", err, "marketId", marketID.String(), "txId", txId.String())
	}

	return matches, nil
}

func (matchesRepository *MatchesRepository) GetAllMatches(ctx context.Context, limit int, offset int) ([]sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}
	q := sqlc.New(matchesRepository.db)
	matches, err := q.GetAllMatches(context.Background(), sqlc.GetAllMatchesParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, lib.ErrorLog("GetAllMatches failed", "error", err, "limit", limit, "offset", offset)
	}

	return matches, nil
}

func (matchesRepository *MatchesRepository) CountAllMatches(ctx context.Context) (int64, error) {
	if matchesRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}
	q := sqlc.New(matchesRepository.db)
	total, err := q.CountAllMatches(ctx)
	if err != nil {
		return 0, lib.ErrorLog("CountAllMatches failed", "error", err)
	}

	return total, nil
}

func (matchesRepository *MatchesRepository) GetPredictionIntentMatches(ctx context.Context, marketIdStr string, limit int32, offset int32) ([]sqlc.Match, error) {
	if matchesRepository.db == nil {
		return nil, lib.ErrorLog("database not initialized")
	}

	marketId, err := uuid.Parse(marketIdStr)
	if err != nil {
		return nil, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketIdStr)
	}

	q := sqlc.New(matchesRepository.db)
	matches, err := q.GetAllMatchesForMarketId(ctx, sqlc.GetAllMatchesForMarketIdParams{
		MarketID: marketId,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, lib.ErrorLog("GetPredictionIntentMatches failed", "error", err, "marketId", marketId, "limit", limit, "offset", offset)
	}

	return matches, nil
}

func (matchesRepository *MatchesRepository) CountPredictionIntentMatches(ctx context.Context, marketIdStr string) (int64, error) {
	if matchesRepository.db == nil {
		return 0, lib.ErrorLog("database not initialized")
	}

	marketId, err := uuid.Parse(marketIdStr)
	if err != nil {
		return 0, lib.ErrorLog("invalid marketId uuid", "error", err, "marketId", marketIdStr)
	}

	q := sqlc.New(matchesRepository.db)
	total, err := q.CountMatchesForMarketId(ctx, marketId)
	if err != nil {
		return 0, lib.ErrorLog("CountMatchesForMarketId failed", "error", err, "marketId", marketId)
	}

	return total, nil
}
