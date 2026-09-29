package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect opens a pgx pool, retrying while PostgreSQL starts up.
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var err error
	for attempt := 1; attempt <= 15; attempt++ {
		pool, err = pgxpool.New(ctx, url)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return pool, nil
			}
			pool.Close()
		}
		log.Printf("database not ready (attempt %d/15): %v", attempt, err)
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("could not connect to database: %w", err)
}
