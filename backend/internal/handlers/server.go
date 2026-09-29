package handlers

import (
	"net/http"

	"automationhub/internal/config"
	"automationhub/internal/middleware"
	"automationhub/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	DB        *pgxpool.Pool
	Cfg       *config.Config
	Engine    *services.Engine
	Scheduler *services.Scheduler
	Notifier  *services.Notifier
	Exporter  *services.Exporter
}

func (s *Server) userID(c *gin.Context) uuid.UUID {
	return c.MustGet(middleware.CtxUserID).(uuid.UUID)
}

func (s *Server) isAdmin(c *gin.Context) bool {
	return c.GetString(middleware.CtxRole) == "admin"
}

func parseIDParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return uuid.Nil, false
	}
	return id, true
}
