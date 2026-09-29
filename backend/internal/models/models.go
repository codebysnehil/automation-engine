package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type Dataset struct {
	ID               uuid.UUID `json:"id"`
	OwnerID          uuid.UUID `json:"ownerId"`
	Name             string    `json:"name"`
	OriginalFilename string    `json:"originalFilename"`
	SheetName        string    `json:"sheetName"`
	RowCount         int       `json:"rowCount"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type DatasetColumn struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	Position int       `json:"position"`
	DataType string    `json:"dataType"`
}

type Workflow struct {
	ID            uuid.UUID      `json:"id"`
	OwnerID       uuid.UUID      `json:"ownerId"`
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	Enabled       bool           `json:"enabled"`
	TriggerType   string         `json:"triggerType"`
	TriggerConfig map[string]any `json:"triggerConfig"`
	WebhookToken  *string        `json:"webhookToken,omitempty"`
	Steps         []WorkflowStep `json:"steps"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
}

type WorkflowStep struct {
	ID         uuid.UUID      `json:"id"`
	Position   int            `json:"position"`
	Name       string         `json:"name"`
	ActionType string         `json:"actionType"`
	Config     map[string]any `json:"config"`
}

type Execution struct {
	ID            uuid.UUID  `json:"id"`
	WorkflowID    uuid.UUID  `json:"workflowId"`
	WorkflowName  string     `json:"workflowName,omitempty"`
	TriggerSource string     `json:"triggerSource"`
	Status        string     `json:"status"`
	Error         string     `json:"error"`
	StartedAt     time.Time  `json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt"`
}

type ExecutionLog struct {
	ID           int64     `json:"id"`
	StepPosition *int      `json:"stepPosition"`
	Level        string    `json:"level"`
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Notification struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Kind      string    `json:"kind"`
	IsRead    bool      `json:"isRead"`
	CreatedAt time.Time `json:"createdAt"`
}
