package lib

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
)

var VolumeResolutionPeriods = []string{"1h", "24h", "7d", "30d"}
