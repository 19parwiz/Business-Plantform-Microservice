package app

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/19parwiz/user-service/config"
	"github.com/19parwiz/user-service/internal/adapter/grpc"
	"github.com/19parwiz/user-service/internal/adapter/httpserver"
	"github.com/19parwiz/user-service/internal/adapter/mail"
	postgresRepo "github.com/19parwiz/user-service/internal/adapter/postgres"
	"github.com/19parwiz/user-service/internal/usecase"
	"github.com/19parwiz/user-service/pkg/hashing"
	postgresConn "github.com/19parwiz/user-service/pkg/postgres"
)

const serviceName = "user-service"

type App struct {
	httpHealth *httpserver.Server
	grpcServer *grpc.ServerAPI
	pgDB       *postgresConn.DB
}

func NewApp(ctx context.Context, cfg *config.Config) (*App, error) {
	log.Printf(fmt.Sprintf("Initializing %s service...", serviceName))

	log.Println("Connecting to DB:", cfg.Postgres.Database)
	pgDB, err := postgresConn.NewDB(ctx, cfg.Postgres)
	if err != nil {
		return nil, fmt.Errorf("error connecting to DB: %v", err)
	}

	aiRepo := postgresRepo.NewAutoInc(pgDB.Pool)
	userRepo := postgresRepo.NewUserRepo(pgDB.Pool)

	hasher := hashing.NewBcryptHasher()

	// Initialize the mailer here
	mailer := mail.NewMailer(
		cfg.SMTP.Host,
		cfg.SMTP.Port,
		cfg.SMTP.Username,
		cfg.SMTP.Password,
	)

	userUsecase := usecase.NewUserUsecase(aiRepo, userRepo, hasher, mailer, cfg.App.PublicBaseURL)

	grpcServer := grpc.New(cfg.Server, userUsecase)
	httpHealth := httpserver.New(cfg.Server.HTTPServer, pgDB)

	app := &App{
		httpHealth: httpHealth,
		grpcServer: grpcServer,
		pgDB:       pgDB,
	}

	return app, nil
}

func (app *App) Start() error {
	errCh := make(chan error)

	app.httpHealth.Run(errCh)
	app.grpcServer.Run(errCh)

	log.Printf(fmt.Sprintf("Starting %s service!", serviceName))

	shutdownCh := make(chan os.Signal, 1)
	signal.Notify(shutdownCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case errRun := <-errCh:
		return errRun
	case sig := <-shutdownCh:
		log.Printf(fmt.Sprintf("Received shutdown signal: %s", sig.String()))
		app.Stop()
		log.Printf(fmt.Sprintf("Stopping %s service!", serviceName))
	}
	return nil
}

func (app *App) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if app.httpHealth != nil {
		if err := app.httpHealth.Stop(ctx); err != nil {
			log.Printf("Error stopping %s HTTP health: %v", serviceName, err)
		}
	}
	err := app.grpcServer.Stop()
	if err != nil {
		log.Printf(fmt.Sprintf("Error stopping %s service: %v", serviceName, err))
	}
	if app.pgDB != nil {
		app.pgDB.Close()
	}
}
