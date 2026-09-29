package services

import (
	"context"
	"log"
	"sync"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

// Scheduler keeps cron entries in sync with workflows whose trigger type is
// "schedule". Sync is called whenever a workflow is created/updated/deleted.
type Scheduler struct {
	cron    *cron.Cron
	db      *pgxpool.Pool
	engine  *Engine
	mu      sync.Mutex
	entries map[uuid.UUID]cron.EntryID
}

func NewScheduler(db *pgxpool.Pool, engine *Engine) *Scheduler {
	return &Scheduler{
		cron:    cron.New(),
		db:      db,
		engine:  engine,
		entries: make(map[uuid.UUID]cron.EntryID),
	}
}

func (s *Scheduler) Start(ctx context.Context) error {
	rows, err := s.db.Query(ctx,
		`SELECT id, trigger_config->>'cron' FROM workflows
		 WHERE trigger_type = 'schedule' AND enabled = true`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var spec *string
		if err := rows.Scan(&id, &spec); err != nil {
			return err
		}
		if spec != nil {
			s.add(id, *spec)
		}
	}
	s.cron.Start()
	log.Printf("scheduler started with %d scheduled workflow(s)", len(s.entries))
	return nil
}

// Sync reconciles one workflow's cron entry with its current state.
func (s *Scheduler) Sync(ctx context.Context, workflowID uuid.UUID) {
	s.Remove(workflowID)

	var triggerType string
	var spec *string
	var enabled bool
	err := s.db.QueryRow(ctx,
		`SELECT trigger_type, trigger_config->>'cron', enabled FROM workflows WHERE id = $1`,
		workflowID,
	).Scan(&triggerType, &spec, &enabled)
	if err != nil {
		return // deleted — Remove already cleaned up
	}
	if triggerType == "schedule" && enabled && spec != nil && *spec != "" {
		s.add(workflowID, *spec)
	}
}

func (s *Scheduler) Remove(workflowID uuid.UUID) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if entryID, ok := s.entries[workflowID]; ok {
		s.cron.Remove(entryID)
		delete(s.entries, workflowID)
	}
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
}

// ValidateSpec reports whether a cron expression is valid.
func ValidateSpec(spec string) error {
	_, err := cron.ParseStandard(spec)
	return err
}

func (s *Scheduler) add(workflowID uuid.UUID, spec string) {
	id := workflowID
	entryID, err := s.cron.AddFunc(spec, func() {
		if _, err := s.engine.Trigger(context.Background(), id, "schedule", nil); err != nil {
			log.Printf("scheduled trigger for workflow %s failed: %v", id, err)
		}
	})
	if err != nil {
		log.Printf("invalid cron spec %q for workflow %s: %v", spec, workflowID, err)
		return
	}
	s.mu.Lock()
	s.entries[workflowID] = entryID
	s.mu.Unlock()
}
