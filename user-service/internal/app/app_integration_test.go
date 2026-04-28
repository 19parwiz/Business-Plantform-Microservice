//go:build integration

package app

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/19parwiz/user-service/pkg/postgres"
	"github.com/stretchr/testify/require"
)

// integrationPostgresConfig returns connection settings for a real Postgres instance.
// Uses USER_SERVICE_TEST_POSTGRES_* env vars when set; otherwise defaults match repo docker-compose.
func integrationPostgresConfig(t *testing.T) postgres.Config {
	t.Helper()

	host := getenvDefault("USER_SERVICE_TEST_POSTGRES_HOST", "127.0.0.1")
	port := getenvDefaultInt(t, "USER_SERVICE_TEST_POSTGRES_PORT", 5432)
	db := getenvDefault("USER_SERVICE_TEST_POSTGRES_DB", "flower_shop")
	user := getenvDefault("USER_SERVICE_TEST_POSTGRES_USER", "postgres")
	pass := getenvDefault("USER_SERVICE_TEST_POSTGRES_PASSWORD", "postgres")
	ssl := getenvDefault("USER_SERVICE_TEST_POSTGRES_SSLMODE", "disable")

	testLog(t, "CONFIG", fmt.Sprintf("Postgres target: host=%s port=%d db=%s user=%s sslmode=%s", host, port, db, user, ssl))
	testLog(t, "CONFIG", "Password source: "+describeEnvPresence("USER_SERVICE_TEST_POSTGRES_PASSWORD"))

	return postgres.Config{
		Host:     host,
		Port:     port,
		Database: db,
		User:     user,
		Password: pass,
		SSLMode:  ssl,
	}
}

func describeEnvPresence(key string) string {
	if os.Getenv(key) != "" {
		return fmt.Sprintf("%s is set (value hidden)", key)
	}
	return fmt.Sprintf("%s unset — using docker-compose-style default", key)
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getenvDefaultInt(t *testing.T, key string, def int) int {
	t.Helper()
	if v := os.Getenv(key); v != "" {
		n, err := strconv.Atoi(v)
		require.NoError(t, err, "parse int env %s", key)
		return n
	}
	return def
}

func TestNewApp_Integration_PostgresAndStop(t *testing.T) {
	suppressStdLog(t)

	testLog(t, "SETUP", "Goal: full NewApp wiring against a real Postgres, then clean shutdown via Stop().")
	testLog(t, "SETUP", "Requires: go test -tags=integration ./internal/app -v")
	testLog(t, "SETUP", "If Postgres is down or credentials differ, this test skips (does not fail).")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pg := integrationPostgresConfig(t)
	cfg := testConfig()
	cfg.Postgres = pg

	testLog(t, "ACT", "NewApp: connect, migrate schema, build gRPC + usecase stack.")
	appInstance, err := NewApp(ctx, cfg)
	if err != nil {
		t.Skipf("[SKIP] Postgres not usable (start DB or set USER_SERVICE_TEST_POSTGRES_*): %v", err)
	}
	require.NotNil(t, appInstance)
	testLog(t, "ASSERT", "NewApp returned a non-nil *App.")

	t.Cleanup(func() {
		testLog(t, "TEARDOWN", "App.Stop(): gRPC graceful stop + DB pool close.")
		appInstance.Stop()
		testLog(t, "DONE", "OK: integration wiring and shutdown completed.")
	})
}
