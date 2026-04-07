package usecase

import (
	"context"
	"fmt"
	"github.com/19parwiz/inventory-service/internal/adapter/postgres"
	"github.com/19parwiz/inventory-service/internal/domain"
	"strings"
	"time"
)

type Product struct {
	aiRepo auto_inc_Repo
	repo   product_Repo
}

func NewProduct(aiRepo auto_inc_Repo, repo product_Repo) *Product {
	return &Product{
		aiRepo: aiRepo,
		repo:   repo,
	}
}

func (p *Product) Create(ctx context.Context, product domain.Product) (domain.Product, error) {
	if strings.TrimSpace(product.Name) == "" || strings.TrimSpace(product.Category) == "" {
		return domain.Product{}, fmt.Errorf("%w: name and category are required", domain.ErrInvalidProduct)
	}
	if product.Price < 0 {
		return domain.Product{}, fmt.Errorf("%w: price cannot be negative", domain.ErrInvalidProduct)
	}

	id, err := p.aiRepo.Next(ctx, postgres.CollectionProducts)
	if err != nil {
		return domain.Product{}, err
	}
	product.ID = id
	err = p.repo.Create(ctx, product)
	if err != nil {
		return domain.Product{}, err
	}
	return domain.Product{
		ID:   id,
		Name: product.Name,
	}, nil
}

func (p *Product) Get(ctx context.Context, pf domain.ProductFilter) (domain.Product, error) {
	product, err := p.repo.GetWithFilter(ctx, pf)
	if err != nil {
		return domain.Product{}, err
	}
	return product, nil
}

func (p *Product) GetAll(ctx context.Context, pf domain.ProductFilter, page, limit int64) ([]domain.Product, int, error) {
	// Keep API behavior predictable for UI consumers.
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	products, totalCount, err := p.repo.GetListWithFilter(ctx, pf, page, limit)
	if err != nil {
		return nil, 0, err
	}
	return products, totalCount, nil
}

func (p *Product) Update(ctx context.Context, filter domain.ProductFilter, updated domain.ProductUpdateData) error {
	if updated.Name != nil && strings.TrimSpace(*updated.Name) == "" {
		return fmt.Errorf("%w: name cannot be empty", domain.ErrInvalidProduct)
	}
	if updated.Category != nil && strings.TrimSpace(*updated.Category) == "" {
		return fmt.Errorf("%w: category cannot be empty", domain.ErrInvalidProduct)
	}
	if updated.Price != nil && *updated.Price < 0 {
		return fmt.Errorf("%w: price cannot be negative", domain.ErrInvalidProduct)
	}

	updated.UpdatedAt = func() *time.Time { t := time.Now(); return &t }()
	err := p.repo.Update(ctx, filter, updated)
	if err != nil {
		return err
	}
	return nil
}

func (p *Product) Delete(ctx context.Context, filter domain.ProductFilter) error {
	err := p.repo.Delete(ctx, filter)
	if err != nil {
		return err
	}
	return nil
}
