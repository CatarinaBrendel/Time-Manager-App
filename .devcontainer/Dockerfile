FROM node:20-bullseye

# OS deps commonly needed by Electron/native modules
RUN apt-get update && apt-get install -y \
    git build-essential python3 make g++ \
    libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libgtk-3-0 libnss3 libxss1 libasound2 xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
