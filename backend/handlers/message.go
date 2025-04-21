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

func GetMessagesHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	chatID := c.Param("id")
	chatUUID, err := uuid.Parse(chatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat ID"})
		return
	}

	userUUID, _ := uuid.Parse(userID.(string))

	var count int
	err = db.DB().QueryRow(`
		SELECT COUNT(*) FROM chat_members
		WHERE chat_id = $1 AND user_id = $2
	`, chatUUID, userUUID).Scan(&count)

	if err != nil || count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to this chat"})
		return
	}

	limit := 50
	offset := 0

	rows, err := db.DB().Query(`
		SELECT id, chat_id, sender_id, content, is_read, is_disappearing, 
			   disappear_after, sent_at
		FROM messages
		WHERE chat_id = $1
		ORDER BY sent_at ASC
		LIMIT $2 OFFSET $3
	`, chatUUID, limit, offset)

	if err != nil {
		log.Printf("Error getting messages: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	messages := []models.Message{}
	for rows.Next() {
		var message models.Message
		var disappearAfter sql.NullInt32

		err := rows.Scan(
			&message.ID, &message.ChatID, &message.SenderID, &message.Content,
			&message.IsRead, &message.IsDisappearing, &disappearAfter, &message.SentAt,
		)

		if err != nil {
			log.Printf("Error scanning message row: %v", err)
			continue
		}

		if disappearAfter.Valid {
			message.DisappearAfter = int(disappearAfter.Int32)
		}

		messages = append(messages, message)
	}

	_, err = db.DB().Exec(`
		UPDATE messages
		SET is_read = true
		WHERE chat_id = $1 AND sender_id != $2 AND is_read = false
	`, chatUUID, userUUID)

	if err != nil {
		log.Printf("Error marking messages as read: %v", err)
	}

	c.JSON(http.StatusOK, messages)
}

func SendMessageHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	chatID := c.Param("id")
	chatUUID, err := uuid.Parse(chatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat ID"})
		return
	}

	userUUID, _ := uuid.Parse(userID.(string))

	var count int
	err = db.DB().QueryRow(`
		SELECT COUNT(*) FROM chat_members
		WHERE chat_id = $1 AND user_id = $2
	`, chatUUID, userUUID).Scan(&count)

	if err != nil || count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to this chat"})
		return
	}

	var req struct {
		Content        string `json:"content" binding:"required"`
		IsDisappearing bool   `json:"isDisappearing"`
		DisappearAfter int    `json:"disappearAfter"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("Attempting to store message - ChatID: %s, UserID: %s, Content: %s", chatUUID, userUUID, req.Content)

	messageID := uuid.New()
	now := time.Now()

	tx, err := db.DB().Begin()
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO messages (id, chat_id, sender_id, content, is_read, is_disappearing, disappear_after, sent_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, messageID, chatUUID, userUUID, req.Content, false, req.IsDisappearing, req.DisappearAfter, now)

	if err != nil {
		log.Printf("Error storing message in database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store message"})
		return
	}

	_, err = tx.Exec(`
		UPDATE chats
		SET last_message = $1, last_message_at = $2
		WHERE id = $3
	`, req.Content, now, chatUUID)

	if err != nil {
		log.Printf("Error updating chat last message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update chat"})
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	log.Printf("Message successfully stored - MessageID: %s", messageID)

	var sender models.User
	err = db.DB().QueryRow(`
		SELECT id, username, display_name, profile_picture, created_at, updated_at
		FROM users
		WHERE id = $1
	`, userUUID).Scan(&sender.ID, &sender.Username, &sender.DisplayName, &sender.ProfilePicture,
		&sender.CreatedAt, &sender.UpdatedAt)

	if err != nil {
		log.Printf("Error getting sender details: %v", err)
	}

	message := models.Message{
		ID:             messageID,
		ChatID:         chatUUID,
		SenderID:       userUUID,
		Content:        req.Content,
		IsRead:         false,
		IsDisappearing: req.IsDisappearing,
		DisappearAfter: req.DisappearAfter,
		SentAt:         now,
	}

	go func() {
		payload := map[string]interface{}{
			"message": message,
			"sender":  sender,
			"chatId":  chatID,
		}

		wsMessage := WSMessage{
			Type:    NewMessageType,
			Payload: payload,
		}
		SendToChat(chatUUID, wsMessage, userID.(string))
	}()

	c.JSON(http.StatusCreated, message)
}

func UpdateMessageHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	chatID := c.Param("id")
	messageID := c.Param("messageId")

	chatUUID, err := uuid.Parse(chatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat ID"})
		return
	}

	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	userUUID, _ := uuid.Parse(userID.(string))
	var senderID uuid.UUID
	err = db.DB().QueryRow(`
		SELECT sender_id FROM messages
		WHERE id = $1 AND chat_id = $2
	`, messageUUID, chatUUID).Scan(&senderID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	} else if err != nil {
		log.Printf("Error checking message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if senderID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only update your own messages"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_, err = db.DB().Exec(`
		UPDATE messages
		SET content = $1
		WHERE id = $2
	`, req.Content, messageUUID)

	if err != nil {
		log.Printf("Error updating message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update message"})
		return
	}

	var lastMessageID uuid.UUID
	err = db.DB().QueryRow(`
		SELECT id
		FROM messages
		WHERE chat_id = $1
		ORDER BY sent_at DESC
		LIMIT 1
	`, chatUUID).Scan(&lastMessageID)

	if err == nil && lastMessageID == messageUUID {
		_, err = db.DB().Exec(`
			UPDATE chats
			SET last_message = $1
			WHERE id = $2
		`, req.Content, chatUUID)

		if err != nil {
			log.Printf("Error updating last message: %v", err)
		}
	}

	var message models.Message
	var disappearAfter sql.NullInt32

	err = db.DB().QueryRow(`
		SELECT id, chat_id, sender_id, content, is_read, is_disappearing, 
			   disappear_after, sent_at
		FROM messages
		WHERE id = $1
	`, messageUUID).Scan(
		&message.ID, &message.ChatID, &message.SenderID, &message.Content,
		&message.IsRead, &message.IsDisappearing, &disappearAfter, &message.SentAt,
	)

	if err != nil {
		log.Printf("Error getting updated message: %v", err)
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	if disappearAfter.Valid {
		message.DisappearAfter = int(disappearAfter.Int32)
	}

	c.JSON(http.StatusOK, message)
}

func DeleteMessageHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	chatID := c.Param("id")
	messageID := c.Param("messageId")

	chatUUID, err := uuid.Parse(chatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat ID"})
		return
	}

	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}

	userUUID, _ := uuid.Parse(userID.(string))
	var senderID uuid.UUID
	var isAdmin bool

	err = db.DB().QueryRow(`
		SELECT sender_id FROM messages
		WHERE id = $1 AND chat_id = $2
	`, messageUUID, chatUUID).Scan(&senderID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	} else if err != nil {
		log.Printf("Error checking message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var role string
	err = db.DB().QueryRow(`
		SELECT role FROM chat_members
		WHERE chat_id = $1 AND user_id = $2
	`, chatUUID, userUUID).Scan(&role)

	if err == nil && role == "admin" {
		isAdmin = true
	}

	if senderID != userUUID && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own messages or need admin rights"})
		return
	}

	var content string
	var sentAt time.Time
	err = db.DB().QueryRow(`
		SELECT content, sent_at FROM messages
		WHERE id = $1
	`, messageUUID).Scan(&content, &sentAt)

	if err != nil {
		log.Printf("Error getting message details: %v", err)
	}

	_, err = db.DB().Exec(`DELETE FROM messages WHERE id = $1`, messageUUID)
	if err != nil {
		log.Printf("Error deleting message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}

	var lastMessageID uuid.UUID
	var lastMessageContent string
	var lastMessageAt time.Time

	err = db.DB().QueryRow(`
		SELECT id, content, sent_at
		FROM messages
		WHERE chat_id = $1
		ORDER BY sent_at DESC
		LIMIT 1
	`, chatUUID).Scan(&lastMessageID, &lastMessageContent, &lastMessageAt)

	if err == nil {
		_, err = db.DB().Exec(`
			UPDATE chats
			SET last_message = $1, last_message_at = $2
			WHERE id = $3
		`, lastMessageContent, lastMessageAt, chatUUID)
	} else if err == sql.ErrNoRows {
		_, err = db.DB().Exec(`
			UPDATE chats
			SET last_message = NULL, last_message_at = NULL
			WHERE id = $1
		`, chatUUID)
	}

	if err != nil {
		log.Printf("Error updating chat's last message: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
