# Project progress

Last reviewed: 2026-04-07.

## Purpose

A small business platform in Go: users, orders, and inventory as separate services, with Kafka for order-related notifications. APIs are gRPC with protos. HTTP handlers exist for some services but are not all wired in app startup.

## What is in the repo

User-service: gRPC auth (register, login, profile), MongoDB, bcrypt, SMTP.

Order-service: gRPC orders (create, get, update, list), PostgreSQL persistence, Kafka producer on topic order.created, gRPC client to inventory.

Inventory-service: gRPC product APIs, MongoDB, Kafka consumer on order.created.

Api-gateway: HTTP gateway into the system.

Docker-compose: Postgres, Redis, Zookeeper, Kafka. Mongo is not in compose; run it locally or add it.

## Flow

Clients talk to services over gRPC (and the gateway over HTTP). Order-service calls inventory over gRPC and sends events to Kafka; inventory-service consumes those events.

## Quality notes

Code is layered as domain, usecase, and adapters (gRPC, persistence, Kafka). Proto-generated Go is checked in; use Task to regenerate after proto edits.

Order-service includes order status rules, request validation, and safer shutdown wiring for gRPC clients and Kafka. Inventory use case validates product fields and normalizes list pagination. Some unit tests exist around order status rules; more coverage is possible.

## Follow-ups

Add Mongo to docker-compose or document a single local Mongo URL for new contributors.

Turn on HTTP servers in app wiring where they exist but are commented out.

Optional: CI, stricter security between services, and Redis if you add caching or sessions.

Version details live in each go.mod; bump Last reviewed when you change the architecture or storage.
