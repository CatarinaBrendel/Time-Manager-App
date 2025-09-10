# ========================================
# Time Manager — Dev & Docker Shortcuts
# ========================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Allow local overrides without editing this file
-include .make.local

# ----- Docker Compose files -----
COMPOSE        := docker compose
ROOT_COMPOSE   ?= docker-compose.yml
LOCAL_COMPOSE  ?= infra/docker-compose.local.yml

# Which services to use by default
# - SERVICE: interactive/dev tasks (shell, run, install, db-*)
# - SERVICE_CI: CI pipeline tasks (lint/build/test)
SERVICE        ?= app
SERVICE_CI     ?= ci

PNPM_VOL       ?= pnpm-store

# Compose command shortcuts
DC  := $(COMPOSE) -f "$(ROOT_COMPOSE)" -f "$(LOCAL_COMPOSE)"   # root + local overlay
DCR := $(COMPOSE) -f "$(ROOT_COMPOSE)"                         # root only

# ----- Project paths -----
FILTER  ?= ./apps/frontend
DB_PATH ?= apps/frontend/data/time_manager.db

# -------- Helpers --------
.PHONY: help check-root check-local
help: ## Show this help
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z0-9_.-]+:.*##/{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check-root:
	@test -f "$(ROOT_COMPOSE)" || { echo "Missing $(ROOT_COMPOSE)"; exit 1; }

check-local:
	@test -f "$(LOCAL_COMPOSE)" || { echo "Missing $(LOCAL_COMPOSE)"; exit 1; }

# -------- Docker lifecycle (overlay: root + local) --------
.PHONY: build rebuild up ci-full ci-detach logs down clean shell
build: check-root check-local ## Build the Docker image(s) (overlay)
	$(DC) build

rebuild: check-root check-local ## Rebuild image(s) (no cache, overlay)
	$(DC) build --no-cache

up: check-root check-local ## Up (build if needed, overlay) for $(SERVICE)
	$(DC) up --build $(SERVICE)

ci-full: check-root check-local ## Run CI flow (overlay; stops when service exits)
	$(DC) up --build --abort-on-container-exit $(SERVICE_CI)
	@echo; printf '\033[32m%s\033[0m\n' '✔ CI finished (container)'; echo

ci-detach: check-root check-local ## Start CI service in background (overlay)
	$(DC) up -d --build $(SERVICE_CI)

logs: check-root check-local ## Tail logs (overlay) for $(SERVICE)
	$(DC) logs -f $(SERVICE)

down: check-root check-local ## Down (overlay; keep volumes)
	$(DC) down --remove-orphans

clean: check-root check-local ## Down + remove volumes (incl pnpm cache)
	-$(DC) down -v --remove-orphans
	-docker volume rm $(PNPM_VOL) 2>/dev/null || true

shell: check-root check-local ## Shell into $(SERVICE) (overlay)
	$(DC) run --rm --entrypoint bash $(SERVICE)

# -------- Root-only variants (use if you don’t want local overlay) --------
.PHONY: build-root up-root run-root shell-root logs-root down-root
build-root: check-root ## Build (root only)
	$(DCR) build

up-root: check-root ## Up (root only) for $(SERVICE)
	$(DCR) up --build $(SERVICE)

run-root: check-root ## Run one-off (root only): make run-root CMD='pnpm -v'
	@if [ -z "$(CMD)" ]; then echo "Usage: make run-root CMD='your command'"; exit 1; fi
	$(DCR) run --rm $(SERVICE) bash -lc "$(CMD)"

shell-root: check-root ## Shell (root only) for $(SERVICE)
	$(DCR) run --rm --entrypoint bash $(SERVICE)

logs-root: check-root ## Logs (root only) for $(SERVICE)
	$(DCR) logs -f $(SERVICE)

down-root: check-root ## Down (root only)
	$(DCR) down --remove-orphans

# -------- One-offs inside container (overlay by default) --------
.PHONY: cli run install dev-cli
cli: build ## Open a shell inside $(SERVICE) (overlay)
	$(DC) run --rm $(SERVICE) bash

run: build ## Run a one-off command (overlay): make run CMD='echo hi'
	@if [ -z "$(CMD)" ]; then echo "Usage: make run CMD='your command'"; exit 1; fi
	$(DC) run --rm $(SERVICE) bash -lc "$(CMD)"

install: build ## pnpm install (inside container, overlay)
	$(DC) run --rm $(SERVICE) bash -lc "pnpm install"

dev-cli: build ## Watch CSS/JS in container (headless, overlay)
	$(DC) run --rm $(SERVICE) bash -lc "pnpm --filter $(FILTER) run dev:cli"

