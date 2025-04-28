
# NoTrace Chat App

A secure chat application that uses QR codes to establish connections between users.

https://github.com/user-attachments/assets/b2be2e0e-d975-44f0-8871-9e197c9de3a2

## Features

- User authentication (register, login)
- QR code generation for secure connections
- QR code scanning to establish chat connections
- Real-time messaging with WebSocket integration

## Project Structure

- `/src` - Frontend React application
- `/backend` - Go backend API

## Setup Instructions

### Prerequisites

- Node.js
- Go 
- PostgreSQL


### Manual Setup

#### Backend

RUN BACKEND ON PORT 8080

1. Navigate to the backend directory: `cd backend`
2. Edit the .env file with your database connection details
3. Install dependencies: `go mod download`
4. Run the application: `go run .`

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


## Technologies Used

### Frontend
- React (with Vite)
- TailwindCSS
- WebSockets for real-time communication

### Backend
- Go
- PostgreSQL database
- WebSockets (Gorilla)
