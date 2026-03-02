FROM node:20-alpine AS builder

WORKDIR /app/server

# better-sqlite3 ネイティブモジュールのビルドに必要
RUN apk add --no-cache python3 make g++

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# 本番用依存のみ再インストール
RUN npm ci --omit=dev

# --- Production ---
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tzdata

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY web ./web

ENV PORT=3002
ENV TZ=America/Los_Angeles

EXPOSE 3002

WORKDIR /app/server
CMD ["node", "dist/index.js"]
