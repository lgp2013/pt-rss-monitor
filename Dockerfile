# Stage 1: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Use Chinese npm mirror
RUN npm config set registry https://registry.npmmirror.com

COPY backend/package*.json ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Use Chinese npm mirror
RUN npm config set registry https://registry.npmmirror.com

COPY frontend/package*.json ./
RUN npm install
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig*.json ./
COPY frontend/index.html ./
COPY frontend/src ./src
RUN npm run build

# Stage 3: Production
FROM node:20-slim AS production

WORKDIR /app

# Install build dependencies for better-sqlite3
# Use Tsinghua Debian mirror for CN network speed (http, no cert issues)
RUN echo 'deb http://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main non-free-firmware' > /etc/apt/sources.list && \
    echo 'deb http://mirrors.tuna.tsinghua.edu.cn/debian-security/ bookworm-security main non-free-firmware' >> /etc/apt/sources.list && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y --no-install-recommends \
        python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Use Chinese npm mirror
RUN npm config set registry https://registry.npmmirror.com

# Copy and install backend dependencies
COPY --from=backend-builder /app/backend/package*.json ./
RUN npm install --only=production

# Copy backend build
COPY --from=backend-builder /app/backend/dist ./dist

# Copy frontend dist
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Create data directory
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/pt-rss-monitor.db
ENV FRONTEND_DIST=/app/frontend-dist

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
