# Simulated CI/CLI environment for Time Manager (no GUI)
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bullseye

# System deps for native modules (better-sqlite3), and sqlite CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack-managed pnpm (ships with Node 20+)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Optional: show versions on container start (handy in CI logs)
ENV CI=true \
    PNPM_HOME=/usr/local/share/pnpm

# ----- Safe creation/renaming of dev user/group (handles existing 1000:1000) -----
ARG USERNAME=dev
ARG USER_UID=1000
ARG USER_GID=1000

RUN set -eux; \
    # Ensure group with GID exists and is named ${USERNAME}
    if getent group "${USER_GID}" >/dev/null; then \
    EXISTING_GRP="$(getent group "${USER_GID}" | cut -d: -f1)"; \
    if [ "${EXISTING_GRP}" != "${USERNAME}" ]; then \
    groupmod -n "${USERNAME}" "${EXISTING_GRP}"; \
    fi; \
    else \
    groupadd --gid "${USER_GID}" "${USERNAME}"; \
    fi; \
    \
    # Ensure user with UID exists and is named ${USERNAME}, in the target group
    if getent passwd "${USER_UID}" >/dev/null; then \
    EXISTING_USR="$(getent passwd "${USER_UID}" | cut -d: -f1)"; \
    if [ "${EXISTING_USR}" != "${USERNAME}" ]; then \
    usermod -l "${USERNAME}" "${EXISTING_USR}" || true; \
    fi; \
    usermod -g "${USER_GID}" "${USERNAME}" || true; \
    # Ensure home is /home/${USERNAME}
    USR_HOME="$(getent passwd "${USERNAME}" | cut -d: -f6)"; \
    if [ "${USR_HOME}" != "/home/${USERNAME}" ]; then \
    usermod -d "/home/${USERNAME}" -m "${USERNAME}" || true; \
    fi; \
    else \
    useradd --uid "${USER_UID}" --gid "${USER_GID}" -m "${USERNAME}"; \
    fi

# Workspace folder
WORKDIR /workspace
USER ${USERNAME}

# Default entry prints tool versions; override with `docker run ... <cmd>`
CMD node -v && pnpm -v && sqlite3 --version && bash
