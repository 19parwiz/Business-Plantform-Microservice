# Project Report — Flower Shop / AgroTech Fresh Business Platform

**Date:** May 2, 2026  
**Repository:** `github.com/19parwiz/...` (monorepo)  
**Language:** Go 1.23.5 (backend), Vanilla HTML/CSS/ES Modules (frontend)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Repository Structure](#3-repository-structure)
4. [Services](#4-services)
   - 4.1 [api-gateway](#41-api-gateway)
   - 4.2 [user-service](#42-user-service)
   - 4.3 [inventory-service](#43-inventory-service)
   - 4.4 [order-service](#44-order-service)
5. [Frontend](#5-frontend)
6. [Infrastructure & Configuration](#6-infrastructure--configuration)
7. [Database Design](#7-database-design)
8. [Messaging (Kafka)](#8-messaging-kafka)
9. [API Reference Summary](#9-api-reference-summary)
10. [Key Algorithms & Domain Logic](#10-key-algorithms--domain-logic)
11. [Testing](#11-testing)
12. [Build & Deployment](#12-build--deployment)
13. [Dependencies](#13-dependencies)
14. [Known Issues & Design Risks](#14-known-issues--design-risks)
15. [Future Improvement Suggestions](#15-future-improvement-suggestions)

---

## 1. Executive Summary

This project is a **microservices-based e-commerce platform** for a flower/microgreens shop, branded as **"AgroTech Fresh"**. It is built using Go microservices communicating over **gRPC**, an **HTTP API gateway** (Gin), **Apache Kafka** for asynchronous order events, and **PostgreSQL** for persistence. A static multi-page HTML/CSS/JS frontend serves as the storefront, calling the API gateway over HTTP.

The platform supports user registration and authentication, a product catalog (inventory management), shopping cart and checkout flows, order lifecycle management with a status state machine, and basic sales analytics.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser / Frontend                        │
│          (Static MPA — HTML, CSS, ES Modules; port 8088)         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP (REST-like, JSON)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                          api-gateway                              │
│             Gin HTTP server — port 8080                           │
│     Auth middleware (X-Email / X-Password headers)               │
└───────┬──────────────────┬───────────────────┬───────────────────┘
        │ gRPC :50051       │ gRPC :50052        │ gRPC :50053
        ▼                   ▼                    ▼
┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ user-service │  │inventory-service │  │  order-service     │
│  port 8081   │  │  port 8082       │  │  port 8083         │
│  gRPC 50051  │  │  gRPC 50052      │  │  gRPC 50053        │
└──────┬───────┘  └────────┬─────────┘  └─────────┬──────────┘
       │                   │  gRPC (stock check)   │
       │                   │◄──────────────────────┘
       │                   │
       │     ┌─────────────┼──────────────────────┐
       │     │             │     Kafka topic        │
       │     │         order.created (protobuf)     │
       │     │             │◄────────── publish ────┘
       │     │             │─────────── consume ─────►inventory-service
       │     │             │
       ▼     ▼             ▼
┌──────────────────────────────────────────────────────────────────┐
│               PostgreSQL — database: flower_shop                  │
│   Tables: users, products, orders, order_items                   │
│   Auto-inc: user_auto_inc_ids, inventory_auto_inc_ids,           │
│             order_auto_inc_ids                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Key design choices:**

- The **api-gateway** is the sole HTTP surface. All backend services expose gRPC only (plus optional HTTP health endpoints).
- A **single PostgreSQL database** (`flower_shop`) is shared across all data services; table namespacing avoids collisions.
- **Kafka** decouples order creation from inventory stock deduction asynchronously.
- The frontend has **no build step** — plain files served from a static file server.

---

## 3. Repository Structure

```
/workspace
├── api-gateway/             # Gin HTTP BFF; gRPC clients to all services
├── user-service/            # Auth and user management (gRPC + HTTP health)
├── inventory-service/       # Product catalog (HTTP + gRPC + Kafka consumer)
├── order-service/           # Order management (HTTP + gRPC + Kafka producer)
├── frontend/                # Static MPA storefront
│   ├── html/                # HTML pages
│   ├── js/                  # ES module scripts per page
│   ├── css/                 # Global styles
│   └── assets/              # Static assets
├── deploy/
│   └── postgres-init/       # DB init scripts (currently comments only)
├── scripts/
│   ├── go-test-all.sh       # Run all Go tests (Linux/macOS)
│   └── go-test-all.ps1      # Run all Go tests (Windows)
├── docker-compose.yml       # Full stack orchestration
├── Taskfile.yml             # Root task shortcuts (run each service)
└── README.md                # Project documentation
```

Each Go service follows the same internal layout:

```
<service>/
├── cmd/main.go              # Entry point
├── config/config.go         # Env-based configuration struct
├── internal/
│   ├── app/app.go           # Wiring: DB, use-cases, adapters, servers
│   ├── domain/              # Core entities and business rules
│   ├── usecase/             # Application logic (orchestration)
│   └── adapter/
│       ├── grpc/            # gRPC server (and client where needed)
│       ├── http/            # Gin HTTP server (where applicable)
│       ├── postgres/        # Repository implementations
│       ├── kafka/           # Producer / consumer (where applicable)
│       └── mail/            # SMTP mailer (user-service only)
├── pkg/
│   ├── postgres/postgres.go # DB init and schema migration
│   └── protos/              # Generated protobuf Go code
├── protos/                  # .proto source files
├── Taskfile.yaml            # protoc codegen task
├── Dockerfile               # Multi-stage Alpine Docker image
└── go.mod / go.sum
```

---

## 4. Services

### 4.1 api-gateway

| Property | Value |
|----------|-------|
| Module | `github.com/19parwiz/api-gateway` |
| HTTP port | **8080** |
| Role | HTTP BFF; translates JSON ↔ gRPC for all downstream services |

**Responsibilities:**

- Exposes all REST-like endpoints to the frontend under `/api/v1/`.
- Applies an authentication middleware that reads `X-Email` and `X-Password` request headers and forwards credentials to `user-service` gRPC for validation on every protected request.
- Translates gRPC status codes to HTTP status codes via `mapGRPCErrorToHTTP`.
- Uses `protojson` for marshalling protobuf messages to JSON responses.

**Route table (summary):**

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/api/v1/register` | Public | Register user |
| `GET` | `/api/v1/products` | Public | List products |
| `GET` | `/api/v1/products/:id` | Protected | Get product |
| `POST` | `/api/v1/products` | Protected | Create product |
| `PUT` | `/api/v1/products/:id` | Protected | Update product |
| `DELETE` | `/api/v1/products/:id` | Protected | Delete product |
| `POST` | `/api/v1/orders` | Protected | Create order |
| `GET` | `/api/v1/orders` | Protected | List orders |
| `GET` | `/api/v1/orders/:id` | Protected | Get order |
| `PUT` | `/api/v1/orders/:id` | Protected | Update order status |
| `GET` | `/api/v1/users/profile` | Protected | Get user profile |

**Configuration variables:**

| Variable | Description |
|----------|-------------|
| `HTTP_PORT` | Gateway HTTP port (default 8080) |
| `USER_SERVICE_HOST` / `USER_SERVICE_PORT` | user-service gRPC address |
| `INVENTORY_SERVICE_HOST` / `INVENTORY_SERVICE_PORT` | inventory-service gRPC address |
| `ORDER_SERVICE_HOST` / `ORDER_SERVICE_PORT` | order-service gRPC address |

---

### 4.2 user-service

| Property | Value |
|----------|-------|
| Module | `github.com/19parwiz/user-service` |
| HTTP port | **8081** (health only) |
| gRPC port | **50051** |
| Role | Authentication and user management |

**Responsibilities:**

- Stores users in PostgreSQL with bcrypt-hashed passwords.
- Exposes a gRPC API (`sso.proto`) for registration, login (credential validation), and profile retrieval.
- Sends a welcome email on registration via SMTP (configurable; Mailhog-friendly defaults).
- Auto-creates database schema on startup (`users`, `user_auto_inc_ids` tables).

**Configuration variables:**

| Variable | Description |
|----------|-------------|
| `GRPC_PORT` | gRPC server port (50051) |
| `HTTP_PORT` | Health endpoint port (8081) |
| `POSTGRES_HOST/PORT/DB/USER/PASSWORD/SSL_MODE` | Database connection |
| `SMTP_HOST/PORT/USERNAME/PASSWORD` | Mail settings |
| `PUBLIC_APP_URL` | Used in email links |

---

### 4.3 inventory-service

| Property | Value |
|----------|-------|
| Module | `github.com/19parwiz/inventory-service` |
| HTTP port | **8082** |
| gRPC port | **50052** |
| Role | Product catalog and stock management |

**Responsibilities:**

- Full CRUD for products in PostgreSQL.
- Exposes both an HTTP API (Gin) and a gRPC API for product queries (consumed by order-service at order creation time).
- Optionally runs a **Kafka consumer group** on the `order.created` topic when `BROKERS` is set. The consumer deserializes `OrderCreatedEvent` protobuf messages and deducts stock for each line item via `ProcessOrderLineItem`.
- Auto-creates schema on startup (`products`, `inventory_auto_inc_ids` tables).

**Configuration variables:**

| Variable | Description |
|----------|-------------|
| `GRPC_PORT` | gRPC port (50052) |
| `HTTP_PORT` | HTTP port (8082) |
| `POSTGRES_*` | Database connection |
| `BROKERS` | Kafka broker addresses (comma-separated); consumer only starts when set |

---

### 4.4 order-service

| Property | Value |
|----------|-------|
| Module | `github.com/19parwiz/order-service` |
| HTTP port | **8083** |
| gRPC port | **50053** |
| Role | Order lifecycle management |

**Responsibilities:**

- Creates orders by: validating line items, calling inventory-service gRPC for each product (price and stock check), computing totals, persisting to PostgreSQL, and publishing an `OrderCreatedEvent` to the `order.created` Kafka topic.
- Enforces an **order status state machine** (see Section 10).
- Exposes HTTP API (Gin) and gRPC API for order operations.
- Auto-creates schema on startup (`orders`, `order_items`, `order_auto_inc_ids` tables).

**Configuration variables:**

| Variable | Description |
|----------|-------------|
| `GRPC_PORT` | gRPC port (50053) |
| `HTTP_PORT` | HTTP port (8083) |
| `POSTGRES_*` | Database connection |
| `BROKERS` | Kafka broker addresses |
| `INVENTORY_SERVICE_HOST/PORT` | inventory-service gRPC address |

---

## 5. Frontend

The frontend is a **static multi-page application (MPA)** — no bundler, no npm, pure HTML + CSS + ES modules loaded natively by the browser. It is served either via `python -m http.server 5500` locally or via a containerised Nginx (port **8088** in Docker Compose).

**Pages:**

| File | Script | Purpose |
|------|--------|---------|
| `html/index.html` | `js/home-page.js` | Home hero + embedded product catalog (search, category chips, grid, cart strip) |
| `html/shop.html` | — | Redirects to `index.html#catalog` |
| `html/auth.html` | `js/auth-page.js` | Combined login + register form |
| `html/cart.html` | — | Shopping cart (sessionStorage) |
| `html/checkout.html` | — | Checkout summary + order POST |
| `html/payment.html` | — | Demo payment info page |
| `html/favorites.html` | `js/favorites-page.js` | Saved favourites list |
| `html/analytics.html` | `js/analytics-page.js` | Sales insights (Chart.js CDN — doughnut + bar charts) |
| `html/orders.html` | — | Order list (`GET /api/v1/orders`) |
| `html/order.html` | — | Order detail (`GET /api/v1/orders/:id`) |
| `html/profile.html` | — | User profile (`GET /api/v1/users/profile`) |
| `html/admin.html` | — | Admin tabs: product CRUD, order management, user profile |
| `html/dashboard.html` | — | Admin dashboard |
| `html/about.html` | `js/about-page.js` | About us page |

**Key JavaScript modules:**

| File | Role |
|------|------|
| `js/config.js` | Reads `<meta name="api-base">` for the gateway URL; `SKIP_AUTH_GUARD` flag |
| `js/api.js` | Centralised fetch wrapper; injects `X-Email` / `X-Password` headers from sessionStorage |
| `js/site-shell.js` | Renders sticky navigation header with auth-aware links; calls `welcome.js` |
| `js/welcome.js` | Dynamic time-of-day greeting with store name and tagline |
| `js/cart-store.js` | Cart state backed by `sessionStorage` |
| `js/favorites-store.js` | Favourites state backed by `sessionStorage` |
| `js/product-images.js` | Fallback product photos from curated Unsplash/Pexels URLs |

**Authentication:** Header-based demo auth — `X-Email` and `X-Password` sent with every protected API call. `SKIP_AUTH_GUARD = true` (default) allows UI preview without login. Set it to `false` to enforce redirects.

---

## 6. Infrastructure & Configuration

### Docker Compose services

| Service | Image / Build | Ports | Purpose |
|---------|--------------|-------|---------|
| `postgres` | `postgres:16` | 5432 | Shared database |
| `redis` | `redis:latest` | 6379 | Optional (not used by current Go code) |
| `zookeeper` | `confluentinc/cp-zookeeper:7.6.1` | 2181 | Kafka coordination |
| `kafka` | `confluentinc/cp-kafka:7.6.1` | 9092 | Message broker |
| `user-service` | Build `./user-service` | 8081, 50051 | Auth service |
| `inventory-service` | Build `./inventory-service` | 8082, 50052 | Products service |
| `order-service` | Build `./order-service` | 8083, 50053 | Orders service |
| `api-gateway` | Build `./api-gateway` | 8080 | HTTP entry point |
| `frontend` | Build `./frontend` | 8088→80 | Static file server |

> **Note:** `frontend/Dockerfile` is referenced in Compose but does not currently exist in the repository. The frontend can be served locally with `python -m http.server 5500` from the `frontend/` directory.

### Start-up order (manual)

```
inventory-service → user-service → order-service → api-gateway
```

order-service depends on inventory-service gRPC; api-gateway depends on all three gRPC ports.

### Configuration pattern

Each service uses the [`caarlos0/env`](https://github.com/caarlos0/env) library to parse environment variables into a typed config struct. Env files are layered:

1. `local.env.template` — committed example
2. `local.env` — created by the developer; gitignored
3. `.env` at the service root — gitignored
4. OS environment variables (highest priority)

Loaded via `godotenv` before struct parsing.

### Taskfile shortcuts (root)

```bash
task gateway    # cd api-gateway && go run ./cmd/main.go
task inventory  # cd inventory-service && go run ./cmd/main.go
task order      # cd order-service && go run ./cmd/main.go
task user       # cd user-service && go run ./cmd/main.go
```

Each service also has a `Taskfile.yaml` with a `task generate` command that runs `protoc` to regenerate Go protobuf/gRPC code under `protos/gen/golang/`.

---

## 7. Database Design

All three data services share a **single PostgreSQL database** named `flower_shop`. Schema is created automatically at service startup using `CREATE TABLE IF NOT EXISTS`.

### Tables

#### `users` (user-service)
| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT | From `user_auto_inc_ids` |
| `email` | TEXT | Unique |
| `password_hash` | TEXT | bcrypt |
| `name` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `products` (inventory-service)
| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT | From `inventory_auto_inc_ids` |
| `name` | TEXT | Indexed |
| `description` | TEXT | |
| `price` | NUMERIC | |
| `stock` | INTEGER | |
| `category` | TEXT | Indexed |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `orders` (order-service)
| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT | From `order_auto_inc_ids` |
| `user_id` | BIGINT | Indexed |
| `total_amount` | NUMERIC | |
| `status` | TEXT | Indexed; values: pending/paid/shipped/delivered/cancelled |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `order_items` (order-service)
| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT | |
| `order_id` | BIGINT | FK → `orders.id` |
| `product_id` | BIGINT | |
| `name` | TEXT | Snapshot of product name at order time |
| `price` | NUMERIC | Snapshot of price at order time |
| `quantity` | INTEGER | |
| `total_price` | NUMERIC | price × quantity |

### ID generation strategy

Each service has a dedicated auto-increment table (`user_auto_inc_ids`, `inventory_auto_inc_ids`, `order_auto_inc_ids`). IDs are generated with an `INSERT … ON CONFLICT DO UPDATE … RETURNING counter` pattern, ensuring no cross-service ID collisions within the shared database.

---

## 8. Messaging (Kafka)

| Topic | Producer | Consumer | Payload |
|-------|----------|----------|---------|
| `order.created` | order-service | inventory-service | `OrderCreatedEvent` (protobuf) |

### Order creation flow (hybrid sync + async)

1. **Synchronous (gRPC):** When an order is created, order-service calls inventory-service gRPC to fetch each product's current price and verify stock is sufficient.
2. **Async (Kafka):** After successful persistence, order-service publishes an `OrderCreatedEvent` to the `order.created` Kafka topic.
3. **Async consumer (Kafka):** inventory-service subscribes to `order.created` and calls `ProcessOrderLineItem` for each line: it re-fetches the product, checks `current.Stock >= qty`, and decrements stock.

> **Design risk:** Both the synchronous gRPC path and the asynchronous Kafka consumer can deduct stock. If both paths are active for the same order, **double deduction** may occur. The current code does not implement idempotency keys or a "deduct in one place only" guard. This is a known design risk to address before production use.

---

## 9. API Reference Summary

All endpoints are served by **api-gateway** at `http://localhost:8080/api/v1/`.

### Authentication

Protected endpoints require these HTTP headers:

```
X-Email: user@example.com
X-Password: plaintext_password
```

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Register a new user |
| GET | `/users/profile` | Yes | Get current user's profile |

### Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | No | List all products |
| GET | `/products/:id` | Yes | Get product by ID |
| POST | `/products` | Yes | Create product |
| PUT | `/products/:id` | Yes | Update product |
| DELETE | `/products/:id` | Yes | Delete product |

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | Yes | Create a new order |
| GET | `/orders` | Yes | List current user's orders |
| GET | `/orders/:id` | Yes | Get order by ID |
| PUT | `/orders/:id` | Yes | Update order status |

### Create Order request body

```json
{
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```

---

## 10. Key Algorithms & Domain Logic

### Order Status State Machine

Defined in `order-service/internal/domain/order.go`:

```
pending ──► paid ──► shipped ──► delivered
   │
   └──► cancelled
```

Terminal states: `delivered`, `cancelled` (no further transitions allowed).

The `CanTransitionOrderStatus(from, to)` function enforces valid transitions. Invalid transitions are rejected with an error before any database write.

### Distributed-safe ID generation

```sql
INSERT INTO {service}_auto_inc_ids (singleton, counter)
VALUES (1, 1)
ON CONFLICT (singleton) DO UPDATE SET counter = {service}_auto_inc_ids.counter + 1
RETURNING counter;
```

This avoids relying on PostgreSQL sequences that could produce conflicts when tables from multiple services share a single database.

### Order total computation

For each line item in a new order:
1. Call `inventory-service.GetProduct(productID)` over gRPC.
2. Verify `product.Stock >= requestedQuantity`.
3. Compute `item.TotalPrice = product.Price × quantity`.
4. Accumulate `order.TotalAmount += item.TotalPrice`.

### Password hashing

`user-service` uses **bcrypt** (`golang.org/x/crypto/bcrypt`) for all password storage. Passwords are never stored in plaintext.

### Hexagonal / Clean Architecture

All services follow a consistent layered layout:

- **Domain** — pure entities and business rules (no framework dependencies)
- **Use-case** — application orchestration, depends on repository/service interfaces
- **Adapter** — implementations of those interfaces (Postgres, gRPC, Kafka, HTTP, Mail)

This makes it straightforward to swap out infrastructure components (e.g., replace PostgreSQL with a different DB) without changing business logic.

---

## 11. Testing

### Test framework

- **Backend:** Go's built-in `testing` package + `stretchr/testify` (assertions, mocks)
- **Frontend:** No test harness in the repository

### Test files

| Service | Test File | Type |
|---------|-----------|------|
| user-service | `internal/app/app_test.go` | Unit |
| user-service | `internal/app/app_integration_test.go` | Integration |
| user-service | `internal/adapter/httpserver/server_test.go` | HTTP adapter |
| user-service | `internal/usecase/user_usecase_test.go` | Use-case unit |
| inventory-service | `internal/adapter/http/handler/health_test.go` | HTTP health |
| inventory-service | `internal/adapter/kafka/consumer_test.go` | Kafka consumer |
| order-service | `internal/adapter/http/handler/health_test.go` | HTTP health |
| order-service | `internal/domain/order_status_test.go` | Domain logic |

### Running tests

```bash
# Single service
cd user-service
go test ./...

# All services at once (Linux/macOS)
./scripts/go-test-all.sh

# All services at once (Windows)
./scripts/go-test-all.ps1
```

The test scripts set `GOPROXY=https://proxy.golang.org,direct` and `GOSUMDB=sum.golang.org` to avoid proxy configuration issues.

---

## 12. Build & Deployment

### Local development

```bash
# Start infrastructure
docker compose up -d postgres kafka zookeeper redis

# Run services individually (from each service directory)
go run ./cmd/main.go

# Or use Taskfile shortcuts (from repo root)
task inventory   # start first (order-service depends on it)
task user
task order
task gateway
```

### Docker (full stack)

```bash
docker compose up -d
```

Services will be available at:
- Frontend: `http://localhost:8088`
- API Gateway: `http://localhost:8080`
- user-service HTTP: `http://localhost:8081`
- inventory-service HTTP: `http://localhost:8082`
- order-service HTTP: `http://localhost:8083`

### Docker images

Each Go service uses a **multi-stage Alpine build**:

1. **Stage 1 (builder):** `golang:1.23-alpine` — copies source, runs `go build -o /app ./cmd/main.go` with `CGO_ENABLED=0`
2. **Stage 2 (runtime):** `alpine:latest` — copies only the compiled binary; creates a non-root `appuser`; exposes the service port; runs the binary

This produces small, secure images (no Go toolchain in the final image, non-root execution).

### Protobuf code generation

From any service directory that has a `Taskfile.yaml`:

```bash
task generate
```

This runs `protoc` with `--go_out` and `--go-grpc_out` plugins and outputs generated code to `protos/gen/golang/`. The api-gateway keeps copies of relevant protos under `pkg/protos/`.

---

## 13. Dependencies

### Go dependencies by service

| Service | Key dependencies |
|---------|-----------------|
| **api-gateway** | `gin v1.10.0`, `grpc v1.72.0`, `protobuf v1.36.6`, `caarlos0/env v10`, `godotenv v1.5.1` |
| **user-service** | `pgx/v5 v5.5.5`, `grpc v1.72.0`, `protobuf v1.36.6`, `bcrypt` (via `golang.org/x/crypto`), `testify v1.10.0`, `caarlos0/env v10`, `godotenv v1.5.1` |
| **inventory-service** | `gin v1.10.0`, `pgx/v5 v5.5.5`, `IBM/sarama v1.45.1` (Kafka), `grpc v1.72.0`, `protobuf v1.36.6` |
| **order-service** | `gin v1.10.0`, `pgx/v5 v5.5.5`, `IBM/sarama v1.45.1` (Kafka), `grpc v1.72.0`, `protobuf v1.36.6` |

All Go modules target **Go 1.23.5**.

### Frontend dependencies

- **Chart.js** — loaded from CDN (no local install); used in `analytics.html` for doughnut and bar charts
- No npm, no bundler, no lockfile

### Infrastructure versions

| Component | Version |
|-----------|---------|
| PostgreSQL | 16 |
| Kafka | Confluent Platform 7.6.1 |
| ZooKeeper | Confluent Platform 7.6.1 |
| Redis | latest |

---

## 14. Known Issues & Design Risks

| Issue | Severity | Description |
|-------|----------|-------------|
| **Double stock deduction** | High | order-service synchronously validates stock via gRPC, then publishes to Kafka. inventory-service consumes Kafka and also deducts stock. Both paths run for the same order, causing double-deduction if the Kafka consumer is active. Mitigation: pick one canonical deduction path (sync or async) and disable the other, or add an idempotency key / deduplication log. |
| **Plaintext credential auth** | High | `X-Email` / `X-Password` headers sent on every request — credentials travel with every API call. Suitable only for demo; replace with JWT or session tokens before production. |
| **Missing `frontend/Dockerfile`** | Medium | `docker-compose.yml` references `./frontend/Dockerfile` but the file does not exist. `docker compose up` will fail for the frontend service. |
| **No admin role enforcement** | Medium | Any authenticated user can currently create, update, or delete products. Role-based access control (RBAC) is not implemented in the gateway middleware. |
| **Redis not used** | Low | Redis is included in `docker-compose.yml` but no Go service currently reads from or writes to Redis. It adds an unused container. |
| **`sessionStorage` auth** | Low | Credentials stored in `sessionStorage` are cleared on tab close. Cart and favourites also use `sessionStorage` so they are lost on session end. |
| **Client-side product search** | Low | The frontend fetches all products and filters in the browser. For large catalogs this is inefficient; server-side filtering with `q` query param should be implemented. |

---

## 15. Future Improvement Suggestions

1. **Authentication:** Replace header-based auth with JWT (access + refresh tokens). The user-service gRPC already follows SSO-like patterns, making this a natural extension.

2. **Role-based access control:** Add a `role` field to users (`customer`, `admin`, `staff`). Expose it via the user profile endpoint and enforce it in the api-gateway middleware.

3. **Idempotent Kafka processing:** Add an `event_id` to `OrderCreatedEvent` and store processed IDs in a `processed_kafka_events` table in inventory-service to prevent double stock deduction.

4. **Server-side search and pagination:** Add `q`, `category`, `page`, `limit` query params to `GET /api/v1/products` and implement in inventory-service.

5. **Persistent cart and favourites:** Implement `POST/DELETE /api/v1/users/:id/favorites` and cart endpoints backed by Redis or PostgreSQL, and sync from `sessionStorage` on login.

6. **Frontend Dockerfile:** Create `frontend/Dockerfile` (e.g., using `nginx:alpine`) so `docker compose up` works end-to-end.

7. **Product images:** Add an `image_url` column to `products` and extend the product API to return it. The frontend already has a fallback image rotator in `product-images.js` ready for real URLs.

8. **Observability:** Add structured logging (e.g., `slog` or `zap`), distributed tracing (OpenTelemetry), and metrics (Prometheus) to all services.

9. **Expand test coverage:** Add integration tests for order-service and inventory-service; add frontend tests (e.g., Playwright for E2E smoke tests).

10. **gRPC health protocol:** Implement the standard [gRPC Health Checking Protocol](https://grpc.io/docs/guides/health-checking/) on all services for better Kubernetes/Compose readiness probe support.

---

*Report generated on May 2, 2026.*
