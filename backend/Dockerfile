
FROM golang:1.20-alpine AS build

WORKDIR /app
COPY go.mod ./
RUN touch go.sum
RUN go mod tidy && go mod download && go mod verify
COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o qrconnect-backend .

FROM alpine:latest

WORKDIR /app

COPY --from=build /app/qrconnect-backend .

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["./qrconnect-backend"]
