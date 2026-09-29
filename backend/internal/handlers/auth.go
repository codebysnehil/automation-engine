package handlers

import (
	"net/http"
	"strings"

	"automationhub/internal/auth"
	"automationhub/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	Name     string `json:"name" binding:"required,min=2"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register creates a user. The very first user becomes admin.
func (s *Server) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, valid email and a password of at least 8 characters are required"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	var count int
	if err := s.DB.QueryRow(c, `SELECT count(*) FROM users`).Scan(&count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	role := "user"
	if count == 0 {
		role = "admin"
	}

	var user models.User
	err = s.DB.QueryRow(c,
		`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
		 RETURNING id, name, email, role, created_at`,
		strings.TrimSpace(req.Name), email, string(hash), role,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "an account with this email already exists"})
		return
	}

	token, err := auth.GenerateToken(s.Cfg.JWTSecret, user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": user})
}

func (s *Server) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	var hash string
	err := s.DB.QueryRow(c,
		`SELECT id, name, email, role, created_at, password_hash FROM users WHERE email = $1`, email,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	token, err := auth.GenerateToken(s.Cfg.JWTSecret, user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (s *Server) Me(c *gin.Context) {
	var user models.User
	err := s.DB.QueryRow(c,
		`SELECT id, name, email, role, created_at FROM users WHERE id = $1`, s.userID(c),
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}
