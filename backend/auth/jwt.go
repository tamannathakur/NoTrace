package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

var JwtSecret = []byte("your-secret-key-here")

type JwtClaims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

func CreateToken(userID string, expiration time.Duration) (string, error) {
	claims := JwtClaims{
		userID,
		jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(JwtSecret)
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

func ParseToken(tokenString string) (*JwtClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JwtClaims{}, func(token *jwt.Token) (interface{}, error) {
		return JwtSecret, nil
	})

	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*JwtClaims)
	if !ok {
		return nil, errors.New("invalid claims")
	}

	return claims, nil
}
