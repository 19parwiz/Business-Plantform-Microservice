package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/19parwiz/inventory-service/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProductRepo struct {
	pool *pgxpool.Pool
}

func NewProductRepo(pool *pgxpool.Pool) *ProductRepo {
	return &ProductRepo{pool: pool}
}

func (p *ProductRepo) Create(ctx context.Context, product domain.Product) error {
	now := time.Now()
	if product.CreatedAt.IsZero() {
		product.CreatedAt = now
	}
	if product.UpdatedAt.IsZero() {
		product.UpdatedAt = now
	}

	_, err := p.pool.Exec(ctx,
		`INSERT INTO products (id, name, category, price, stock, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		int64(product.ID),
		product.Name,
		product.Category,
		product.Price,
		int64(product.Stock),
		product.CreatedAt,
		product.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("product with ID %d has not been created: %w", product.ID, err)
	}
	return nil
}

func (p *ProductRepo) Update(ctx context.Context, filter domain.ProductFilter, update domain.ProductUpdateData) error {
	setClauses := make([]string, 0, 5)
	args := make([]any, 0, 8)
	argPos := 1

	if update.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argPos))
		args = append(args, *update.Name)
		argPos++
	}
	if update.Category != nil {
		setClauses = append(setClauses, fmt.Sprintf("category = $%d", argPos))
		args = append(args, *update.Category)
		argPos++
	}
	if update.Price != nil {
		setClauses = append(setClauses, fmt.Sprintf("price = $%d", argPos))
		args = append(args, *update.Price)
		argPos++
	}
	if update.Stock != nil {
		setClauses = append(setClauses, fmt.Sprintf("stock = $%d", argPos))
		args = append(args, int64(*update.Stock))
		argPos++
	}
	if update.UpdatedAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argPos))
		args = append(args, *update.UpdatedAt)
		argPos++
	}
	if len(setClauses) == 0 {
		return nil
	}

	where, whereArgs, _ := productFilterToWhere(filter, argPos)
	if where == "" {
		return domain.ErrProductNotFound
	}
	args = append(args, whereArgs...)

	query := fmt.Sprintf("UPDATE products SET %s WHERE %s", strings.Join(setClauses, ", "), where)
	tag, err := p.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("product has not been updated with filter: %v, err: %w", filter, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("product has not been updated with filter: %v", filter)
	}
	return nil
}

func (p *ProductRepo) GetWithFilter(ctx context.Context, filter domain.ProductFilter) (domain.Product, error) {
	where, args, _ := productFilterToWhere(filter, 1)
	if where == "" {
		return domain.Product{}, domain.ErrProductNotFound
	}

	query := fmt.Sprintf(`
SELECT id, name, category, price, stock, created_at, updated_at
FROM products
WHERE %s
LIMIT 1`, where)

	var (
		product domain.Product
		id, st int64
	)
	err := p.pool.QueryRow(ctx, query, args...).Scan(
		&id,
		&product.Name,
		&product.Category,
		&product.Price,
		&st,
		&product.CreatedAt,
		&product.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Product{}, domain.ErrProductNotFound
		}
		return domain.Product{}, fmt.Errorf("failed to find product: %w", err)
	}
	product.ID = uint64(id)
	product.Stock = uint64(st)
	return product, nil
}

func (p *ProductRepo) GetListWithFilter(ctx context.Context, filter domain.ProductFilter, page, limit int64) ([]domain.Product, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	where, args, nextPos := productFilterToWhere(filter, 1)

	countQuery := "SELECT COUNT(*) FROM products"
	if where != "" {
		countQuery += " WHERE " + where
	}
	var total int64
	if err := p.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQuery := `SELECT id, name, category, price, stock, created_at, updated_at FROM products`
	if where != "" {
		listQuery += " WHERE " + where
	}
	listQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", nextPos, nextPos+1)
	listArgs := append(args, limit, offset)

	rows, err := p.pool.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to find products: %w", err)
	}
	defer rows.Close()

	products := make([]domain.Product, 0)
	for rows.Next() {
		var (
			product domain.Product
			id, st  int64
		)
		if err := rows.Scan(&id, &product.Name, &product.Category, &product.Price, &st, &product.CreatedAt, &product.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("failed to decode products: %w", err)
		}
		product.ID = uint64(id)
		product.Stock = uint64(st)
		products = append(products, product)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return products, int(total), nil
}

func (p *ProductRepo) Delete(ctx context.Context, filter domain.ProductFilter) error {
	where, args, _ := productFilterToWhere(filter, 1)
	if where == "" {
		return domain.ErrProductNotFound
	}

	query := fmt.Sprintf("DELETE FROM products WHERE %s", where)
	tag, err := p.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("product has not been deleted with filter: %v, err: %w", filter, err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrProductNotFound
	}
	return nil
}

func productFilterToWhere(filter domain.ProductFilter, argStart int) (string, []any, int) {
	clauses := make([]string, 0, 4)
	args := make([]any, 0, 4)
	argPos := argStart

	if filter.ID != nil {
		clauses = append(clauses, fmt.Sprintf("id = $%d", argPos))
		args = append(args, int64(*filter.ID))
		argPos++
	}
	if filter.Name != nil {
		clauses = append(clauses, fmt.Sprintf("name = $%d", argPos))
		args = append(args, *filter.Name)
		argPos++
	}
	if filter.Category != nil {
		clauses = append(clauses, fmt.Sprintf("category = $%d", argPos))
		args = append(args, *filter.Category)
		argPos++
	}
	if filter.Price != nil {
		clauses = append(clauses, fmt.Sprintf("price = $%d", argPos))
		args = append(args, *filter.Price)
		argPos++
	}
	if filter.Stock != nil {
		clauses = append(clauses, fmt.Sprintf("stock = $%d", argPos))
		args = append(args, int64(*filter.Stock))
		argPos++
	}

	return strings.Join(clauses, " AND "), args, argPos
}
