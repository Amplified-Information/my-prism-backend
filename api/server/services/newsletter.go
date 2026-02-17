package services

import (
	pb_api "api/gen"
	"api/server/lib"
	repositories "api/server/repositories"
	"context"
	"fmt"
	"os"
)

type NewsletterService struct {
	dbRepository *repositories.DbRepository
}

func (ns *NewsletterService) Init(d *repositories.DbRepository) error {
	// and inject the DbService:
	ns.dbRepository = d

	lib.Log(lib.LOG_INFO, "Service: Newsletter service initialized successfully")
	return nil
}

func (ns *NewsletterService) SubscribeNewsletter(ctx context.Context, req *pb_api.NewsLetterRequest) (*pb_api.StdResponse, error) {
	ipAddress := lib.GetIPFromContext(ctx)
	userAgent := lib.GetUserAgentFromContext(ctx)
	email := req.GetEmail()

	lib.Log(lib.LOG_INFO, "Subscribing email %s to newsletter from IP %s with User-Agent %s", email, ipAddress, userAgent)

	// TODO - send email to the user inviting them to prism

	// Send notification email to admin:
	err := lib.SendEmail(os.Getenv("EMAIL_ADDRESS"), "New Newsletter Subscription", fmt.Sprintf("Email: %s\nIP Address: %s\nUser-Agent: %s", email, ipAddress, userAgent))
	if err != nil {
		return nil, lib.LogAndError(lib.LOG_ERROR, "failed to send notification email: %v", "internal error" /* err - don't pass the full reason to the user*/)
	}

	err = ns.dbRepository.CreateNewsletterSubscription(email, ipAddress, userAgent)
	if err != nil {
		lib.Log(lib.LOG_ERROR, "Failed to create newsletter subscription for email %s: %v", email, err)
		return &pb_api.StdResponse{
			Message:   "Failed to subscribe to newsletter",
			ErrorCode: 1,
		}, lib.LogAndError(lib.LOG_ERROR, "failed to create newsletter subscription: %v", "internal error" /* err - don't pass the full reason to the user*/)
	}

	return &pb_api.StdResponse{
		Message: "Successfully subscribed to newsletter",
	}, nil
}
