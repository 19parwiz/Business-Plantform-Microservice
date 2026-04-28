package postgres

import "github.com/19parwiz/user-service/internal/domain"

// Row key in user_auto_inc_ids — must match what the use case passes to AutoInc.Next.
const (
	CollectionUsers = domain.UserDB
)
