# ---------- Config ----------
COMPOSE := docker compose -f infra/docker-compose.local.yml
SERVICE := cli

# Default target
.PHONY: help
help:
	@echo "Time Manager — Docker CLI shortcuts"
	@echo ""
	@echo "make build        Build the CLI image"
	@echo "make rebuild      Rebuild without cache"
	@echo "make cli          Start an interactive shell in the CLI container"
	@echo "make run CMD=...  Run a one-off command in the container (e.g. CMD='pnpm -v')"
	@echo "make up           Start the CLI service detached (rarely needed)"
	@echo "make down         Stop and remove the CLI service"
	@echo "make install      Run pnpm install inside the container"
	@echo "make test         Run test suite inside the container"
	@echo "make lint         Run linter inside the container"
	@echo "make clean        Remove containers and the pnpm store volume"

# ---------- Build & Lifecycle ----------
.PHONY: build
build:
	$(COMPOSE) build

.PHONY: rebuild
rebuild:
	$(COMPOSE) build --no-cache

.PHONY: up
up:
	$(COMPOSE) up -d $(SERVICE)

.PHONY: down
down:
	$(COMPOSE) down

# ---------- Dev ergonomics ----------
.PHONY: cli
cli: build
	$(COMPOSE) run --rm $(SERVICE) bash

.PHONY: run
run: build
	@if [ -z "$(CMD)" ]; then \
		echo "Usage: make run CMD='your command'"; exit 1; \
	fi
	$(COMPOSE) run --rm $(SERVICE) bash -lc "$(CMD)"

# ---------- Common tasks ----------
.PHONY: install
install: build
	$(COMPOSE) run --rm $(SERVICE) bash -lc "pnpm install"

.PHONY: test
test: build
	$(COMPOSE) run --rm $(SERVICE) bash -lc "pnpm run test"

.PHONY: lint
lint: build
	$(COMPOSE) run --rm $(SERVICE) bash -lc "pnpm run lint"

# ---------- Cleanup ----------
.PHONY: clean
clean:
	$(COMPOSE) down -v
