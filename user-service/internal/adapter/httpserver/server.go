package httpserver

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/19parwiz/user-service/config"
	"github.com/19parwiz/user-service/pkg/postgres"
)

const addrFmt = "0.0.0.0:%d"

// DBPinger is implemented by *postgres.DB for /ready.
type DBPinger interface {
	Ping(ctx context.Context) error
}

// Server exposes only /live and /ready on HTTP_PORT (gRPC stays separate).
type Server struct {
	cfg  config.HTTPServer
	addr string
	db   DBPinger
	srv  *http.Server
}

func New(cfg config.HTTPServer, db *postgres.DB) *Server {
	var pinger DBPinger
	if db != nil {
		pinger = db
	}
	return &Server{
		cfg:  cfg,
		addr: fmt.Sprintf(addrFmt, cfg.Port),
		db:   pinger,
	}
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/live", s.handleLive)
	mux.HandleFunc("/ready", s.handleReady)
	return mux
}

func (s *Server) handleLive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "", http.StatusMethodNotAllowed)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "", http.StatusMethodNotAllowed)
		return
	}
	if s.db == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) Run(errCh chan<- error) {
	s.srv = &http.Server{
		Addr:              s.addr,
		Handler:           s.routes(),
		ReadTimeout:       s.cfg.ReadTimeout,
		WriteTimeout:      s.cfg.WriteTimeout,
		IdleTimeout:       s.cfg.IdleTimeout,
		MaxHeaderBytes:    s.cfg.MaxHeaderBytes,
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("user-service HTTP (health) listening on %s", s.addr)
		if err := s.srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- fmt.Errorf("health http server: %w", err)
		}
	}()
}

func (s *Server) Stop(ctx context.Context) error {
	if s.srv == nil {
		return nil
	}
	if err := s.srv.Shutdown(ctx); err != nil {
		return fmt.Errorf("health http shutdown: %w", err)
	}
	log.Println("user-service HTTP (health) stopped")
	return nil
}
