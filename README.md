
# NoTrace Chat App

A secure chat application that uses QR codes to establish connections between users.

## Features

- User authentication (register, login)
- QR code generation for secure connections
- QR code scanning to establish chat connections
- Real-time messaging with WebSocket integration
- Message read status and disappearing messages
- Organized chats with folders

## Project Structure

- `/src` - Frontend React application
- `/backend` - Go backend API

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- Go (v1.16+)
- PostgreSQL (v12+)
- Docker and Docker Compose (optional)

### Running with Docker

The easiest way to get started is using Docker:

1. Clone this repository
2. Copy the example environment file: `cp backend/.env.example backend/.env`
3. Start the application: `docker-compose up -d`
4. Access the frontend at: http://localhost:3000
5. API is available at: http://localhost:8080/api

### Manual Setup

#### Backend

1. Navigate to the backend directory: `cd backend`
2. Copy the example environment file: `cp .env.example .env`
3. Edit the .env file with your database connection details
4. Install dependencies: `go mod download`
5. Run the application: `go run .`

#### Frontend

1. Install dependencies: `npm install`
2. Create a `.env` file with the following content:
   ```
   VITE_API_URL=http://localhost:8080/api
   VITE_WS_URL=ws://localhost:8080/ws
   ```
3. Start the development server: `npm run dev`

## API Documentation

The API provides endpoints for:

- User authentication
- Chat management
- Messaging
- QR code generation and verification

See the API endpoints in `src/config/api.ts` for a complete list of available endpoints.

## Technologies Used

### Frontend
- React (with Vite)
- TailwindCSS
- Shadcn UI components
- WebSockets for real-time communication

### Backend
- Go
- Gin web framework
- PostgreSQL database
- JWT authentication
- WebSockets (Gorilla)
