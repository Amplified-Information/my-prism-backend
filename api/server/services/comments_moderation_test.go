package services

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestFindRejectedCategories(t *testing.T) {
	categories := map[string]bool{
		"sexual/minors":          true,
		"hate":                   true,
		"harassment/threatening": true,
	}

	rejected := findRejectedCategories(categories)
	if len(rejected) != 2 {
		t.Fatalf("expected 2 rejected categories, got %d", len(rejected))
	}
	if rejected[0] != "harassment/threatening" || rejected[1] != "sexual/minors" {
		t.Fatalf("unexpected rejected categories: %v", rejected)
	}
}

func TestModerateCommentContentRejectsHardBlockCategory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"categories":{"sexual/minors":true}}]}`))
	}))
	defer server.Close()

	t.Setenv("OPENAI_API_KEY", "test-key")
	t.Setenv("OPENAI_API_BASE_URL", server.URL)

	decision, err := moderateCommentContent(context.Background(), "test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !decision.Rejected {
		t.Fatalf("expected decision to reject")
	}
	if decision.Reason != "sexual/minors" {
		t.Fatalf("expected reason sexual/minors, got %q", decision.Reason)
	}
}

func TestModerateCommentContentAllowsSoftCategory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"categories":{"harassment":true}}]}`))
	}))
	defer server.Close()

	t.Setenv("OPENAI_API_KEY", "test-key")
	t.Setenv("OPENAI_API_BASE_URL", server.URL)

	decision, err := moderateCommentContent(context.Background(), "test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if decision.Rejected {
		t.Fatalf("expected decision to allow")
	}
}

func TestModerateCommentContentProviderFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream error", http.StatusBadGateway)
	}))
	defer server.Close()

	t.Setenv("OPENAI_API_KEY", "test-key")
	t.Setenv("OPENAI_API_BASE_URL", server.URL)

	_, err := moderateCommentContent(context.Background(), "test")
	if err == nil {
		t.Fatalf("expected provider error")
	}
}

func TestModerateCommentContentUnauthorizedFallsOpen(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"invalid api key"}}`))
	}))
	defer server.Close()

	t.Setenv("OPENAI_API_KEY", "test-key")
	t.Setenv("OPENAI_API_BASE_URL", server.URL)

	decision, err := moderateCommentContent(context.Background(), "test")
	if err != nil {
		t.Fatalf("expected no error for unauthorized fall-open, got: %v", err)
	}
	if decision == nil {
		t.Fatalf("expected non-nil moderation decision")
	}
	if decision.Rejected {
		t.Fatalf("expected unauthorized response to pass moderation")
	}
}

func TestModerateCommentContentMissingAPIKey(t *testing.T) {
	_ = os.Unsetenv("OPENAI_API_KEY")
	t.Setenv("OPENAI_API_BASE_URL", "http://localhost:9999")

	_, err := moderateCommentContent(context.Background(), "test")
	if err == nil {
		t.Fatalf("expected missing API key error")
	}
	if err.Error() != fmt.Sprintf("%s", "OPENAI_API_KEY is not configured") {
		t.Fatalf("unexpected error: %v", err)
	}
}
