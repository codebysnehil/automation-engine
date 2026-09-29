package router

import (
	"net/http"

	"automationhub/internal/handlers"
	"automationhub/internal/middleware"

	"github.com/gin-gonic/gin"
)

func New(s *handlers.Server) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery(), middleware.CORS())
	r.MaxMultipartMemory = 16 << 20

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Public
	r.POST("/api/auth/register", s.Register)
	r.POST("/api/auth/login", s.Login)
	r.POST("/api/hooks/:token", s.IncomingWebhook)

	// Authenticated
	api := r.Group("/api", middleware.AuthRequired(s.Cfg.JWTSecret))
	{
		api.GET("/auth/me", s.Me)

		api.POST("/datasets/upload", s.UploadDataset)
		api.GET("/datasets", s.ListDatasets)
		api.GET("/datasets/:id", s.GetDataset)
		api.GET("/datasets/:id/rows", s.GetDatasetRows)
		api.GET("/datasets/:id/export", s.ExportDataset)
		api.GET("/datasets/:id/snapshots", s.ListDatasetSnapshots)
		api.POST("/datasets/:id/snapshots/:snapshotId/restore", s.RestoreDatasetSnapshot)
		api.DELETE("/datasets/:id", s.DeleteDataset)

		api.GET("/workflows", s.ListWorkflows)
		api.POST("/workflows", s.CreateWorkflow)
		api.GET("/workflows/:id", s.GetWorkflow)
		api.PUT("/workflows/:id", s.UpdateWorkflow)
		api.DELETE("/workflows/:id", s.DeleteWorkflow)
		api.POST("/workflows/:id/run", s.RunWorkflow)

		api.GET("/executions", s.ListExecutions)
		api.GET("/executions/:id", s.GetExecution)

		api.GET("/notifications", s.ListNotifications)
		api.POST("/notifications/read-all", s.MarkAllNotificationsRead)
		api.POST("/notifications/:id/read", s.MarkNotificationRead)

		api.GET("/dashboard/stats", s.DashboardStats)

		admin := api.Group("/users", middleware.AdminRequired())
		{
			admin.GET("", s.ListUsers)
			admin.PATCH("/:id/role", s.UpdateUserRole)
			admin.DELETE("/:id", s.DeleteUser)
		}
	}

	return r
}
