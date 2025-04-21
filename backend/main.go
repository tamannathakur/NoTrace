package main

import (
	"log"
	"os"
	"time"

	"qrconnect-backend/db"
	"qrconnect-backend/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	db.InitDB()
	log.Println("Database connection initialized")

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{

		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.RegisterHandler)
			auth.POST("/login", handlers.LoginHandler)
			auth.POST("/refresh", handlers.AuthMiddleware(), handlers.RefreshTokenHandler)
		}

		qr := api.Group("/qr")
		{
			qr.POST("/generate", handlers.AuthMiddleware(), handlers.GenerateQRHandler)
			qr.POST("/verify", handlers.AuthMiddleware(), handlers.VerifyQRHandler)
		}

		chats := api.Group("/chats")
		{
			chats.GET("", handlers.AuthMiddleware(), handlers.GetChatsHandler)
			chats.GET("/:id", handlers.AuthMiddleware(), handlers.GetChatHandler)
			chats.POST("", handlers.AuthMiddleware(), handlers.CreateChatHandler)
			chats.PATCH("/:id", handlers.AuthMiddleware(), handlers.UpdateChatHandler)
			chats.DELETE("/:id", handlers.AuthMiddleware(), handlers.DeleteChatHandler)

			chats.GET("/:id/messages", handlers.AuthMiddleware(), handlers.GetMessagesHandler)
			chats.POST("/:id/messages", handlers.AuthMiddleware(), handlers.SendMessageHandler)
			chats.PATCH("/:id/messages/:messageId", handlers.AuthMiddleware(), handlers.UpdateMessageHandler)
			chats.DELETE("/:id/messages/:messageId", handlers.AuthMiddleware(), handlers.DeleteMessageHandler)
		}

		userRoutes := api.Group("/users")
		userRoutes.Use(handlers.AuthMiddleware())
		{
			userRoutes.GET("", handlers.GetAllUsersHandler)
			userRoutes.GET("/:id", handlers.GetUserProfileHandler)
			userRoutes.PATCH("/:id", handlers.UpdateUserProfileHandler)
		}
	}

	r.GET("/ws", handlers.HandleWebSocket)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s\n", port)
	err = r.Run(":" + port)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
