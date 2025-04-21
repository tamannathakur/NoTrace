package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"qrconnect-backend/auth"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	clients      = make(map[string][]*websocket.Conn)
	clientsMutex = sync.RWMutex{}
)

const (
	NewMessageType    = "new_message"
	UpdateMessageType = "update_message"
	DeleteMessageType = "delete_message"
	ChatUpdateType    = "chat_update"
	ChatDeleteType    = "chat_delete"
)

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

func HandleWebSocket(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if token == "" {
		log.Println("WebSocket connection missing authentication token")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication token required"})
		return
	}

	claims, err := auth.ParseToken(token)
	if err != nil {
		log.Printf("Invalid WebSocket token: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authentication token"})
		return
	}

	userID := claims.UserID

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Error upgrading to WebSocket: %v", err)
		return
	}

	log.Printf("WebSocket connected for user: %s", userID)

	addClient(userID, conn)

	welcomeMsg := WSMessage{
		Type: "connected",
		Payload: map[string]interface{}{
			"userId": userID,
		},
	}
	sendWSMessage(conn, welcomeMsg)

	go startPingPong(conn)

	go handleMessages(userID, conn)
}

func addClient(userID string, conn *websocket.Conn) {
	clientsMutex.Lock()
	defer clientsMutex.Unlock()

	if _, ok := clients[userID]; !ok {
		clients[userID] = make([]*websocket.Conn, 0)
	}
	clients[userID] = append(clients[userID], conn)

	log.Printf("Client connected: %s, total connections: %d", userID, len(clients[userID]))
}

func removeClient(userID string, conn *websocket.Conn) {
	clientsMutex.Lock()
	defer clientsMutex.Unlock()

	if conns, ok := clients[userID]; ok {
		for i, c := range conns {
			if c == conn {

				clients[userID] = append(conns[:i], conns[i+1:]...)
				break
			}
		}

		if len(clients[userID]) == 0 {
			delete(clients, userID)
		}

		log.Printf("Client disconnected: %s, remaining connections: %d", userID, len(clients[userID]))
	}
}

func startPingPong(conn *websocket.Conn) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Ping error: %v", err)
				conn.Close()
				return
			}
		}
	}
}

func handleMessages(userID string, conn *websocket.Conn) {
	defer func() {
		conn.Close()
		removeClient(userID, conn)
	}()

	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error parsing message: %v", err)
			continue
		}

		switch msg.Type {
		case "ping":

			pongMsg := WSMessage{Type: "pong", Payload: time.Now().UnixMilli()}
			if err := sendWSMessage(conn, pongMsg); err != nil {
				log.Printf("Error sending pong: %v", err)
			}

		case "subscribe":
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				if chatIDStr, ok := payload["chatId"].(string); ok {
					log.Printf("User %s subscribing to chat %s", userID, chatIDStr)

					confirmMsg := WSMessage{
						Type:    "subscribed",
						Payload: map[string]interface{}{"chatId": chatIDStr},
					}
					sendWSMessage(conn, confirmMsg)
				}
			}

		case "unsubscribe":

			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				if chatIDStr, ok := payload["chatId"].(string); ok {
					log.Printf("User %s unsubscribing from chat %s", userID, chatIDStr)

					confirmMsg := WSMessage{
						Type:    "unsubscribed",
						Payload: map[string]interface{}{"chatId": chatIDStr},
					}
					sendWSMessage(conn, confirmMsg)
				}
			}

		default:
			log.Printf("Received unknown message type: %s", msg.Type)
		}
	}
}

func SendToUser(userID string, message WSMessage) {
	clientsMutex.RLock()
	conns, ok := clients[userID]
	clientsMutex.RUnlock()

	if !ok {
		return
	}

	for _, conn := range conns {
		if err := sendWSMessage(conn, message); err != nil {
			log.Printf("Error sending to user %s: %v", userID, err)
		}
	}
}

func SendToChat(chatID uuid.UUID, message WSMessage, excludeUserID string) {

	members, err := getChatMembers(chatID)
	if err != nil {
		log.Printf("Error getting chat members: %v", err)
		return
	}

	for _, member := range members {
		userID := member.ID.String()
		if userID != excludeUserID {
			SendToUser(userID, message)
		}
	}
}

func sendWSMessage(conn *websocket.Conn, message WSMessage) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, data)
}
