package httpserver

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/19parwiz/user-service/config"
)

type stubPinger struct {
	err error
}

func (s *stubPinger) Ping(ctx context.Context) error {
	return s.err
}

func newTestServer(t *testing.T, db DBPinger) *httptest.Server {
	t.Helper()
	s := &Server{
		cfg: config.HTTPServer{
			Port:           0,
			ReadTimeout:    5 * time.Second,
			WriteTimeout:   5 * time.Second,
			IdleTimeout:    10 * time.Second,
			MaxHeaderBytes: 1 << 20,
		},
		addr: "127.0.0.1:0",
		db:   db,
	}
	return httptest.NewServer(s.routes())
}

func TestHandleLive(t *testing.T) {
	ts := newTestServer(t, nil)
	t.Cleanup(ts.Close)

	res, err := http.Get(ts.URL + "/live")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("live: %d", res.StatusCode)
	}
}

func TestHandleReady_noDB(t *testing.T) {
	ts := newTestServer(t, nil)
	t.Cleanup(ts.Close)

	res, err := http.Get(ts.URL + "/ready")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("ready nil db: %d", res.StatusCode)
	}
}

func TestHandleReady_pingErr(t *testing.T) {
	ts := newTestServer(t, &stubPinger{err: errors.New("down")})
	t.Cleanup(ts.Close)

	res, err := http.Get(ts.URL + "/ready")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("ready ping err: %d", res.StatusCode)
	}
}

func TestHandleReady_ok(t *testing.T) {
	ts := newTestServer(t, &stubPinger{err: nil})
	t.Cleanup(ts.Close)

	res, err := http.Get(ts.URL + "/ready")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("ready ok: %d", res.StatusCode)
	}
}
