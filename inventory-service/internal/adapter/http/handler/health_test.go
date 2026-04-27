package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type stubPinger struct {
	err error
}

func (s *stubPinger) Ping(ctx context.Context) error {
	return s.err
}

func TestHealthHandler_Live(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHealthHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	h.Live(c)
	if w.Code != http.StatusOK {
		t.Fatalf("live: got %d want %d", w.Code, http.StatusOK)
	}
}

func TestHealthHandler_Ready_nilDB(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHealthHandler(nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/ready", nil)
	h.Ready(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("ready nil: got %d want %d", w.Code, http.StatusServiceUnavailable)
	}
}

func TestHealthHandler_Ready_pingErr(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHealthHandler(&stubPinger{err: errors.New("down")})
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/ready", nil)
	h.Ready(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("ready err: got %d want %d", w.Code, http.StatusServiceUnavailable)
	}
}

func TestHealthHandler_Ready_ok(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHealthHandler(&stubPinger{err: nil})
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/ready", nil)
	h.Ready(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ready ok: got %d want %d", w.Code, http.StatusOK)
	}
}
