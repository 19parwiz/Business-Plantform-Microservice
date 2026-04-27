package http

import (
	"context"
	"errors"
	"fmt"
	"log"
	stdhttp "net/http"
	"time"

	"github.com/19parwiz/inventory-service/config"
	"github.com/19parwiz/inventory-service/internal/adapter/http/handler"
	"github.com/gin-gonic/gin"
)

const serverIPAddress = "0.0.0.0:%d"

type API struct {
	router         *gin.Engine
	cfg            config.HTTPServer
	address        string
	productHandler *handler.ProductHandler
	healthHandler  *handler.HealthHandler
	httpSrv        *stdhttp.Server
}

func New(cfg config.Server, useCase handler.ProductUseCase, db handler.DBPinger) *API {
	gin.SetMode(cfg.HTTPServer.Mode)

	server := gin.New()
	server.Use(gin.Recovery())

	productHandler := handler.NewProductHandler(useCase)
	healthHandler := handler.NewHealthHandler(db)

	api := &API{
		router:         server,
		cfg:            cfg.HTTPServer,
		address:        fmt.Sprintf(serverIPAddress, cfg.HTTPServer.Port),
		productHandler: productHandler,
		healthHandler:  healthHandler,
	}

	api.setupRoutes()

	return api
}

func (api *API) setupRoutes() {
	api.router.GET("/live", api.healthHandler.Live)
	api.router.GET("/ready", api.healthHandler.Ready)

	v1 := api.router.Group("api/v1")
	{
		products := v1.Group("/products")
		{
			products.GET("", api.productHandler.GetAll)
			products.GET("/:id", api.productHandler.GetByID)
			products.PUT("/:id", api.productHandler.Update)
			products.POST("/", api.productHandler.Create)
			products.DELETE("/:id", api.productHandler.Delete)
		}
	}
}

func (api *API) Run(errCh chan<- error) {
	api.httpSrv = &stdhttp.Server{
		Addr:              api.address,
		Handler:           api.router,
		ReadTimeout:       api.cfg.ReadTimeout,
		WriteTimeout:      api.cfg.WriteTimeout,
		IdleTimeout:       api.cfg.IdleTimeout,
		MaxHeaderBytes:    api.cfg.MaxHeaderBytes,
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("HTTP server running on: %v", api.address)
		if err := api.httpSrv.ListenAndServe(); err != nil && !errors.Is(err, stdhttp.ErrServerClosed) {
			errCh <- fmt.Errorf("failed to run HTTP server: %w", err)
		}
	}()
}

func (api *API) Stop(ctx context.Context) error {
	if api.httpSrv == nil {
		return nil
	}
	if err := api.httpSrv.Shutdown(ctx); err != nil {
		return fmt.Errorf("http shutdown: %w", err)
	}
	log.Println("HTTP server stopped")
	return nil
}
