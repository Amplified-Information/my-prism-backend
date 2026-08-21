package lib

import (
	"math"
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

func TestCronJobsPerDay(t *testing.T) {
	tests := []struct {
		name     string
		cronStr  string
		expected float64
		margin   float64
	}{
		{"once-per-week", "0 0 0 * * 0", 1.0 / 7.0, 0.01},
		{"once-per-day", "0 0 0 * * *", 1, 0.0001},
		{"once-per-hour", "0 0 * * * *", 24, 0.0001},
		{"every-30-minutes", "0 */30 * * * *", 48, 0.0001},
		{"every-minute", "0 * * * * *", 1440, 0.0001},
		{"every-second", "* * * * * *", 86400, 0.01},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := CronJobsPerDay(tt.cronStr)
			if err != nil {
				t.Fatalf("CronJobsPerDay(%q) returned error: %v", tt.cronStr, err)
			}
			if math.Abs(got-tt.expected) > tt.margin {
				t.Fatalf("CronJobsPerDay(%q) = %v, want approx %v (margin %v)", tt.cronStr, got, tt.expected, tt.margin)
			}
		})
	}
}
