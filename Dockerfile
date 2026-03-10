# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies for both project root and web-app
COPY package*.json ./
RUN npm install

COPY web-app/package*.json ./web-app/
RUN cd web-app && npm install

# Copy source and build
COPY . .
RUN npx tsc
RUN cd web-app && npm run build

# Production stage
FROM node:20-slim

# Install system dependencies
# - ca-certificates for SSL
# - chromium for browser tools
# - golang for building youtube-uploader-mcp (linux version)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    chromium \
    golang \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web-app/dist ./web-app-dist
COPY --from=builder /app/SKILLS ./SKILLS
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Install youtube-uploader-mcp (Linux version via Go)
RUN go install github.com/anwerj/youtube-uploader-mcp@latest
# O binário vai estar em /root/go/bin/youtube-uploader-mcp
# Vamos copiar para SKILLS para manter o padrão ou apenas referenciar
RUN mkdir -p /app/SKILLS/youtube/bin && \
    cp /root/go/bin/youtube-uploader-mcp /app/SKILLS/youtube/bin/youtube-uploader-mcp

# Garante permissões
RUN chmod +x /app/SKILLS/google/bin/gog_linux && \
    chmod +x /app/SKILLS/youtube/bin/youtube-uploader-mcp && \
    chmod +x /app/entrypoint.sh

# Create data directory
RUN mkdir -p /app/data && chmod -R 777 /app/data

# Environment variables
ENV PORT=5000
ENV NODE_ENV=production
ENV XDG_CONFIG_HOME=/app/data
ENV GOG_KEYRING_BACKEND=file
ENV GOG_KEYRING_PASSWORD=opendluz_secret
ENV YOUTUBE_MCP_PATH="./SKILLS/youtube/bin/youtube-uploader-mcp"

EXPOSE 5000

ENTRYPOINT ["/bin/bash", "./entrypoint.sh"]
