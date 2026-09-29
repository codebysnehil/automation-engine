package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IncomingWebhook is the public (unauthenticated) trigger endpoint:
// POST /api/hooks/:token. The token is a per-workflow secret.
func (s *Server) IncomingWebhook(c *gin.Context) {
	token := c.Param("token")
	var workflowID uuid.UUID
	err := s.DB.QueryRow(c,
		`SELECT id FROM workflows WHERE webhook_token = $1 AND enabled = true AND trigger_type = 'webhook'`,
		token,
	).Scan(&workflowID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown webhook"})
		return
	}

	var payload map[string]any
	c.ShouldBindJSON(&payload) // optional body

	execID, err := s.Engine.Trigger(c, workflowID, "webhook", payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"executionId": execID})
}
