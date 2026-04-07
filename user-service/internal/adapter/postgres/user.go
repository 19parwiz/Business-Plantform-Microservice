package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/19parwiz/user-service/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

func (u *UserRepo) Create(ctx context.Context, user domain.User) error {
	now := time.Now()
	if user.CreatedAt.IsZero() {
		user.CreatedAt = now
	}
	if user.UpdatedAt.IsZero() {
		user.UpdatedAt = now
	}

	_, err := u.pool.Exec(ctx,
		`INSERT INTO users (id, name, email, email_confirm_token, hashed_password, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		int64(user.ID),
		user.Name,
		user.Email,
		user.EmailConfirmToken,
		user.HashedPassword,
		user.CreatedAt,
		user.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.ErrUserExists
		}
		return fmt.Errorf("failed to insert user: %w", err)
	}
	return nil
}

func (u *UserRepo) GetWithFilter(ctx context.Context, filter domain.UserFilter) (domain.User, error) {
	where, args, _ := userFilterToWhere(filter, 1)
	if where == "" {
		return domain.User{}, domain.ErrUserNotFound
	}

	query := fmt.Sprintf(`
SELECT id, name, email, email_confirm_token, hashed_password, created_at, updated_at
FROM users
WHERE %s
LIMIT 1`, where)

	var (
		user domain.User
		id   int64
	)
	err := u.pool.QueryRow(ctx, query, args...).Scan(
		&id,
		&user.Name,
		&user.Email,
		&user.EmailConfirmToken,
		&user.HashedPassword,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrUserNotFound
		}
		return domain.User{}, fmt.Errorf("failed to get user: %w", err)
	}
	user.ID = uint64(id)
	return user, nil
}

func (u *UserRepo) Update(ctx context.Context, filter domain.UserFilter, update domain.UserUpdate) error {
	setClauses := make([]string, 0, 4)
	args := make([]any, 0, 6)
	argPos := 1

	if update.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argPos))
		args = append(args, *update.Name)
		argPos++
	}
	if update.Email != nil {
		setClauses = append(setClauses, fmt.Sprintf("email = $%d", argPos))
		args = append(args, *update.Email)
		argPos++
	}
	if update.HashedPassword != nil {
		setClauses = append(setClauses, fmt.Sprintf("hashed_password = $%d", argPos))
		args = append(args, *update.HashedPassword)
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

	where, whereArgs, _ := userFilterToWhere(filter, argPos)
	if where == "" {
		return domain.ErrUserNotFound
	}
	args = append(args, whereArgs...)

	query := fmt.Sprintf("UPDATE users SET %s WHERE %s", strings.Join(setClauses, ", "), where)
	tag, err := u.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (u *UserRepo) Delete(ctx context.Context, filter domain.UserFilter) error {
	where, args, _ := userFilterToWhere(filter, 1)
	if where == "" {
		return domain.ErrUserNotFound
	}

	query := fmt.Sprintf("DELETE FROM users WHERE %s", where)
	tag, err := u.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func userFilterToWhere(filter domain.UserFilter, argStart int) (string, []any, int) {
	clauses := make([]string, 0, 3)
	args := make([]any, 0, 3)
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
	if filter.Email != nil {
		clauses = append(clauses, fmt.Sprintf("email = $%d", argPos))
		args = append(args, *filter.Email)
		argPos++
	}

	return strings.Join(clauses, " AND "), args, argPos
}
