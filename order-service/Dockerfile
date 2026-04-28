# syntax=docker/dockerfile:1

FROM golang:1.23.5-alpine AS builder
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/order-service ./cmd/main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 65532 appuser
WORKDIR /app
COPY --from=builder /out/order-service .
USER appuser
EXPOSE 8083 50053
ENTRYPOINT ["/app/order-service"]
