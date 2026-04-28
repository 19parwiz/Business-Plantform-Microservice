package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AutoInc hands out the next numeric id for a named "collection" (e.g. users).
// We use a tiny Postgres table so ids stay unique even though several services share one database.
type AutoInc struct {
	pool *pgxpool.Pool
}

func NewAutoInc(pool *pgxpool.Pool) *AutoInc {
	return &AutoInc{pool: pool}
}

// Next does insert-or-bump in one round trip: first row wins 1, later calls add 1.
func (a *AutoInc) Next(ctx context.Context, coll string) (uint64, error) {
	query := `
INSERT INTO user_auto_inc_ids (collection_name, counter)
VALUES ($1, 1)
ON CONFLICT (collection_name)
DO UPDATE SET counter = user_auto_inc_ids.counter + 1
RETURNING counter;
`
	var nextID int64
	if err := a.pool.QueryRow(ctx, query, coll).Scan(&nextID); err != nil {
		return 0, fmt.Errorf("failed to get next id for %s: %w", coll, err)
	}
	return uint64(nextID), nil
}
