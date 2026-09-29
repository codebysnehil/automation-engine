package handlers

import (
	"net/http"

	"automationhub/internal/models"

	"github.com/gin-gonic/gin"
)

func (s *Server) ListNotifications(c *gin.Context) {
	rows, err := s.DB.Query(c,
		`SELECT id, title, message, kind, is_read, created_at FROM notifications
		 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, s.userID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	notifications := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.Title, &n.Message, &n.Kind, &n.IsRead, &n.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		notifications = append(notifications, n)
	}

	var unread int
	s.DB.QueryRow(c,
		`SELECT count(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
		s.userID(c)).Scan(&unread)

	c.JSON(http.StatusOK, gin.H{"notifications": notifications, "unread": unread})
}

func (s *Server) MarkNotificationRead(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	_, err := s.DB.Exec(c,
		`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
		id, s.userID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"read": true})
}

func (s *Server) MarkAllNotificationsRead(c *gin.Context) {
	_, err := s.DB.Exec(c,
		`UPDATE notifications SET is_read = true WHERE user_id = $1`, s.userID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"read": true})
}
