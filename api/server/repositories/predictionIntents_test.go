package repositories

import (
	"database/sql"
	"testing"
	"time"

	pb_api "api/gen"
	sqlc "api/gen/sqlc"

	"github.com/google/uuid"
)

func TestCreatePredictionIntentParamsSetsQtyOrigAndQtyRem(t *testing.T) {
	txID := uuid.MustParse("11111111-1111-4111-8111-111111111111")
	marketID := uuid.MustParse("22222222-2222-4222-8222-222222222222")
	generatedAt := time.Unix(1700000000, 0).UTC()

	req := &pb_api.PrismPredictionIntentRequest{
		TxId:             txID.String(),
		Net:              "testnet",
		MarketId:         marketID.String(),
		AccountId:        "0.0.1234",
		PriceUsd:         0.75,
		Qty:              42.5,
		Sig:              "sig",
		PublicKey:        "pubkey",
		EvmAddress:       "0xabc",
		KeyType:          1,
		GeneratedAt:      generatedAt.Format(time.RFC3339),
		PrimarySecondary: "p",
	}

	params := sqlc.CreatePredictionIntentParams{
		TxID:             txID,
		Net:              req.Net,
		MarketID:         marketID,
		AccountID:        req.AccountId,
		PriceUsd:         req.PriceUsd,
		QtyOrig:          req.Qty,
		QtyRem:           req.Qty,
		Sig:              req.Sig,
		GeneratedAt:      generatedAt,
		PublicKeyHex:     req.PublicKey,
		Evmaddress:       req.EvmAddress,
		Keytype:          int32(req.KeyType),
		PrimarySecondary: req.PrimarySecondary,
	}

	if params.QtyOrig != req.Qty {
		t.Fatalf("QtyOrig mismatch: got %v want %v", params.QtyOrig, req.Qty)
	}
	if params.QtyRem != req.Qty {
		t.Fatalf("QtyRem mismatch: got %v want %v", params.QtyRem, req.Qty)
	}
}

func TestIsOpenPredictionIntentExcludesStaleClosedOrZeroQtyRows(t *testing.T) {
	tests := []struct {
		name string
		pi   sqlc.PredictionIntent
		want bool
	}{
		{
			name: "open positive qty",
			pi: sqlc.PredictionIntent{
				QtyRem: 0.25,
			},
			want: true,
		},
		{
			name: "zero qty is not open",
			pi: sqlc.PredictionIntent{
				QtyRem: 0,
			},
			want: false,
		},
		{
			name: "fully matched rows are not open",
			pi: sqlc.PredictionIntent{
				QtyRem:         0.25,
				FullyMatchedAt: sql.NullTime{Time: time.Now(), Valid: true},
			},
			want: false,
		},
		{
			name: "cancelled rows are not open",
			pi: sqlc.PredictionIntent{
				QtyRem:      0.25,
				CancelledAt: sql.NullTime{Time: time.Now(), Valid: true},
			},
			want: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isOpenPredictionIntent(tc.pi); got != tc.want {
				t.Fatalf("isOpenPredictionIntent() = %v, want %v", got, tc.want)
			}
		})
	}
}
