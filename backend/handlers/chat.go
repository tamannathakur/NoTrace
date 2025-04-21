package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"qrconnect-backend/db"
	"qrconnect-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetChatsHandler(c *gin.Context) {
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

	rows, err := db.DB().Query(`
		SELECT c.id, c.name, c.is_secure, c.folder, c.last_message, c.last_message_at, 
			   c.created_at, c.updated_at
		FROM chats c
		JOIN chat_members cm ON c.id = cm.chat_id
		WHERE cm.user_id = $1
		ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
	`, userUUID)

	if err != nil {
		log.Printf("Error getting chats: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	chats := []models.Chat{}

	for rows.Next() {
		var chat models.Chat
		var lastMessage sql.NullString
		var lastMessageAt sql.NullTime

		err := rows.Scan(
			&chat.ID, &chat.Name, &chat.IsSecure, &chat.Folder,
			&lastMessage, &lastMessageAt, &chat.CreatedAt, &chat.UpdatedAt,
		)

		if err != nil {
			log.Printf("Error scanning chat row: %v", err)
			continue
		}

		if lastMessage.Valid {
			chat.LastMessage = lastMessage.String
		}

		if lastMessageAt.Valid {
			chat.LastMessageAt = &lastMessageAt.Time
		}

		members, err := getChatMembers(chat.ID)
		if err != nil {
			log.Printf("Error getting chat members: %v", err)
			continue
		}

		chat.Members = members
		chats = append(chats, chat)
	}

	c.JSON(http.StatusOK, chats)
}

func GetChatHandler(c *gin.Context) {
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

	if err != nil {
		log.Printf("Error checking chat membership: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to this chat"})
		return
	}

	var chat models.Chat
	var lastMessage sql.NullString
	var lastMessageAt sql.NullTime

	err = db.DB().QueryRow(`
		SELECT id, name, is_secure, folder, last_message, last_message_at, created_at, updated_at
		FROM chats
		WHERE id = $1
	`, chatUUID).Scan(
		&chat.ID, &chat.Name, &chat.IsSecure, &chat.Folder,
		&lastMessage, &lastMessageAt, &chat.CreatedAt, &chat.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	} else if err != nil {
		log.Printf("Error getting chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if lastMessage.Valid {
		chat.LastMessage = lastMessage.String
	}

	if lastMessageAt.Valid {
		chat.LastMessageAt = &lastMessageAt.Time
	}

	members, err := getChatMembersSafely(chat.ID)
	if err != nil {
		log.Printf("Error getting chat members: %v", err)
		chat.Members = []models.User{}
	} else {
		chat.Members = members
	}

	c.JSON(http.StatusOK, chat)
}

func getChatMembersSafely(chatID uuid.UUID) ([]models.User, error) {
	rows, err := db.DB().Query(`
		SELECT u.id, u.username, u.display_name, u.profile_picture,
			   cm.role, cm.joined_at
		FROM users u
		JOIN chat_members cm ON u.id = cm.user_id
		WHERE cm.chat_id = $1
	`, chatID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := []models.User{}
	for rows.Next() {
		var member models.User
		var role string
		var joinedAt time.Time
		var profilePicture sql.NullString

		err := rows.Scan(
			&member.ID, &member.Username, &member.DisplayName, &profilePicture,
			&role, &joinedAt,
		)

		if err != nil {
			log.Printf("Error scanning member row: %v", err)
			continue
		}

		if profilePicture.Valid {
			member.ProfilePicture = profilePicture.String
		}

		member.Metadata = map[string]interface{}{
			"role":     role,
			"joinedAt": joinedAt,
		}

		members = append(members, member)
	}

	return members, nil
}
func CreateChatHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	var req struct {
		Name      string   `json:"name" binding:"required"`
		IsSecure  bool     `json:"isSecure"`
		Folder    string   `json:"folder"`
		MemberIDs []string `json:"memberIds" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.MemberIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one member is required"})
		return
	}

	currentUserID := userID.(string)
	found := false
	for _, id := range req.MemberIDs {
		if id == currentUserID {
			found = true
			break
		}
	}
	if !found {
		req.MemberIDs = append(req.MemberIDs, currentUserID)
	}

	chatID := uuid.New()
	_, err := db.DB().Exec(`
		INSERT INTO chats (id, name, is_secure, folder)
		VALUES ($1, $2, $3, $4)
	`, chatID, req.Name, req.IsSecure, req.Folder)

	if err != nil {
		log.Printf("Error creating chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create chat"})
		return
	}
	for _, memberID := range req.MemberIDs {
		memberUUID, err := uuid.Parse(memberID)
		if err != nil {
			log.Printf("Invalid member ID %s: %v", memberID, err)
			continue
		}

		role := "member"
		if memberID == currentUserID {
			role = "admin"
		}

		_, err = db.DB().Exec(`
			INSERT INTO chat_members (chat_id, user_id, role)
			VALUES ($1, $2, $3)
		`, chatID, memberUUID, role)

		if err != nil {
			log.Printf("Error adding member %s to chat: %v", memberID, err)
		}
	}

	var chat models.Chat
	err = db.DB().QueryRow(`
		SELECT id, name, is_secure, folder, created_at, updated_at
		FROM chats
		WHERE id = $1
	`, chatID).Scan(
		&chat.ID, &chat.Name, &chat.IsSecure, &chat.Folder,
		&chat.CreatedAt, &chat.UpdatedAt,
	)

	if err != nil {
		log.Printf("Error getting created chat: %v", err)
		c.JSON(http.StatusCreated, gin.H{"id": chatID})
		return
	}

	members, err := getChatMembers(chat.ID)
	if err != nil {
		log.Printf("Error getting chat members: %v", err)
	} else {
		chat.Members = members
	}

	c.JSON(http.StatusCreated, chat)
}

func UpdateChatHandler(c *gin.Context) {
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

	var role string
	err = db.DB().QueryRow(`
		SELECT role FROM chat_members
		WHERE chat_id = $1 AND user_id = $2
	`, chatUUID, userUUID).Scan(&role)

	if err != nil || role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admin can update chat"})
		return
	}

	var req struct {
		Name     *string `json:"name"`
		IsSecure *bool   `json:"isSecure"`
		Folder   *string `json:"folder"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := "UPDATE chats SET "
	args := []interface{}{}
	argIndex := 1
	updates := []string{}

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argIndex))
		args = append(args, *req.Name)
		argIndex++
	}

	if req.IsSecure != nil {
		updates = append(updates, fmt.Sprintf("is_secure = $%d", argIndex))
		args = append(args, *req.IsSecure)
		argIndex++
	}

	if req.Folder != nil {
		updates = append(updates, fmt.Sprintf("folder = $%d", argIndex))
		args = append(args, *req.Folder)
		argIndex++
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	updates = append(updates, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	query += updates[0]
	for i := 1; i < len(updates); i++ {
		query += ", " + updates[i]
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIndex)
	args = append(args, chatUUID)

	_, err = db.DB().Exec(query, args...)
	if err != nil {
		log.Printf("Error updating chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update chat"})
		return
	}

	var chat models.Chat
	var lastMessage sql.NullString
	var lastMessageAt sql.NullTime

	err = db.DB().QueryRow(`
		SELECT id, name, is_secure, folder, last_message, last_message_at, created_at, updated_at
		FROM chats
		WHERE id = $1
	`, chatUUID).Scan(
		&chat.ID, &chat.Name, &chat.IsSecure, &chat.Folder,
		&lastMessage, &lastMessageAt, &chat.CreatedAt, &chat.UpdatedAt,
	)

	if err != nil {
		log.Printf("Error getting updated chat: %v", err)
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	if lastMessage.Valid {
		chat.LastMessage = lastMessage.String
	}

	if lastMessageAt.Valid {
		chat.LastMessageAt = &lastMessageAt.Time
	}

	members, err := getChatMembers(chat.ID)
	if err == nil {
		chat.Members = members
	}

	c.JSON(http.StatusOK, chat)
}

func DeleteChatHandler(c *gin.Context) {
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

	var role string
	err = db.DB().QueryRow(`
		SELECT role FROM chat_members
		WHERE chat_id = $1 AND user_id = $2
	`, chatUUID, userUUID).Scan(&role)

	if err != nil || role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admin can delete chat"})
		return
	}

	_, err = db.DB().Exec(`DELETE FROM chats WHERE id = $1`, chatUUID)
	if err != nil {
		log.Printf("Error deleting chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete chat"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func getChatMembers(chatID uuid.UUID) ([]models.User, error) {
	return getChatMembersSafely(chatID)
}
