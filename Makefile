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
FILTER       ?= ./apps/frontend
DB_PATH      ?= apps/frontend/data/time_manager.db
BACKEND_DIR  := apps/frontend/electron/backend
FRONTEND_DIR := apps/frontend

# ----- Schema / index / seed scripts
SCHEMA_SQL   ?= apps/frontend/electron/backend/db/migrations/01_schema.sql
INDEXES_SQL  ?= apps/frontend/electron/backend/db/migrations/02_indexes.sql
DEV_SEED_SQL ?= apps/frontend/electron/backend/db/dev_data.sql

# ----- Container workdir & absolute DB path (inside container) -----
WORKDIR      ?= /workspace
DB_ABS       := $(WORKDIR)/$(DB_PATH)

# ----- Portable sqlite3 installer (Debian/Ubuntu or Alpine) -----
define INSTALL_SQLITE
set -euo pipefail; \
if command -v sqlite3 >/dev/null 2>&1; then \
  echo "sqlite3 already installed"; \
elif command -v apt-get >/dev/null 2>&1; then \
  apt-get update -qq && apt-get install -y -qq sqlite3 >/dev/null; \
elif command -v apk >/dev/null 2>&1; then \
  apk add --no-cache sqlite >/dev/null; \
else \
  echo "No known package manager to install sqlite3"; exit 1; \
fi
endef
export INSTALL_SQLITE

# -------- Helpers --------
.PHONY: help check-root check-local
help: ## Show this help
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z0-9_.-]+:.*##/{printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

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
	$(DC) run --rm $(SERVICE) bash -lc "pnpm -w install --frozen-lockfile || pnpm -w install"

dev-cli: build ## Watch CSS/JS in container (headless, overlay)
	$(DC) run --rm $(SERVICE) bash -lc "pnpm --filter $(FILTER) run dev:cli"

# -------- Host (macOS) dev with GUI Electron --------
.PHONY: dev start prepare-dev rebuild-sqlite

dev: ## GUI dev (Vite + Electron)
	pnpm --filter $(FILTER) run dev

start: ## Start Electron app
	pnpm --filter $(FILTER) run start

# Only if you need to run Node-only code that imports better-sqlite3
rebuild-sqlite: ## Rebuild better-sqlite3 for host Node ABI
	pnpm --filter $(FILTER) run rebuild:sqlite

# -------- SQLite helpers (inside container; overlay) --------
.PHONY: db-tables db-schema db-which db-exec db-query db-diagnose db-wipe db-init db-seed

db-tables: check-root check-local ## List tables (inside Docker)
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE; cd "$(WORKDIR)"; sqlite3 -readonly "$(DB_ABS)" ".tables"'

db-schema: check-root check-local ## Show full schema (inside Docker)
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE; cd "$(WORKDIR)"; sqlite3 -readonly "$(DB_ABS)" ".schema"'

db-which: check-root check-local ## Show database_list (inside Docker)
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE >/dev/null; cd "$(WORKDIR)"; sqlite3 -readonly "$(DB_ABS)" "PRAGMA database_list;"'

db-exec: check-root check-local ## Write query inside Docker: make db-exec SERVICE=cli Q="INSERT ..."
	@if [ -z "$(Q)" ]; then echo "Usage: make db-exec SERVICE=cli Q=\"INSERT ...;\""; exit 1; fi
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE >/dev/null; su node -s /bin/bash -lc "cd \"$(WORKDIR)\" && printf %s \"$(Q)\" | sqlite3 \"$(DB_ABS)\" && echo OK"'

db-query: check-root check-local ## Ad-hoc query: make db-query Q='SELECT * FROM tasks;'
	@if [ -z "$(Q)" ]; then echo "Usage: make db-query Q='SELECT ...;'" && exit 1; fi
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE; cd "$(WORKDIR)"; sqlite3 -readonly -cmd ".headers on" -cmd ".mode column" "$(DB_ABS)" "$$(printf %s "$(Q)")"'

db-diagnose: check-root check-local ## One-shot: path, journal, insert, count
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE >/dev/null; su node -s /bin/bash -lc "\
	  set -e; cd \"$(WORKDIR)\"; \
	  sqlite3 -echo -bail \"$(DB_ABS)\" \
	    \"PRAGMA database_list; \
	     PRAGMA journal_mode; \
	     SELECT COUNT(*) AS before_n FROM tasks; \
	     INSERT INTO tasks (title, description, status) VALUES (\\\"diag insert\\\",\\\"via target\\\",\\\"todo\\\"); \
	     SELECT changes() AS changed; \
	     SELECT COUNT(*) AS after_n FROM tasks;\" "'
 
