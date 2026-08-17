package services

import (
	"testing"

	pb_clob "api/gen/clob"
)

func TestFullyMatchedOrderIndexFromTupleUsesResidualQtyNotOrigQty(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "1", QtyRem: 0.4, QtyOrig: 1.0},
		{TxId: "2", QtyRem: 0.4, QtyOrig: 0.4},
	}

	got := fullyMatchedOrderIndexFromTuple(tuple, true)
	want := [2]bool{false, false}
	if got != want {
		t.Fatalf("fullyMatchedOrderIndexFromTuple() = %v, want %v", got, want)
	}
}

func TestFullyMatchedOrderIndexFromTupleMarksBothWhenResidualIsZero(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "1", QtyRem: 0.0, QtyOrig: 0.3},
		{TxId: "2", QtyRem: 0.0, QtyOrig: 0.3},
	}

	got := fullyMatchedOrderIndexFromTuple(tuple, true)
	want := [2]bool{true, true}
	if got != want {
		t.Fatalf("fullyMatchedOrderIndexFromTuple() = %v, want %v", got, want)
	}
}

func TestFullyMatchedOrderIndexFromTupleMarksResidualZeroSideOnly(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "1", QtyRem: 0.0, QtyOrig: 0.253981},
		{TxId: "2", QtyRem: 0.024392, QtyOrig: 0.024392},
	}

	got := fullyMatchedOrderIndexFromTuple(tuple, true)
	want := [2]bool{true, false}
	if got != want {
		t.Fatalf("fullyMatchedOrderIndexFromTuple() = %v, want %v", got, want)
	}
}

func TestValidateMatchTupleInvariantAcceptsBalancedMatch(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "tx-1", MarketId: "market-1", PriceUsd: 0.42, QtyRem: 1.25},
		{TxId: "tx-2", MarketId: "market-1", PriceUsd: -0.42, QtyRem: 1.25},
	}

	if err := validateMatchTupleInvariant(tuple); err != nil {
		t.Fatalf("validateMatchTupleInvariant() unexpected error: %v", err)
	}
}

func TestValidateMatchTupleInvariantUsesMatchedQtyNotOriginalQty(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "tx-1", MarketId: "market-1", PriceUsd: 0.42, QtyOrig: 10.0, QtyRem: 4.0},
		{TxId: "tx-2", MarketId: "market-1", PriceUsd: -0.42, QtyOrig: 4.0, QtyRem: 4.0},
	}

	if err := validateMatchTupleInvariant(tuple); err != nil {
		t.Fatalf("validateMatchTupleInvariant() unexpected error for matched-qty tuple: %v", err)
	}
}

func TestValidateMatchTupleInvariantRejectsQtyMismatch(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "tx-1", MarketId: "market-1", PriceUsd: 0.42, QtyRem: 1.25},
		{TxId: "tx-2", MarketId: "market-1", PriceUsd: -0.42, QtyRem: 1.50},
	}

	if err := validateMatchTupleInvariant(tuple); err == nil {
		t.Fatal("validateMatchTupleInvariant() expected qty mismatch error, got nil")
	}
}

func TestMatchTupleKeyIsOrderIndependent(t *testing.T) {
	tupleA := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "tx-1", MarketId: "market-1", QtyRem: 0.25},
		{TxId: "tx-2", MarketId: "market-1", QtyRem: 0.25},
	}
	tupleB := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "tx-2", MarketId: "market-1", QtyRem: 0.25},
		{TxId: "tx-1", MarketId: "market-1", QtyRem: 0.25},
	}

	if got, want := matchTupleKey(tupleA), matchTupleKey(tupleB); got != want {
		t.Fatalf("matchTupleKey() returned different keys for same match pair: got %q want %q", got, want)
	}
}

func TestMatchTupleKeyDistinguishesResidualQtyChanges(t *testing.T) {
	tupleA := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "tx-1", MarketId: "market-1", QtyRem: 0.250000},
		{TxId: "tx-2", MarketId: "market-1", QtyRem: 0.250000},
	}
	tupleB := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "tx-2", MarketId: "market-1", QtyRem: 0.100000},
		{TxId: "tx-1", MarketId: "market-1", QtyRem: 0.100000},
	}

	if got := matchTupleKey(tupleA); got == matchTupleKey(tupleB) {
		t.Fatalf("matchTupleKey() should distinguish different residual qty states: %q == %q", matchTupleKey(tupleA), matchTupleKey(tupleB))
	}
}
