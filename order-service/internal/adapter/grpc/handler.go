package grpc

import (
	"context"
	"errors"
	"strings"
	"github.com/19parwiz/order-service/internal/adapter/grpc/dto"
	"github.com/19parwiz/order-service/internal/domain"
	"github.com/19parwiz/order-service/internal/usecase"
	proto "github.com/19parwiz/order-service/protos/gen/golang"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type OrderGRPCServer struct {
	proto.UnimplementedOrderServiceServer
	orderUsecase *usecase.Order
}

func NewOrderGRPCServer(orderUsecase *usecase.Order) *OrderGRPCServer {
	return &OrderGRPCServer{
		orderUsecase: orderUsecase,
	}
}

func (s *OrderGRPCServer) CreateOrder(ctx context.Context, req *proto.CreateOrderRequest) (*proto.OrderResponse, error) {
	requestDTO := dto.FromCreateOrderRequestProto(req)

	domainOrder := requestDTO.ToDomainOrder()
	createdOrder, err := s.orderUsecase.Create(ctx, domainOrder)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidOrder) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		// Pass through downstream gRPC statuses (e.g. inventory NotFound) so gateway can map cleanly.
		if st, ok := status.FromError(err); ok {
			switch st.Code() {
			case codes.NotFound, codes.InvalidArgument, codes.FailedPrecondition, codes.Unavailable:
				return nil, status.Error(st.Code(), st.Message())
			}
		}
		if strings.Contains(strings.ToLower(err.Error()), "insufficient stock") {
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	responseDTO := dto.FromDomainOrder(createdOrder)
	return responseDTO.ToProtoOrderResponse(), nil
}

func (s *OrderGRPCServer) GetOrder(ctx context.Context, req *proto.GetOrderRequest) (*proto.OrderResponse, error) {
	requestDTO := dto.FromGetOrderRequestProto(req)
	filter := requestDTO.ToDomainFilter()

	order, err := s.orderUsecase.Get(ctx, filter)
	if err != nil {
		if errors.Is(err, domain.ErrOrderNotFound) {
			return nil, status.Error(codes.NotFound, "order not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	responseDTO := dto.FromDomainOrder(order)
	return responseDTO.ToProtoOrderResponse(), nil
}

func (s *OrderGRPCServer) UpdateOrder(ctx context.Context, req *proto.UpdateOrderRequest) (*proto.OrderResponse, error) {
	requestDTO := dto.FromUpdateOrderRequestProto(req)
	filter, update := requestDTO.ToDomainFilterAndUpdate()

	err := s.orderUsecase.Update(ctx, filter, update)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrOrderNotFound):
			return nil, status.Error(codes.NotFound, err.Error())
		case errors.Is(err, domain.ErrInvalidOrderStatus), errors.Is(err, domain.ErrInvalidOrderStatusTransition):
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	updatedOrder, err := s.orderUsecase.Get(ctx, filter)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	responseDTO := dto.FromDomainOrder(updatedOrder)
	return responseDTO.ToProtoOrderResponse(), nil
}

func (s *OrderGRPCServer) ListOrders(ctx context.Context, req *proto.ListOrdersRequest) (*proto.ListOrdersResponse, error) {
	requestDTO := dto.FromListOrdersRequestProto(req)
	filter := domain.OrderFilter{UserID: &requestDTO.UserID}

	orders, total, err := s.orderUsecase.GetAll(ctx, filter, requestDTO.Page, requestDTO.Limit)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	response := &proto.ListOrdersResponse{
		Orders: make([]*proto.OrderResponse, len(orders)),
		Total:  total,
	}
	for i, ord := range orders {
		responseDTO := dto.FromDomainOrder(ord)
		response.Orders[i] = responseDTO.ToProtoOrderResponse()
	}

	return response, nil
}
