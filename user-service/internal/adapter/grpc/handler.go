package grpc

import (
	"context"
	"github.com/19parwiz/user-service/internal/adapter/grpc/dto"
	"github.com/19parwiz/user-service/internal/domain"
	"github.com/19parwiz/user-service/internal/usecase"
	proto "github.com/19parwiz/user-service/protos/gen/golang"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type UserGRPCServer struct {
	proto.UnimplementedAuthServer
	userUsecase usecase.UserUsecase
}

func NewUserGRPCServer(userUsecase usecase.UserUsecase) *UserGRPCServer {
	return &UserGRPCServer{userUsecase: userUsecase}
}

func (s *UserGRPCServer) RegisterUser(ctx context.Context, req *proto.UserRequest) (*proto.UserResponse, error) {
	requestDTO := dto.FromRegisterUserRequestProto(req)

	// Validate
	if err := requestDTO.ValidateUserRequest(); err != nil {
		return nil, err
	}

	user, err := s.userUsecase.Register(ctx, requestDTO.ToDomainUserRequest())
	if err != nil {
		switch err {
		case domain.ErrUserExists:
			return nil, status.Error(codes.AlreadyExists, "user already exists")
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	// Convert domain to DTO and protobuf
	responseDTO := dto.FromRegisterUserDomain(user)
	return responseDTO.ToProtoUserResponse(), nil
}

func (s *UserGRPCServer) AuthenticateUser(ctx context.Context, req *proto.AuthRequest) (*proto.AuthResponse, error) {
	// Convert protobuf to DTO
	requestDTO := dto.FromAuthenticateUserRequestProto(req)

	// Validate
	if err := requestDTO.ValidateAuthRequest(); err != nil {
		return nil, err
	}

	// Call usecase
	user, err := s.userUsecase.Authenticate(ctx, requestDTO.ToDomainAuthRequest())
	if err != nil {
		switch err {
		case domain.ErrUserNotFound:
			return nil, status.Error(codes.NotFound, "user not found")
		case domain.ErrInvalidPassword:
			return nil, status.Error(codes.Unauthenticated, "invalid password")
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	// Convert domain to DTO and protobuf
	responseDTO := dto.FromAuthenticateUserDomain(user)
	return responseDTO.ToProtoAuthResponse(), nil
}

func (s *UserGRPCServer) GetUserProfile(ctx context.Context, req *proto.UserID) (*proto.UserProfile, error) {
	// Convert protobuf to DTO
	requestDTO := dto.FromGetRequestProto(req)

	// Validate
	if err := requestDTO.ValidateUserID(); err != nil {
		return nil, err
	}

	// Call usecase
	user, err := s.userUsecase.Get(ctx, requestDTO.ToDomainFilterUserID())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if user.ID == 0 {
		return nil, status.Error(codes.NotFound, "user not found")
	}

	// Convert domain to DTO and protobuf
	responseDTO := dto.FromUserProfileDomain(user)
	return responseDTO.ToProtoUserProfile(), nil
}

func (s *UserGRPCServer) ListUsers(ctx context.Context, req *proto.ListUsersRequest) (*proto.ListUsersResponse, error) {
	page := req.GetPage()
	limit := req.GetLimit()
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	users, total, err := s.userUsecase.List(ctx, page, limit)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	out := &proto.ListUsersResponse{
		Users: make([]*proto.UserProfile, 0, len(users)),
		Total: total,
	}
	for _, u := range users {
		out.Users = append(out.Users, &proto.UserProfile{
			UserId: u.ID,
			Email:  u.Email,
			Name:   u.Name,
		})
	}
	return out, nil
}

func (s *UserGRPCServer) UpdateUser(ctx context.Context, req *proto.UpdateUserRequest) (*proto.UserProfile, error) {
	if req.GetUserId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}
	filter := domain.UserFilter{ID: &req.UserId}
	email := req.GetEmail()
	name := req.GetName()
	password := req.GetPassword()

	updatedUser, err := s.userUsecase.Update(ctx, filter, &name, &email, &password)
	if err != nil {
		switch err {
		case domain.ErrInvalidUserUpdate:
			return nil, status.Error(codes.InvalidArgument, "at least one field is required")
		case domain.ErrUserNotFound:
			return nil, status.Error(codes.NotFound, "user not found")
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}
	return &proto.UserProfile{
		UserId: updatedUser.ID,
		Email:  updatedUser.Email,
		Name:   updatedUser.Name,
	}, nil
}

func (s *UserGRPCServer) DeleteUser(ctx context.Context, req *proto.UserID) (*proto.DeleteUserResponse, error) {
	if req.GetUserId() == 0 {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	filter := domain.UserFilter{ID: &req.UserId}
	if err := s.userUsecase.Delete(ctx, filter); err != nil {
		if err == domain.ErrUserNotFound {
			return nil, status.Error(codes.NotFound, "user not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &proto.DeleteUserResponse{Message: "user deleted"}, nil
}
