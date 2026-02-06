package main

import (
	// Import the lib package
	"api/server/services"
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	pb_api "api/gen"
	repositories "api/server/repositories"

	"google.golang.org/grpc"

	cron "github.com/robfig/cron/v3"
)

type server struct {
	pb_api.UnimplementedApiServiceInternalServer
	pb_api.UnimplementedApiServicePublicServer

	commentsRepository          repositories.CommentsRepository
	dbRepository                repositories.DbRepository
	marketsRepository           repositories.MarketsRepository
	matchesRepository           repositories.MatchesRepository
	positionsRepository         repositories.PositionsRepository
	predictionIntentsRepository repositories.PredictionIntentsRepository
	priceRepository             repositories.PriceRepository

	commentsService          services.CommentsService
	cronService              services.CronService
	hederaService            services.HederaService
	logService               services.LogService
	marketsService           services.MarketsService
	natsService              services.NatsService
	newsletterService        services.NewsletterService
	positionsService         services.PositionsService
	predictionIntentsService services.PredictionIntentsService
	prismService             services.Prism
	priceService             services.PriceService

	// don't forget to register in RegisterApiServiceServer grpc call in main()
}

func (s *server) Health(ctx context.Context, req *pb_api.Empty) (*pb_api.StdResponse, error) {
	return &pb_api.StdResponse{
		Message: "OK",
	}, nil
}

func (s *server) CreatePredictionIntent(ctx context.Context, req *pb_api.PredictionIntentRequest) (*pb_api.StdResponse, error) {
	if err := req.ValidateAll(); err != nil { // PGV validation
		return &pb_api.StdResponse{Message: fmt.Sprintf("Invalid request: %v", err)}, err
	}

	response, err := s.predictionIntentsService.CreatePredictionIntent(req)

	return &pb_api.StdResponse{
		Message: response,
	}, err
}

func (s *server) GetMarketById(ctx context.Context, req *pb_api.MarketIdRequest) (*pb_api.MarketResponse, error) {
	result, err := s.marketsService.GetMarketById(req.GetMarketId())
	return result, err
}

func (s *server) GetMarkets(ctx context.Context, req *pb_api.LimitOffsetRequest) (*pb_api.MarketsResponse, error) {
	result, err := s.marketsService.GetMarkets(req.GetLimit(), req.GetOffset())
	return result, err
}

func (s *server) CreateMarket(ctx context.Context, req *pb_api.CreateMarketRequest) (*pb_api.CreateMarketResponse, error) {
	result, err := s.marketsService.CreateMarket(req)
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
	cancelResp, err := s.predictionIntentsService.CancelPredictionIntent(req.MarketId, req.TxId)
	return cancelResp, err
}

