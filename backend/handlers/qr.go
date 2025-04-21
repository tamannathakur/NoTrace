package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"qrconnect-backend/db"
	"qrconnect-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GenerateQRHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	userUUID, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	codeID := uuid.New()
	expiresAt := time.Now().Add(5 * time.Minute)

	_, err = db.DB().Exec(`
		INSERT INTO connection_codes (id, user_id, expires_at, used)
		VALUES ($1, $2, $3, $4)
	`, codeID, userUUID, expiresAt, false)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"codeId":    codeID.String(),
		"expiresAt": expiresAt,
	})
}

func VerifyQRHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	var req struct {
		CodeID string `json:"codeId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	codeUUID, err := uuid.Parse(req.CodeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid code ID"})
		return
	}

	var ownerID uuid.UUID
	var expiresAt time.Time
	var used bool

	err = db.DB().QueryRow(`
		SELECT user_id, expires_at, used
		FROM connection_codes
		WHERE id = $1
	`, codeUUID).Scan(&ownerID, &expiresAt, &used)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "QR code not found"})
		} else {
			log.Printf("Error querying connection code: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Database error"})
		}
		return
	}

	if time.Now().After(expiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "QR code expired"})
		return
	}

	if used {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "QR code already used"})
		return
	}

	currentUserID, _ := uuid.Parse(userID.(string))
	if currentUserID == ownerID {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "You cannot connect with yourself"})
		return
	}

	_, err = db.DB().Exec(`
		UPDATE connection_codes
		SET used = true
		WHERE id = $1
	`, codeUUID)

	if err != nil {
		log.Printf("Error marking code as used: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Database error"})
		return
	}

	tx, err := db.DB().Begin()
	if err != nil {
		log.Printf("Error beginning transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Database error"})
		return
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	chatID := uuid.New()
	now := time.Now()
	_, err = tx.Exec(`
		INSERT INTO chats (id, name, is_secure, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`, chatID, "QR Connect Chat", true, now, now)

	if err != nil {
		log.Printf("Error creating chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to create chat"})
		return
	}

	_, err = tx.Exec(`
		INSERT INTO chat_members (chat_id, user_id, role, notifications_enabled, joined_at)
		VALUES ($1, $2, $3, $4, $5)
	`, chatID, ownerID, "member", true, now)

	if err != nil {
		log.Printf("Error adding code owner to chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to add users to chat"})
		return
	}

	_, err = tx.Exec(`
		INSERT INTO chat_members (chat_id, user_id, role, notifications_enabled, joined_at)
		VALUES ($1, $2, $3, $4, $5)
	`, chatID, currentUserID, "member", true, now)

	if err != nil {
		log.Printf("Error adding current user to chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to add users to chat"})
		return
	}

	err = tx.Commit()
	if err != nil {
		log.Printf("Error committing transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Database error"})
		return
	}

	var owner models.User
	err = db.DB().QueryRow(`
		SELECT id, username, display_name, profile_picture, created_at, updated_at
		FROM users
		WHERE id = $1
	`, ownerID).Scan(&owner.ID, &owner.Username, &owner.DisplayName, &owner.ProfilePicture,
		&owner.CreatedAt, &owner.UpdatedAt)

	if err != nil {
		log.Printf("Error getting user details: %v", err)

	}

	qrConnectedMessage := WSMessage{
		Type: "qr_connected",
		Payload: map[string]interface{}{
			"chatId": chatID.String(),
			"user":   owner,
		},
	}

	SendToUser(ownerID.String(), qrConnectedMessage)
	SendToUser(currentUserID.String(), qrConnectedMessage)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"chatId":  chatID.String(),
		"message": "Successfully connected",
		"user":    owner,
	})
}
