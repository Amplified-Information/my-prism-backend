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

var TotalNprismTokens = 100_000_000

var LaunchDate = time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC)

// prism points configuration:
var Seasons = [][2]int64{
	{1764374400, 1772419199}, // season 0: 1st Apr 2026 00:00:00 to 30th Jun 2026 23:59:59
	{1772419200, 1780377599}, // season 1: 1st Jul 2026 00:00:00 to 30th Sep 2026 23:59:59
	{1780377600, 1788326399}, // season 2: 1st Oct 2026 00:00:00 to 31st Dec 2026 23:59:59
	{1788326400, 1796207999}, // season 3: 1st Jan 2027 00:00:00 to 31st Mar 2027 23:59:59
	{1796208000, 1804089599}, // season 4: 1st Apr 2027 00:00:00 to 30th Jun 2027 23:59:59
}

// the sig scheme date ranges are used to determine which signature scheme to use for a given timestamp
// see: lib/sign.go/AssemblePayloadHexForSigning
// N.B: the index in the array is the version number
var SigSchemeDateRanges = [][2]int64{
	{0, 1763904000},          // v0: 1st Jan 1970 00:00:00 to 22nd Mar 2026 00:00:00
	{1763904000, 2147483647}, // v1: 22nd Mar 2026 00:00:00 to 19th Jan 2038 03:14:07 (max 32-bit int)
}

var LIMIT int32 = 100
var OFFSET int32 = 0
