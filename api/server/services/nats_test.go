package services

import (
	"testing"

	pb_clob "api/gen/clob"
)

func TestFullyMatchedOrderIndexFromTupleUsesQtyOrig(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "1", Qty: 0.4, QtyOrig: 1.0},
		{TxId: "2", Qty: 0.4, QtyOrig: 0.4},
	}

	got := fullyMatchedOrderIndexFromTuple(tuple, true)
	want := [2]bool{false, true}
	if got != want {
		t.Fatalf("fullyMatchedOrderIndexFromTuple() = %v, want %v", got, want)
	}
}

func TestFullyMatchedOrderIndexFromTupleMarksBothWhenEqual(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "1", Qty: 0.3, QtyOrig: 0.3},
		{TxId: "2", Qty: 0.3, QtyOrig: 0.3},
	}

	got := fullyMatchedOrderIndexFromTuple(tuple, true)
	want := [2]bool{true, true}
	if got != want {
		t.Fatalf("fullyMatchedOrderIndexFromTuple() = %v, want %v", got, want)
	}
}

func TestFullyMatchedOrderIndexFromTupleUsesSmallerOrigQtyForPartialMatch(t *testing.T) {
	tuple := [2]*pb_clob.CreateOrderRequestClob{
		{TxId: "1", Qty: 0.253981, QtyOrig: 0.253981},
		{TxId: "2", Qty: 0.024392, QtyOrig: 0.024392},
	}

	got := fullyMatchedOrderIndexFromTuple(tuple, true)
	want := [2]bool{false, true}
	if got != want {
		t.Fatalf("fullyMatchedOrderIndexFromTuple() = %v, want %v", got, want)
	}
}
