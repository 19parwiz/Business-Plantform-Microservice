package middleware

import (
	proto "github.com/19parwiz/api-gateway/pkg/protos/gen/golang"
	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func AuthMiddleware(userClient proto.AuthClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		email := c.GetHeader("X-Email")
		password := c.GetHeader("X-Password")

		if email == "" || password == "" {
			c.JSON(400, gin.H{"error": "X-Email and X-Password headers are required"})
			c.Abort()
			return
		}

		authReq := &proto.AuthRequest{
			Email:    email,
			Password: password,
		}

		authResp, err := userClient.AuthenticateUser(c.Request.Context(), authReq)
		if err != nil {
			st, ok := status.FromError(err)
			if ok {
				switch st.Code() {
				case codes.Unauthenticated, codes.NotFound:
					// Treat unknown user and wrong password the same to avoid account enumeration.
					c.JSON(401, gin.H{"error": "authentication failed"})
				case codes.InvalidArgument:
					c.JSON(400, gin.H{"error": "invalid authentication headers"})
				default:
					c.JSON(500, gin.H{"error": "internal server error"})
				}
			} else {
				c.JSON(500, gin.H{"error": "internal server error"})
			}
			c.Abort()
			return
		}

		if !authResp.Authenticated {
			c.JSON(401, gin.H{"error": "authentication failed"})
			c.Abort()
			return
		}

		c.Set("user_id", authResp.UserId)
		c.Next()
	}
}
