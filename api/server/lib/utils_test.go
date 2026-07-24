package lib

import (
	"testing"
	"time"
)

func TestParseDuration(t *testing.T) {
	tests := []struct {
		name     string
		period   string
		expected time.Duration
	}{
		{"one hour", "1h", 1 * time.Hour},
		{"twenty four hours", "24h", 24 * time.Hour},
		{"seven days", "7d", 7 * 24 * time.Hour},
		{"thirty days", "30d", 30 * 24 * time.Hour},
		{"empty string", "", 0},
		{"unsupported period", "1w", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseDuration(tt.period)
			if got != tt.expected {
				t.Errorf("ParseDuration(%q) = %v, want %v", tt.period, got, tt.expected)
			}
		})
	}
}
