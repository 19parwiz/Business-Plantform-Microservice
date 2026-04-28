package handler

import (
	proto "github.com/19parwiz/api-gateway/pkg/protos/gen/golang"
	"github.com/gin-gonic/gin"
	"google.golang.org/protobuf/encoding/protojson"
	"net/http"
	"strconv"
)

func (h *Handler) RegisterUser(c *gin.Context) {
	var req proto.UserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	resp, err := h.Clients.User.RegisterUser(c.Request.Context(), &req)
	if err != nil {
		code, msg := mapGRPCErrorToHTTP(err)
		c.JSON(code, gin.H{"error": msg})
		return
	}

	jsonBytes, err := protojson.Marshal(resp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal response"})
		return
	}

	c.Data(http.StatusOK, "application/json", jsonBytes)
}

func (h *Handler) GetUserProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	req := &proto.UserID{UserId: userID.(uint64)}
	resp, err := h.Clients.User.GetUserProfile(c.Request.Context(), req)
	if err != nil {
		code, msg := mapGRPCErrorToHTTP(err)
		c.JSON(code, gin.H{"error": msg})
		return
	}

	jsonBytes, err := protojson.Marshal(resp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal response"})
		return
	}

	c.Data(http.StatusOK, "application/json", jsonBytes)
}

func requireAdmin(c *gin.Context) (uint64, bool) {
	userIDAny, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return 0, false
	}
	userID, ok := userIDAny.(uint64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user identity"})
		return 0, false
	}
	// Demo guard: first account is admin.
	if userID != 1 {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return 0, false
	}
	return userID, true
}

func (h *Handler) ListUsers(c *gin.Context) {
	if _, ok := requireAdmin(c); !ok {
		return
	}

	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}

	req := &proto.ListUsersRequest{Page: page, Limit: limit}
	resp, err := h.Clients.User.ListUsers(c.Request.Context(), req)
	if err != nil {
		code, msg := mapGRPCErrorToHTTP(err)
		c.JSON(code, gin.H{"error": msg})
		return
	}

	jsonBytes, err := protojson.Marshal(resp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal response"})
		return
	}
	c.Data(http.StatusOK, "application/json", jsonBytes)
}

func (h *Handler) UpdateOwnProfile(c *gin.Context) {
	userIDAny, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	userID, ok := userIDAny.(uint64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user identity"})
		return
	}
	var body struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	req := &proto.UpdateUserRequest{
		UserId:   userID,
		Email:    body.Email,
		Name:     body.Name,
		Password: body.Password,
	}
	resp, err := h.Clients.User.UpdateUser(c.Request.Context(), req)
	if err != nil {
		code, msg := mapGRPCErrorToHTTP(err)
		c.JSON(code, gin.H{"error": msg})
		return
	}
	jsonBytes, err := protojson.Marshal(resp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal response"})
		return
	}
	c.Data(http.StatusOK, "application/json", jsonBytes)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	if _, ok := requireAdmin(c); !ok {
		return
	}
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}
	var body struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	req := &proto.UpdateUserRequest{
		UserId:   id,
		Email:    body.Email,
		Name:     body.Name,
		Password: body.Password,
	}
	resp, err := h.Clients.User.UpdateUser(c.Request.Context(), req)
	if err != nil {
		code, msg := mapGRPCErrorToHTTP(err)
		c.JSON(code, gin.H{"error": msg})
		return
	}
	jsonBytes, err := protojson.Marshal(resp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal response"})
		return
	}
	c.Data(http.StatusOK, "application/json", jsonBytes)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	adminID, ok := requireAdmin(c)
	if !ok {
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}
	if id == adminID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "admin cannot delete self"})
		return
	}

	req := &proto.UserID{UserId: id}
	resp, err := h.Clients.User.DeleteUser(c.Request.Context(), req)
	if err != nil {
		code, msg := mapGRPCErrorToHTTP(err)
		c.JSON(code, gin.H{"error": msg})
		return
	}

	jsonBytes, err := protojson.Marshal(resp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal response"})
		return
	}
	c.Data(http.StatusOK, "application/json", jsonBytes)
}
