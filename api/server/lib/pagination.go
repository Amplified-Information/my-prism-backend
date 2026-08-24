package lib

import (
	pb_api "api/gen"
	"os"
	"strconv"
)

// ClampLimit caps a requested page size at DB_MAX_ROWS and returns the limit actually applied.
func ClampLimit(limit int32) int32 {
	if limit <= 0 {
		limit = LIMIT
	}

	maxRows, err := strconv.Atoi(os.Getenv("DB_MAX_ROWS"))
	if err != nil || maxRows <= 0 {
		Log(LOG_WARN, "invalid DB_MAX_ROWS environment variable; falling back to %d", LIMIT)
		maxRows = int(LIMIT)
	}

	if limit > int32(maxRows) {
		Log(LOG_INFO, "limit %d exceeds DB_MAX_ROWS %d, clamping to DB_MAX_ROWS", limit, maxRows)
		limit = int32(maxRows)
	}

	return limit
}

// NewPagination reports the page the caller actually got, so clients can page without
// guessing whether a short page means "end of data" or "limit was clamped".
func NewPagination(limit int32, offset int32, total int64, returned int) *pb_api.PaginationRes {
	consumed := int64(offset) + int64(returned)
	hasMore := consumed < total

	nextOffset := offset
	if hasMore {
		nextOffset = int32(consumed)
	}

	return &pb_api.PaginationRes{
		Limit:      limit,
		Offset:     offset,
		Total:      total,
		HasMore:    hasMore,
		NextOffset: nextOffset,
	}
}
