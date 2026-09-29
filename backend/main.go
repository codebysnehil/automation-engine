package main

import (
	"context"
	"log"

	"automationhub/internal/config"
	"automationhub/internal/database"
	"automationhub/internal/handlers"
	"automationhub/internal/router"
	"automationhub/internal/services"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	if err := database.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}

	notifier := services.NewNotifier(pool, cfg)
	exporter := services.NewExporter(pool, cfg.ExportDir)
	engine := services.NewEngine(pool, notifier, exporter)
	scheduler := services.NewScheduler(pool, engine)
	if err := scheduler.Start(ctx); err != nil {
		log.Fatalf("scheduler failed to start: %v", err)
	}
	defer scheduler.Stop()

	server := &handlers.Server{
		DB:        pool,
		Cfg:       cfg,
		Engine:    engine,
		Scheduler: scheduler,
		Notifier:  notifier,
		Exporter:  exporter,
	}

	r := router.New(server)
	log.Printf("AutomationHub API listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
