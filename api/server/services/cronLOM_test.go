package services

import "testing"

func TestCalculateOrderSizePoints_BaseAndExecutionBonusAreAdditive(t *testing.T) {
	orderSizeUsd := 100.0
	qtyOrig := 100.0
	qtyRem := 50.0

	got := calculateOrderSizePoints(orderSizeUsd, qtyOrig, qtyRem)
	want := 150.0

	if got != want {
		t.Fatalf("calculateOrderSizePoints(%v, %v, %v) = %v, want %v", orderSizeUsd, qtyOrig, qtyRem, got, want)
	}
}

func TestCalculateOrderSizePoints_ClampsExecutionRatio(t *testing.T) {
	cases := []struct {
		name    string
		order   float64
		qtyOrig float64
		qtyRem  float64
		want    float64
	}{
		{name: "fully executed", order: 100, qtyOrig: 100, qtyRem: 0, want: 200},
		{name: "unmatched remains base size", order: 100, qtyOrig: 100, qtyRem: 100, want: 100},
		{name: "negative ratio clamps to zero", order: 100, qtyOrig: 100, qtyRem: 200, want: 100},
		{name: "ratio over one clamps to one", order: 100, qtyOrig: 0, qtyRem: 0, want: 100},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := calculateOrderSizePoints(tc.order, tc.qtyOrig, tc.qtyRem)
			if got != tc.want {
				t.Fatalf("calculateOrderSizePoints(%v, %v, %v) = %v, want %v", tc.order, tc.qtyOrig, tc.qtyRem, got, tc.want)
			}
		})
	}
}
