package main

import (
	// Import the lib package
	"api/server/lib"
	"api/server/services"
	"context"
	"fmt"
	"net"
	"net/http"
	"os"

	pb_api "api/gen"
	repositories "api/server/repositories"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	cron "github.com/robfig/cron/v3"
)

type server struct {
	pb_api.UnimplementedApiServiceInternalServer
	pb_api.UnimplementedApiServicePublicServer
	pb_api.UnimplementedApiAuthServer

	categoriesRepository         repositories.CategoriesRepository
	commentsRepository           repositories.CommentsRepository
	dbRepository                 repositories.DbRepository
	marketsRepository            repositories.MarketsRepository
	matchesRepository            repositories.MatchesRepository
	positionsRepository          repositories.PositionsRepository
	predictionIntentsRepository  repositories.PredictionIntentsRepository
	priceRepository              repositories.PriceRepository
	prismLomRepository           repositories.PrismLomRepository
	prismPointsRepository        repositories.PrismPointsRepository
	smartContractEventRepository repositories.SmartContractEventRepository
	userRoleRepository           repositories.UserRoleRepository

	authService                services.AuthService
	categoriesService          services.CategoriesService
	commentsService            services.CommentsService
	cronKickOutUnfundedService services.CronKickOutUnfundedService
	cronLOMService             services.CronLOMService
	hederaService              services.HederaService
	marketsService             services.MarketsService
	matchesService             services.MatchesService
	natsService                services.NatsService
	newsletterService          services.NewsletterService
	positionsService           services.PositionsService
	predictionIntentsService   services.PredictionIntentsService
	priceService               services.PriceService
	prismService               services.Prism
	prismPointsService         services.PrismPointsService

	// don't forget to register in RegisterApiServiceServer grpc call in main()
}

func (s *server) Health(ctx context.Context, req *pb_api.Empty) (*pb_api.StdResponse, error) {
	return &pb_api.StdResponse{
		Message: "OK",
	}, nil
}

func (s *server) CreatePredictionIntent(ctx context.Context, req *pb_api.PrismPredictionIntentRequest) (*pb_api.StdResponse, error) {
	if err := req.ValidateAll(); err != nil { // PGV validation
		return &pb_api.StdResponse{Message: fmt.Sprintf("Invalid request: %v", err)}, err
	}

	response, err := s.predictionIntentsService.CreatePredictionIntent(req)

	return &pb_api.StdResponse{
		Message: response,
	}, err
}

func (s *server) GetMarketById(ctx context.Context, req *pb_api.MarketIdRequest) (*pb_api.MarketResponse, error) {
	isAdmin := s.authService.HasRole(ctx, lib.ADMIN)

	result, err := s.marketsService.GetMarketById(req.GetMarketId(), isAdmin)
	return result, err
}

func (s *server) GetMarkets(ctx context.Context, req *pb_api.LimitOffsetRequest) (*pb_api.MarketsResponse, error) {
	isAdmin := s.authService.HasRole(ctx, lib.ADMIN)

	result, err := s.marketsService.GetMarkets(req.GetLimit(), req.GetOffset(), isAdmin)
	return result, err
}

// func (s *server) GetCategories(ctx context.Context, req *pb_api.Empty) (*pb_api.CategoriesResponse, error) {
// 	result, err := s.marketsService.GetCategories()
// 	return result, err
// }

func (s *server) CreateMarket(ctx context.Context, req *pb_api.CreateMarketRequest) (*pb_api.CreateMarketResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	result, err := s.marketsService.CreateMarket(req)
	return result, err
}

func (s *server) CreateMarketv2(ctx context.Context, req *pb_api.CreateMarketv2Request) (*pb_api.CreateMarketResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	result, err := s.marketsService.CreateMarketv2(req)
	return result, err
}

func (s *server) PriceHistory(ctx context.Context, req *pb_api.PriceHistoryRequest) (*pb_api.PriceHistoryResponse, error) {
	result, err := s.marketsService.PriceHistory(req)
	return result, err
}

