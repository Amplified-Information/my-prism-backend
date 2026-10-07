package repositories

import (
	"context"
	"os"
	"testing"
	"time"

	pb_api "api/gen"

	"github.com/google/uuid"
)

// TestPrismV2PersistenceAgainstPostgres runs the V2 order, match and event queries
// against a real, fully migrated database. It is skipped unless PRISM_INTEGRATION_DB=1,
// with the usual DB_HOST/DB_PORT/DB_UNAME/DB_PWORD/DB_NAME variables pointing at a
// disposable database.
func TestPrismV2PersistenceAgainstPostgres(t *testing.T) {
	if os.Getenv("PRISM_INTEGRATION_DB") != "1" {
		t.Skip("set PRISM_INTEGRATION_DB=1 and DB_* to run against PostgreSQL")
	}
	pir, mr, scer, markets := &PredictionIntentsRepository{}, &MatchesRepository{}, &SmartContractEventRepository{}, &MarketsRepository{}
	for _, init := range []func() error{pir.InitDb, mr.InitDb, scer.InitDb, markets.InitDb} {
		if err := init(); err != nil {
			t.Fatal(err)
		}
	}

	marketID := uuid.Must(uuid.NewV7())
	if _, err := markets.CreateMarket(marketID.String(), "testnet", "", "Will it settle?", time.Now().Add(24*time.Hour), "d", "r", "0.0.5555", "", "", "", "", false); err != nil {
		t.Fatal(err)
	}

	order := func(evm string, side, action uint32, limit, qty, cap uint64) *pb_api.PrismPredictionIntentRequest {
		return &pb_api.PrismPredictionIntentRequest{
			TxId: uuid.Must(uuid.NewV7()).String(), Net: "testnet", MarketId: marketID.String(), AccountId: "0.0.1234",
			Sig: "c2lnbmF0dXJlLXBsYWNlaG9sZGVy", PublicKey: "0011223344556677889900112233445566778899001122334455667788990011", EvmAddress: evm, KeyType: 1,
			ChainId: 296, VerifyingContract: "1111111111111111111111111111111111111111",
			Side: side, Action: action, LimitYesPrice: limit, QtyShares: qty, CollateralCap: cap, Deadline: 2_000_000_000,
		}
	}
	bidReq := order("2222222222222222222222222222222222222222", 0, 0, 600000, 4_000_000, 2_400_000)
	askReq := order("3333333333333333333333333333333333333333", 1, 0, 600000, 10_000_000, 4_000_000)
	bid, err := pir.CreateOrderIntentRequestWithOutbox(bidReq, 1e6, "clob.orders", []byte(`{"tx_id":"`+bidReq.TxId+`"}`))
	if err != nil {
		t.Fatal(err)
	}
	ask, err := pir.CreateOrderIntentRequestWithOutbox(askReq, 1e6, "clob.orders", []byte(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	if bid.ProtocolVersion != 2 || bid.QtyShares.String != "4000000" || bid.PriceUsd != 0.6 || bid.PrimarySecondary != "p" || bid.QtyRem != 4 {
		t.Fatalf("unexpected bid row: %+v", bid)
	}
	if ask.PriceUsd != -0.6 {
		t.Fatalf("an ask's legacy price must be negative, got %v", ask.PriceUsd)
	}
	outbox, err := pir.PendingOrderOutbox(100)
	if err != nil || len(outbox) < 2 {
		t.Fatalf("outbox: %v (%d rows)", err, len(outbox))
	}

	match := MatchV2{
		MarketID: marketID, BidTxID: bid.TxID, AskTxID: ask.TxID, MatchID: "0x" + uuid.NewString(),
		FillShares: 4_000_000, ExecutionYesPrice: 600000, YesCollateral: 2_400_000, NoCollateral: 1_600_000,
		BidCollateral: 2_400_000, AskCollateral: 1_600_000, UnitScale: 1e6,
	}
	row, err := mr.CreateMatchV2(match)
	if err != nil || row.Status != "pending" {
		t.Fatalf("create match: %v %+v", err, row)
	}
	again, err := mr.CreateMatchV2(match)
	if err != nil || again.ID != row.ID {
		t.Fatalf("a redelivered match must return the existing row: %v", err)
	}
	if err := mr.MarkMatchSubmitted(match.MatchID, "0.0.9@1700000000.000000001"); err != nil {
		t.Fatal(err)
	}

	applied, err := mr.FinalizeMatchV2(match, "0.0.9@1700000000.000000001")
	if err != nil || !applied {
		t.Fatalf("finalize: applied=%t err=%v", applied, err)
	}
	applied, err = mr.FinalizeMatchV2(match, "0.0.9@1700000000.000000001")
	if err != nil || applied {
		t.Fatalf("a second finalization must change nothing: applied=%t err=%v", applied, err)
	}

	bidAfter, err := pir.GetPredictionIntentByTxId(bid.TxID.String())
	if err != nil {
		t.Fatal(err)
	}
	askAfter, err := pir.GetPredictionIntentByTxId(ask.TxID.String())
	if err != nil {
		t.Fatal(err)
	}
	if bidAfter.SharesFilled != "4000000" || bidAfter.CollateralFilled != "2400000" || !bidAfter.FullyMatchedAt.Valid || bidAfter.QtyRem != 0 {
		t.Fatalf("bid fill state: %+v", bidAfter)
	}
	if askAfter.SharesFilled != "4000000" || askAfter.CollateralFilled != "1600000" || askAfter.FullyMatchedAt.Valid || askAfter.QtyRem != 6 {
		t.Fatalf("ask fill state: %+v", askAfter)
	}
	stored, err := mr.GetMatchByMatchId(match.MatchID)
	if err != nil || stored.Status != "finalized" || stored.FillShares.String != "4000000" || stored.ExecutionYesPrice.Int64 != 600000 {
		t.Fatalf("stored match: %v %+v", err, stored)
	}

	md5 := uuid.NewString()
	args := map[string]interface{}{"marketId": "1", "state": "4"}
	for i, want := range []bool{true, false} {
		inserted, err := scer.CreateEventV2("testnet", "0.0.5555", "MarketStateChanged", args, "0xabc", time.Now(), "host", md5)
		if err != nil || inserted != want {
			t.Fatalf("event insert %d: inserted=%t err=%v", i, inserted, err)
		}
	}

	if err := pir.MarkPredictionIntentAsRedeemedForAccount(marketID.String(), "0x2222222222222222222222222222222222222222"); err != nil {
		t.Fatal(err)
	}
	redeemed, _ := pir.GetPredictionIntentByTxId(bid.TxID.String())
	if !redeemed.RedeemedAt.Valid {
		t.Fatal("redemption must match the stored address regardless of 0x prefix")
	}
	_ = context.Background()
}
