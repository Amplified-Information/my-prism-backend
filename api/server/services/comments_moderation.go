package services

import (
	"api/server/lib"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

const (
	openAIModerationModel = "omni-moderation-latest"
	defaultOpenAIBaseURL  = "https://api.openai.com"
)

var commentModerationHTTPClient = &http.Client{}

var hardBlockCategories = []string{
	"sexual/minors",
	"hate/threatening",
	"harassment/threatening",
	"violence/graphic",
	"self-harm/instructions",
}

type moderationDecision struct {
	Rejected bool
	Reason   string
}

type openAIModerationRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type openAIModerationResponse struct {
	Results []struct {
		Categories map[string]bool `json:"categories"`
	} `json:"results"`
}

type openAIErrorResponse struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func moderateCommentContent(ctx context.Context, content string) (*moderationDecision, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY is not configured")
	}

	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("OPENAI_API_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = defaultOpenAIBaseURL
	}

	requestBody, err := json.Marshal(openAIModerationRequest{
		Model: openAIModerationModel,
		Input: content,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal moderation request: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, baseURL+"/v1/moderations", bytes.NewReader(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create moderation request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := commentModerationHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("moderation provider request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("moderation provider returned %d", resp.StatusCode)
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		var providerErr openAIErrorResponse
		if decodeErr := json.NewDecoder(resp.Body).Decode(&providerErr); decodeErr == nil && providerErr.Error.Message != "" {
			lib.Error("OPENAI_API_KEY authentication failed for moderation provider", "statusCode", resp.StatusCode, "detail", providerErr.Error.Message)
		} else {
			lib.Error("OPENAI_API_KEY authentication failed for moderation provider", "statusCode", resp.StatusCode)
		}

		// Fail-open for unauthorized provider responses: do not block commenting.
		return &moderationDecision{Rejected: false}, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var providerErr openAIErrorResponse
		if decodeErr := json.NewDecoder(resp.Body).Decode(&providerErr); decodeErr == nil && providerErr.Error.Message != "" {
			return nil, fmt.Errorf("moderation provider returned %d: %s", resp.StatusCode, providerErr.Error.Message)
		}
		return nil, fmt.Errorf("moderation provider returned %d", resp.StatusCode)
	}

	var response openAIModerationResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode moderation response: %w", err)
	}
	if len(response.Results) == 0 {
		return nil, fmt.Errorf("moderation provider returned no results")
	}

	rejectedCategories := findRejectedCategories(response.Results[0].Categories)
	if len(rejectedCategories) > 0 {
		return &moderationDecision{
			Rejected: true,
			Reason:   strings.Join(rejectedCategories, ", "),
		}, nil
	}

	return &moderationDecision{Rejected: false}, nil
}

func findRejectedCategories(categories map[string]bool) []string {
	if len(categories) == 0 {
		return nil
	}

	blocked := make([]string, 0, len(hardBlockCategories))
	for _, category := range hardBlockCategories {
		if categories[category] {
			blocked = append(blocked, category)
		}
	}

	sort.Strings(blocked)
	return blocked
}