func (s *server) MacroMetadata(ctx context.Context, req *pb_api.Empty) (*pb_api.MacroMetadataResponse, error) {
	result, err := s.prismService.MacroMetadata()
	return result, err
}

func (s *server) GetComments(ctx context.Context, req *pb_api.GetCommentsRequest) (*pb_api.GetCommentsResponse, error) {
	comments, err := s.commentsService.GetComments(req)
	return comments, err
}

func (s *server) CreateComment(ctx context.Context, req *pb_api.CreateCommentRequest) (*pb_api.CreateCommentResponse, error) {
	commentResp, err := s.commentsService.CreateComment(req)
	return commentResp, err
}

func (s *server) NewsLetter(ctx context.Context, req *pb_api.NewsLetterRequest) (*pb_api.StdResponse, error) {
	newsletterResp, err := s.newsletterService.SubscribeNewsletter(ctx, req)
	return newsletterResp, err
}

func (s *server) GetUserPortfolio(ctx context.Context, req *pb_api.UserPortfolioRequest) (*pb_api.UserPortfolioResponse, error) {
	userPortfolioResponse, err := s.positionsService.GetUserPortfolio(req)
	return userPortfolioResponse, err
}

func (s *server) TriggerRecreateClob(ctx context.Context, req *pb_api.Empty) (*pb_api.StdResponse, error) {
	isOK, err := s.prismService.TriggerRecreateClob()

	var errorCode int32 = 0
	if err != nil || isOK == false {
		errorCode = 1
	}

	return &pb_api.StdResponse{
		Message:   "Triggered recreate CLOB",
		ErrorCode: errorCode,
	}, err
}

func (s *server) CancelPredictionIntent(ctx context.Context, req *pb_api.CancelOrderRequest) (*pb_api.StdResponse, error) {
	cancelResp, err := s.predictionIntentsService.CancelPredictionIntent(req.Net, req.MarketId, req.TxId, req.AccountId, req.Sig, req.PublicKey, req.KeyType)
	return cancelResp, err
}

func (s *server) GetTxHashes(ctx context.Context, req *pb_api.TxIdRequest) (*pb_api.TxIdHashesResponse, error) {
	txHashResp, err := s.predictionIntentsService.GetTxHashes(req.TxId)
	return txHashResp, err
}

func (s *server) GetPredictionIntentMatches(ctx context.Context, req *pb_api.GetMatchesRequest) (*pb_api.MatchesResponse, error) {
	matchesResp, err := s.matchesService.GetPredictionIntentMatches(req.MarketId, req.Limit, req.Offset)
	return matchesResp, err
}

func (s *server) GetChallenge(ctx context.Context, req *pb_api.ChallengeRequest) (*pb_api.StdResponse, error) {
	challengesResp, err := s.authService.GetChallenge(req.AccountId, req.Network)
	if err != nil {
		// Do not leak backend error details (e.g. SQL internals) in grpc status text.
		return &pb_api.StdResponse{
			Message:   "Unable to issue challenge",
			ErrorCode: 1,
		}, nil
	}
	return &pb_api.StdResponse{
		Message:   fmt.Sprintf("%d", challengesResp),
		ErrorCode: 0,
	}, err
}

