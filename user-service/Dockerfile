# syntax=docker/dockerfile:1

FROM golang:1.23.5-alpine AS builder
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/user-service ./cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata \
	&& adduser -D -u 65532 appuser
WORKDIR /app
COPY --from=builder /out/user-service .
USER appuser
# Defaults from local.env.template: gRPC 50051, HTTP health 8081 (override via env at run).
EXPOSE 8081 50051
ENTRYPOINT ["/app/user-service"]
