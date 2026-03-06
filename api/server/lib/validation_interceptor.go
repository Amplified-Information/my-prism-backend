package lib

import (
	"context"

	"google.golang.org/grpc"
)

// ValidationInterceptor checks for Validate() method and logs validation errors centrally
func ValidationInterceptor() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		if v, ok := req.(interface{ Validate() error }); ok {
			if err := v.Validate(); err != nil {
				return nil, LogAndError(LOG_ERROR, "Validation error in %s: %v", info.FullMethod, err)
			}
		}
		return handler(ctx, req)
	}
}
