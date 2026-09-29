package services

import (
	"context"
	"fmt"
	"log"
	"net/smtp"

	"automationhub/internal/config"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Notifier struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewNotifier(db *pgxpool.Pool, cfg *config.Config) *Notifier {
	return &Notifier{db: db, cfg: cfg}
}

// Notify creates an in-app notification and, when SMTP is configured,
// also emails the user.
func (n *Notifier) Notify(ctx context.Context, userID uuid.UUID, title, message, kind string) error {
	_, err := n.db.Exec(ctx,
		`INSERT INTO notifications (user_id, title, message, kind) VALUES ($1, $2, $3, $4)`,
		userID, title, message, kind)
	if err != nil {
		return err
	}
	if n.cfg.SMTPHost != "" {
		go n.sendEmail(userID, title, message)
	}
	return nil
}

func (n *Notifier) sendEmail(userID uuid.UUID, title, message string) {
	var email string
	if err := n.db.QueryRow(context.Background(),
		`SELECT email FROM users WHERE id = $1`, userID).Scan(&email); err != nil {
		return
	}
	addr := n.cfg.SMTPHost + ":" + n.cfg.SMTPPort
	from := n.cfg.SMTPFrom
	if from == "" {
		from = n.cfg.SMTPUser
	}
	body := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: [AutomationHub] %s\r\n\r\n%s\r\n", from, email, title, message)
	var auth smtp.Auth
	if n.cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", n.cfg.SMTPUser, n.cfg.SMTPPass, n.cfg.SMTPHost)
	}
	if err := smtp.SendMail(addr, auth, from, []string{email}, []byte(body)); err != nil {
		log.Printf("email notification failed: %v", err)
	}
}
