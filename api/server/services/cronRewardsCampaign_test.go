package services

import (
	"api/server/lib"
	"testing"
)

func TestRewardsCampaignVestingScheduleUsesExplicitYearlyAllocations(t *testing.T) {
	if got := rewardsCampaignVestingScheduleTotal(); got != RewardsCampaignAllocationAbsolute {
		t.Fatalf("vesting schedule total = %d, want %d", got, RewardsCampaignAllocationAbsolute)
	}

	launch := lib.LaunchDate
	secondYear := launch.AddDate(1, 0, 0)

	if got := rewardsCampaignForYearAtTime(launch); got != 1_000_000 {
		t.Fatalf("rewardsCampaignForYearAtTime(launch) = %v, want %v", got, 1_000_000.0)
	}
	if got := rewardsCampaignForYearAtTime(secondYear.AddDate(0, 0, 31)); got != 0 {
		t.Fatalf("rewardsCampaignForYearAtTime(second year) = %v, want %v", got, 0.0)
	}

	if got := rewardsCampaignPerDayAtTime(launch); got != 1_000_000.0/365.0 {
		t.Fatalf("rewardsCampaignPerDayAtTime(launch) = %v, want %v", got, 1_000_000.0/365.0)
	}
}
