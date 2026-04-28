package config

import (
	"os"
	"time"

	"github.com/caarlos0/env/v10"
	"github.com/joho/godotenv"
)

type Config struct {
	HTTPServer HTTPServer
	Services   Microservices
}

type HTTPServer struct {
	Port           int           `env:"HTTP_PORT,required"`
	ReadTimeout    time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"30s"`
	WriteTimeout   time.Duration `env:"HTTP_WRITE_TIMEOUT" envDefault:"30s"`
	IdleTimeout    time.Duration `env:"HTTP_IDLE_TIMEOUT" envDefault:"60s"`
	MaxHeaderBytes int           `env:"HTTP_MAX_HEADER_BYTES" envDefault:"1048576"`
	Mode           string        `env:"GIN_MODE" envDefault:"release"`
}

type Microservices struct {
	UserService      ServiceConfig `envPrefix:"USER_SERVICE_"`
	InventoryService ServiceConfig `envPrefix:"INVENTORY_SERVICE_"`
	OrderService     ServiceConfig `envPrefix:"ORDER_SERVICE_"`
}

type ServiceConfig struct {
	Host string `env:"HOST,required"`
	Port int    `env:"PORT,required"`
}

func New() (*Config, error) {
	// Load local.env.template, then local.env, then .env; later files override earlier ones (missing files skipped).
	for _, name := range []string{"local.env.template", "local.env", ".env"} {
		if _, err := os.Stat(name); err != nil {
			continue
		}
		_ = godotenv.Overload(name)
	}

	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
