# ========================================
# Time Manager — Dev & Docker Shortcuts
# ========================================

# --- Compose pointing to infra file ---
COMPOSE := docker compose -f infra/docker-compose.local.yml
SERVICE := cli

# --- Monorepo filter (frontend app path) ---
FILTER := ./apps/frontend

# -------- Help --------
.PHONY: help
help:
	@echo "Targets:"
	@echo "  build          Build the Docker image"
	@echo "  rebuild        Rebuild the Docker image (no cache)"
	@echo "  cli            Open a shell inside the CLI container"
	@echo "  run CMD=...    Run a one-off command inside the CLI container"
	@echo "  install        pnpm install (in container)"
	@echo "  dev-cli        Watch CSS/JS in container (no GUI)"
	@echo "  dev            Run full dev on host (GUI Electron + watch)"
	@echo "  start          Start Electron on host (after fetching Electron)"
	@echo "  fetch-electron Fetch Electron binaries on host"
	@echo "  clean          Remove containers + pnpm-store volume"

# -------- Docker lifecycle --------
.PHONY: build
build:
	$(COMPOSE) build

.PHONY: rebuild
rebuild:
	$(COMPOSE) build --no-cache

.PHONY: cli
cli: build
	$(COMPOSE) run --rm $(SERVICE) bash

.PHONY: run
run: build
	@if [ -z "$(CMD)" ]; then \
		echo "Usage: make run CMD='your command'"; exit 1; \
	fi
	$(COMPOSE) run --rm $(SERVICE) bash -lc "$(CMD)"

.PHONY: install
install: build
	$(COMPOSE) run --rm $(SERVICE) bash -lc "pnpm install"

# -------- Dev in container (no GUI) --------
.PHONY: dev-cli
dev-cli: build
	$(COMPOSE) run --rm $(SERVICE) bash -lc "pnpm --filter $(FILTER) run dev:cli"

# -------- Host (macOS) dev with GUI Electron --------
# These run pnpm directly on your host (outside Docker).
.PHONY: dev
dev:
	pnpm --filter $(FILTER) run dev

.PHONY: start
start:
	pnpm --filter $(FILTER) run start

.PHONY: fetch-electron
fetch-electron:
	pnpm --filter $(FILTER) run fetch:electron

# -------- SQLite helpers --------
# Was: apps/frontend/electron/backend/data/time_manager.db
DB_PATH := apps/frontend/data/time_manager.db


.PHONY: db-shell
db-shell: build
	# Open an interactive sqlite3 shell for the dev DB (inside the container)
	$(COMPOSE) run --rm $(SERVICE) bash -lc "sqlite3 $(DB_PATH)"

.PHONY: db-tables
db-tables: build
	# Quick list of tables
	$(COMPOSE) run --rm $(SERVICE) bash -lc "sqlite3 $(DB_PATH) '.tables'"

.PHONY: db-schema
db-schema: build
	# Full schema (all CREATE statements)
	$(COMPOSE) run --rm $(SERVICE) bash -lc \"sqlite3 $(DB_PATH) '.schema'\"

.PHONY: db-query
db-query: build
	# Run an ad-hoc SQL query: make db-query Q='SELECT * FROM meta_migrations;'
	@if [ -z "$(Q)" ]; then echo "Usage: make db-query Q='SELECT ...;'" && exit 1; fi
	$(COMPOSE) run --rm $(SERVICE) bash -lc "sqlite3 -cmd '.headers on' -cmd '.mode column' $(DB_PATH) \"$(Q)\""


# -------- Cleanup --------
.PHONY: clean
clean:
	$(COMPOSE) down -v

# -------- Production Pipeline --------
.PHONY: ci
ci:
	pnpm ci:prepare && pnpm ci:install && pnpm ci:lint && pnpm ci:build && pnpm ci:test

.PHONY: release-local
release-local:
	pnpm ci:build
	mkdir -p artifacts
	cp apps/frontend/renderer/index.html artifacts/
	cp apps/frontend/renderer/bundle.js artifacts/
	cp apps/frontend/renderer/tailwind.css artifacts/ || true
	tar -czf artifacts/frontend_bundle.tgz -C artifacts .
	tar -czf artifacts/sql_migrations.tgz -C apps/frontend/electron/backend/db/migrations .
	@echo "Artifacts in ./artifacts"

