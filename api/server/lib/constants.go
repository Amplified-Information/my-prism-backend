package lib

import "time"

const (
	MID_MARKET_PRICE           = 0.5
	SUBJECT_CLOB_ORDERS        = "clob.orders"
	NATS_CLOB_MATCHES_SETTLE   = "clob.matches.settle" // one ClobMatch per PrismV2 fill
	NATS_CLOB_CANCEL_ORDERS    = "clob.orders.cancel"
)

const (
	LOG_DEBUG = iota
	LOG_INFO
	LOG_WARN
	LOG_ERROR
	LOG_CRITICAL
)

var VolumeResolutionPeriods = []string{"1h", "24h", "7d", "30d"}

// Order-signing scheme date ranges, reported in MacroMetadata. Clients compare the
// active entry with the scheme they sign and refuse to place orders on a mismatch.
// v2 is the PrismV2 authorization (lib.AuthorizationV2, see docs/PRISM_V2_ORDER_PROTOCOL.md);
// v0 and v1 are the removed floating-point schemes.
// N.B: the index in the array is the version number
var SigSchemeDateRanges = [][2]int64{
	{0, 1763904000},          // v0: 1st Jan 1970 00:00:00 to 23rd Nov 2025 13:20:00
	{1763904000, 1791417600}, // v1: 23rd Nov 2025 13:20:00 to 8th Oct 2026 00:00:00
	{1791417600, 2147483647}, // v2: 8th Oct 2026 00:00:00 to 19th Jan 2038 03:14:07 (max 32-bit int)
}

var LIMIT int32 = 50
var OFFSET int32 = 0

var LaunchDate = time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC)

const TotalNprismTokens = 100_000_000
