package services

import (
	"math/big"
	"testing"

	pb_clob "api/gen/clob"
)

func TestMatchedSettlementAmountsUsesExecutedResidualQuantity(t *testing.T) {
	sideYes := &pb_clob.CreateOrderRequestClob{PriceUsd: 0.05, QtyOrig: 1.0, QtyRem: 0.6}
	sideNo := &pb_clob.CreateOrderRequestClob{PriceUsd: -0.05, QtyOrig: 1.0, QtyRem: 0.6}

	settlementYes, settlementNo, err := matchedSettlementAmounts(sideYes, sideNo, 0.6, 6)
	if err != nil {
		t.Fatalf("matchedSettlementAmounts() unexpected error: %v", err)
	}

	want := big.NewInt(30000)
	if settlementYes.Cmp(want) != 0 || settlementNo.Cmp(want) != 0 {
		t.Fatalf("matchedSettlementAmounts() = (%s, %s), want (30000, 30000)", settlementYes, settlementNo)
	}
}

func TestMatchedSettlementAmountsBoundsUnequalPriceByCommonNotional(t *testing.T) {
	sideYes := &pb_clob.CreateOrderRequestClob{PriceUsd: 0.06, QtyOrig: 1.0, QtyRem: 0.5}
	sideNo := &pb_clob.CreateOrderRequestClob{PriceUsd: -0.05, QtyOrig: 1.0, QtyRem: 0.5}

	settlementYes, settlementNo, err := matchedSettlementAmounts(sideYes, sideNo, 0.5, 6)
	if err != nil {
		t.Fatalf("matchedSettlementAmounts() unexpected error: %v", err)
	}

	want := big.NewInt(25000)
	if settlementYes.Cmp(want) != 0 || settlementNo.Cmp(want) != 0 {
		t.Fatalf("matchedSettlementAmounts() = (%s, %s), want (25000, 25000)", settlementYes, settlementNo)
	}
}