# -------- Host (macOS) dev with GUI Electron --------
.PHONY: dev start fetch-electron
dev: ## Run full dev on host (GUI Electron + watch)
	pnpm --filter $(FILTER) run dev

start: ## Start Electron on host
	pnpm --filter $(FILTER) run start

fetch-electron: ## Fetch Electron binaries on host
	pnpm --filter $(FILTER) run fetch:electron

# -------- SQLite helpers (inside container; overlay) --------
.PHONY: db-shell db-tables db-schema db-query
db-shell: build ## Open sqlite3 shell for dev DB (container)
	$(DC) run --rm $(SERVICE) bash -lc "sqlite3 '$(DB_PATH)'"

db-tables: build ## List tables
	$(DC) run --rm $(SERVICE) bash -lc "sqlite3 '$(DB_PATH)' '.tables'"

db-schema: build ## Show full schema (CREATE statements)
	$(DC) run --rm $(SERVICE) bash -lc "sqlite3 '$(DB_PATH)' '.schema'"

db-query: build ## Ad-hoc query: make db-query Q='SELECT * FROM foo;'
	@if [ -z "$(Q)" ]; then echo "Usage: make db-query Q='SELECT ...;'" && exit 1; fi
	$(DC) run --rm $(SERVICE) bash -lc "sqlite3 -cmd '.headers on' -cmd '.mode column' '$(DB_PATH)' \"$(Q)\""

# -------- Production-ish helpers (host) --------
.PHONY: ci-host release-local release-verify
ci-host: ## Run host CI scripts (package.json)
	pnpm ci:prepare && pnpm ci:install && pnpm ci:lint && pnpm ci:build && pnpm ci:test

release-local: ## Build artifacts on host (ensures host-native deps)
	@set -euo pipefail; \
	SKIP_ELECTRON_REBUILD=1 pnpm install --frozen-lockfile; \
	pnpm --filter $(FILTER) run build; \
	mkdir -p artifacts; \
	rm -f artifacts/frontend_bundle.tgz artifacts/sql_migrations.tgz; \
	tar -czf artifacts/frontend_bundle.tgz \
		-C apps/frontend/renderer/dist .; \
	tar -czf artifacts/sql_migrations.tgz \
		-C apps/frontend/electron/backend/db/migrations .; \
	echo; \
	echo "-------------------------------------------"; \
	printf "\033[32m%s\033[0m\n" "✔ Build complete"; \
	echo "Artifacts created in ./artifacts:"; \
	echo "  - frontend_bundle.tgz      ($$(du -h artifacts/frontend_bundle.tgz | cut -f1))"; \
	echo "  - sql_migrations.tgz       ($$(du -h artifacts/sql_migrations.tgz | cut -f1))"; \
	echo "-------------------------------------------"; \
	echo "Next steps:"; \
	echo "  - make release-verify   # preview the archive contents"; \
	echo

release-verify: ## Preview artifact contents
	@echo "== frontend_bundle.tgz ==" && tar -tzf artifacts/frontend_bundle.tgz | sed -n '1,50p'
	@echo
	@echo "== sql_migrations.tgz ==" && tar -tzf artifacts/sql_migrations.tgz | sed -n '1,50p'

# -------- Lint (container) --------
.PHONY: ci-lint
ci-lint: check-root check-local ## Run ESLint in container (overlay)
	$(DC) run --rm $(SERVICE_CI) \
	bash -lc 'set -euo pipefail; \
	  if ! command -v pnpm >/dev/null 2>&1; then \
	    if command -v corepack >/dev/null 2>&1; then \
	      corepack enable; corepack prepare pnpm@latest --activate; \
	    else \
	      npm i -g pnpm@10; \
	    fi; \
	  fi; \
	  pnpm -v; \
	  SKIP_ELECTRON_REBUILD=1 pnpm install --frozen-lockfile; \
	  pnpm -r run --if-present lint'

# -------- Rebuild Electron native (host) --------
.PHONY: rebuild-electron
rebuild-electron: ## Rebuild better-sqlite3 for the vendored Electron (host)
	@EV="$$(./apps/frontend/vendor/electron/Electron.app/Contents/MacOS/Electron --version | sed 's/^v//')"; \
	echo "Rebuilding for Electron $$EV..."; \
	ARCH="$$(uname -m)"; [ "$$ARCH" = "x86_64" ] && ARCH=x64 || ARCH=arm64; \
	rm -rf node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build; \
	pnpm dlx @electron/rebuild -v "$$EV" -f -w better-sqlite3 --arch "$$ARCH"
