package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID             uuid.UUID              `json:"id"`
	Username       string                 `json:"username"`
	PasswordHash   string                 `json:"-"`
	DisplayName    string                 `json:"displayName"`
	ProfilePicture string                 `json:"profilePicture,omitempty"`
	CreatedAt      time.Time              `json:"createdAt"`
	UpdatedAt      time.Time              `json:"updatedAt"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

type Chat struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	IsSecure      bool       `json:"isSecure"`
	Folder        string     `json:"folder,omitempty"`
	LastMessage   string     `json:"lastMessage,omitempty"`
	LastMessageAt *time.Time `json:"lastMessageAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	Members       []User     `json:"members,omitempty"`
}

type Message struct {
	ID             uuid.UUID `json:"id"`
	ChatID         uuid.UUID `json:"chatId"`
	SenderID       uuid.UUID `json:"senderId"`
	Content        string    `json:"content"`
	IsRead         bool      `json:"isRead"`
	IsDisappearing bool      `json:"isDisappearing"`
	DisappearAfter int       `json:"disappearAfter,omitempty"`
	SentAt         time.Time `json:"sentAt"`
}

type RegisterRequest struct {
	Username    string `json:"username" binding:"required"`
	Password    string `json:"password" binding:"required"`
	DisplayName string `json:"displayName" binding:"required"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	User         User   `json:"user"`
}
