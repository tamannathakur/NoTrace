package handlers

import (
	"log"
	"net/http"
	"os"
	"time"

	"qrconnect-backend/auth"
	"qrconnect-backend/db"
	"qrconnect-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func RegisterHandler(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existingUser models.User
	err := db.DB().QueryRow("SELECT id FROM users WHERE username = $1", req.Username).Scan(&existingUser.ID)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username already exists"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	userID := uuid.New()
	_, err = db.DB().Exec(
		"INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4)",
		userID, req.Username, hashedPassword, req.DisplayName,
	)
	if err != nil {
		log.Printf("Failed to create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	token, refreshToken, err := generateAuthTokens(userID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	user := models.User{
		ID:          userID,
		Username:    req.Username,
		DisplayName: req.DisplayName,
	}
	c.JSON(http.StatusCreated, models.AuthResponse{
		Token:        token,
		RefreshToken: refreshToken,
		User:         user,
	})
}

func LoginHandler(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	var passwordHash string
	err := db.DB().QueryRow("SELECT id, username, password_hash, display_name FROM users WHERE username = $1", req.Username).Scan(&user.ID, &user.Username, &passwordHash, &user.DisplayName)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, refreshToken, err := generateAuthTokens(user.ID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token:        token,
		RefreshToken: refreshToken,
		User:         user,
	})
}

func RefreshTokenHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	token, refreshToken, err := generateAuthTokens(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":        token,
		"refreshToken": refreshToken,
	})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization header"})
			return
		}

		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}

		claims, err := auth.ParseToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		c.Set("userID", claims.UserID)

		c.Next()
	}
}

func generateAuthTokens(userID string) (string, string, error) {
	jwtExpiration := os.Getenv("JWT_EXPIRATION")
	if jwtExpiration == "" {
		jwtExpiration = "1h"
	}

	expirationDuration, err := time.ParseDuration(jwtExpiration)
	if err != nil {
		log.Printf("Error parsing JWT_EXPIRATION: %v, using default value of 1 hour", err)
		expirationDuration = time.Hour
	}

	token, err := auth.CreateToken(userID, expirationDuration)
	if err != nil {
		return "", "", err
	}

	refreshTokenExpiration := os.Getenv("REFRESH_TOKEN_EXPIRATION")
	if refreshTokenExpiration == "" {
		refreshTokenExpiration = "720h"
	}

	refreshExpirationDuration, err := time.ParseDuration(refreshTokenExpiration)
	if err != nil {
		log.Printf("Error parsing REFRESH_TOKEN_EXPIRATION: %v, using default value of 720 hours", err)
		refreshExpirationDuration = time.Hour * 720
	}

	refreshToken, err := auth.CreateToken(userID, refreshExpirationDuration)
	if err != nil {
		return "", "", err
	}

	return token, refreshToken, nil
}

func parseToken(tokenString string) (*auth.JwtClaims, error) {
	return auth.ParseToken(tokenString)
}
