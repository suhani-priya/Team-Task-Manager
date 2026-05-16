# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Install deps first (layer cache)
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production backend ───────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into place so SERVE_STATIC=1 works
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Railway injects PORT automatically; fall back to 5000 locally
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/index.js"]