func (s *server) VerifyChallenge(ctx context.Context, req *pb_api.VerifyChallengeRequest) (*pb_api.StdResponse, error) {
	lib.Log(lib.LOG_INFO, "Verifying challenge for accountId: %s on network: %s, payload: %s, sigBase64: %s", req.ChallengeRequest.AccountId, req.ChallengeRequest.Network, req.Payload, req.ChallengeResponseBase64)
	isValid, err := s.authService.VerifyChallenge(req.ChallengeRequest.AccountId, req.ChallengeRequest.Network, req.ChallengeResponseBase64, req.Payload)
	if err != nil {
		return &pb_api.StdResponse{
			ErrorCode: 1,
			Message:   "Error verifying challenge",
		}, err
	}

	if isValid {
		lib.Log(lib.LOG_INFO, "Challenge verified successfully for accountId: %s on network: %s", req.ChallengeRequest.AccountId, req.ChallengeRequest.Network)

		// look up the user's roles on the database:
		userRoles, err := s.authService.GetRoles(ctx, req.ChallengeRequest.AccountId, req.ChallengeRequest.Network)
		if err != nil {
			return &pb_api.StdResponse{
				ErrorCode: 1,
				Message:   "Error getting user's roles",
			}, err
		}

		// Generate JWT token
		claims := map[string]interface{}{
			"accountId": req.ChallengeRequest.AccountId,
			"roles":     userRoles,
			"network":   req.ChallengeRequest.Network,
		}
		jwtToken, err := lib.GenerateJWT(os.Getenv("JWT_SECRET"), claims)
		if err != nil {
			return &pb_api.StdResponse{
				ErrorCode: 1,
				Message:   "Error generating JWT token",
			}, err
		}

		// Inject the JWT token into response header
		grpc.SendHeader(ctx, metadata.Pairs("Authorization", "Bearer "+jwtToken))
		// grpc.SendHeader(ctx, metadata.Pairs("Set-Cookie", "jwt="+jwtToken+"; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600"))
		return &pb_api.StdResponse{
			ErrorCode: 0,
			Message:   "Challenge verified successfully",
		}, nil
	}

	return &pb_api.StdResponse{
		ErrorCode: 1,
		Message:   "Invalid challenge response",
	}, nil
}

func (s *server) GetAllMatches(ctx context.Context, req *pb_api.LimitOffsetRequest) (*pb_api.MatchesResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	allMatches, err := s.matchesService.GetAllMatches(req.Limit, req.Offset)
	if err != nil {
		return nil, err
	}

	return &pb_api.MatchesResponse{
		Matches: allMatches,
	}, nil
}

func (s *server) GetAllPositions(ctx context.Context, req *pb_api.LimitOffsetRequest) (*pb_api.PositionsResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	positions, err := s.positionsService.GetAllPositions(req.Limit, req.Offset)
	if err != nil {
		return nil, err
	}

	return &pb_api.PositionsResponse{
		Positions: positions,
	}, nil
}

func (s *server) GetAllPredictionIntents(ctx context.Context, req *pb_api.LimitOffsetRequest) (*pb_api.PredictionIntentsResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	predictionIntents, err := s.predictionIntentsService.GetAllPredictionIntents(req.Limit, req.Offset)
	if err != nil {
		return nil, err
	}

	return &pb_api.PredictionIntentsResponse{
		PredictionIntents: predictionIntents,
	}, nil
}

func (s *server) ToggleMarketPause(ctx context.Context, req *pb_api.MarketIdRequest) (*pb_api.StdResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	market, err := s.marketsRepository.ToggleMarketPause(req.MarketId)
	if err != nil {
		return nil, err
	}

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   fmt.Sprintf("market.IsPaused: %v", market.IsPaused),
	}, nil
}

func (s *server) ToggleMarketSuspend(ctx context.Context, req *pb_api.MarketIdRequest) (*pb_api.StdResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	market, err := s.marketsRepository.ToggleMarketSuspend(req.MarketId)
	if err != nil {
		return nil, err
	}

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   fmt.Sprintf("market.IsSuspended: %v", market.IsSuspended),
	}, nil
}

func (s *server) UpdateMarket(ctx context.Context, req *pb_api.UpdateMarketRequest) (*pb_api.StdResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	result, err := s.categoriesService.SetCategoriesForMarket(req.MarketId, req.CategoryIds)
	if err != nil {
		return nil, err
	}
	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   fmt.Sprintf("market categories updated: %v", result),
	}, nil
}

func (s *server) PatchMarket(ctx context.Context, req *pb_api.PatchMarketRequest) (*pb_api.MarketResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	result, err := s.marketsService.PatchMarket(req)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *server) DeleteMarket(ctx context.Context, req *pb_api.MarketIdRequest) (*pb_api.StdResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	err := s.marketsService.SoftDeleteMarket(req.MarketId)
	if err != nil {
		return nil, err
	}

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   "Market deleted successfully",
	}, nil
}

