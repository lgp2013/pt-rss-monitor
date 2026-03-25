FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/index.html ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig*.json ./
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/pt-rss-monitor.json
ENV FRONTEND_DIST=/app/frontend-dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
