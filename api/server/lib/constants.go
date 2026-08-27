package lib

import "time"

const (
	MID_MARKET_PRICE           = 0.5
	SUBJECT_CLOB_ORDERS        = "clob.orders"
	NATS_CLOB_MATCHES_FULL     = "clob.matches.full"
	NATS_CLOB_MATCHES_PARTIAL  = "clob.matches.partial"
	NATS_CLOB_MATCHES_WILDCARD = "clob.matches.*"
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

// the sig scheme date ranges are used to determine which signature scheme to use for a given timestamp
// see: lib/sign.go/AssemblePayloadHexForSigning
// N.B: the index in the array is the version number
var SigSchemeDateRanges = [][2]int64{
	{0, 1763904000},          // v0: 1st Jan 1970 00:00:00 to 22nd Mar 2026 00:00:00
	{1763904000, 2147483647}, // v1: 22nd Mar 2026 00:00:00 to 19th Jan 2038 03:14:07 (max 32-bit int)
}

var LIMIT int32 = 50
var OFFSET int32 = 0

var LaunchDate = time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC)

const TotalNprismTokens = 100_000_000
