package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"testing"
	"time"

	"github.com/19parwiz/user-service/config"
	"github.com/19parwiz/user-service/internal/adapter/grpc"
	"github.com/19parwiz/user-service/internal/domain"
	"github.com/19parwiz/user-service/internal/usecase"
	"github.com/19parwiz/user-service/pkg/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testLog prints one readable line per step. Use: go test ./internal/app -v
func testLog(t *testing.T, phase, msg string) {
	t.Helper()
	t.Logf("[%s] %s", phase, msg)
}

// suppressStdLog hides global log.Printf/log.Println from app, grpc, and postgres
// so test output stays step-oriented. Restore on cleanup.
func suppressStdLog(t *testing.T) {
	t.Helper()
	prev := log.Writer()
	log.SetOutput(io.Discard)
	t.Cleanup(func() {
		log.SetOutput(prev)
	})
}

// --- minimal usecase mocks (same roles as internal/usecase tests) ---

type testAutoIncRepo struct{}

func (testAutoIncRepo) Next(ctx context.Context, key string) (uint64, error) {
	return 1, nil
}

type testUserRepo struct {
	users map[string]domain.User
}

func (m *testUserRepo) Create(ctx context.Context, user domain.User) error {
	m.users[user.Email] = user
	return nil
}

func (m *testUserRepo) GetWithFilter(ctx context.Context, filter domain.UserFilter) (domain.User, error) {
	if filter.Email != nil {
		if user, ok := m.users[*filter.Email]; ok {
			return user, nil
		}
	}
	return domain.User{}, errors.New("user not found")
}

func (m *testUserRepo) Delete(ctx context.Context, filter domain.UserFilter) error {
	return errors.New("not implemented")
}

func (m *testUserRepo) Update(ctx context.Context, filter domain.UserFilter, update domain.UserUpdate) error {
	return errors.New("not implemented")
}

type testHasher struct{}

func (testHasher) Hash(password string) (string, error) {
	return "hashed_" + password, nil
}

func (testHasher) Verify(hash, password string) bool {
	return hash == "hashed_"+password
}

type testMailer struct{}

func (testMailer) SendEmail(to []string, subject, body string) error {
	return nil
}

func testConfig() *config.Config {
	return &config.Config{
		Postgres: postgres.Config{
			Host:     "127.0.0.1",
			Port:     5432,
			Database: "flower_shop",
			User:     "postgres",
			Password: "postgres",
			SSLMode:  "disable",
		},
		Server: config.Server{
			HTTPServer: config.HTTPServer{Port: 18080},
			GRPCServer: config.GRPCServer{Port: 0},
		},
		SMTP: config.SMTPConfig{
			Host:     "127.0.0.1",
			Port:     25,
			Username: "test",
			Password: "test",
		},
		App: config.App{PublicBaseURL: "http://localhost:3000"},
	}
}

func TestNewApp_ContextCanceled(t *testing.T) {
	suppressStdLog(t)

	testLog(t, "SETUP", "Goal: prove NewApp fails fast when the context is already canceled (no real DB needed). Std library logs from dependencies are suppressed for readable output.")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	testLog(t, "ACT", "Calling NewApp with canceled context (DB dial/ping should not succeed).")

	_, err := NewApp(ctx, testConfig())

	testLog(t, "ASSERT", "Expect a non-nil error wrapping the DB connection failure.")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "error connecting to DB")
	testLog(t, "DONE", fmt.Sprintf("OK: got expected error: %q", err.Error()))
}

func TestApp_Stop_GrpcWithoutDB(t *testing.T) {
	suppressStdLog(t)

	testLog(t, "SETUP", "Goal: exercise App.Stop when only gRPC is running (pgDB nil). gRPC must call Serve before GracefulStop.")
	cfg := testConfig()
	testLog(t, "SETUP", "Building UserUsecase with in-memory mocks (no Postgres).")

	uc := usecase.NewUserUsecase(
		&testAutoIncRepo{},
		&testUserRepo{users: make(map[string]domain.User)},
		&testHasher{},
		&testMailer{},
		cfg.App.PublicBaseURL,
	)
	srv := grpc.New(cfg.Server, uc)
	testLog(t, "SETUP", "gRPC port is 0 (ephemeral); server will pick a free port.")

	errCh := make(chan error, 1)
	testLog(t, "ACT", "Starting gRPC server in the background (grpc.ServerAPI.Run).")
	srv.Run(errCh)

	testLog(t, "WAIT", "Waiting up to 150ms for immediate listen errors, or continuing if the server is listening.")
	select {
	case err := <-errCh:
		require.NoError(t, err, "gRPC server should listen on an ephemeral port")
	case <-time.After(150 * time.Millisecond):
		testLog(t, "WAIT", "No early error: assuming gRPC is serving on an ephemeral port.")
	}

	a := &App{
		grpcServer: srv,
		pgDB:       nil,
	}

	testLog(t, "ACT", "Calling App.Stop() (should stop gRPC; no pool to close).")
	assert.NotPanics(t, func() {
		a.Stop()
	})
	testLog(t, "DONE", "OK: Stop completed without panic; gRPC lifecycle is consistent with a nil DB handle.")
}