db-wipe: check-root check-local ## Remove the dev DB file (inside container)
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc 'cd "$(WORKDIR)"; rm -f "$(DB_ABS)"; echo "✔ Removed $(DB_ABS)"'

db-init: check-root check-local ## Create fresh DB: schema + indexes (inside container)
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE; cd "$(WORKDIR)"; \
	sqlite3 "$(DB_ABS)" ".read apps/frontend/electron/backend/db/01_schema.sql"; \
	sqlite3 "$(DB_ABS)" ".read apps/frontend/electron/backend/db/02_indexes.sql"; \
	echo "✔ Initialized schema + indexes at $(DB_ABS)"'

db-seed: check-root check-local ## Seed dev data (runs after db-init)
	COMPOSE_PROFILES=dev $(DC) run --rm --user root $(SERVICE) \
	bash -lc '$$INSTALL_SQLITE; cd "$(WORKDIR)"; \
	[ -f "$(DB_ABS)" ] || { echo "DB not found. Run: make db-init SERVICE=$(SERVICE)"; exit 1; }; \
	sqlite3 "$(DB_ABS)" ".read apps/frontend/electron/backend/db/dev_seed_data.sql"; \
	echo "✔ Seeded dev data into $(DB_ABS)"'

# -------- In-app DB helpers (HOST, no Docker) --------
.PHONY: app-db-wipe app-db-init app-db-seed app-db-refresh app-db-schema app-db-tables

app-db-wipe: ## Remove the local in-app DB file (HOST)
	@rm -f "$(DB_PATH)"
	@echo "✔ Removed $(DB_PATH)"

app-db-init: ## Create fresh in-app DB with schema + indexes (HOST)
	@if ! command -v sqlite3 >/dev/null 2>&1; then echo "sqlite3 not found on host. Install it or use docker-based targets."; exit 1; fi
	@mkdir -p "$(dir $(DB_PATH))"
	@sqlite3 "$(DB_PATH)" ".read $(SCHEMA_SQL)"
	@sqlite3 "$(DB_PATH)" ".read $(INDEXES_SQL)"
	@echo "✔ Initialized schema + indexes at $(DB_PATH)"

app-db-seed: ## Seed DEV data into in-app DB (HOST)
	@if ! command -v sqlite3 >/dev/null 2>&1; then echo "sqlite3 not found on host. Install it or use docker-based targets."; exit 1; fi
	@test -f "$(DB_PATH)" || { echo "DB not found. Run: make app-db-init"; exit 1; }
	@sqlite3 "$(DB_PATH)" ".read $(DEV_SEED_SQL)"
	@echo "✔ Seeded dev data into $(DB_PATH)"

app-db-refresh: ## WIPE → INIT → SEED the in-app DB (HOST)
	@$(MAKE) app-db-wipe
	@$(MAKE) app-db-init
	@$(MAKE) app-db-seed

app-db-schema: ## Show full schema of in-app DB (HOST)
	@sqlite3 -readonly "$(DB_PATH)" ".schema"

app-db-tables: ## List tables of in-app DB (HOST)
	@sqlite3 -readonly "$(DB_PATH)" ".tables"

# -------- Production-ish helpers (host) --------
.PHONY: ci-host release-local release-verify
ci-host: ## Run host CI scripts (package.json)
	pnpm ci:prepare && pnpm ci:install && pnpm ci:lint && pnpm ci:build && pnpm ci:test