func (s *server) DeleteComment(ctx context.Context, req *pb_api.CommentIdRequest) (*pb_api.StdResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	err := s.commentsRepository.DeleteComment(req.CommentId)
	if err != nil {
		return nil, err
	}

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   "Comment deleted successfully",
	}, nil
}

func (s *server) ResolveMarket(ctx context.Context, req *pb_api.ResolveMarketRequest) (*pb_api.StdResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	isOK, err := s.marketsService.ResolveMarket(req.MarketId, req.Outcome)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "market resolution failed", err)
	}

	if !isOK {
		return &pb_api.StdResponse{
			ErrorCode: 1,
			Message:   "market resolution failed",
		}, nil
	}

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   "Market resolved successfully. Prism points allocated to users based on their positions.",
	}, nil
}

func (s *server) CreateCategory(ctx context.Context, req *pb_api.CategoryRequest) (*pb_api.CategoryResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	if req.CategoryId != nil && *req.CategoryId != 0 {
		return nil, lib.LogAndError(lib.LOG_ERROR, "category ID must not be set for CreateCategory")
	}

	// OK

	result, err := s.categoriesService.CreateCategory(req.Name, req.IsActive, req.Description)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "create category failed", err)
	}

	return &pb_api.CategoryResponse{
		Id:          result.ID,
		Name:        result.Name,
		IsActive:    result.IsActive.Bool,
		Description: result.Description.String,
	}, nil
}

func (s *server) UpdateCategory(ctx context.Context, req *pb_api.CategoryRequest) (*pb_api.CategoryResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	if (req.CategoryId == nil) || (*req.CategoryId == 0) {
		return nil, lib.LogAndError(lib.LOG_ERROR, "category ID must be set for UpdateCategory")
	}

	// OK

	result, err := s.categoriesService.UpdateCategory(*req.CategoryId, req.Name, req.IsActive, req.Description)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "update category failed", err)
	}

	return &pb_api.CategoryResponse{
		Id:          result.ID,
		Name:        result.Name,
		IsActive:    result.IsActive.Bool,
		Description: result.Description.String,
	}, nil
}

func (s *server) DeleteCategory(ctx context.Context, req *pb_api.CategoryIdRequest) (*pb_api.StdResponse, error) {
	if !s.authService.HasRole(ctx, lib.ADMIN) { // MUST be ADMIN user
		return nil, lib.LogAndError(lib.LOG_ERROR, "unauthorized: ADMIN role required")
	}

	// OK

	err := s.categoriesService.DeleteCategory(req.CategoryId)
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "delete category failed", err)
	}

	return &pb_api.StdResponse{
		ErrorCode: 0,
		Message:   "Category deleted successfully",
	}, nil
}

