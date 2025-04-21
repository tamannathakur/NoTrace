package db

import (
	"database/sql"
	"log"
	"os"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

var (
	db   *sql.DB
	once sync.Once
)

func DB() *sql.DB {
	return db
}

func InitDB() {
	once.Do(func() {
		dbURL := os.Getenv("DATABASE_URL")
		if dbURL == "" {
			dbURL = "postgresql://postgres:postgres@localhost:5432/qrconnect?sslmode=disable"
			log.Println("Using default database URL:", dbURL)
		}

		var err error
		maxRetries := 5
		retryDelay := time.Second

		for i := 0; i < maxRetries; i++ {
			log.Printf("Attempting database connection (attempt %d/%d)...", i+1, maxRetries)

			db, err = sql.Open("postgres", dbURL)
			if err != nil {
				log.Printf("Failed to open database connection: %v", err)
				time.Sleep(retryDelay)
				retryDelay *= 2
				continue
			}

			err = db.Ping()
			if err == nil {
				log.Println("Successfully connected to database")
				break
			}

			log.Printf("Failed to ping database: %v", err)
			db.Close()

			if i < maxRetries-1 {
				log.Printf("Retrying in %v...", retryDelay)
				time.Sleep(retryDelay)
				retryDelay *= 2
			}
		}

		if err != nil {
			log.Fatalf("Could not connect to database after %d attempts: %v", maxRetries, err)
		}

		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(time.Minute * 5)
		createTables()
	})
}

func createTables() {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			username VARCHAR(50) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			display_name VARCHAR(100) NOT NULL,
			profile_picture TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS connection_codes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			used BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS chats (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL,
			is_secure BOOLEAN DEFAULT TRUE,
			folder VARCHAR(50),
			last_message TEXT,
			last_message_at TIMESTAMP WITH TIME ZONE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS chat_members (
			chat_id UUID NOT NULL,
			user_id UUID NOT NULL,
			role VARCHAR(20) DEFAULT 'member',
			notifications_enabled BOOLEAN DEFAULT TRUE,
			joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			PRIMARY KEY (chat_id, user_id),
			CONSTRAINT fk_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
			CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			chat_id UUID NOT NULL,
			sender_id UUID NOT NULL,
			content TEXT NOT NULL,
			is_read BOOLEAN DEFAULT FALSE,
			is_disappearing BOOLEAN DEFAULT FALSE,
			disappear_after INTEGER,
			sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			CONSTRAINT fk_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
			CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
	}

	for _, query := range queries {
		_, err := db.Exec(query)
		if err != nil {
			log.Printf("Warning when creating table: %v", err)
		}
	}

	log.Println("Database tables initialized successfully")
}