# GitHub Actions sanity check
release-local: ## Local CI: lint, build, smoke-check, package (mirrors CI)
	@set -euo pipefail; \
	echo "== Hard clean =="; \
	rm -rf node_modules ; \
	rm -rf ~/.cache/node-gyp ~/.npm/_npx ~/.electron-gyp || true ; \
	\
	echo "== Install (frozen) =="; \
	SKIP_ELECTRON_REBUILD=1 pnpm install --frozen-lockfile; \
	\
	echo "== Rebuild native modules for Electron =="; \
	cd apps/frontend && pnpm dlx @electron/rebuild -v 38.0.0 -f -w better-sqlite3 ; cd - >/dev/null; \
	\
	echo "== Lint =="; \
	pnpm --filter $(FILTER) run lint; \
	\
	echo "== Build renderer (Vite) =="; \
	pnpm --filter $(FILTER) run build; \
	\
	echo "== Backend: smoke migrations =="; \
	node $(BACKEND_DIR)/db/migrate.js || true; \
	\
	echo "== Backend: tests =="; \
	cd $(BACKEND_DIR) && pnpm run test || true; cd - >/dev/null; \
	\
	echo "== Package artifacts =="; \
	mkdir -p artifacts; \
	rm -f artifacts/frontend_bundle.tgz artifacts/sql_migrations.tgz; \
	tar -czf artifacts/frontend_bundle.tgz \
		-C apps/frontend/renderer/dist .; \
	tar -czf artifacts/sql_migrations.tgz \
		-C apps/frontend/electron/backend/db/migrations .; \
	echo; \
	echo "-------------------------------------------"; \
	printf "\033[32m%s\033[0m\n" "✔ Local CI build complete"; \
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
	  if ! command -v pnpm >/dev/null 21; then \
	    if command -v corepack >/dev/null 21; then \
	      corepack enable; corepack prepare pnpm@latest --activate; \
	    else \
	      npm i -g pnpm@10; \
	    fi; \
	  fi; \
	  pnpm -v; \
	  SKIP_ELECTRON_REBUILD=1 pnpm install --frozen-lockfile; \
	  pnpm -r run --if-present lint'

# -------- Rebuild Electron native (host) --------
.PHONY: rebuild-electron rebuild-sqlite abi doctor
rebuild-electron: ## Rebuild better-sqlite3 for Electron (vendor or devDep, auto-detect)
	@set -euo pipefail; \
	if [ -x "./$(FRONTEND_DIR)/vendor/electron/Electron.app/Contents/MacOS/Electron" ]; then \
	  EV="$$(./$(FRONTEND_DIR)/vendor/electron/Electron.app/Contents/MacOS/Electron --version | sed 's/^v//')"; \
	else \
	  EV="$$(pnpm --filter $(FILTER) exec electron --version 2>/dev/null | sed 's/^v//')"; \
	fi; \
	if [ -z "$$EV" ]; then echo "Electron not found (vendor or devDependency). Run 'pnpm --filter $(FILTER) add -D electron' or 'make fetch-electron'."; exit 1; fi; \
	echo "Rebuilding for Electron $$EV..."; \
	ARCH="$$(uname -m)"; [ "$$ARCH" = "x86_64" ] && ARCH=x64 || ARCH=arm64; \
	rm -rf node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build; \
	pnpm dlx @electron/rebuild -v "$$EV" -f -w better-sqlite3 --arch "$$ARCH"

rebuild-sqlite: ## Rebuild better-sqlite3 using package script (dynamic Electron)
	pnpm --filter $(FILTER) run rebuild:sqlite

abi: ## Print Node/Electron versions and ABI
	@echo "node:     $$(node -v)"; \
	echo "pnpm:     $$(pnpm -v)"; \
	echo "electron: $$(pnpm --filter $(FILTER) exec electron --version 2>/dev/null || echo 'not-installed')"; \
	echo "ABI:      $$(ELECTRON_RUN_AS_NODE=1 pnpm --filter $(FILTER) exec electron -p \"process.versions.modules\" 2>/dev/null || echo 'n/a')"

doctor: ## Quick env sanity: versions and where better-sqlite3 resolves
	@set -e; \
	echo "== Versions =="; \
	$(MAKE) abi; \
	echo; \
	echo "== better-sqlite3 path (node) =="; \
	node -e "try{console.log(require.resolve('better-sqlite3'))}catch(e){console.log('not found')}" || true; \
	echo "== better-sqlite3 load under Electron =="; \
	ELECTRON_RUN_AS_NODE=1 pnpm --filter $(FILTER) exec electron -e "try{require('better-sqlite3');console.log('OK under Electron (ABI='+process.versions.modules+')')}catch(e){console.error(e.message)}" || true

# -------- Backend tests with a rebuild --------
.PHONY: dev-test
dev-test:
	docker compose --progress=plain -f docker-compose.test.yml build
	docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from tests
