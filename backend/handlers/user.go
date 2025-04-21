package handlers

import (
	"database/sql"
	"log"
	"net/http"

	"qrconnect-backend/db"
	"qrconnect-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetUserProfileHandler(c *gin.Context) {
	userID := c.Param("id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var user models.User
	var profilePicture sql.NullString
	err = db.DB().QueryRow(`
		SELECT id, username, display_name, profile_picture, created_at, updated_at
		FROM users
		WHERE id = $1
	`, userUUID).Scan(
		&user.ID, &user.Username, &user.DisplayName,
		&profilePicture, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	} else if err != nil {
		log.Printf("Error getting user profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if profilePicture.Valid {
		user.ProfilePicture = profilePicture.String
	}

	c.JSON(http.StatusOK, user)
}

func UpdateUserProfileHandler(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	userID := c.Param("id")

	if currentUserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only update your own profile"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	type UpdateProfileRequest struct {
		DisplayName    *string `json:"displayName"`
		ProfilePicture *string `json:"profilePicture"`
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.DisplayName != nil {
		_, err = db.DB().Exec(`
			UPDATE users
			SET display_name = $1
			WHERE id = $2
		`, *req.DisplayName, userUUID)

		if err != nil {
			log.Printf("Error updating display name: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
			return
		}
	}

	if req.ProfilePicture != nil {
		_, err = db.DB().Exec(`
			UPDATE users
			SET profile_picture = $1
			WHERE id = $2
		`, *req.ProfilePicture, userUUID)

		if err != nil {
			log.Printf("Error updating profile picture: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
			return
		}
	}

	var user models.User
	var profilePicture sql.NullString
	err = db.DB().QueryRow(`
		SELECT id, username, display_name, profile_picture, created_at, updated_at
		FROM users
		WHERE id = $1
	`, userUUID).Scan(
		&user.ID, &user.Username, &user.DisplayName,
		&profilePicture, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		log.Printf("Error getting updated user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Profile updated but failed to retrieve details"})
		return
	}

	if profilePicture.Valid {
		user.ProfilePicture = profilePicture.String
	}

	c.JSON(http.StatusOK, user)
}

func GetAllUsersHandler(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	rows, err := db.DB().Query(`
		SELECT id, username, display_name, profile_picture, created_at, updated_at
		FROM users
		WHERE id != $1
		ORDER BY display_name, username
	`, currentUserID)

	if err != nil {
		log.Printf("Error getting users: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		var profilePicture sql.NullString
		err := rows.Scan(&user.ID, &user.Username, &user.DisplayName,
			&profilePicture, &user.CreatedAt, &user.UpdatedAt)

		if err != nil {
			log.Printf("Error scanning user row: %v", err)
			continue
		}

		if profilePicture.Valid {
			user.ProfilePicture = profilePicture.String
		}

		users = append(users, user)
	}

	c.JSON(http.StatusOK, users)
}
