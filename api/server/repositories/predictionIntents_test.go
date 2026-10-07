package repositories

import (
	"database/sql"
	"testing"
	"time"

	sqlc "api/gen/sqlc"
)

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
