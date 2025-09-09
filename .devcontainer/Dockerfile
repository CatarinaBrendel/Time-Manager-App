FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
    git build-essential python3 make g++ \
    libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libgtk-3-0 libnss3 libxss1 libasound2 xvfb sqlite3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# install pnpm once (as root)
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# create mountpoints with node ownership so named volumes inherit perms
RUN mkdir -p /workspace/node_modules /workspace/apps/frontend/node_modules \
    && chown -R node:node /workspace

USER node
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace
