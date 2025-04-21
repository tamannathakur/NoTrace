package main

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID             uuid.UUID `json:"id"`
	Username       string    `json:"username"`
	PasswordHash   string    `json:"-"`
	DisplayName    string    `json:"displayName"`
	ProfilePicture *string   `json:"profilePicture,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Chat struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	IsSecure      bool       `json:"isSecure"`
	Folder        *string    `json:"folder,omitempty"`
	LastMessage   *string    `json:"lastMessage,omitempty"`
	LastMessageAt *time.Time `json:"lastMessageAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type ChatWithDetails struct {
	Chat
	UnreadCount          int    `json:"unreadCount"`
	Members              []User `json:"members"`
	NotificationsEnabled bool   `json:"notificationsEnabled"`
}

type Message struct {
	ID             uuid.UUID `json:"id"`
	ChatID         uuid.UUID `json:"chatId"`
	SenderID       uuid.UUID `json:"senderId"`
	Content        string    `json:"content"`
	IsRead         bool      `json:"isRead"`
	IsDisappearing bool      `json:"isDisappearing,omitempty"`
	DisappearAfter *int      `json:"disappearAfter,omitempty"`
	SentAt         time.Time `json:"sentAt"`
}

type ChatMember struct {
	ChatID               uuid.UUID `json:"chatId"`
	UserID               uuid.UUID `json:"userId"`
	Role                 string    `json:"role"`
	NotificationsEnabled bool      `json:"notificationsEnabled"`
	JoinedAt             time.Time `json:"joinedAt"`
}

type ConnectionCode struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
	Used      bool      `json:"used"`
	CreatedAt time.Time `json:"createdAt"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	User         User   `json:"user"`
}

type WebSocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type QRCodeData struct {
	ConnectionID string    `json:"connectionId"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

type ConnectionResult struct {
	Success bool   `json:"success"`
	ChatID  string `json:"chatId,omitempty"`
	Message string `json:"message,omitempty"`
	User    *User  `json:"user,omitempty"`
}

type RegisterRequest struct {
	Username    string `json:"username" binding:"required"`
	Password    string `json:"password" binding:"required"`
	DisplayName string `json:"displayName" binding:"required"`
	Email       string `json:"email"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type GenerateQRRequest struct {
	ExpiresIn int `json:"expiresIn"`
}

type VerifyQRRequest struct {
	ConnectionID string `json:"connectionId" binding:"required"`
}

type CreateChatRequest struct {
	Name      string   `json:"name" binding:"required"`
	MemberIDs []string `json:"memberIds" binding:"required"`
	IsSecure  *bool    `json:"isSecure"`
	Folder    *string  `json:"folder"`
}

type UpdateChatRequest struct {
	Name     *string `json:"name"`
	IsSecure *bool   `json:"isSecure"`
	Folder   *string `json:"folder"`
}

type SendMessageRequest struct {
	Content        string `json:"content" binding:"required"`
	IsDisappearing *bool  `json:"isDisappearing"`
	DisappearAfter *int   `json:"disappearAfter"`
}

type UpdateMessageRequest struct {
	IsRead *bool `json:"isRead"`
}
