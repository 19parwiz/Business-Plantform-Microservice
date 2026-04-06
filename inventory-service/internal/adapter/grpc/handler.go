package grpc

import (
	"context"
	"errors"
	"github.com/19parwiz/inventory-service/internal/adapter/grpc/dto"
	"github.com/19parwiz/inventory-service/internal/domain"
	"github.com/19parwiz/inventory-service/internal/usecase"
	proto "github.com/19parwiz/inventory-service/protos/gen/golang"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"log"
)

type InventoryGRPCServer struct {
	proto.UnimplementedInventoryServiceServer
	productUsecase *usecase.Product
}

func NewInventoryGRPCServer(productUsecase *usecase.Product) *InventoryGRPCServer {
	return &InventoryGRPCServer{productUsecase: productUsecase}
}

func (s *InventoryGRPCServer) CreateProduct(ctx context.Context, req *proto.CreateProductRequest) (*proto.ProductResponse, error) {
	log.Println("CreateProduct")
	requestDTO := dto.FromCreateRequestProto(req)
	domainProduct := requestDTO.ToProduct()
	log.Println(domainProduct)

	createdProduct, err := s.productUsecase.Create(ctx, domainProduct)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidProduct) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	responseDTO := dto.FromProduct(createdProduct)
	return responseDTO.ToProtoProductResponse(), nil
}

func (s *InventoryGRPCServer) GetProduct(ctx context.Context, req *proto.GetProductRequest) (*proto.ProductResponse, error) {
	requestDTO := dto.FromGetRequestProto(req)
	filter := requestDTO.ToDomainFilter()

	product, err := s.productUsecase.Get(ctx, filter)
	if err != nil {
		if errors.Is(err, domain.ErrProductNotFound) {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	responseDTO := dto.FromProduct(product)
	return responseDTO.ToProtoProductResponse(), nil
}

func (s *InventoryGRPCServer) UpdateProduct(ctx context.Context, req *proto.UpdateProductRequest) (*proto.ProductResponse, error) {
	requestDTO := dto.FromUpdateRequestProto(req)
	filter, update := requestDTO.ToDomainFilterAndUpdate()

	err := s.productUsecase.Update(ctx, filter, update)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidProduct) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	updatedProduct, err := s.productUsecase.Get(ctx, filter)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	responseDTO := dto.FromProduct(updatedProduct)
	return responseDTO.ToProtoProductResponse(), nil
}

func (s *InventoryGRPCServer) ListProducts(ctx context.Context, req *proto.ListProductsRequest) (*proto.ListProductsResponse, error) {
	requestDTO := dto.FromListRequestProto(req)
	filter := requestDTO.ToDomainFilter()

	products, total, err := s.productUsecase.GetAll(ctx, filter, requestDTO.Page, requestDTO.Limit)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	response := &proto.ListProductsResponse{
		Products: make([]*proto.ProductResponse, len(products)),
		Total:    int64(total),
	}
	for i, prod := range products {
		responseDTO := dto.FromProduct(prod)
		response.Products[i] = responseDTO.ToProtoProductResponse()
	}

	return response, nil
}

func (s *InventoryGRPCServer) DeleteProduct(ctx context.Context, req *proto.DeleteProductRequest) (*proto.DeleteProductResponse, error) {
	requestDTO := dto.FromDeleteRequestProto(req)
	filter := requestDTO.ToDomainFilter()

	err := s.productUsecase.Delete(ctx, filter)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &proto.DeleteProductResponse{Message: "Product deleted successfully"}, nil
}
