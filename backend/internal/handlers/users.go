package handlers

import (
	"net/http"

	"automationhub/internal/models"

	"github.com/gin-gonic/gin"
)

// Admin-only user management.

func (s *Server) ListUsers(c *gin.Context) {
	rows, err := s.DB.Query(c,
		`SELECT id, name, email, role, created_at FROM users ORDER BY created_at`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func (s *Server) UpdateUserRole(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req struct {
		Role string `json:"role" binding:"required,oneof=admin user"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be 'admin' or 'user'"})
		return
	}
	if id == s.userID(c) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you cannot change your own role"})
		return
	}
	tag, err := s.DB.Exec(c, `UPDATE users SET role = $2 WHERE id = $1`, id, req.Role)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (s *Server) DeleteUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if id == s.userID(c) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you cannot delete your own account"})
		return
	}
	tag, err := s.DB.Exec(c, `DELETE FROM users WHERE id = $1`, id)
	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