func main() {
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
		"PREVIEWNET_SMART_CONTRACT_ID",
		"PREVIEWNET_HEDERA_OPERATOR_ID",
		"PREVIEWNET_HEDERA_OPERATOR_KEY_TYPE",
		"PREVIEWNET_PUBLIC_KEY",
		"TESTNET_SMART_CONTRACT_ID",
		"TESTNET_HEDERA_OPERATOR_ID",
		"TESTNET_HEDERA_OPERATOR_KEY_TYPE",
		"TESTNET_PUBLIC_KEY",
		"MAINNET_SMART_CONTRACT_ID",
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
		"PREVIEWNET_TOKEN",
		"TESTNET_TOKEN",
		"MAINNET_TOKEN",
		"MIN_ORDER_SIZE_USD",
		// secrets:
		"DB_PWORD",
		"PREVIEWNET_HEDERA_OPERATOR_KEY",
		"TESTNET_HEDERA_OPERATOR_KEY",
		"MAINNET_HEDERA_OPERATOR_KEY",
		"SMTP_PWORD",
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
		log.Fatalf("Missing required environment variables: %v", missing)
	}

	var err error

	/////
	// data layer
	/////
	// initialize database
	commentsRepository := repositories.CommentsRepository{}
	err = commentsRepository.InitDb()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer commentsRepository.CloseDb()

	dbRepository := repositories.DbRepository{}
	err = dbRepository.InitDb()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer dbRepository.CloseDb()

	marketsRepository := repositories.MarketsRepository{}
	err = marketsRepository.InitDb()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer marketsRepository.CloseDb()

	positionsRepository := repositories.PositionsRepository{}
	err = positionsRepository.InitDb()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer positionsRepository.CloseDb()

	predictionIntentsRepository := repositories.PredictionIntentsRepository{}
	err = predictionIntentsRepository.InitDb()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer predictionIntentsRepository.CloseDb()

	priceRepository := repositories.PriceRepository{}
	err = priceRepository.InitDb()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer priceRepository.CloseDb()

	matchesRepository := repositories.MatchesRepository{}
	err = matchesRepository.InitDb()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer matchesRepository.CloseDb()

	/////
	// service layer
	/////
	// initialize Log service
	logService := services.LogService{}
	logService.InitLogger(services.INFO)

	// initialize Hedera service
	hederaService := services.HederaService{}
	err = hederaService.InitHedera(&logService, &dbRepository, &priceRepository, &marketsRepository, &matchesRepository)
	if err != nil {
		log.Fatalf("Failed to initialize Hedera service: %v", err)
	}
	// TODO: defer hederaService cleanup

	// initialize price service
	priceService := services.PriceService{}
	err = priceService.InitPriceService(&logService, &priceRepository)
	if err != nil {
		log.Fatalf("Failed to initialize Price service: %v", err)
	}

	// initialize Markets service
	marketsService := services.MarketsService{}
	err = marketsService.Init(&logService, &marketsRepository, &hederaService, &priceService)
	if err != nil {
		log.Fatalf("Failed to initialize Markets service: %v", err)
	}

	// initialize Comments service
	commentsService := services.CommentsService{}
	err = commentsService.Init(&logService, &commentsRepository)
	if err != nil {
		log.Fatalf("Failed to initialize Comments service: %v", err)
	}

	// initialize Newsletter service
	newsletterService := services.NewsletterService{}
	err = newsletterService.Init(&logService, &dbRepository)
	if err != nil {
		log.Fatalf("Failed to initialize Newsletter service: %v", err)
	}

	// initialize Positions service
	positionsService := services.PositionsService{}
	err = positionsService.Init(&logService, &positionsRepository, &marketsRepository, &predictionIntentsRepository, &priceService)
	if err != nil {
		log.Fatalf("Failed to initialize Positions service: %v", err)
	}

	// initialize NATS
	natsService := services.NatsService{}
	err = natsService.InitNATS(&logService, &hederaService, &dbRepository, &matchesRepository, &predictionIntentsRepository)
	if err != nil {
		log.Fatalf("Failed to initialize NATS: %v", err)
	}
	defer natsService.CloseNATS()
	// NATS start listening for matches
	natsService.HandleOrderMatches()

	// initialize PredictionIntents service
	predictionIntentsService := services.PredictionIntentsService{}
	err = predictionIntentsService.Init(&logService, &dbRepository, &marketsRepository, &natsService, &hederaService, &predictionIntentsRepository)
	if err != nil {
		log.Fatalf("Failed to initialize PredictionIntents service: %v", err)
	}

	cronService := services.CronService{}
	err = cronService.Init(&logService, &marketsRepository, &predictionIntentsRepository, &hederaService, &predictionIntentsService)
	if err != nil {
		log.Fatalf("Failed to initialize Cron service: %v", err)
	}

	// initialize prism service
	prismService := services.Prism{}
	err = prismService.InitPrism(&logService, &dbRepository, &marketsRepository, &matchesRepository, &natsService, &hederaService, &marketsService, &predictionIntentsService)
	if err != nil {
		log.Fatalf("Failed to initialize Prism service: %v", err)
	}
	// TODO: defer prismService cleanup

	// Now start gRPC service
	lis, err := net.Listen("tcp", fmt.Sprintf("%s:%s", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT")))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	log.Printf("Smart contract ID (previewnet): %s", os.Getenv("PREVIEWNET_SMART_CONTRACT_ID"))
	log.Printf("Smart contract ID (testnet): %s", os.Getenv("TESTNET_SMART_CONTRACT_ID"))
	log.Printf("Smart contract ID (mainnet): %s", os.Getenv("MAINNET_SMART_CONTRACT_ID"))

	grpcServer := grpc.NewServer()
	sharedServer := &server{
		commentsRepository:          commentsRepository,
		dbRepository:                dbRepository,
		marketsRepository:           marketsRepository,
		matchesRepository:           matchesRepository,
		positionsRepository:         positionsRepository,
		predictionIntentsRepository: predictionIntentsRepository,
		priceRepository:             priceRepository,

		commentsService:          commentsService,
		cronService:              cronService,
		hederaService:            hederaService,
		logService:               logService,
		marketsService:           marketsService,
		natsService:              natsService,
		newsletterService:        newsletterService,
		positionsService:         positionsService,
		predictionIntentsService: predictionIntentsService,
		priceService:             priceService,
		prismService:             prismService,
	}
	// must pass the grpc server to bother internal and the public servers!
	pb_api.RegisterApiServiceInternalServer(grpcServer, sharedServer)
	pb_api.RegisterApiServicePublicServer(grpcServer, sharedServer)

	// start a cron job
	c := cron.New(cron.WithSeconds())
	_, err = c.AddFunc("0 * * * * *", cronService.CronJob) // Every minute on the minute
	if err != nil {
		log.Fatalf("Failed to schedule cron job: %v", err)
	}
	c.Start()
	defer c.Stop()
	cronService.KickOutOrderIntentsNotBackedByFunds()

	// Start a HTTP health check server on port 8889
	go func() {
		http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(200)
			w.Write([]byte("200"))
		})
		log.Printf("✅ HTTP health endpoint running on %s:%s/health", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT_HEALTH"))
		if err := http.ListenAndServe(fmt.Sprintf("%s:%s", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT_HEALTH")), nil); err != nil {
			log.Fatalf("Failed to start HTTP health endpoint: %v", err)
		}
	}()

	log.Printf("✅ gRPC server running on %s:%s", os.Getenv("API_SELF_HOST"), os.Getenv("API_SELF_PORT"))
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
	// TODO: defer grpcService cleanup
}
