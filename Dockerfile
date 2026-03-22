# Stage 1: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig*.json ./
COPY frontend/index.html ./
COPY frontend/src ./src
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy and install backend dependencies
COPY --from=backend-builder /app/backend/package*.json ./
RUN npm ci --only=production

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
