package config

import (
	"os"
	"time"

	"github.com/19parwiz/inventory-service/pkg/postgres"
	"github.com/caarlos0/env/v10"
	"github.com/joho/godotenv"
)

type (
		Config struct {
		Postgres postgres.Config
		Server   Server
		Brokers []string `env:"BROKERS"`
		Version string   `env:"VERSION"`
	}

	Server struct {
		HTTPServer HTTPServer
		GRPCServer GRPCServer
	}

	HTTPServer struct {
		Port           int           `env:"HTTP_PORT,required"`
		ReadTimeout    time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"30s"`
		WriteTimeout   time.Duration `env:"HTTP_WRITE_TIMEOUT" envDefault:"30s"`
		IdleTimeout    time.Duration `env:"HTTP_IDLE_TIMEOUT" envDefault:"60s"`
		MaxHeaderBytes int           `env:"HTTP_MAX_HEADER_BYTES" envDefault:"1048576"` // 1 MB
		Mode           string        `env:"GIN_MODE" envDefault:"release"`              // Can be: release, debug, test
	}

	GRPCServer struct {
		Port    int           `env:"GRPC_PORT,required"`
		Timeout time.Duration `env:"GRPC_TIMEOUT" envDefault:"30s"`
	}
)

func New() (*Config, error) {
	// Load local.env.template, then local.env, then .env; later files override earlier ones (missing files skipped).
	for _, name := range []string{"local.env.template", "local.env", ".env"} {
		if _, err := os.Stat(name); err != nil {
			continue
		}
		_ = godotenv.Overload(name)
	}

	var cfg Config
	err := env.Parse(&cfg)

	return &cfg, err
}