func main() {
	lib.InitZapLogger(lib.LOG_INFO)
	fatal := func(msg string, args ...interface{}) {
		lib.Log(lib.LOG_ERROR, msg, args...)
		os.Exit(1)
	}

	// check env vars are available (.config.ENV and .secrets.ENV are loaded):
	vars := []string{
		// keep in sync with main.go, docker-compose-monolith.yml, .config and .secrets and the run command in Dockerfile
		"API_SELF_HOST",
		"API_SELF_PORT",
		"API_SELF_PORT_HEALTH",
		"CLOB_HOST",
		"CLOB_PORT",
		"USDC_DECIMALS",
		"PREVIEWNET_USDC_ADDRESS",
		"TESTNET_USDC_ADDRESS",
		"MAINNET_USDC_ADDRESS",
		"AVAILABLE_NETWORKS",
		"AVAILABLE_NETWORKS_ADMIN",
		"PREVIEWNET_SMART_CONTRACT_ID",
		"PREVIEWNET_HCS_TOPIC_ID",
		"PREVIEWNET_HEDERA_OPERATOR_ID",
		"PREVIEWNET_HEDERA_OPERATOR_KEY_TYPE",
		"PREVIEWNET_PUBLIC_KEY",
		"TESTNET_SMART_CONTRACT_ID",
		"TESTNET_HCS_TOPIC_ID",
		"TESTNET_HEDERA_OPERATOR_ID",
		"TESTNET_HEDERA_OPERATOR_KEY_TYPE",
		"TESTNET_PUBLIC_KEY",
		"MAINNET_SMART_CONTRACT_ID",
		"MAINNET_HCS_TOPIC_ID",
		"MAINNET_HEDERA_OPERATOR_ID",
		"MAINNET_HEDERA_OPERATOR_KEY_TYPE",
		"MAINNET_PUBLIC_KEY",
		"DB_HOST",
		"DB_PORT",
		"DB_UNAME",
		"DB_NAME",
		"DB_MAX_ROWS",
		"NATS_URL",
		"TIMESTAMP_ALLOWED_PAST_SECONDS",
		"TIMESTAMP_ALLOWED_FUTURE_SECONDS",
		"SEND_EMAIL",
		"EMAIL_ADDRESS",
		"SMTP_ENDPOINT",
		"IAM_USERNAME",
		"SMTP_USERNAME",
		"MARKET_CREATION_FEE_USDC",
		"TOKEN_DECIMALS",
		"PREVIEWNET_TOKEN",
		"TESTNET_TOKEN",
		"MAINNET_TOKEN",
		"MIN_ORDER_SIZE_USD",
		"CRON_STR_KICK_UNFUNDED",
		"CRON_STR_LOM",
		"JWT_EXPIRY_HOURS",
		"S3_BUCKET_NAME",
		"S3_AWS_REGION",
		"OPENAI_API_BASE_URL",
		// secrets:
		"DB_PWORD",
		"PREVIEWNET_HEDERA_OPERATOR_KEY",
		"TESTNET_HEDERA_OPERATOR_KEY",
		"MAINNET_HEDERA_OPERATOR_KEY",
		"SMTP_PWORD",
		"JWT_SECRET",
		"OPENAI_API_KEY",
	}
	vals := make(map[string]string)

	var missing []string
	for _, name := range vars {
		if val := os.Getenv(name); val == "" {
			missing = append(missing, name)
		} else {
			vals[name] = val
		}
	}

	if len(missing) > 0 {
		fatal("Missing required environment variables: %v", missing)
	}

	var err error

	/////
	// data layer
	/////

	categoriesRepository := repositories.CategoriesRepository{}
	err = categoriesRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer categoriesRepository.CloseDb()

	commentsRepository := repositories.CommentsRepository{}
	err = commentsRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer commentsRepository.CloseDb()

	dbRepository := repositories.DbRepository{}
	err = dbRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer dbRepository.CloseDb()

	marketsRepository := repositories.MarketsRepository{}
	err = marketsRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer marketsRepository.CloseDb()

	positionsRepository := repositories.PositionsRepository{}
	err = positionsRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer positionsRepository.CloseDb()

	predictionIntentsRepository := repositories.PredictionIntentsRepository{}
	err = predictionIntentsRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer predictionIntentsRepository.CloseDb()

	priceRepository := repositories.PriceRepository{}
	err = priceRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer priceRepository.CloseDb()

	prismLomRepository := repositories.PrismLomRepository{}
	err = prismLomRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer prismLomRepository.CloseDb()

	prismPointsRepository := repositories.PrismPointsRepository{}
	err = prismPointsRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer prismPointsRepository.CloseDb()

	matchesRepository := repositories.MatchesRepository{}
	err = matchesRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer matchesRepository.CloseDb()

	smartContractEventRepository := repositories.SmartContractEventRepository{}
	err = smartContractEventRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer smartContractEventRepository.CloseDb()

	userRoleRepository := repositories.UserRoleRepository{}
	err = userRoleRepository.InitDb()
	if err != nil {
		fatal("Failed to initialize database: %v", err)
	}
	defer userRoleRepository.CloseDb()

	/////
	// service layer
	/////
	// logger initialized above

	// initialize Hedera service
	hederaService := services.HederaService{}
	err = hederaService.InitHedera(&dbRepository, &priceRepository, &marketsRepository, &matchesRepository, &positionsRepository)
	if err != nil {
		fatal("Failed to initialize Hedera service: %v", err)
	}
	// TODO: defer hederaService cleanup

	// initialize Auth service
	authService := services.AuthService{}
	err = authService.Init(&userRoleRepository)
	if err != nil {
		fatal("Failed to initialize Auth service: %v", err)
	}

	// initialize price service
	priceService := services.PriceService{}
	err = priceService.InitPriceService(&priceRepository)
	if err != nil {
		fatal("Failed to initialize Price service: %v", err)
	}

	// initialize Matches service
	matchesService := services.MatchesService{}
	err = matchesService.Init(&matchesRepository, &predictionIntentsRepository)
	if err != nil {
		fatal("Failed to initialize Matches service: %v", err)
	}

	categoriesService := services.CategoriesService{}
	err = categoriesService.Init(&categoriesRepository)
	if err != nil {
		fatal("Failed to initialize Categories service: %v", err)
	}

	// initialize Comments service
	commentsService := services.CommentsService{}
	err = commentsService.Init(&commentsRepository)
	if err != nil {
		fatal("Failed to initialize Comments service: %v", err)
	}

	// initialize Newsletter service
	newsletterService := services.NewsletterService{}
	err = newsletterService.Init(&dbRepository)
	if err != nil {
		fatal("Failed to initialize Newsletter service: %v", err)
	}

	// initialize Positions service
	positionsService := services.PositionsService{}
	err = positionsService.Init(&positionsRepository, &marketsRepository, &predictionIntentsRepository, &prismPointsRepository, &smartContractEventRepository, &hederaService, &priceService)
	if err != nil {
		fatal("Failed to initialize Positions service: %v", err)
	}

	// initialize PrismPoints service
	prismPointsService := services.PrismPointsService{}
	err = prismPointsService.Init(&marketsRepository, &positionsRepository, &prismPointsRepository)
	if err != nil {
		fatal("Failed to initialize PrismPoints service: %v", err)
	}

	// initialize Markets service
	marketsService := services.MarketsService{}
	err = marketsService.Init(&marketsRepository, &hederaService, &priceService, &prismPointsService, &categoriesRepository)
	if err != nil {
		fatal("Failed to initialize Markets service: %v", err)
	}

	// initialize NATS
	natsService := services.NatsService{}
	err = natsService.InitNATS(&hederaService, &dbRepository, &matchesRepository, &predictionIntentsRepository, &smartContractEventRepository)
	if err != nil {
		fatal("Failed to initialize NATS: %v", err)
	}
	defer natsService.CloseNATS()

	// initialize PredictionIntents service
	predictionIntentsService := services.PredictionIntentsService{}
	err = predictionIntentsService.Init(&dbRepository, &marketsRepository, &natsService, &predictionIntentsRepository)
	if err != nil {
		fatal("Failed to initialize PredictionIntents service: %v", err)
	}

	cronKickOutUnfundedService := services.CronKickOutUnfundedService{}
	err = cronKickOutUnfundedService.Init(&marketsRepository, &predictionIntentsRepository, &hederaService, &predictionIntentsService)
	if err != nil {
		fatal("Failed to initialize CronKickOutUnfunded service: %v", err)
	}

	cronLOMService := services.CronLOMService{}
	err = cronLOMService.Init(&marketsRepository, &predictionIntentsRepository, &hederaService, &predictionIntentsService, &priceRepository, &prismLomRepository)
	if err != nil {
		fatal("Failed to initialize CronLOM service: %v", err)
	}

	// initialize prism service
	prismService := services.Prism{}
	err = prismService.InitPrism(&dbRepository, &marketsRepository, &matchesRepository, &natsService, &hederaService, &marketsService, &predictionIntentsService)
	if err != nil {
		fatal("Failed to initialize Prism service: %v", err)
	}
	// TODO: defer prismService cleanup

	// Now start gRPC service
	lis, err := net.Listen("tcp", fmt.Sprintf("%s:%s", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT")))
	if err != nil {
		fatal("Failed to listen: %v", err)
	}

	lib.Log(lib.LOG_INFO, "Smart contract ID (previewnet): %s", os.Getenv("PREVIEWNET_SMART_CONTRACT_ID"))
	lib.Log(lib.LOG_INFO, "Smart contract ID (testnet): %s", os.Getenv("TESTNET_SMART_CONTRACT_ID"))
	lib.Log(lib.LOG_INFO, "Smart contract ID (mainnet): %s", os.Getenv("MAINNET_SMART_CONTRACT_ID"))

	grpcServer := grpc.NewServer(
		// interceptors:
		grpc.UnaryInterceptor(lib.ValidationInterceptor()),
	)
	sharedServer := &server{
		commentsRepository:           commentsRepository,
		categoriesRepository:         categoriesRepository,
		dbRepository:                 dbRepository,
		marketsRepository:            marketsRepository,
		matchesRepository:            matchesRepository,
		positionsRepository:          positionsRepository,
		predictionIntentsRepository:  predictionIntentsRepository,
		priceRepository:              priceRepository,
		prismLomRepository:           prismLomRepository,
		prismPointsRepository:        prismPointsRepository,
		smartContractEventRepository: smartContractEventRepository,
		userRoleRepository:           userRoleRepository,

		authService:                authService,
		categoriesService:          categoriesService,
		commentsService:            commentsService,
		cronKickOutUnfundedService: cronKickOutUnfundedService,
		cronLOMService:             cronLOMService,
		hederaService:              hederaService,
		marketsService:             marketsService,
		matchesService:             matchesService,
		natsService:                natsService,
		newsletterService:          newsletterService,
		positionsService:           positionsService,
		predictionIntentsService:   predictionIntentsService,
		priceService:               priceService,
		prismService:               prismService,
	}
	// must pass the grpc server to bother internal and the public servers!
	pb_api.RegisterApiServiceInternalServer(grpcServer, sharedServer)
	pb_api.RegisterApiServicePublicServer(grpcServer, sharedServer)
	pb_api.RegisterApiAuthServer(grpcServer, sharedServer)

	// NATS start listening
	natsService.HandleOrderMatches()
	natsService.HandleSmartContractEvents()

	// start cron jobs:
	c := cron.New(cron.WithSeconds())

	_, err = c.AddFunc(os.Getenv("CRON_STR_KICK_UNFUNDED"), cronKickOutUnfundedService.CronJob)
	if err != nil {
		fatal("Failed to schedule cron job: %v", err)
	}

	_, err = c.AddFunc(os.Getenv("CRON_STR_LOM"), cronLOMService.CronJob)
	if err != nil {
		fatal("Failed to schedule cron job: %v", err)
	}

	c.Start()
	defer c.Stop()

	// net, err := hiero.LedgerIDFromString("testnet")
	// if err != nil {
	// 	fatal("Failed to get ledger ID: %v", err)
	// }
	// yes, no, err := hederaService.GetUserPositionTokenBalance(*net, "019c7644-76f5-77f0-bfe4-f72f22131675", "0x440a1d7af93b92920bce50b4c0d2a8e6dcfebfd6")
	// if err != nil {
	// 	fatal("Failed to get user position token balance: %v", err)
	// }
	// lib.Log(lib.LOG_INFO, "User position token balance - yes: %d, no: %d", yes, no)

	// Start a HTTP health check server on port 8889
	go func() {
		// Use a dedicated mux so debug handlers (e.g. pprof) are never exposed
		// on this public-facing health listener via the default mux.
		healthMux := http.NewServeMux()
		healthMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(200)
			w.Write([]byte("200"))
		})
		lib.Log(lib.LOG_INFO, "HTTP health endpoint running on %s:%s/health", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT_HEALTH"))
		if err := http.ListenAndServe(fmt.Sprintf("%s:%s", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT_HEALTH")), healthMux); err != nil {
			fatal("Failed to start HTTP health endpoint: %v", err)
		}
	}()

	lib.Log(lib.LOG_INFO, "gRPC server running on %s:%s", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT"))
	if err := grpcServer.Serve(lis); err != nil {
		fatal("Failed to serve: %v", err)
	}
	// TODO: defer grpcService cleanup
}
