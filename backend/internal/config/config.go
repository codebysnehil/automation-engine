package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	UploadDir   string
	ExportDir   string
	SMTPHost    string
	SMTPPort    string
	SMTPUser    string
	SMTPPass    string
	SMTPFrom    string
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func Load() *Config {
	return &Config{
		Port:        getenv("PORT", "8090"),
		DatabaseURL: getenv("DATABASE_URL", "postgres://automation:automation_dev@localhost:5434/automation?sslmode=disable"),
		JWTSecret:   getenv("JWT_SECRET", "dev-secret-change-in-production"),
		UploadDir:   getenv("UPLOAD_DIR", "uploads"),
		ExportDir:   getenv("EXPORT_DIR", "exports"),
		SMTPHost:    os.Getenv("SMTP_HOST"),
		SMTPPort:    getenv("SMTP_PORT", "587"),
		SMTPUser:    os.Getenv("SMTP_USER"),
		SMTPPass:    os.Getenv("SMTP_PASS"),
		SMTPFrom:    os.Getenv("SMTP_FROM"),
	}
}
